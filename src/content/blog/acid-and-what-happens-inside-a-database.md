---
title: "ACID and what happens inside a database"
description: "A closer look at transactions, isolation, locking, MVCC, and how databases keep committed data after a crash."
pubDate: "2026-10-29"
---

You send a query to a database, it runs, and you get a result. Most of the time, that's all you need to think about.

But what happens if your next query fails, and the two were supposed to work together? What if another request changes the data while you're still using it? Or the database tells you it saved your changes, then the machine loses power?

These are the problems I want to look at here. ACID gives us four properties to reason about them: atomicity, consistency, isolation, and durability. We'll go through the problems first, then look at what the database does underneath to handle them.

Let's start with a transaction.

## First, what is a transaction?

Imagine you're building a transfer between two bank accounts. You need to subtract money from one account and add it to the other.

That's two updates, but do you want them to succeed independently? If the subtraction works and the addition fails, the money leaves one account without arriving in the other. You can't tell the user the transfer was half successful and leave it there.

We need to tell the database that these updates belong together. That's what a **transaction** lets us do: group database operations into one unit of work. It can contain one statement or several.

What if you're only reading data? You can use a transaction for that too. A **read-only transaction** groups reads without changing the stored data. Imagine building an account page: one query reads the balance, and another reads the recent transfers.

While those queries run, someone could complete a new transfer. You might read the balance before it happens, then read the transfer list after it happens. Both queries worked, but the page now combines information from two different moments.

A transaction gives us a boundary around those reads. Whether they share one stable view of the data depends on the isolation level; starting a transaction alone doesn't guarantee that. We'll come back to this when we look at isolation.

For our transfer, we start the transaction, run our updates, and commit if the transfer succeeds. If we can't finish it, we roll back and cancel its changes. The property that keeps us from saving half a transfer is atomicity.

## Atomicity

Atomicity means that a transaction's changes are committed together or discarded together. For our transfer, either both updates take effect or neither does.

You might wonder: what if each query is already a transaction? Wouldn't that be enough?

The problem is where we draw the boundary. If the subtraction commits in its own transaction, it's already finished before we try the addition. A rollback of the second transaction won't cancel the first. We need one transaction around both updates.

Let's move 10 between accounts starting at 100 and 50. These are the two outcomes our transaction allows:

![A committed transfer leaves account A at 90 and B at 60. A rollback restores A to 100 and B to 50.](/images/blog/acid/atomicity-notebook.webp)

There is one detail worth being careful with: a failed statement doesn't automatically roll back the whole transaction in every database. Our application needs to handle the error and make sure it doesn't commit incomplete work. In PostgreSQL, we use `BEGIN` to start a transaction, `COMMIT` to finish it successfully, and `ROLLBACK` to cancel it.

### How can the database undo a change?

From our side, rollback is just a command. But think about what we're asking the database to do. We've already told it to change a balance. How does it know what to put back?

It needs to keep information about the changes it makes. MySQL's InnoDB, for example, uses **undo logs**. An undo record contains the information needed to reverse a change to a row. When a transaction rolls back, InnoDB uses those records to undo its work.

For one balance update, the undo path looks like this:

![A balance changes from 100 to 90 while undo information is kept. Rollback uses that information to restore 100.](/images/blog/acid/undo-notebook.webp)

Undo information can also help reconstruct older row versions for readers, which we'll come back to when we reach isolation.

What about PostgreSQL? For ordinary row updates, it takes a different approach. Suppose our balance is 100 and a transaction changes it to 90. PostgreSQL creates a new row version containing 90 and keeps the old version containing 100.

PostgreSQL tracks which transaction made the change and whether it committed or rolled back. That lets it decide whether the new version can be used as committed data.

Now suppose our update rolls back. PostgreSQL treats its transaction as aborted. The version containing 90 isn't accepted as committed data, and the aborted update doesn't hide the old version containing 100. It doesn't need to copy 100 back over 90 to restore the row's visible value.

Here's what happens to the two versions when that update is rolled back:

![PostgreSQL keeps the old balance of 100 and creates a new version containing 90. After the updating transaction aborts, the old version remains visible and the new version is invisible and can be cleaned up.](/images/blog/acid/postgres-rollback-notebook.webp)

You might wonder whether the cancelled version stays there forever. It can remain physically stored for a while, even though readers can't use it. Cleanup, including `VACUUM`, makes space from dead row versions available for reuse. Rollback doesn't have to wait for that cleanup.

There's another way to keep the old data safe: **copy-on-write**. Instead of changing an existing data page, the engine writes a changed copy somewhere else. A page is a block of stored data, so this works at a different level from the individual row versions we just discussed.

Let's use the same balance again. The committed page contains 100. To change it to 90, the engine prepares a new page containing that change, leaving the committed page untouched. It doesn't need to copy the whole database; unchanged parts can be shared.

But now we have two pages. How does the engine know which one belongs to the committed database? It keeps a reference to the current committed structure. Once the new pages are safely written, the commit publishes the new structure. If we abort instead, it keeps the previous committed structure and abandons the new work.

Follow the two possible outcomes here. The existing page stays untouched while we prepare the change:

![Copy-on-write keeps the committed page containing 100 while preparing a separate page containing 90. Commit publishes the new structure; abort keeps the previous committed structure and abandons the new work.](/images/blog/acid/copy-on-write-notebook.webp)

So in this case, rollback doesn't have to restore an overwritten value. The transaction never replaced the committed page in the first place. Space from abandoned work can be reused later.

These approaches can overlap with other mechanisms inside an engine. The useful difference here is what makes rollback possible: undo information to reverse a change, transaction status to reject an aborted row version, or an intact committed structure we haven't replaced.

## Consistency

Our transaction keeps the two updates together. Suppose both succeed and we commit. Does that automatically mean the data is correct?

We could still have a bug that subtracts one amount and adds a different amount. The transaction completed, but it broke our rule: moving money between these accounts should preserve their combined balance. **Consistency** is about preserving the rules that make the database state valid.

The database can enforce rules we declare as constraints. A foreign key can stop us from referring to an owner who doesn't exist. A unique constraint can prevent duplicate account numbers. `NOT NULL` can require a value, and a check constraint can restrict allowed values. These are concrete ways to reject invalid data.

But the database doesn't automatically know that our application intended to transfer a particular amount to a particular person. We still have to write the correct transaction. Atomicity can save all our changes together, even when our code asked for the wrong changes.

## Isolation

So far, we've looked at keeping the transfer together and preserving its rules. Now let's bring in another request working with the same accounts.

What happens if another request reads that account while we're changing it? Or if both requests read its balance and then calculate a new value?

This is where isolation matters. It controls how transactions interact and what they can see of each other's work. Let's call our transactions T1 and T2, and follow a few ways their steps can overlap.

### Dirty reads

Suppose T2 updates a balance but hasn't committed yet. T1 reads the new balance and uses it in a calculation. So far, that might seem fine: T1 got the newer value.

Now T2 fails and rolls back. What happens to the value T1 used? It belongs to a change that was cancelled. T1 has already made a decision using data that never became committed data. That's a **dirty read**.

Follow the steps from top to bottom. This diagram shows both transactions so we can compare them; each transaction only reads the data its isolation rules allow:

![T2 writes an uncommitted balance of 90. T1 reads it. T2 rolls back to 100, but T1 has already used 90.](/images/blog/acid/dirty-read-notebook.webp)

We can prevent this by stopping transactions from reading each other's uncommitted changes. That fixes dirty reads. Let's see what can still happen even when we follow that rule.

### Non-repeatable reads

T1 reads a balance. While T1 is still working, T2 updates that balance and commits. Then T1 reads the same account again.

Should T1 get the old value or the new one? If it gets the new value, it has now seen two different values for the same row inside one transaction. That's a **non-repeatable read**.

Here is the same row being read before and after T2 commits:

![T1 reads 100. T2 writes 90 and commits. T1 reads again and gets 90 within the same transaction.](/images/blog/acid/non-repeatable-read-notebook.webp)

Notice that neither read was dirty. Both values were committed when T1 read them. We solved the previous problem, but if our calculation needs the same balance throughout the transaction, we still don't have enough protection.

### Phantom reads

Now let's change the query. Instead of asking for one account, T1 asks for all accounts with a balance above a certain amount.

T2 inserts a new account that matches our condition and commits. T1 runs its query again. Same query, but now there's an extra row. Where did that come from?

Let's make that new row visible. The condition stays the same in both queries:

![T1 queries accounts with balances above 100 and gets A and B. T2 inserts matching account C and commits. T1 repeats the query and gets A, B, and C.](/images/blog/acid/phantom-read-notebook.webp)

That's a **phantom read**. We're seeing a change in which rows match the query. A row can also disappear from the result if another transaction deletes it or changes it so it no longer matches. With a non-repeatable read, we were following the value in a row. Here, we're following the set of matching rows.

### Lost updates

Let's say a value starts at 10, and two requests each want to add 5. Both read the value into application memory, calculate the result, then write that result back.

Without protection against this pattern, we can get this sequence. Watch when each request reads the value, compared with when it writes:

![T1 and T2 both read 10 and calculate 15. T1 writes 15 and commits. T2 then writes its calculated 15 and commits, leaving 15 instead of 20.](/images/blog/acid/lost-update-notebook.webp)

Both requests did their addition correctly: 10 plus 5 is 15. The problem is that T2 calculated its answer before T1's change. It then wrote that old calculation back over the value T1 had saved. One addition was lost.

This doesn't mean every concurrent addition loses an update. Asking the database to add 5 to the current value is different from writing a value our application calculated earlier. The statement we use, the database, and the isolation level all matter.

### Isolation levels

At this point, you might ask why the database doesn't just prevent all of these problems. It can provide stronger protection, but that can change how much work transactions need to do and how often they have to wait or retry. Databases expose isolation levels so we can choose the guarantees our application needs.

#### Read uncommitted

Read uncommitted is the lowest of the four standard isolation levels. It allows a transaction to read changes made by another transaction before those changes are committed. The data we read might still be rolled back, so we can end up using a value that never becomes committed data.

That's why this level permits dirty reads. It also permits non-repeatable reads and phantom reads. It gives us the fewest guarantees about what we'll see while other transactions are working.

#### Read committed

Read committed adds one rule: a transaction must not read another transaction's uncommitted changes. This prevents dirty reads, because we don't use someone else's changes before they commit.

But committed doesn't mean fixed for the whole transaction. A later read can see changes that another transaction committed after an earlier read. So non-repeatable reads and phantom reads are still possible. The guarantee is that we avoid unfinished changes, not that all our reads share one stable view.

#### Repeatable read

Repeatable read goes further by keeping other transactions' committed changes from changing the values of rows we've already read when we read them again. It prevents both dirty reads and non-repeatable reads.

The distinction here is between values in rows we've read and the set of rows matching a query. Under the SQL standard, repeatable read can still allow phantom reads: repeating a query can return a new matching row. Some engines provide stronger protection and prevent phantoms too.

These guarantees concern changes made by other transactions. Our transaction can still see changes it makes itself.

#### Serializable

Serializable is the highest of the four standard isolation levels. Its goal is to make concurrent transactions behave as if they ran one at a time in some order. This applies to their reads and writes together, including decisions based on several rows.

It prevents dirty reads, non-repeatable reads, and phantom reads, as well as other interactions that couldn't happen in a serial execution. Keeping a stable view of the data alone isn't enough to provide that guarantee.

The database can still run transactions concurrently. It must control their interactions so the committed execution fits a serial order. Depending on the implementation, this can involve making operations wait or aborting a transaction that cannot safely commit. Our application then needs to retry the whole transaction, including its reads and decisions.

Here are the minimum protections for the three read problems we discussed. An engine can provide more protection than this table requires:

| Isolation level  | Dirty reads | Non-repeatable reads | Phantom reads |
| ---------------- | ----------- | -------------------- | ------------- |
| Read uncommitted | Allowed     | Allowed              | Allowed       |
| Read committed   | Prevented   | Allowed              | Allowed       |
| Repeatable read  | Prevented   | Prevented            | Allowed       |
| Serializable     | Prevented   | Prevented            | Prevented     |

This table isn't a complete list of concurrency problems. In particular, don't use it alone to decide whether your read-then-write code can lose an update. The statements you run and the engine's conflict handling matter too.

The table describes the standard's minimum guarantees. PostgreSQL treats read uncommitted as read committed, and its repeatable read also prevents phantoms. Defaults differ too: PostgreSQL uses read committed, while MySQL InnoDB defaults to repeatable read.

Stronger isolation may require more waiting, more conflict tracking, or more retries. The cost depends on what our transactions do and how often they conflict. We need to know which behavior our application can accept before choosing a level.

## How does the database provide isolation?

We've talked about what a transaction should be allowed to see. How does the database actually control that? Let's return to our examples and look at locking and versioning.

### Locking

Remember the two requests that both read 10 and wrote 15? One way to stop that is to make the second request wait before it reads.

T1 takes a lock on the row before reading it. T2 must take the same kind of lock before doing its own read and update, so it waits. T1 reads 10, writes 15, and commits, releasing the lock. Now T2 can read 15 and add its own 5. We end up with 20.

Compare that with the lost-update timeline. This time, T2 waits before reading:

![T1 locks the row, reads 10, writes 15, and commits. T2 waits for the lock, then reads 15, writes 20, and commits.](/images/blog/acid/locking-notebook.webp)

This approach is called pessimistic locking. We prevent the conflict by controlling access in advance. The cost is that transactions can spend time waiting for each other.

What if we'd rather let the work proceed and check for a conflict when we write? That's the idea behind **optimistic concurrency control**.

For example, a row can have a version number. We read the value and its version, then make our update conditional on that version still matching. If another transaction changed the row and advanced its version, our update doesn't match. We can reload the data and retry instead of silently overwriting the other transaction's work.

That check has to be part of the update itself. Checking first and updating separately would leave another gap where someone could change the row.

### MVCC

Locking gives us a way to make conflicting operations wait. But consider a request that only wants to read an account while another transaction is updating it. Could we let the reader use the last committed value instead of waiting for the update?

That's the idea behind **multiversion concurrency control**, or MVCC. The database keeps multiple versions of a row. While a writer creates a newer version, a reader can use an older committed one. Touching the same row doesn't always mean they have to wait for each other.

Here is a reader using the committed value while another transaction works on a newer version:

![A row has committed balance 100 and a newer uncommitted balance 90. Another transaction reads 100 while the writer works on 90.](/images/blog/acid/mvcc-notebook.webp)

A snapshot determines which changes a reader can see. It isn't a full copy of the database made for each transaction. The engine uses row versions and transaction information to find the version visible to that reader. PostgreSQL uses this multiversion model.

Now think back to the non-repeatable read. If every statement gets a fresh snapshot, a second read can see changes committed since the first. If successive reads keep the same snapshot, they keep the same view of other transactions' changes. PostgreSQL uses the first behavior for read committed and the second for repeatable read. The versioning mechanism is there in both cases; the visibility rules change.

MVCC doesn't remove the need for locks or conflict handling. Two transactions trying to update the same row still need coordination. Also, snapshot isolation alone isn't the same as serializable isolation: a stable view doesn't prevent every conflicting decision transactions can make.

## Durability

Our transfer finishes, the database confirms the commit, and we tell the user it worked. A moment later, the machine crashes.

When it starts again, we expect the transfer to still be there. That's durability.

But where were those changes when we got the reply? Had every changed row already reached its final place on disk? Not necessarily. First, let's look at what a file write actually tells us.

### The operating system's cache

You ask the operating system to write some bytes to a file. The call succeeds. It's natural to think those bytes are now on disk, but they may still be sitting in a memory cache.

Here's the path from the application to storage, with a memory cache in between:

![An application write can return after bytes reach the OS memory cache. Those bytes need to reach persistent storage to survive power loss.](/images/blog/acid/os-cache-notebook.webp)

This is useful. The OS can combine writes and send them to the device later instead of handling every small write immediately. But if power disappears while the data exists only in memory, that data is lost.

So “the write returned successfully” and “the data can survive a power failure” aren't always the same thing. Databases use operations such as `fsync` to request that writes reach persistent storage. The storage device also has to honor those requests.

### Write-ahead logging

We could insist on writing every changed piece of data to its final location before confirming each commit. But a transaction can touch several places. Can we save enough information to recover the work, then finish those writes later?

That's what **write-ahead logging**, or WAL, makes possible. The database writes records describing changes to a log. The required log records must reach persistent storage before the corresponding changed data pages do. A data page is a block the database uses to store data.

For a durable WAL-based commit, the database persists the required log records before replying with success. It doesn't need to finish writing every changed page to its final location first.

Now imagine the crash happens just after that reply. Some pages still contain old data. Have we lost the transfer? We have the log, so recovery can replay the necessary changes. That's why saving the log first matters.

Follow the order here: the log reaches persistent storage before the application hears that the commit succeeded:

![Persist WAL, acknowledge the commit, crash before every data page is flushed, then replay necessary changes from WAL during recovery.](/images/blog/acid/wal-recovery-notebook.webp)

This is also useful for performance. Writing a log sequentially can be cheaper than flushing many separate data pages for each transaction, and several commits can share a log flush. That's part of the reason WAL is useful, beyond recovery.

Durability still depends on configuration and storage. If we choose settings that acknowledge commits before the log is safely persisted, we accept a window where a crash can lose acknowledged work. It also doesn't protect the only copy of our data from a destroyed disk.

A network failure is a separate issue. The database might commit, then lose the connection before its reply reaches us. Our application doesn't know whether it succeeded, even though the database has saved the transaction. Retrying blindly can create another problem.

## Putting the pieces together

Think back to the transfer we started with. We needed to keep two updates together, handle other requests touching the same accounts, preserve our rules, and keep the result after a crash. Those needs led us through the four ACID properties.

Underneath those guarantees, the database has work to do. It keeps information for rollback, coordinates access with locks and row versions, checks declared constraints, and saves recovery records before confirming a durable commit.

The details differ between engines and settings. But now, when your query waits for another transaction or a commit takes longer than you expected, you can ask a more useful question: what work is the database doing to keep its promise?

## Resources

- [PostgreSQL — transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [MySQL InnoDB — undo logs](https://dev.mysql.com/doc/refman/8.4/en/innodb-undo-logs.html)
- [PostgreSQL — vacuuming and row version cleanup](https://www.postgresql.org/docs/current/routine-vacuuming.html#VACUUM-FOR-SPACE-RECOVERY)
- [LMDB — copy-on-write design](https://github.com/LMDB/lmdb/blob/mdb.master/libraries/liblmdb/lmdb.h)
- [CouchDB — storage and commit process](https://docs.couchdb.com/en/latest/intro/overview.html)
- [PostgreSQL — transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [MySQL InnoDB — transaction isolation levels](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html)
- [Microsoft — optimistic concurrency](https://learn.microsoft.com/en-us/sql/connect/ado-net/optimistic-concurrency?view=sql-server-ver17)
- [PostgreSQL — multiversion concurrency control (MVCC)](https://www.postgresql.org/docs/current/mvcc-intro.html)
- [PostgreSQL — constraints](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [PostgreSQL — reliability and storage caches](https://www.postgresql.org/docs/16/wal-reliability.html)
- [PostgreSQL — write-ahead logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html)
