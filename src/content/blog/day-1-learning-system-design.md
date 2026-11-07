---
title: "Day 1: Learning System Design"
description: "My first notes on system design: requirements, quality goals, software architecture, and the tradeoffs between monoliths and microservices."
pubDate: "2026-11-07"
tags: ["system design", "learning in public"]
---

## What system design means

System design is the work of planning how a system will meet its requirements in real-world conditions. Those conditions include more users, slow networks, failed components, and data that must stay correct.

A design that works for 1,000 users may struggle when 1 million users arrive. The exact limit depends on the system, but the point is that a design must account for how demand changes and what happens when parts fail.

Some important goals are:

- **Scalability:** Can the system handle more users or requests as demand grows?
- **Availability:** Can users continue using it when some components fail?
- **Latency:** How long does a user wait for a response? A page that takes a second to load may feel slow, especially if every action takes that long.
- **Consistency:** Do users see accurate, up-to-date data across the system?

These goals give us a way to discuss whether a design is suitable. They also create tradeoffs, which I will come back to later.

## System design and coding

System design is not the same as coding. It works at a higher level.

Think about building a house. The blueprint shows how many rooms there are, where they go, and how they connect. Construction turns that plan into walls, doors, and wiring.

System design is like the blueprint for a software system: it describes the major parts and how they work together. Coding implements those parts with classes, functions, business logic, and handling for bugs and edge cases. Coding happens at a more detailed level; system design looks at the whole system.

System design is also a team responsibility. It is not a decision that belongs only to one specialist. Developers, product managers, operations staff, and other people on the team can all bring requirements and constraints that shape the design.

## System design and software architecture

The terms **system design** and **software architecture** overlap, so the distinction is not absolute. A useful way to think about them is that architecture often focuses on the structure inside an application, while system design looks at how the larger system fits together: applications, databases, networks, hardware, and infrastructure.

For example, system design might decide which database an online shop needs and how the shop connects to payment and delivery services. Software architecture might decide how the shop's code is divided into modules and how those modules interact with the database.

Architecture helps manage an application's internal complexity. A team might organize code into modules, choose an architectural pattern such as MVC or event-driven design, and use patterns such as Observer where they fit. These decisions can affect non-functional goals such as latency and reliability.

The two areas influence each other. If an online shop must respond quickly, its internal design may need to avoid slow work on the request path. If the system uses microservices, its system design must account for how services find and communicate with one another. A decision at one level can create constraints at the other.

## Monoliths and microservices

A **monolith** is an application built and deployed as one unit. Its user interface, business logic, and data-access code may live in the same application. The database is often a separate component, even when people casually describe it as part of the monolith.

Monoliths can be a good fit for an early startup or a small team. There is one application to deploy, and following a request through one codebase can be easier than tracing it across several services. The tradeoff is that you usually scale the application as a whole. If image processing is under heavy load but the rest of the app is quiet, you may still need to run more copies of the entire application.

A **modular monolith** keeps one deployable application but divides its code into modules with clear responsibilities and boundaries. For a shop, there might be separate catalog, order, and account modules. Teams can work on those areas through defined interfaces, and each module can be tested on its own. This structure can make the code easier to change and can provide a path to splitting out a service later.

It is still one application, though. You cannot scale a module independently just because it has a boundary in the code. And if a failure in one module brings down the application process, users may lose access to the whole application.

With **microservices**, services run and deploy independently and communicate over a network. A large team might let one group own the catalog service and another own orders. Services can use different technologies where there is a good reason, and a busy service can be scaled without scaling every other service. Separating services can also limit the effect of some failures, provided the system handles failures between services well.

That flexibility brings work with it. The team now has to manage network communication, service discovery, data consistency, deployment, and monitoring across more moving parts. A request that once stayed inside one application may now depend on several services and network calls.

For many teams, a modular monolith is a sensible starting point. Microservices become useful when needs such as independent scaling, team ownership, or deployment speed justify the extra operational work. It is a starting guideline, not a rule that fits every system.

## Functional and non-functional requirements

Before choosing components, we need to understand what the system should do.

**Functional requirements** describe the actions and behavior the system must support. For a marketplace, users might need to buy and sell items, update listing details, and change listing photos. For a messaging app, we might ask: must users sign in? Should they see whether someone is online? Do we need group chats, one-to-one conversations, or both?

Once we know these behaviors, we can map them to the system's modules and components.

**Non-functional requirements (NFRs)** describe how well the system must do its job. They help answer questions like:

- How many users or requests should the system handle? This relates to scalability.
- How often can the system be unavailable? This relates to availability.
- How long may a message take to arrive? The difference between a fraction of a second and several seconds can change how responsive a chat app feels. The right target depends on the product and network conditions.
- How quickly should a profile-photo change appear to other users? This is a consistency question; some updates must appear immediately, while others can tolerate a delay.
- If a database or network connection fails, can the system recover safely? This relates to reliability.
- Should messages be encrypted, and how should access to them be controlled? These are security requirements.

The answers shape the design. A system for a small private group has different needs from a public service expected to handle a large, unpredictable audience.

## The tradeoffs are part of the design

In practice, we cannot maximize every quality at once. A choice that improves one goal can make another harder or more expensive.

Consider a money transfer. The system must avoid showing a transfer as successful if the balance was not updated correctly. It may need to wait for a reliable confirmation before responding. That can add time, but reporting success too early could show users the wrong balance or cause the transfer to be applied twice. Correctness matters more than making this particular response feel instant.

Image uploads show a different tradeoff. A service can compress an uploaded image and create several sizes before it is ready to display. That makes the upload take longer, but later page views can load a smaller image suited to the screen. The system spends time during upload to reduce waiting when people view the image.

That is the kind of question system design keeps asking: which experience matters most, where should the work happen, and what cost are we willing to accept?

## What I took away from day one

I started by separating the system's behavior from its quality goals, then looking at how those requirements shape architecture. Monoliths and microservices are choices with different costs, not simply “old” and “new” ways to build software. The right design depends on the system's needs, the team's size, and the tradeoffs the team is willing to make.
