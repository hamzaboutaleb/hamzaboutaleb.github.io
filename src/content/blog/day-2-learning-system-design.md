---
title: "Day 2: Learning System Design"
description: "My learning notes on time, logical clocks, event ordering, and consistency: definitions, mechanisms, examples, and limitations."
pubDate: "2026-11-09"
tags: ["system design", "learning in public", "distributed systems"]
---

My notes from day two: why time is difficult across machines, how logical clocks track events, and the differences between ordering and consistency.

## Time and clocks

### Time in distributed systems

Physical time is what a machine's clock measures. Different machines may show different times.

Computers measure elapsed time by counting pulses from hardware oscillators, often based on a quartz crystal. An electronic circuit keeps the crystal vibrating near a particular frequency and produces a repeating electrical signal. For example, many real-time clocks use a `32,768 Hz` crystal: counting `32,768` cycles corresponds to one second at the intended frequency. Other computer timers can use different frequencies, but the counting idea is the same.

The frequency isn't perfectly stable. Manufacturing differences, temperature changes, and aging can make the oscillator run slightly faster or slower. If it runs fast, the counter reaches its “one second” total too early; if it runs slow, it reaches it too late. Those small errors accumulate, causing **clock drift**.

Each machine has its own timing hardware, so even clocks set to the same time can gradually disagree. Synchronization reduces that difference, but uncertain network delays limit how accurately machines can align their clocks.

User 1 sends “Coffee?” through server A at `10:00:05`. User 2 receives it and replies through B, whose clock shows `10:00:03`. Sorting by timestamps reverses the conversation:

<!-- [Diagram: Place User 1 beside server A and User 2 beside server B, with time flowing downward along the server timelines and arrows for the question and reply; label the sends 10:00:05 and 10:00:03. Beside them, show the incorrectly sorted chat with “Yes!” above “Coffee?”. Alt: Different server clocks make a reply sort before the question that prompted it.] -->

![Different server clocks make a reply sort before the question that prompted it.](/images/blog/system-design-day-2/physical-clocks-notebook.webp)

Cross-machine timestamps alone don't reliably establish event order. Logical clocks track relationships between events without measuring physical time.

An event **happened before** another if it comes earlier in the same process, or if it sends a message that the other receives. These relationships chain together: if X precedes Y and Y precedes Z, X precedes Z. When neither event happened before the other, they are **concurrent**, even if they occurred at different physical times.

### Lamport clocks

A counter per process that preserves happened-before order: if X happened before Y, X gets a smaller timestamp.

Start at `0`. Increment for each local or send event, and attach the counter to outgoing messages. On receipt of timestamp `T`, update to `max(local, T) + 1`.

A starts at `4`, B at `1`. The question gets `5`, B's receive gets `6`, and its reply gets `7`:

<!-- [Diagram: Reuse server A and B timelines with time flowing downward; start A at 4 and B at 1. Draw “Coffee?” from A at 5 to B at 6, annotate the receive with max(1, 5) + 1, then show B sending “Yes!” at 7. Alt: Receiving the timestamp 5 moves B's counter ahead to 6 before its reply gets 7.] -->

![Receiving the timestamp 5 moves B's counter ahead to 6 before its reply gets 7.](/images/blog/system-design-day-2/lamport-clocks-notebook.webp)

**Lamport clocks cannot identify concurrent events from their timestamps alone.** If X has timestamp `5` and Y has `9`, X might have happened before Y, or the events might be independent. Comparing the counters can't distinguish those cases: happened-before implies a smaller timestamp, but a smaller timestamp doesn't imply happened-before.

Separate processes can also produce equal timestamps. Lamport counters don't measure elapsed time.

### Vector clocks

One counter per process, kept together as a vector. This records enough history to distinguish happened-before relationships from concurrency.

1. Each process starts with a vector of zeros, with one position per process. For servers A and B, both keep their own copy of `[0, 0]`, using positions `[A, B]`.
2. When a local event happens, increment only your own position. A changes `[0, 0]` to `[1, 0]`; B would change its own `[0, 0]` to `[0, 1]`.
3. When sending a message, increment your own position once for that send event, then attach a copy of the updated vector to the message.
4. When receiving a message, compare its vector with your local vector position by position. Keep the larger value in each position. For example, merging local `[0, 2]` with incoming `[3, 0]` gives `[3, 2]`.
5. After merging, increment your own position to record the receive event. If B received the message in the previous step, its vector becomes `[3, 3]`. This is the receive event's timestamp; don't increment it again for the same event.

Using positions `[A, B]`, compare independent sends with a question followed by a reply:

<!-- [Diagram: Two panels compare independent send cards [1, 0] and [0, 1] with a question-and-reply chain [1, 0] → [1, 1] → [1, 2]. Alt: Incomparable vectors identify concurrency, while increasing vectors identify a happened-before relationship.] -->

![Incomparable vectors identify concurrency, while increasing vectors identify a happened-before relationship.](/images/blog/system-design-day-2/vector-clocks-notebook.webp)

X precedes Y when every entry in X is at most Y's corresponding entry and at least one is smaller. If neither vector precedes the other, they're concurrent. A basic vector grows with the number of processes; it doesn't enforce delivery order or resolve conflicts.

## Event ordering

There are two order structures to distinguish: **partial order** and **total order**. Causality describes dependencies that an order can preserve; it isn't a third structure.

### Partial order

An order that doesn't require every pair of events to be comparable. Happened-before is a partial order.

Local process order and message exchanges establish relationships; independent events can remain unordered.

A question precedes its reply. A greeting from an independent third process has no causal position relative to either:

<!-- [Diagram: Show event nodes Q “Question” and R “Reply” connected by Q → R, with G “Greeting” separate and unconnected. Label the arrow “happened before” and the unconnected pairs “concurrent”; note that node positions do not represent physical time. Alt: The question precedes the reply, while the independent greeting is incomparable with both.] -->

![The question precedes the reply, while the independent greeting is incomparable with both.](/images/blog/system-design-day-2/partial-order-notebook.webp)

The happened-before relationship gives us a **causal partial order**. A delivery protocol respects it by delivering the question before its reply, buffering the reply if necessary. The independent greeting can appear in different positions:

<!-- [Diagram: Show two recipient lists top to bottom: “Greeting, Question, Reply” and “Question, Reply, Greeting.” Use matching colors for the same messages and connect Question → Reply within both lists. Alt: Causal delivery preserves question-before-reply while allowing different positions for the greeting.] -->

![Causal delivery preserves question-before-reply while allowing different positions for the greeting.](/images/blog/system-design-day-2/causal-order-notebook.webp)

Both delivery sequences respect the same causal partial order. Recipients can disagree about concurrent messages. Having vector timestamps alone doesn't implement the delivery guarantee.

### Total order

A total order compares every pair of distinct events. Total-order delivery makes recipients agree on the relative order of messages they deliver.

A protocol establishes one common sequence, including concurrent messages. `(Lamport timestamp, process ID)` defines a possible order, breaking timestamp ties with the ID.

All recipients use the same sequence, even for the independent greeting:

<!-- [Diagram: Show one ordered log numbered 1 Question, 2 Greeting, 3 Reply, branching to two recipients with identical numbered lists. Reuse the message colors from the causal-ordering diagram. Alt: Total-order delivery gives both recipients the same relative order, including for independent messages.] -->

![Total-order delivery gives both recipients the same relative order, including for independent messages.](/images/blog/system-design-day-2/total-order-notebook.webp)

A total order doesn't automatically preserve causality. `Question → Greeting → Reply` respects the dependency; `Reply → Question → Greeting` violates it. The Lamport-based order above preserves happened-before relationships while also ordering concurrent events.

Live delivery still needs coordination or buffering to account for delayed messages. **Partial or total describes how completely events are ordered; respecting causality means keeping dependencies in the right order.**

## Consistency

Consistency describes the rules for what clients can observe when reading and writing shared data. When servers keep replicas of the same data, an update may reach each copy at a different time. A consistency model defines which results are allowed during that process: whether a read must include a completed write, preserve causal dependencies, or allow temporary differences while replicas catch up.

The connection to clocks is that misleading timestamps can put updates in the wrong order, which can lead to incorrect read results. Logical clocks help preserve known event relationships. But even with the correct order, a replica can be missing updates. The storage and replication protocol must enforce the consistency guarantee; a clock alone can't tell a replica that it has caught up.

### Ordering versus consistency

Suppose a shop owner changes a product's price from **100 DH to 120 DH**, then later to **150 DH**. Ordering concerns which update is applied first. Applying them backward would leave the price at 120 DH.

Both servers can follow the correct order while one is still behind:

```text
Server A: 100 → 120 → 150
Server B: 100 → 120
```

The owner receives confirmation that the price is 150 DH. A customer then reads the product through B. Assuming no further changes:

- With strong consistency, a successful read must return **150 DH**. B must obtain current data or route the request before answering successfully.
- With eventual consistency, B may temporarily return **120 DH**, then return 150 DH once it catches up.

Server B applied updates in the right order but still showed older data. **Ordering determines the sequence; consistency determines which read results are allowed.**

### Strong consistency

Here, strong means **linearizability**: each operation appears atomic between its request and response, respecting real-time order.

A successful read started after a write completes can't return the older state that the write replaced, unless a later write restores it. A server whose copy is behind must obtain data that satisfies this guarantee or forward the request; otherwise, it must wait or return an error.

For an append-only chat history, a successful read started after “Coffee?” is confirmed stored must include it:

<!-- [Diagram: Draw a left-to-right real-time axis with a write request and success response for “Coffee?”, followed by a read request through B and a response containing “Coffee?”. Mark the gap between write completion and read start; do not depict simultaneous replica updates. Alt: A successful read begun after the write completes includes the stored message.] -->

![A successful read begun after the write completes includes the stored message.](/images/blog/system-design-day-2/strong-consistency-notebook.webp)

Replicas don't need to update simultaneously. During failures, preserving the guarantee may require waiting or rejecting operations. Check the precise meaning of “strong” in a product's documentation.

### Causal consistency

Readers observe causally related operations in dependency order.

Track dependencies and expose an update only with the history it depends on. When a client switches servers, its next request must carry enough information about what it has already read for the new server to preserve those dependencies.

A and B handle the conversation. A separate replica C receives copies of their updates for other readers. If C receives “Yes!” before its question, it holds back the reply:

<!-- [Diagram: Show observer replica C in two successive frames: first “Yes!” arrives but stays in a pending buffer because “Coffee?” is missing; then “Coffee?” arrives and the visible history becomes “Coffee?, Yes!”. Keep the pending buffer separate from the client-visible history. Alt: A replica delays exposing the reply until its causal predecessor is available.] -->

![A replica delays exposing the reply until its causal predecessor is available.](/images/blog/system-design-day-2/causal-consistency-notebook-v2.webp)

Readers can see older data, and independent updates may appear in different orders. Causal consistency can be combined with eventual convergence.

### Eventual consistency

Replicas converge if writes stop and updates can propagate.

Updates spread between replicas. Concurrent edits need a conflict-resolution rule that lets copies converge.

Under eventual consistency alone, C could expose the reply immediately. A may still have only the question while C has only the reply; after updates propagate, both have the full history:

<!-- [Diagram: Show two frames labeled “During propagation” and “After updates arrive.” Initially replica A contains “Coffee?” and observer replica C contains only “Yes!”; later both contain “Coffee?, Yes!”, with propagation arrows between frames and no fixed duration label. Alt: Eventual consistency permits different temporary histories before replicas converge.] -->

![Eventual consistency permits different temporary histories before replicas converge.](/images/blog/system-design-day-2/eventual-consistency-notebook-v2.webp)

This guarantee alone sets no deadline and doesn't preserve causal visibility. A reply may temporarily appear without its question unless the system provides an additional guarantee.
