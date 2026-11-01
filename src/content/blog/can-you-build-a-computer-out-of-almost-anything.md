---
title: "Can You Build a Computer Out of Almost Anything?"
description: "A journey through simple rules, surprising computers, and the idea of Turing completeness."
pubDate: "2026-10-31"
draft: false
tags: ["Computing", "Turing Completeness"]
---

How can a few simple rules be enough to build something as complicated as a computer?

An instruction like “add these numbers” or “if this value is zero, go here” doesn’t sound like much. On its own, it isn’t. But give a machine some memory and the right set of simple instructions, and we can combine them into programs that do much more.

Enough, even, to simulate another computer. We can describe how that computer works in a program, then let our machine follow the instructions. The simulated computer could run a computer of its own, which could run another one inside it.

We’d eventually run out of time or memory, but we wouldn’t need a new kind of instruction for each layer. Somehow, the same small set of rules is enough.

So what do those rules need to let us do? And **how simple can they be before we lose the ability to build a computer?**

## Two switches and a light

Let's start with a little box. It has two switches going in and one light coming out. Each switch can be off or on. The light can be off or on too.

Inside the box is one rule: **keep the light on unless both switches are on.**

That's the whole job. Both switches off? The light is on. Turn on just one switch? Still on. Turn on the other one too, and the light goes out.

Here are all four possibilities:

![Four switch combinations show that the output light stays on except when both input switches are on.](/images/blog/turing-completeness/nand-two-switches-notebook.webp)

We can write off as `0` and on as `1`. These are the two possible values of a **bit**. Our box takes two input bits and produces one output bit.

A device that applies a rule like this is called a **logic gate**. This particular rule has a name: **NAND**.

So far, we've built something with a very limited talent for controlling a light. The interesting part comes when we connect the output of one box to the input of another. Then one box's result becomes something the next box can work with.

What could we make if we had a whole pile of these boxes?

## What happens when we connect the boxes?

First, let's try a small trick. Instead of controlling the two inputs separately, connect the same switch to both of them.

When our switch is off, both inputs are `0`, so the output is `1`. When we turn it on, both inputs become `1`, so the output becomes `0`.

We've made a box that **flips a bit**. Give it `0`, get `1`. Give it `1`, get `0`. This is called **NOT**.

The NAND box hasn't changed. We've just connected its inputs differently:

![Feeding the same bit into both inputs of a NAND gate produces its opposite: zero becomes one and one becomes zero.](/images/blog/turing-completeness/nand-makes-not-notebook.webp)

Once we can flip a bit, we can use that trick on the output of another NAND box. NAND gives us `0` only when both inputs are `1`. Flip its answer, and we get `1` only when both inputs are `1`. We've made **AND**.

We can make **OR** too: flip each input first, then send the two flipped bits into a NAND box. Its output is `1` whenever at least one original input is `1`.

Here is how these two rules treat the same inputs:

![For the same four input pairs, AND lights its output only for two ones, while OR lights its output whenever either input is one.](/images/blog/turing-completeness/nand-and-or-comparison-notebook.webp)

We can now use these arrangements as building blocks in their own right. When we say “AND,” we can think about its job without tracing every NAND inside it.

## Can one kind of box build all the others?

With NOT, AND, and OR, we have enough to build any rule that takes a fixed number of input bits and produces output bits. How can we be sure?

Imagine writing down every possible input combination and the answer we want for each one. We can use NOT and AND to recognise a particular combination. Then OR lets us collect all the combinations that should produce `1`. If we need several output bits, we build a rule for each one.

That arrangement could become enormous. But we wouldn't need a new kind of gate to build it. Since NAND can make NOT, AND, and OR, **NAND alone can build every Boolean logic function**. That's what makes it a **universal logic gate**.

NAND isn't the only gate with this ability. **NOR**, which outputs `1` only when both inputs are `0`, is also universal. We could build all the other logic gates from NOR alone too.

So do we have a whole computer yet? Our circuits so far produce an answer from whatever inputs we give them. They don't remember the previous answer or keep track of where they are in a program.

For that, we need something that can hold onto a bit, even after the signal that set it has gone away.

## How can a circuit remember?

Think about a light switch on a wall. We press it, take our hand away, and the light stays on. Our action ends, but its effect remains. We'd like our circuit to do something similar.

So far, we've connected our boxes in one direction: inputs go in, an answer comes out. Now let's send an output back around to an input. This is called **feedback**.

With two NAND gates connected to each other in the right arrangement, we can make a circuit with two stable states. One represents `1`, the other `0`. Once we put it into a state, the feedback keeps it there until we tell it to change, as long as it has power.

This little circuit is called a **latch**. It can remember one bit.

Let's set it to `1`, leave it alone, then change it to `0`:

![A two-NAND latch is set to one, keeps that value when both controls return to their inactive state, and changes to zero when reset.](/images/blog/turing-completeness/nand-latch-memory-notebook.webp)

The useful part is the middle step. The command to store `1` has ended, but the output is still `1`. The circuit's answer now depends on what happened before.

One bit won't hold much. But a row of eight gives us a byte, and larger collections let us store numbers, instructions, and intermediate results. This isn't how every kind of memory is built; it's one way to see how memory can emerge from our gates.

We have logic gates and a way to store bits. There's still a gap between these ingredients and a machine that follows a program. What would we need to build next?

## How do we get it to follow instructions?

We still need circuits that work with numbers, a way to pick values out of memory, and something that controls which operation happens next. We can build these from gates too, but each takes more design than the little examples we've drawn.

Think of the remaining work as three jobs:

- **Perform operations.** We represent numbers as groups of bits. Subtracting one becomes a rule that turns the bits for one number into the bits for the result. Gates can implement that rule, just as they implement AND and OR, though the circuit is larger.
- **Organise memory.** Give storage locations numbers, so we can choose where to read a value or write a result. More logic routes the bits to and from the selected location.
- **Interpret instructions.** Give each operation a bit pattern. Control logic reads that pattern and selects the circuits and memory locations needed for the job.

Now we can store a list of those instructions: a **program**. A small piece of memory holds which instruction comes next. That's the **program counter**, our bookmark in the list.

Suppose the instruction is “subtract 1” and our stored number is `3`. Control logic selects subtraction, memory supplies the number, and the operations circuit produces `2`. We store that result and move the bookmark to the next instruction.

Here is that one step, showing the parts we would connect:

![Instruction control selects subtraction, memory supplies three, the operations circuit subtracts one, and the result two is written back to memory before the next instruction.](/images/blog/turing-completeness/computer-parts-one-step-notebook.webp)

With those parts in place, we could run a countdown program. Written in words, its instructions would be:

1. Store the number `3`.
2. If the stored number is `0`, stop.
3. Subtract `1` from the stored number.
4. Go back to instruction `2`.

The machine doesn't need to understand counting. It needs circuits that recognise these instructions, check a value, subtract, and choose the next instruction. In the actual machine, each instruction is a bit pattern; the words above are for us.

Follow the bookmark as our number gets smaller:

![A program stores three, repeatedly checks and subtracts one, then stops at zero; a bookmark tracks the next instruction separately from the stored number.](/images/blog/turing-completeness/countdown-program-notebook.webp)

Notice instruction `4`. Without it, we'd reach the end of the list. With it, we can reuse the same instructions. And instruction `2` lets the result of a calculation change what happens next.

Our circuit also needs to coordinate when values are read and when new ones are stored. A simple computer can use a regular timing signal, called a **clock**, to organise those updates. Otherwise, we'd risk storing a result while the gates were still working it out.

We've outlined how these parts could form a programmable computer, rather than built every circuit. The important change is that its job now comes from the instructions in memory. Change the program, and we can change what it does without reconnecting the gates.

That brings us back to the opening. What if the instructions we give this machine describe how *another* computer works?

## A computer inside a computer

Suppose we finish building a machine along those lines. It can now follow programs. One possible job for it is to imitate how another computer follows instructions.

What would that program need to keep track of? The other computer's stored values, its list of instructions, and its bookmark showing which instruction comes next. All of that information can be stored in our machine's memory.

Let's have this simulated computer run our countdown program. Its stored number is `3`, and its bookmark points to “subtract 1.” Our simulation program does three things:

1. Reads the instruction at the simulated computer's bookmark.
2. Changes its stored number from `3` to `2`, just as that instruction requires.
3. Moves its bookmark to the next instruction.

Then it repeats. Step by step, our program makes the same changes that the other computer would make. That's what we mean by **simulating a computer**. The physical machine does all the work; the simulated machine exists as information that the program reads and changes.

Why bother? Because a program written for the simulated computer can run this way too. Our physical machine doesn't need to understand that program's instructions directly. The simulation program translates their effects into operations it can perform, even if that takes many steps.

Now suppose simulated computer A is capable of running a simulation program of its own. We can use it to simulate computer B. Our physical computer runs A's simulation, and A runs B's. Here is how those layers fit together:

![A physical computer runs a simulation of computer A, which runs a simulation of computer B; each level's memory and instructions are represented within the outer machine.](/images/blog/turing-completeness/computer-inside-computer-notebook.webp)

Each step in B now requires work in A, which requires work on the physical computer. We can add layers, but they all share the time and memory available on the original machine. We haven't created extra computing power.

### When does this become universal?

Our countdown shows that a machine can follow a program. But a machine built only to count down could do that too. It wouldn't tell us whether the same machine could search a list, process a picture, or simulate another computer.

We need a stronger test than “it follows instructions.” We need to know how much those instructions let us express.

This is where a **Turing machine** becomes useful. Imagine a tape divided into squares, with a head that reads one square at a time. The machine follows rules that tell it what symbol to write, which way to move, and what state to enter next. A state is a label that helps it keep track of what it's doing. More tape is available whenever it needs it.

Now suppose we write a simulation program for our computer. It stores the tape's contents, the head's position, and the machine's current state. At each step, it reads the appropriate rule and updates those values.

The important part is that **we can give this simulator different rule lists and inputs**. It can reproduce any Turing machine, rather than one machine we specially built it to imitate.

A system capable of doing this is **Turing complete**. That little tape-and-rules model can express general algorithms, so being able to simulate all of it gives our system the same computational reach. For every task computable by a Turing machine, there's a program our system can run to perform it too.

That's the significance of universality: **we can change the program instead of inventing a new kind of machine for each computable task**. The program may be enormous and the execution painfully slow, but the basic rules are enough.

There is a condition: enough time and memory. A simulation must be able to represent more tape when the computation needs it. Real computers have fixed limits; when we call a design Turing complete, we consider what it could do if more memory could be supplied as needed.

NAND's universality gets us the logic gates. Turing completeness is a claim about what a whole system can compute over time. We've explored the ingredients of such a system, but proving a particular design universal would require showing that it really can carry out the general simulation described above.

Because nothing in this idea says our building blocks have to be electronic gates. Could the rules of a game give us enough to work with?

## Computers in unexpected places

Once we know what to look for, we start finding the ingredients of a computer in some strange places. Here are a few builds worth watching. We don't need to understand every connection to recognise the idea: simple rules, arranged into something much bigger.

- **Minecraft:** mattbatwings builds a working computer using redstone. The game's blocks become the parts of a machine that follows instructions. Watch [I Made a Working Computer with just Redstone!](https://www.youtube.com/watch?v=CW9N6kGbu2I).

- **Terraria:** From Scratch builds a 32-bit computer using the game's wiring system and gets it running Pong. The project uses a mod to speed up the wiring simulation while preserving its behavior. Watch [I Made a 32-bit Computer Inside Terraria](https://www.youtube.com/watch?v=zXPiqk0-zDY).

- **Conway's Game of Life:** this starts with a grid of cells that live or die according to their neighbours. Alan Zucconi's video explores how patterns in that grid can become the parts of a computer. Watch [Let's Build a Computer in Conway's Game of Life](https://www.youtube.com/watch?v=Kk2MH9O4pXY). For a finished build, the [Quest for Tetris team built a computer and a Tetris program inside Life](https://codegolf.stackexchange.com/questions/11880/build-a-working-game-of-tetris-in-conways-game-of-life).

- **LEGO:** Jeroen van den Bos and Davy Landman built a working Turing machine with LEGO. We can watch it read, write, and move its tape, making the model we discussed earlier into something physical. Its tape is finite, of course. Watch [LEGO Turing Machine](https://www.youtube.com/watch?v=FTSAiF9AHN4).

- **Water:** Steve Mould built a binary adding machine using water and siphons. Here, water levels and flows do the work we'd usually give to electronic circuits. This particular build is an adder, rather than a universal computer, but it shows that even arithmetic doesn't need electricity. Watch [I Made A Water Computer And It Actually Works](https://www.youtube.com/watch?v=IxXaizglscw).

These builds have practical limits: space, memory, and how long we're willing to wait. The surprising part is how far their underlying rules let us go. A computer doesn't have to look like the one on our desk.

## Does that mean it can compute anything?

After seeing a computer built inside a game, it’s tempting to think we can make these systems solve absolutely anything. Just add more blocks and wait.

But “anything computable” is doing some work here.

First, being able to run a computation doesn’t mean we can afford to finish it. Our redstone computer might follow the right instructions perfectly and still leave us waiting long after we’ve lost interest.

Then there’s a limit that more time and memory won’t fix.

Imagine a program that checks other programs. Give it some code and an input, and it tells us whether that code will eventually stop or keep running forever. That would be handy when a loading screen has been spinning for twenty minutes.

We can answer that question for many particular programs. But Turing proved that **no algorithm can answer it correctly for every possible program and input**. This is the *halting problem*.

A faster processor won’t change that. Neither will a bigger Minecraft world.

Universal computation means we can express every computation a Turing machine can perform. It doesn’t mean every question has a computable answer.

## Want to build one yourself?

We started with two switches and a light. If you'd like to see how far you can take that idea yourself, you don't need a room full of electronics—or a few months to spare in Minecraft. These projects let you build a computer in a simulator, one small piece at a time.

- **[NandGame](https://nandgame.com/)** runs in your browser. Each level asks you to build a component from the parts available to you. The components you finish become building blocks for later levels, gradually taking you toward a computer. It's a place to try the same trick we've been using: connect simple things, give the result a name, and build with it again.

- **[Nand2Tetris](https://www.nand2tetris.org/)** takes the idea further through a sequence of projects. You build the simulated hardware, then the software that makes it useful, including an assembler, a compiler, and a small operating system. Choose this if you want a longer journey through how the pieces fit together, with course materials to guide you.

- **[Turing Complete](https://store.steampowered.com/app/1444480/Turing_Complete/)** is a puzzle game where you build circuits, starting with NAND gates and working toward a programmable processor. You can also design your own computers and instruction sets. Choose this if you'd rather discover the ideas by solving puzzles and experimenting with connections.

Pick whichever sounds enjoyable. For a first step, try making a gate behave the way you want. You already know how to turn NAND into NOT. Getting that little circuit working yourself is the start of the same journey that leads to a whole computer.

## Resources

- [Logic gates and storage circuits — Introduction to Computer Organization](https://blue.cs.sonoma.edu/~bob/IntroCompOrg-x64/bookch5.html)
- [Putting a computer together — Nand2Tetris](https://www.nand2tetris.org/project05)
- [Universal computation — Alan Turing's 1936 paper](https://www.cs.virginia.edu/~robins/Turing_Paper_1936.pdf)
- [Code: The Hidden Language of Computer Hardware and Software — Charles Petzold](https://www.codehiddenlanguage.com/): a book that builds up how computers work from simple ideas, with interactive circuit illustrations on its companion website.
