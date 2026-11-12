---
title: "Day 3: Learning System Design"
description: "My learning notes on distributed coordination, leader election, locks, consensus, service discovery, ZooKeeper, and etcd."
pubDate: "2026-11-11"
tags: ["system design", "learning in public", "distributed systems"]
---

Today I learned about coordination in distributed systems: how machines choose responsibilities, agree on decisions, and find one another. These notes cover the idea behind each approach and where tools such as ZooKeeper and etcd fit.

## Coordination between machines

Coordination means organizing how separate processes work together around shared decisions or resources. A local variable or an in-process lock can't coordinate copies of an application running on different servers.

Suppose servers A, B, and C can all generate the same daily report. If each independently starts the job, they may duplicate work or overwrite the same output. They need a way to decide who should act.

Failures make this harder. If A stops responding, B can't immediately know whether A crashed, paused, or lost its network connection. A timeout is a reason to suspect a failure, not proof that A stopped working.

### Leader election

Leader election selects one process to take a coordinating role. Other processes follow its decisions for that role, and a replacement can be chosen when leadership is lost.

For the report system, A could be the scheduler that assigns jobs to workers. If A becomes unavailable, the remaining processes use the election protocol to select a replacement. The leader doesn't have to perform every job itself.

The normal case and a replacement election look like this:

![A leader assigns work, and a replacement takes over through an election when the previous leader becomes unreachable.](/images/blog/system-design-day-3/leader-election-notebook.webp)

A former leader may still believe it is in charge after a pause or network failure. The system must prevent outdated leaders from making conflicting changes. Choosing a leader alone doesn't make every later operation safe.

### Distributed locks

A distributed lock coordinates exclusive access to a named resource across processes. It can let one worker at a time update a particular report, while other workers handle different reports.

Two approaches to handling concurrent changes are **pessimistic locking** and **optimistic locking**. Despite its name, optimistic locking usually checks for conflicts without holding an exclusive lock while the application prepares its change.

#### Pessimistic locking

Acquire the lock before working on the shared resource. Other processes requesting the same exclusive lock must wait or retry until ownership is released.

Workers request the same lock from a shared coordination service. The owner proceeds; others wait or retry. Ownership is released when the work finishes. Some designs use a **lease**, which expires unless renewed, so a failed owner doesn't block everyone forever.

For example, A acquires `report:daily` while B waits:


![Two workers share one lock service so only the current owner is allowed to update the report.](/images/blog/system-design-day-3/pessimistic-locking-notebook.webp)

An expired lease doesn't stop a paused worker from waking up and continuing. **Fencing tokens** can help: the storage system checks increasing ownership numbers and rejects writes from an older owner. A lock also doesn't guarantee a job runs exactly once; retries may still repeat completed work.

#### Optimistic locking

Read the data and its version, prepare a change, then save it only if the version is still the same. The storage system must check the version and apply the update as one atomic operation. If another process changed the data first, reject the stale update and let the application reread and retry if appropriate.

For example, A and B both read a report record at version `3`:

```text
A saves with expected version 3 → succeeds; version becomes 4.
B saves with expected version 3 → rejected; current version is 4.
```

B doesn't silently overwrite A's work. It must read the new state before deciding what to do next.

The two save attempts have different outcomes:


![A saves first and advances the version to four; B cannot overwrite it using version three.](/images/blog/system-design-day-3/optimistic-locking-notebook.webp)

This approach avoids holding a lock during the read-and-prepare work and is useful when conflicts are uncommon. Frequent conflicts can cause repeated retries. A version check on a record also doesn't undo an external action, such as an email already sent.

Pessimistic locking reserves access before the work; optimistic locking detects conflicting changes when saving. These are concurrency-control approaches, rather than two different consensus protocols.

### Service discovery

Service discovery lets applications find the addresses of service instances as they start, stop, or move.

One approach uses a registry. Instances register their addresses, and clients or proxies consult that registry and watch for changes. Leases, sessions, or health checks help remove outdated registrations.

A report scheduler might look up `report-worker` instead of keeping worker addresses in its code:


![A registry lets the scheduler discover workers without hard-coding their addresses.](/images/blog/system-design-day-3/service-discovery-notebook.webp)

A listed instance can fail immediately after discovery. Clients still need connection-failure handling, and retries must account for operations that might already have succeeded. Discovery finds candidates; it doesn't guarantee availability or assign a leader.

## Agreement through consensus

Consensus lets participating processes agree on a proposed value without choosing conflicting values for the same decision.

For example, a coordination cluster could agree that a particular lock belongs to worker A. If its replicas independently granted that lock to different workers, it wouldn't provide reliable coordination.

I came across **Raft** and **Paxos** as protocols for solving consensus. I haven't studied how they work yet, so these notes only mention them.

## Tools that provide coordination

ZooKeeper and etcd are services that applications can use to share small pieces of coordination data, such as worker addresses, settings, or who currently owns a lock. They run across several servers so the coordination data doesn't depend on just one machine.

They provide building blocks for coordination. The application still decides what the stored information means and how to react when it changes.

### ZooKeeper

ZooKeeper organizes small data records into paths, similar to files and folders. Applications can create records, read or update them, and ask to be notified when something changes. Those records are called **znodes**.

For example, our report workers could register their addresses:

```text
/report-workers/worker-b → 10.0.0.2:8080
/report-workers/worker-c → 10.0.0.3:8080
```

The scheduler reads these records to find workers. A worker can create a temporary record tied to its session with ZooKeeper. If that session expires, ZooKeeper removes the record, and the scheduler can learn that the worker's registration is gone.

The registration tree changes after the session expires:


![ZooKeeper removes worker B’s temporary registration after its session expires, leaving worker C registered.](/images/blog/system-design-day-3/zookeeper-registration-notebook.webp)

Applications can also use ZooKeeper's operations to build leader election and locks. It is intended for coordination data, rather than storing the generated reports themselves. A missing response doesn't remove a registration immediately; the session must expire first.

### etcd

etcd stores data as **key-value pairs**: a name and its associated value. Applications can read and update these values, receive change notifications, and make conditional updates that succeed only if the stored data still matches an expected value or version.

For example, two schedulers could try to claim the same report:

```text
Key: /reports/daily/owner
Value: scheduler-a
```

Each asks etcd to create the key only if it doesn't already exist. etcd checks that condition and performs the write together, so only one claim succeeds. A separate read followed by an unconditional write wouldn't provide the same protection.

Only the first conditional claim succeeds:

![etcd accepts scheduler A’s conditional claim and rejects scheduler B’s attempt without changing the owner.](/images/blog/system-design-day-3/etcd-ownership-notebook.webp)

A key can be attached to a **lease**, a time-limited registration that must be renewed. If the lease expires, etcd removes the key. etcd also provides lock and election APIs, and uses Raft internally to keep its copies of the data coordinated.

The basic distinction is the data model: ZooKeeper exposes a tree of records, while etcd exposes keys and values. Both can support coordination. Neither automatically stops an application that has lost ownership from continuing to work; the application must handle that case.
