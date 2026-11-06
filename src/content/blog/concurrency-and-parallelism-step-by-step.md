---
title: "Concurrency and Parallelism, Step by Step"
description: "A simple guide to concurrency and parallelism, the problems they bring, and how locks, atomics, and common patterns help."
pubDate: "2026-11-05"
---

You're buying something online, and the payment is taking a while. While you wait, someone else opens the shop to check a price. Should they have to wait for your payment to finish before the shop can answer?

We want the shop to keep handling requests while other work is still in progress. But now there's only one item left, and two customers try to buy it. If both orders check the stock before either updates it, both could see that item as available. We could sell it twice.

That's what I want to work through here: how we let tasks make progress without getting the wrong result when they work with the same data. We'll use the shop to explore locks, atomics, and ways to arrange the work. First, though, does handling several requests mean the computer has to do several things at exactly the same moment?

## Concurrency and parallelism: what's the difference?

Imagine one worker handling orders in our shop. They send a payment request, but the payment service hasn't replied yet. While they wait, they check the stock for another order.

Both orders are now in progress. The worker still handles one step at a time; they don't need to finish one whole order before starting another. That's **concurrency**: tasks make progress over overlapping periods. Here, a task is a piece of work, such as handling an order.

Now give the shop a second worker. One can check the stock for an order while the other checks a different order, at the same moment. That's **parallelism**: work actually runs at the same time.

Here are the two arrangements side by side:

![One core alternates work between overlapping tasks, while two cores execute work from different tasks at the same time.](/images/blog/concurrency/concurrency-vs-parallelism-notebook.webp)

On a computer, a processor core is a part of the CPU that executes instructions. Even with one core, a program can handle overlapping tasks by switching between them. When one task is waiting for a payment reply, another can use the core. With multiple cores, instructions from different tasks can also execute at the same time.

Our shop can use both: keep many orders in progress and use several cores to work on some of them in parallel. But neither approach tells us which order gets the last item.

## When two tasks share the same data

Let's keep the stock count in a variable in our program's memory. More than one task can read or change it, so it's **shared data**. We'll start with just one copy of the shop program running; coordinating several servers is a separate problem.

To accept an order, we read the count, check that it's above zero, and save a new count with one item removed. If one order finishes all of that before another checks, we get the result we'd expect.

What if the second order reads the stock before the first saves its change? Follow the reads and writes here:

![Two orders both read stock one and later save zero, accepting two purchases for one item.](/images/blog/concurrency/shared-stock-race-notebook.webp)

Both orders succeed. We only had one item.

Order B did its calculation using the value it read earlier. When it writes zero, it isn't taking a second look at the stock. It's saving an answer it already worked out. The stock ends at zero, so that number alone doesn't even reveal the extra sale.

This is a **race condition**: whether the program behaves correctly depends on how the tasks' steps overlap. It can happen on a single core too. One task can pause after reading the stock, let another run, then continue using its earlier value.

The gap is between checking and changing the stock. We need to keep another order from changing it between those steps.

## Protecting shared data with a lock

An order can take a lock before checking the stock and keep it until the update is finished. Another order needing the same lock has to wait.

That's what a **mutex** lets us do. The name is short for mutual exclusion: only one task can hold this lock at a time. Let's give both orders the same stock lock and follow them again:

![Order B waits for the stock lock before reading, sees zero after Order A's update, and rejects the purchase.](/images/blog/concurrency/stock-mutex-notebook.webp)

Notice when Order B reads. It waits before checking, so it sees the stock after Order A's change. Only one order gets the item.

The code inside that protection is called a **critical section**. Here's ours in pseudocode, which describes the steps without using a particular programming language:

```text
with stock_lock held:
    if stock > 0:
        stock = stock - 1
        reserved = true
    else:
        reserved = false
```

Here, `with` takes the lock before the block and releases it when we leave, including if an error occurs. Many languages have a way to manage that for us.

Could we check the stock outside the lock and protect only the subtraction? Both orders could still read 1 and decide to proceed. Taking turns afterward wouldn't fix the decision they already made. We need the check and update together.

Every task accessing this stock must follow the same locking rule. The lock doesn't stop code that ignores it, and this in-memory lock doesn't coordinate separate copies of the program on different servers. Those copies would need coordination through something they share, such as a database.

We've made one order wait for another. That solves our race, but waiting brings its own problems. What happens if the task we're waiting for is also waiting for us?

## When tasks wait forever: deadlock

A transfer between two accounts needs to subtract from one balance and add to the other. Here, both balances live in our program's memory, and each account has its own lock. Before moving money, a transfer needs both locks.

Nora sends money to Sami while Sami sends money to Nora. We decide to lock the account we're taking money from first. That sounds reasonable, until the two transfers overlap:

![Nora's transfer holds account lock seventeen and waits for forty-two, while Sami's holds forty-two and waits for seventeen.](/images/blog/concurrency/transfer-deadlock-notebook.webp)

Nora's transfer can't continue until Sami's lock is released. Sami's transfer can't continue until Nora's lock is released. Neither reaches the code that releases its lock. This is a **deadlock**.

Giving them more time won't help. Something would have to break the wait, such as a cancellation path that safely gives up and releases the lock it holds.

We can prevent this cycle by giving each account a unique number and always locking the smaller number first, regardless of which direction the money moves.

If Nora's account is 17 and Sami's is 42, both transfers ask for lock 17 first. One gets it; the other waits without holding lock 42. The first can take lock 42, finish, and release both. Then the other can proceed.

Here's one possible schedule when both transfers follow that rule:

![Both transfers request locks in the same order, so one waits without holding the second lock and the other can finish.](/images/blog/concurrency/consistent-lock-order-notebook.webp)

Every transfer must follow that order for this prevention rule to work. We've removed this cycle, but tasks can still spend a long time waiting for a busy lock.

## When a lock becomes a bottleneck

Back in the shop, we take the stock lock, set aside an item, and request payment. If we keep the lock while waiting for the payment service, other orders needing that lock have to wait for the reply too. Their stock checks may be quick, yet they're stuck behind a network request. This competition for a lock is called **lock contention**.

The payment service doesn't need access to our stock variable. We can finish the stock changes and release the lock before asking it to charge the customer. Compare the order of the steps:

![Releasing the stock lock after recording a reservation lets another order check stock while payment is still pending.](/images/blog/concurrency/short-critical-section-notebook.webp)

By reserving an item, I mean reducing the available count and recording which order holds it. Both changes happen under the lock. Once we've done that, another order can check what's left while payment is in progress.

If payment fails, we take the lock again and cancel the reservation, returning the item to stock only once. A timeout alone doesn't confirm failure: the payment may have happened even though we received no reply. We'd need to resolve that before deciding what to do with the item.

For our stock lock, the useful change is small: protect the check and reservation, then let go. Other orders no longer wait for payment.

## Updating a counter with atomics

Let's count completed orders. Each time one finishes, we add one:

```text
completed_orders = completed_orders + 1
```

It looks like one step. An ordinary increment, though, isn't guaranteed to happen as one indivisible operation. A task can read the value, add one, and write its answer. If two tasks both read 8, both can write 9. Two orders finished, but we counted one.

We could put a lock around those steps. We can also ask for an **atomic increment**: the read and increase happen as one indivisible operation. Compare what happens with ordinary and atomic increments:

![Ordinary overlapping increments can leave nine from a starting value of eight, while two atomic increments produce ten.](/images/blog/concurrency/atomic-counter-notebook.webp)

Two atomic increments starting from 8 leave us with 10. Neither addition gets lost.

Here's an atomic counter in pseudocode:

```text
completed_orders = AtomicInteger(0)

on each completed order:
    completed_orders.fetch_add(1)
```

`fetch_add(1)` adds one atomically and returns the previous value. We don't use the returned value here. The names differ between languages, but the operation we're asking for is the same.

Could we make the stock atomic too and remove its lock? Let's try an atomic read followed by an atomic subtraction. Both orders could still read 1 and decide there's stock. Each then subtracts one. The count reaches −1, and we've accepted two orders again.

Each operation was atomic. The check and subtraction together weren't. Our completed-order counter only needed one increment; claiming an item needs an update that depends on the count still being available.

## Change it only if it hasn't changed

We want to make this whole request atomic: “I read 1. Set it to 0, but only if it's still 1.”

**Compare-and-swap**, or **CAS**, does the comparison and update as one operation. If the current value matches what we expected, it replaces it. Otherwise, it leaves the value alone and reports failure. Here's what that changes for our two orders:

![The first conditional stock update succeeds, and the second fails without writing because its expected value is stale.](/images/blog/concurrency/stock-compare-and-swap-notebook.webp)

Order B can't replace the count using its earlier expectation. Its attempt fails, so it reads again before deciding what to do. In this case, there's nothing left to claim.

We can put those steps in a retry loop. In this pseudocode, `compare_and_swap` returns true on success and false on failure:

```text
repeat:
    available = stock.load()

    if available <= 0:
        return sold_out

    if stock.compare_and_swap(available, available - 1):
        return item_claimed

    # The attempt failed. Read again and retry.
```

We only treat the item as claimed after the update succeeds. Charging the customer before that point could leave them paying for an item another order got.

This solves the count update. CAS on the stock alone doesn't also update the reservation record we added earlier to track which order owns the item. Keeping those changes together still needs coordination. For that full reservation, I'd keep the lock rather than assume one atomic counter protects everything.

Retries cost work too. If many tasks keep changing the count, an attempt can fail repeatedly. Whether this helps performance depends on the work and the implementation; choosing atomics isn't a guarantee of faster code.

## Producer–consumer: passing work through a queue

Once an order is confirmed, we need to send an email. If we do that inside the request handling the order, the customer waits while we talk to the email service. Handing the email work to another task would let us reply sooner.

We can put an email job in a queue. A worker takes jobs from the queue and sends them. The task adding work is the **producer**, and the one doing it is the **consumer**. This arrangement is called producer–consumer:

![Order requests enqueue email jobs for a separate worker, and a full bounded queue makes a producer wait for space.](/images/blog/concurrency/producer-consumer-queue-notebook.webp)

While the worker sends one email, later jobs wait in the queue. The order request can finish after handing over its job; the email doesn't have to be sent before we reply.

The queue itself is shared data. Several requests might add jobs while the worker takes one, so we'd use a queue designed for concurrent access. Replacing it with an ordinary list would leave us solving coordination again.

If orders arrive faster than we can send emails, the queue grows. We can give it a size limit, then decide what producers do when it's full. They might wait for space, or we might refuse new work and ask callers to retry. Letting the receiving side slow the sending side is called **backpressure**.

Handing work over also means deciding how it survives failures. A queue held only in memory can lose pending jobs when the program stops. If we promise an email, we need to save the work somewhere it can survive a restart and recover unfinished jobs. Retries need care too: an email may have been sent before its worker stopped, so repeating the job could send it twice. A queue alone doesn't guarantee one delivery.

Our queue gives the email worker somewhere to find work. If one worker can't keep up, we can let several take jobs from it.

## Worker pools: putting a limit on active work

We could add two more workers. Each takes a job when it's free, processes it, then returns for another. Reusing a group like this gives us a **worker pool**. Here's our queue with three workers:

![Three reusable workers each process a different email job while later jobs wait in one shared queue.](/images/blog/concurrency/email-worker-pool-notebook.webp)

The queue assigns each entry to one worker when it's taken, so the workers take different entries. As we saw with the email queue, a retry can still repeat a job.

If each worker handles one job at a time, we can have three email jobs in progress. While one waits for a reply, the others can proceed. That's useful even if the workers don't execute instructions in parallel.

Starting a new worker for every email could overwhelm the service or exhaust our program's memory and connections. A pool limits active jobs. We still need the queue's size limit too; three busy workers don't prevent a million waiting jobs from using memory.

I'd increase the pool size only after checking where time goes. If the email service is already rejecting requests, more workers may produce more errors. If most workers are waiting and the service has room, more concurrency may help.

## Pipelines: splitting work into stages

The email workers all do the same job. Other work has distinct stages, each needing the previous one's result.

Consider the shop's product photos. For each upload, we check that it's a supported image, resize it, and save the result. We can't resize an image before we've checked it, or save the resized result before it's ready. We can, though, resize one image while another is being saved.

We can arrange the work as a **pipeline**, with queues connecting its stages:

![Different product photos occupy checking, resizing, and saving stages at once, while a full downstream queue can make an earlier stage wait.](/images/blog/concurrency/product-image-pipeline-notebook.webp)

One image still goes through the stages in order. Different images can be at different stages, as the shoe, jacket, and bag photos are in the diagram.

Now the check stage doesn't have to wait for the bag photo to be saved before starting the shoe photo. Each stage can have its own worker pool too. If resizing is holding things up, we might give it more workers, provided the machine and later stages can handle the extra work.

If saving is slow instead, resized images pile up before that stage. With a bounded queue, resizing eventually waits for space, and checking may have to wait in turn. That's backpressure travelling through the pipeline.

A rejected image leaves the pipeline with an error for its uploader; it doesn't continue to resizing. Later stages should only receive items they can process.

The overlap can help us finish more images over time. One image still needs every stage and may wait in queues, so it won't necessarily finish sooner.

## Fork–join: split the work, then combine the results

Our image stages depend on each other. Now consider a calculation we can split into independent pieces: totaling the value of completed orders for a report.

We've already loaded a fixed set of orders into memory, and nothing changes them during the calculation. We could give three tasks a different group each and ask for subtotals. Once they're finished, we'd add their answers:

![Three independent groups return local subtotals of one hundred twenty, eighty-five, and one hundred ninety-five cents, which are combined after all finish to produce four hundred cents.](/images/blog/concurrency/report-fork-join-notebook.webp)

That's **fork–join**. We split one job into tasks, then wait for their results and combine them. Every order belongs to exactly one group, so we neither miss an amount nor count it twice. Here we're adding whole cents to avoid floating-point rounding differences.

Notice that each task keeps its own subtotal. We don't have three tasks changing one running total, so we avoid the counter race. The final addition happens after the subtotals are ready.

With separate cores, the tasks can calculate in parallel. A worker pool could run the pieces without creating a new worker for each one. But for a small list, splitting and coordinating the work could take longer than one task doing the addition.

We also have to wait for the slowest piece. A failed task means we don't have a complete total; its missing answer can't be treated as zero.

## Message passing: give the data an owner

The report was easier to coordinate because each task had its own subtotal. We can also reduce shared access to stock by choosing one task to manage it.

Let's give one inventory task ownership of the stock and reservation records. Order tasks send it requests such as “reserve one shoe for order 73” and wait for a reply. They don't read or change its data themselves.

This is **message passing**. Requests reach the owner through a queue, often called a mailbox:

![A single inventory owner processes reservation messages in sequence, keeping stock private and replying separately to each order.](/images/blog/concurrency/inventory-message-owner-notebook.webp)

The inventory task handles one message at a time. It checks the stock, reduces the count if possible, and records the reservation before starting the next message. Two requests for the last item now take turns: the first processed gets it; the second sees no stock left.

We don't need a stock lock around that code if this task is the only one accessing the data and finishes one reservation before starting another. The mailbox still needs safe coordination, and sending a message mustn't give another task a way to change the owner's private data.

Adding more inventory workers as we did for emails would bring us back to shared data if they changed the same stock. We'd need a new plan, such as assigning each product to exactly one owner.

The duplicate-work problem from our email queue matters here too: repeating a request mustn't reserve another item. A unique request ID lets the owner recognize a retry and return the saved result. That result and the stock change need to survive a restart together.

We've changed where coordination happens. Order tasks ask for changes, and the owner decides how to apply them. A busy owner can still become a bottleneck, but we have one place to follow the rules for its inventory.

## How do we choose?

I'd start by asking where the time goes. Our email jobs spend time waiting for a service. That's **I/O-bound** work: input or output, such as network communication, limits progress. Letting other jobs proceed during those waits can help.

Resizing images spends time calculating. That's **CPU-bound** work: processing capacity limits progress. Independent work on several cores may help, if the calculation is large enough to justify splitting it up.

Then I'd follow the data. Can each task work on its own input, as our report tasks did? If they share changing data, who owns it? Which decisions and updates have to stay together?

These questions give us a starting point:

| What we need                                      | An approach to consider            | What to watch for                                           |
| ------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Keep related changes to shared data together      | A lock around the critical section | Long waits, inconsistent lock order                         |
| Update a single shared counter                    | An atomic increment                | Several atomic operations don't form one protected sequence |
| Update a value only if it matches our expectation | Compare-and-swap with retries      | Repeated attempts and other data left unprotected           |
| Hand work to another task                         | Producer–consumer with a queue     | Queue growth, lost jobs, retries                            |
| Limit active jobs                                 | A worker pool                      | Overloading a service or leaving too much work queued       |
| Process items through dependent stages            | A pipeline                         | One stage holding up the rest                               |
| Split a calculation into independent pieces       | Fork–join                          | Coordination costs, uneven pieces, failures                 |
| Give changing data one owner                      | Message passing                    | A busy owner, missing replies, duplicate requests           |

We can combine these approaches. A pipeline can have worker pools at its stages. A queue may use locks internally. They answer different questions about the same program.

I'd keep the simplest arrangement that gives the right result, then measure completed work, waiting time, and resource use before adding more concurrency. Extra email workers won't help a service that's already at capacity.

## Back to the last item

Both orders looked reasonable on their own: check the stock, see one item, accept the purchase. The bug appeared when we followed their steps together. Order B made its decision using a count that Order A had already changed.

When you look at a concurrent program, follow a value the way we followed that stock count. Who reads it? What can change before they act? If a task waits, fails, or retries, what happens next? Those questions help explain how two reasonable-looking orders could both buy the same last item.
