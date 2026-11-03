---
title: "Design Patterns in Game Development: What Problems Do They Solve?"
description: "Exploring game development problems, the design patterns that help solve them, and when to keep things simple."
pubDate: "2026-11-03"
tags: ["Game Development", "Design Patterns"]
---

I want to add an achievement for surviving ten hits. But to do that, I have to open the method that subtracts the player's health.

That method already updates the health bar, plays a hurt animation, and starts a sound. Now it needs to know about achievements too. The rules for taking damage haven't changed, but the method keeps gaining new jobs.

This is the kind of problem I've run into while working on game code. I can make the new feature work with another call. What I want to improve is how much unrelated code I have to touch each time.

That's where I'll start with **design patterns**: common ways to arrange code around problems like this. I'll walk you through damage reactions, movement, controls, menus, and game objects, showing what I want to change and how a pattern might help.

My goal is code that's easier to read and change. If a pattern adds more work than it saves, I'd keep the simpler version.

If you're looking for a particular problem, here's where I'd start:

| The problem | The approach |
| --- | --- |
| Every new damage reaction means changing the damage method. | [Observer](#observer-separate-damage-from-its-reactions) |
| Movement rules are spread across flags and methods. | [State](#state-organise-behavior-by-mode) |
| Different enemy movement rules crowd the same method. | [Strategy](#strategy-swap-movement-rules) |
| Input code is tied to specific character actions. | [Command](#command-separate-actions-from-input) |
| Menu code needs to handle both buttons and nested panels. | [Composite](#composite-draw-individual-elements-and-groups) |
| Objects need features that don't fit neatly into subclasses. | [ECS architecture](#ecs-combine-data-instead-of-adding-subclasses) |

## Observer: separate damage from its reactions

Here's the damage method before I add the achievement. `Player` holds references to the health bar, audio, and animation objects, so it can call them directly:

```java
public void takeDamage(int amount) {
    if (amount <= 0 || health == 0) return;

    int damageTaken = Math.min(amount, health);
    health -= damageTaken;

    healthBar.setHealth(health);
    audio.playHurtSound();
    animation.play("hurt");
}
```

I can read this method and see what happens after a hit, in order. If it does what I need and stays small, I'd keep it. Knowing a pattern isn't a reason to rewrite working code.

To add the achievement, I'd give `Player` another reference and call it after each hit. A camera effect would add another call. The problem I want to solve is this growing list of reactions inside a method whose main job is to change health.

What I'd like is a way to add a reaction without editing this method each time. Let's let other objects sign up to hear about damage.

### Send a damage notification

I'll keep changing health inside `Player`. After that, I'll have it tell its listeners about the hit. The health bar can update itself, and the audio listener can play a sound.

The player still calls methods, but it calls the same method on each listener. It doesn't need to know which listener controls a health bar or counts achievements. This is the **Observer pattern**. The listeners are the observers.

First, I need to decide what information those listeners receive:

```java
record DamageEvent(int amount, int healthAfter) {}

interface DamageListener {
    void onDamage(DamageEvent event);
}
```

`DamageEvent` is a small container for the damage actually taken and the health left afterward. A listener implements `onDamage()` to choose its own reaction.

I'll give the player a list of listeners and a way to add and remove them:

```java
import java.util.ArrayList;
import java.util.List;

class Player {
    private int health = 100;
    private final List<DamageListener> listeners = new ArrayList<>();

    public int getHealth() {
        return health;
    }

    public void addDamageListener(DamageListener listener) {
        listeners.add(listener);
    }

    public void removeDamageListener(DamageListener listener) {
        listeners.remove(listener);
    }

    public void takeDamage(int amount) {
        if (amount <= 0 || health == 0) return;

        int damageTaken = Math.min(amount, health);
        health -= damageTaken;

        DamageEvent event = new DamageEvent(damageTaken, health);
        for (DamageListener listener : List.copyOf(listeners)) {
            listener.onDamage(event);
        }
    }
}
```

I copy the list before calling the listeners. That lets a listener add or remove one without changing the list I'm currently walking through. This hit uses the copy; later hits use the updated list.

Notice where I send the notification: **after** health changes. I want the player to handle taking damage, then let the listeners react to the result.

### Register the listeners during setup

There's still some setup to do. The listeners won't connect themselves. I'd register them when creating the gameplay screen. In this example, `healthBar` and `audio` are objects I've already created:

```java
Player player = new Player();

DamageListener updateHealthBar =
    event -> healthBar.setHealth(event.healthAfter());

DamageListener playHurtSound =
    event -> audio.playHurtSound();

player.addDamageListener(updateHealthBar);
player.addDamageListener(playHurtSound);

healthBar.setHealth(player.getHealth());
player.takeDamage(20);
```

Each `event -> ...` supplies the listener's `onDamage()` behavior. I also set the health bar's starting value. Registering it only signs it up for future notifications; it doesn't send the current health.

Let's follow the hit together. Health drops from `100` to `80`. The player creates a notification containing `20` damage and `80` health left. It calls the health bar listener, then the sound listener.

Here is how the notification reaches both:

<!-- diagram: observer-damage-listeners
[Diagram: A simple left-to-right flow in the notebook style. On the left, a Player box shows takeDamage(20) and health changing from 100 to 80. After that change, one DamageEvent with amount 20 and healthAfter 80 branches to two listeners on the right: updateHealthBar sets the bar to 80; playHurtSound plays a sound. Label both outgoing paths onDamage(event). A small setup note shows that the gameplay screen registers both listeners beforehand. Make clear that these are immediate method calls on the same thread, not queued messages or background tasks. Alt: After reducing health to eighty, the player sends the same damage notification to a health bar listener and a sound listener registered by the gameplay screen.]
-->

![After reducing health to eighty, the player sends the same damage notification to a health bar listener and a sound listener registered by the gameplay screen.](/images/blog/design-patterns/observer-damage-listeners-notebook.webp)

Now I can add the achievement as another listener. It can count hits where `healthAfter` is greater than zero, and I don't have to change `Player.takeDamage()`. I can connect the animation and camera effects in the same way.

I can use the same idea for weather. When rain starts, villagers might seek shelter while an audio listener starts the rain sound. The weather code reports the change, and each listener handles its own reaction.

### Watch listener lifetime, timing, and call order

If the player stays alive after the gameplay screen closes, I need to remove that screen's listeners:

```java
player.removeDamageListener(updateHealthBar);
player.removeDamageListener(playHurtSound);
```

That's why I kept references to the listeners when I registered them. I need those same objects to remove them. If I forget, an old screen might keep receiving notifications, or opening the screen again might register its reactions twice.

My example calls listeners immediately on the same thread. A slow listener delays the rest. If one throws an exception, the loop stops and later listeners aren't called. Using Observer here doesn't make those calls run in the background.

There's a cost to reading the code too. I can no longer find every reaction by looking at `takeDamage()` alone; I have to check which listeners were registered. If two steps must happen together in a specific order, I'd rather make that order clear with direct calls.

I'd consider Observer when several separate features need to react to the same event: an enemy dies and the score changes, or a quest reacts to an item pickup. But if I only have one small, closely connected feature, the direct calls at the start may still be easier to read.

## State: organise behavior by mode

A player who's already in the air shouldn't be able to jump again in this example. After landing, jumping should work again. I want those rules in a place where I can find and change them without checking several flags across different methods.

One way I could track this is with flags:

```java
boolean isGrounded = true;
boolean isJumping = false;
```

When a jump starts, I change both values. When it ends, I change them back. But now I have two values describing the same part of movement. If I update one and forget the other, the code could say the player is both grounded and jumping.

Add dashing, climbing, or being stunned, and more methods may start checking and changing these flags. What I want is one clear place to look for the rules of the player's current movement.

### Define the movement states and transitions

For the small jumping example, I'll use two states: **Grounded** and **Airborne**. I'm grouping standing and running under grounded. Airborne covers the whole time off the ground, including falling.

There are two transitions:

- Press jump while grounded: start the jump and become airborne.
- Land while airborne: become grounded again.

Pressing jump while airborne doesn't cause a transition. That's a rule I'm choosing for this example, not a limit of the pattern. A game with double jumps would need different rules.

Here are those rules as a small state machine:

<!-- diagram: player-movement-states
[Diagram: Two large notebook-style circles labeled Grounded and Airborne. A left-to-right arrow from Grounded to Airborne is labeled Jump pressed / start jump. A separate return arrow from Airborne to Grounded is labeled Landed. Beside Airborne show a jump-button input with the note Jump pressed here: ignored. Show the same player on the ground and above it to make the states concrete. A note says One movement state at a time. Do not introduce idle, running, animation, or attack states into this diagram. Alt: The player changes from grounded to airborne when jumping, ignores extra jump presses in the air, and returns to grounded on landing.]
-->

![The player changes from grounded to airborne when jumping, ignores extra jump presses in the air, and returns to grounded on landing.](/images/blog/design-patterns/player-movement-states-notebook.webp)

These states and transitions form a **state machine**. Before introducing more classes, I could represent it with an `enum` and a few conditions:

```java
enum MovementState {
    GROUNDED,
    AIRBORNE
}
```

For two states with little behavior, **I'd consider stopping at the enum**. I'd look at separate classes when each state has enough rules that the conditions are becoming hard to follow.

### Move each state's behavior into its own object

With the **State pattern**, I put each state's behavior in its own object. The player passes a movement event to its current state, and that state decides what to do.

Let's give the objects a shared interface. This version replaces the `MovementState` enum above:

```java
enum MovementEvent {
    JUMP_PRESSED,
    LANDED
}

interface MovementState {
    void handle(Player player, MovementEvent event);
}
```

I can now keep each state's rule in one place:

```java
class GroundedState implements MovementState {
    @Override
    public void handle(Player player, MovementEvent event) {
        if (event == MovementEvent.JUMP_PRESSED) {
            player.changeState(new AirborneState());
            player.startJump();
        }
    }
}

class AirborneState implements MovementState {
    @Override
    public void handle(Player player, MovementEvent event) {
        if (event == MovementEvent.LANDED) {
            player.changeState(new GroundedState());
        }
    }
}
```

`GroundedState` knows how to start a jump. `AirborneState` knows how to react to landing. It has no action for another jump press, so that event does nothing there.

The player holds the current state and forwards events to it. Here is just the movement part of `Player`; the damage code from earlier is left out. `PhysicsBody` stands for our game's existing physics object, whose `jump()` method starts the physical jump:

```java
class Player {
    private final PhysicsBody body;
    private MovementState state = new GroundedState();

    public Player(PhysicsBody body) {
        this.body = body;
    }

    public void onJumpPressed() {
        state.handle(this, MovementEvent.JUMP_PRESSED);
    }

    public void onLanded() {
        state.handle(this, MovementEvent.LANDED);
    }

    void changeState(MovementState next) {
        state = next;
    }

    void startJump() {
        body.jump();
    }
}
```

I still need to connect this to the game. Input code calls `onJumpPressed()`, and physics code calls `onLanded()` when the player touches the ground. The state objects handle those events; they don't detect the landing themselves.

Follow two jump presses. The first reaches `GroundedState`, which changes the state and starts the jump. The second reaches `AirborneState`, which ignores it. After landing, the next jump press reaches `GroundedState` again.

I've added more code than a single flag would need. What I'm buying is a place to keep each mode's behavior together. If I add climbing, I can keep moving along a ladder and leaving it in the climbing state. If those states need more control, I could add methods for entering, updating, and leaving them.

Another example is a mammoth with peaceful and angry moods. I could have it wander while peaceful and chase a target while angry. The creature would pass work to its current mood object. I'd still need rules for what makes it angry and what calms it down.

### The same idea in animation and screens

I can use states for animations too: idle, run, and hurt, with rules for when each starts and ends. But I wouldn't assume animation and movement need one shared state. If the player can run while attacking, I'd look at separate state machines or animation layers before creating a state for every possible combination.

Screens are another place I'd use this idea. Main menu, gameplay, and game over can each handle their own input and drawing, while a screen manager passes work to the current screen. For a pause menu over gameplay, I'd consider a stack so I can return to the screen underneath. I'd still need to decide whether gameplay updates or stays visible while paused.

### When an enum is enough

I'd use state objects when each mode has enough behavior that keeping its rules together makes the code easier to read. If an `enum` and a short `switch` already explain the rules clearly, I don't gain much by adding classes.

I also need to keep the scope clear. One movement state at a time doesn't mean one state for everything the player does. I'd keep health and inventory out of these movement states. And I still have to get the transition rules right: a state object won't fix a landing event sent at the wrong time.

## Strategy: swap movement rules

Say I'm changing how an archer keeps its distance from the player. I don't want to read through the melee enemy's chase rules and another enemy's retreat rules to find that code. But all three behaviors could end up in the same update method:

```java
public void update(Target target) {
    switch (movementType) {
        case CHASE -> body.moveToward(target);
        case KEEP_DISTANCE -> {
            double distance = body.distanceTo(target);
            if (distance < 6) {
                body.moveAwayFrom(target);
            } else if (distance > 8) {
                body.moveToward(target);
            } else {
                body.stop();
            }
        }
        case FLEE -> body.moveAwayFrom(target);
    }
}
```

For a few short rules, I'd be happy with this. But if each movement style grows, this method starts holding several different jobs. Adding a circling enemy means editing it again. Changing how ranged enemies keep their distance means reading past the other movement rules.

What I want is to give an enemy a movement behavior, then let it use that behavior without checking which kind it received.

### Put movement rules behind one interface

This is the **Strategy pattern**: I put different ways of doing a job behind the same interface. The object using a strategy asks it to do the work.

For this example, `EnemyBody` and `Target` stand for existing game classes. The body already has methods for moving toward a target, moving away, stopping, and measuring distance. I'll focus on choosing between those actions:

```java
interface MovementStrategy {
    void move(EnemyBody body, Target target);
}
```

Each strategy receives the same information, but applies its own rule:

```java
class Chase implements MovementStrategy {
    @Override
    public void move(EnemyBody body, Target target) {
        body.moveToward(target);
    }
}

class KeepDistance implements MovementStrategy {
    @Override
    public void move(EnemyBody body, Target target) {
        double distance = body.distanceTo(target);
        if (distance < 6) {
            body.moveAwayFrom(target);
        } else if (distance > 8) {
            body.moveToward(target);
        } else {
            body.stop();
        }
    }
}

class Flee implements MovementStrategy {
    @Override
    public void move(EnemyBody body, Target target) {
        body.moveAwayFrom(target);
    }
}
```

`KeepDistance` tries to keep the enemy between six and eight game units from the target. Inside that range, it stops. I use a range so the rule doesn't keep reversing direction around one exact distance. The distances are choices for this example; I'd tune them for the game.

The enemy can now pass the movement work to its strategy:

```java
class Enemy {
    private final EnemyBody body;
    private MovementStrategy movement;

    public Enemy(EnemyBody body, MovementStrategy movement) {
        this.body = body;
        this.movement = movement;
    }

    public void update(Target target) {
        movement.move(body, target);
    }

    public void setMovement(MovementStrategy movement) {
        this.movement = movement;
    }
}
```

The movement rules still exist. I've moved them into separate objects so I can read and change one without opening the enemy's update method.

### Choose the strategy when setting up the enemy

Here's where I connect the behavior to an enemy. Assume `meleeBody`, `archerBody`, and the target `player` are already available:

```java
Enemy melee = new Enemy(meleeBody, new Chase());
Enemy archer = new Enemy(archerBody, new KeepDistance());

melee.update(player);
archer.update(player);
```

Both objects are `Enemy` instances, but one moves closer while the other follows its distance rule. If the archer is seven units away, it stops. If the player approaches to five units, it moves away on its next update.

Here is how the same update call reaches different movement code:

<!-- diagram: enemy-movement-strategies
[Diagram: A notebook-style comparison with two Enemy objects on the left. Both receive update(player), but each holds exactly one movement strategy. The first points to Chase, whose move call goes to body.moveToward(player). The second points to KeepDistance; show two small situations: distance seven leads to stop, distance five leads to moveAwayFrom(player). A separate small note shows that setup code supplies each strategy through the constructor. Do not show Enemy selecting its strategy by type checks, and do not imply a strategy changes automatically. Alt: Two enemies receive the same update call but use different movement strategies chosen during setup; the ranged enemy stops at seven units and moves away at five.]
-->

![Two enemies receive the same update call but use different movement strategies chosen during setup; the ranged enemy stops at seven units and moves away at five.](/images/blog/design-patterns/enemy-movement-strategies-notebook.webp)

I can also change a strategy while the game is running. When the AI decides the melee enemy should retreat, it can do this:

```java
melee.setMovement(new Flee());
melee.update(player);
```

The next update moves it away from the player. **The pattern doesn't decide when retreat is needed.** That choice still belongs in my AI or game rules. What changes is that the enemy can use the new movement rule through the same interface.

I can apply the idea to attacks too. A character fighting a dragon could use a sword, fire a projectile, or cast a spell. I'd give those attacks a shared interface and choose which one to use. The combat code asks for an attack, while the selected strategy decides how to perform it.

### Strategy versus State

The code looks similar: an object holds another object and passes work to it. The difference I look for is the problem I'm solving.

With **State**, I'm organising behavior around the object's current mode and the rules for changing modes. In the previous example, being airborne changes what a jump press means, and landing changes the mode.

With **Strategy**, I'm choosing a way to perform a job. Here, I give an enemy a movement rule. The enemy's update method can use any rule that fits the interface.

These ideas can work together. A stunned state might prevent movement altogether. When movement is allowed again, the enemy could continue using its chosen movement strategy. I could also model fleeing as a state if it changes several parts of the enemy's behavior. The name of the behavior doesn't decide the pattern; how I use it does.

### When a switch is simpler

If all three movement rules stay tiny, the original `switch` may be easier to follow. Strategy adds files and another call to trace. For a very short rule, a function or lambda can also be enough; I don't always need a named class.

I'd reach for strategies when the choices have enough behavior to deserve separate places, or when I want to give different objects different implementations of the same job. I'd keep the interface small and pass in what the strategy needs. A strategy that has to reach through half the game to work would be a sign to rethink that boundary.

## Command: separate actions from input

I want to let the player change the jump key from Space to J. If I connect keys directly to actions, changing that choice means changing the checks in my input code:

```java
public void onKeyPressed(Key key) {
    if (key == Key.SPACE) {
        actor.requestJump();
    } else if (key == Key.F) {
        actor.requestAttack();
    }
}
```

Here, `actor` is the character being controlled. Its methods handle the game rules, such as whether it can jump or attack right now. The input code asks for an action.

This is small and clear. But suppose I want to let the player change the controls, use an on-screen button for the same action, or let AI request that action too. I'd like those callers to share a way to request work, without each one needing its own calls to the character's methods.

I can use a **command** to represent that request. Instead of connecting a button directly to `requestJump()`, I give the button a command it can execute.

### Represent jump and attack as commands

I'll start with one method shared by all commands:

```java
interface Command {
    void execute();
}

class JumpCommand implements Command {
    private final Actor actor;

    public JumpCommand(Actor actor) {
        this.actor = actor;
    }

    @Override
    public void execute() {
        actor.requestJump();
    }
}

class AttackCommand implements Command {
    private final Actor actor;

    public AttackCommand(Actor actor) {
        this.actor = actor;
    }

    @Override
    public void execute() {
        actor.requestAttack();
    }
}
```

`Actor` stands for an existing character class in the game. Each command holds the character it should act on. Calling `execute()` sends that character the request.

I haven't moved the jumping or combat rules into these classes. If the actor is already airborne and double jumping isn't allowed, `requestJump()` can reject the request. **Executing a command doesn't guarantee the action succeeds.**

For a request that needs more information, I'd store that too. A move command in a turn-based game might hold a unit and a destination tile.

### Bind keys to commands

Now my input handler can work with the shared interface. It only needs to find the command connected to a key and execute it:

```java
import java.util.HashMap;
import java.util.Map;

enum Key {
    SPACE, F, J
}

class InputHandler {
    private final Map<Key, Command> bindings = new HashMap<>();

    public void bind(Key key, Command command) {
        bindings.put(key, command);
    }

    public void unbind(Key key) {
        bindings.remove(key);
    }

    public void onKeyPressed(Key key) {
        Command command = bindings.get(key);
        if (command != null) {
            command.execute();
        }
    }
}
```

The small `Key` enum represents keys for this example. I'd connect the game's input events to `onKeyPressed()`. For jumping, I want a press event, rather than a call on every frame the button stays held.

The setup code chooses which commands go with which keys. Assume `player` is an actor I've already created:

```java
InputHandler input = new InputHandler();
Command jump = new JumpCommand(player);

input.bind(Key.SPACE, jump);
input.bind(Key.F, new AttackCommand(player));

input.onKeyPressed(Key.SPACE);
```

Follow that last call: the input handler finds `jump`, calls `execute()`, and the command calls `player.requestJump()`. The character decides whether it can carry out the action.

Here is the path from the key press to the character:

<!-- diagram: input-command-actor
[Diagram: A notebook-style left-to-right flow: Space pressed → InputHandler → JumpCommand → Actor. Show a small binding map inside InputHandler: SPACE maps to JumpCommand, F maps to AttackCommand. Label the call from InputHandler to JumpCommand execute(), and the call from JumpCommand to Actor requestJump(). A small note at Actor says Checks whether jumping is allowed. A setup arrow shows that game setup supplies the command and its actor beforehand. Do not imply commands contain the physics implementation, run asynchronously, or automatically record history. Alt: A key press selects a bound command, which requests a jump from the actor; the actor still checks whether the jump is allowed.]
-->

![A key press selects a bound command, which requests a jump from the actor; the actor still checks whether the jump is allowed.](/images/blog/design-patterns/input-command-actor-notebook.webp)

If I want jump on `J` instead, I can change the binding:

```java
input.unbind(Key.SPACE);
input.bind(Key.J, jump);

input.onKeyPressed(Key.J);
```

Neither the input handler's dispatch method nor the character's jump rules need to change. Saving those bindings and showing a controls menu would still be separate work.

### Let AI request the same action

The command doesn't need a keyboard event. When AI decides its character should jump, it can use the same command type. Here, `bot` is another actor:

```java
Command botJump = new JumpCommand(bot);
botJump.execute();
```

This command acts on `bot`; the earlier one acts on `player`. Both use the same kind of request. The AI still needs to decide when jumping makes sense, just as the input handler still needs to read a button press.

I can also pass a command somewhere else before executing it. In a turn-based game, a menu could create an action for a selected unit and pass it to the turn controller. The controller could validate and execute it when appropriate. That gives me a clear action to pass around, rather than making the menu perform the whole turn itself.

### What replay and undo still need

Commands give me a place to represent actions, but the classes above don't provide a replay system. For that, I'd need to record information such as the actor's ID, the action, its arguments, and the game tick when it happened. Replaying those requests also needs a suitable starting state and consistent game updates, including how randomness is handled.

Undo needs extra rules too. In a level editor, a move command could remember an object's previous position and restore it. But undoing a jump during combat could involve collisions, damage, and other changes. Simply calling the jump method again won't reverse those effects. I'd need an undo operation, stored state, or another way to restore the game.

### When a direct call is enough

I'd use Command when I want actions to be named objects that different callers can pass around, bind, or execute. The input code can focus on choosing a command, while each command makes its request clear.

There's still another object and method call to follow. If a button has one fixed action and I don't need anything beyond that, the direct call may be clearer. A callback can also be enough for a small action; I don't need a separate class just to wrap every method.

Strategy and Command can look similar too. I use a strategy to choose **how a job is done**. I use a command to represent **a request to do something**. A command could even ask an actor to perform an action that uses a strategy internally.

## Composite: draw individual elements and groups

If I add a button inside an Options panel, I want that panel to take care of drawing it. I don't want the pause menu to keep a list of every button inside every panel. Start with a small menu, though, and it's easy to end up drawing them all directly:

```java
resumeButton.draw(renderer);
soundButton.draw(renderer);
controlsButton.draw(renderer);
quitButton.draw(renderer);
```

But as the menu grows, I want to work with groups. The Options panel should know about its own children. The pause menu should be able to ask that whole panel to draw without listing every button inside it.

What I'd like is a shared operation: **draw this UI element**, whether that element is one button or a panel full of elements.

### Give buttons and panels one drawing interface

This is the **Composite pattern**. I arrange objects in a tree, then use the same interface for individual objects and groups.

For this example, I'll keep the shared interface small:

```java
interface UiElement {
    void draw(Renderer renderer);
}
```

`Renderer` stands for the game's drawing code. The example leaves out positions and sizes so I can focus on how the objects fit together.

A button draws itself:

```java
class Button implements UiElement {
    private final String label;

    public Button(String label) {
        this.label = label;
    }

    @Override
    public void draw(Renderer renderer) {
        renderer.drawButton(label);
    }
}
```

A panel draws its background, then asks each child to draw:

```java
import java.util.ArrayList;
import java.util.List;

class Panel implements UiElement {
    private final String name;
    private final List<UiElement> children = new ArrayList<>();

    public Panel(String name) {
        this.name = name;
    }

    public void add(UiElement child) {
        children.add(child);
    }

    public void remove(UiElement child) {
        children.remove(child);
    }

    @Override
    public void draw(Renderer renderer) {
        renderer.drawPanel(name);
        for (UiElement child : children) {
            child.draw(renderer);
        }
    }
}
```

The child list holds `UiElement` objects. A button fits that interface, and so does another panel. The loop doesn't need to check which kind it received. A child panel will draw its own children in turn.

I keep `add()` and `remove()` on `Panel`. A button has no children, so it doesn't need those methods just to share the drawing interface.

### Build the menu as a tree

Here is how I'd connect the objects:

```java
Panel pauseMenu = new Panel("Pause menu");
Button resumeButton = new Button("Resume");

Panel options = new Panel("Options");
options.add(new Button("Sound"));
options.add(new Button("Controls"));

pauseMenu.add(resumeButton);
pauseMenu.add(options);
pauseMenu.add(new Button("Quit"));

UiElement root = pauseMenu;
root.draw(renderer);
```

That last call draws the pause menu background, then Resume. Next it reaches the Options panel, which draws its background, Sound, and Controls. Finally, the pause menu draws Quit.

Here is the tree behind that call:

<!-- diagram: composite-pause-menu
[Diagram: A notebook-style tree with Pause menu (Panel) at the top. Its children, in left-to-right order, are Resume (Button), Options (Panel), and Quit (Button). Options has Sound (Button) and Controls (Button) beneath it. Label the common operation draw(renderer), and use small numbered arrows to show the drawing order: Pause menu background, Resume, Options background, Sound, Controls, Quit. Panels and buttons both implement UiElement; only panels contain children. Do not imply the diagram handles layout, click routing, or pausing the game. Alt: A pause menu panel contains Resume, an Options panel, and Quit; drawing the root also draws Sound and Controls inside Options through the shared UiElement interface.]
-->

![A pause menu panel contains Resume, an Options panel, and Quit; drawing the root also draws Sound and Controls inside Options through the shared UiElement interface.](/images/blog/design-patterns/composite-pause-menu-notebook.webp)

If I add another button inside Options, the drawing code at the root stays the same. If I put another panel inside Options, the same process works another level down. Each panel only needs to know its own children.

The example also keeps drawing order visible: children are drawn in the order I add them. If I need a different order, I have to arrange the list accordingly or add a rule for it.

### Layout, input, and tree rules still need work

I've organised the UI objects and the way drawing passes through them. **Layout and input handling are still separate jobs.** I also need positions and clipping. A click on an overlapping button needs a rule for which element receives it; adding everything to a tree doesn't answer that question.

The tree needs rules too. I shouldn't add a panel to itself or put one of its ancestors inside it. That creates a loop, and `draw()` would keep calling itself until it fails.

For a real UI tree, I'd also define who owns a child and how it moves between parents. The small `add()` method above doesn't enforce those rules.

I can combine this with Command: a button could hold a command to execute when clicked. Composite would organise the menu's parts, while Command would represent the button's action. I'd still need input code that detects the click and triggers it.

### When a flat list is enough

I'd consider Composite when the objects naturally form nested groups and I want to apply the same operation to a single item or a group. A game menu fits. A scene made of drawable objects and groups can fit too, though it also needs rules for positions and transforms.

Another example is a message made of words, with each word made of letters. A shared print operation can pass through the whole structure, just as drawing passes through the menu.

If I only have a flat list of buttons, a list and a loop may be enough. I wouldn't add panels just to use the pattern. The useful part is making a real nested structure easier to work with.

## ECS: combine data instead of adding subclasses

I want a breakable rock to move. That sounds like a small change, but it can become awkward if I've organised my objects into moving and non-moving branches of a class hierarchy.

The player already moves and has health. The rock has health but stays in place. A decoration only needs to appear on screen. Where should I put the moving rock so it can reuse movement and damage handling without copying either?

I could put more shared fields in the base class, but then the decoration gets data it doesn't need. These combinations are a reason for me to look at composition: building an object from the parts it needs.

**ECS**, short for **Entity Component System**, takes that idea and separates data from the systems that use it. It's a larger architecture choice than the patterns above. Here's how I'd use it to approach this problem.

### Entity, component, and system

I find it easier to understand ECS by giving each word one job:

- **Entity:** an identity for a game object. In this example, I'll use an integer ID.
- **Component:** a piece of data attached to that ID, such as position or health.
- **System:** code that finds entities with the data it needs and works on that data.

Here are the components I'd give the three objects:

| Entity | Position | Velocity | Health | Sprite |
| --- | --- | --- | --- | --- |
| Player | Yes | Yes | Yes | Yes |
| Rock | Yes | No | Yes | Yes |
| Decoration | Yes | No | No | Yes |

The entity ID connects the pieces. A position and a health value attached to the same ID belong to the same game object.

I'll represent the data with small Java records:

```java
record Position(double x, double y) {}
record Velocity(double xPerSecond, double yPerSecond) {}
record Health(int value) {}
record Sprite(String image) {}
```

These components don't have an `update()` method. `Position` stores coordinates. `Velocity` stores movement per second. The system will do the work.

### Give each entity its components

For the example, I'll use an illustrative `World` API. It creates entity IDs, stores components, and finds matching entities. `put()` adds a component or replaces its current value. This is a sketch of the operations I need, rather than the API of a particular library:

```java
int player = world.createEntity();
world.put(player, new Position(0, 0));
world.put(player, new Velocity(2, 0));
world.put(player, new Health(100));
world.put(player, new Sprite("player.png"));

int rock = world.createEntity();
world.put(rock, new Position(5, 0));
world.put(rock, new Health(10));
world.put(rock, new Sprite("rock.png"));

int decoration = world.createEntity();
world.put(decoration, new Position(10, 0));
world.put(decoration, new Sprite("decoration.png"));
```

I haven't created a `Player` subclass or a `Rock` subclass here. I've created three identities and given each one the data it needs. A library might wrap those identities in entity objects; using an integer keeps this example small.

### Move entities with both position and velocity

For movement, I need a position and a velocity. I don't need health or a sprite. So my movement system asks for entities that have **both** of those components:

```java
class MovementSystem {
    public void update(World world, double deltaSeconds) {
        for (int entity : world.with(Position.class, Velocity.class)) {
            Position position = world.get(entity, Position.class);
            Velocity velocity = world.get(entity, Velocity.class);

            world.put(entity, new Position(
                position.x() + velocity.xPerSecond() * deltaSeconds,
                position.y() + velocity.yPerSecond() * deltaSeconds
            ));
        }
    }
}
```

In this API, `with()` returns IDs that have all the listed components, and `get()` reads one component. Because these records are immutable, I store a new position to replace the old one.

My game loop still needs to run the system. For a half-second step, that could look like this:

```java
MovementSystem movement = new MovementSystem();
movement.update(world, 0.5);
```

The player moves from `(0, 0)` to `(1, 0)`. The rock and decoration stay where they are because neither has velocity. The system never asks whether an entity is a player or a rock; it asks which components are available.

Here is how those matches select the objects to move:

<!-- diagram: ecs-movement-query
[Diagram: A notebook-style view with three entity IDs and their component data. Player has Position, Velocity, Health, and Sprite. Rock has Position, Health, and Sprite. Decoration has Position and Sprite. Highlight only the Player's Position and Velocity, with a connection to MovementSystem labeled requires BOTH Position and Velocity. Show the player position changing from (0,0) to (1,0) for velocity (2,0) over 0.5 seconds. Rock at (5,0) and decoration at (10,0) remain unchanged. A small second scene shows adding Velocity(-1,0) to Rock, making it match the same system on the next update. Do not depict components running methods or imply Health and Sprite are required for movement. Alt: A movement system selects only entities with both position and velocity; adding velocity to a rock lets the same system move it on a later update.]
-->

![A movement system selects only entities with both position and velocity; adding velocity to a rock lets the same system move it on a later update.](/images/blog/design-patterns/ecs-movement-query-notebook.webp)

Now suppose I want the rock to move left. I can give it velocity:

```java
world.put(rock, new Velocity(-1, 0));
movement.update(world, 0.5);
```

On this next update, both the player and the rock match the system. The rock moves from `(5, 0)` to `(4.5, 0)`. I haven't changed `MovementSystem` or added a `MovingRock` class.

A drawing system could work with entities that have Position and Sprite. Damage-handling code could look for Health on the target entity. The data alone doesn't provide every game rule: I still need code for collisions, whether damage is allowed, and how a destroyed object leaves the world.

### ECS versus components with their own behavior

I could give a game object a `MovementComponent` with its own `update()` method. That is another useful way to use composition. But it's a different setup from the ECS example here.

Here, **components hold the data; systems do the work across matching entities**. That separation matters more than whether I name a class `Component` or `Entity`.

It also changes how I read the game. Instead of opening `Rock.update()`, I look at the rock's components and the systems that work on them. That can make one feature easier to find, but tracing everything that happens to one entity takes more looking around.

### ECS tradeoffs: tracing, update order, and setup

I'd consider it when many kinds of objects share features in different combinations, and those combinations are becoming awkward to express with subclasses. I can keep movement rules in one system and reuse them wherever the required data exists.

There is more to organise, though. I need rules for system order, entity removal, and when components can be added or removed. If AI changes velocity, whether movement runs before or after AI affects when that change takes effect. A real framework may also restrict changes while a system is walking through its matches.

For a small game, ordinary objects with a few behavior components may be easier to work with. I wouldn't move everything into ECS just to make the class list look smaller. I'd choose it when separating the data and systems makes the actual game rules easier to manage.

## How I choose a pattern

The question I come back to is simple: if I change this feature tomorrow, where will I need to look?

For damage reactions, Observer gives me a way to add listeners. For movement modes, State keeps each mode's rules together. Strategy lets me choose a different way to do a job, while Command gives me an action I can pass around. Composite helps me work with nested groups, and ECS offers a different way to organise data and the systems that use it.

Each choice also gives me more code to understand. Sometimes a direct call, a small `switch`, or a plain object already makes the rules clear. I'd keep that version until I can explain what a pattern would improve.

If you're trying these ideas in your own game, start with one place that's becoming hard to change. Pick a pattern that fits that problem, try it, and compare the result. Can you find the rules more easily? Can you change one part without touching several others? Or do you now have more files to follow for the same small job?

That's how I want to judge the result. The pattern's name helps me talk about the design. What matters when I return to the code is whether I can understand it and keep building the game.

## Resources

- [Refactoring.Guru](https://refactoring.guru/design-patterns)
- [java design patterns](https://java-design-patterns.com/patterns)
