---
title: "From HTTP to WebSocket: Building Real-Time Communication"
description: "From HTTP requests and persistent connections to why we need WebSocket and what it adds."
pubDate: "2026-10-31"
draft: false
---

## Before WebSocket, let's talk about HTTP

HTTP stands for **Hypertext Transfer Protocol**. It started as a way to retrieve and share hypertext documents: documents with links you could follow to other documents. You asked for a document, the server sent it back, and you could follow a link to request another one.

Today, we use HTTP for much more than documents, including APIs and interactive applications. But that basic pattern is still familiar: ask for something, then receive a response.

When you open a website, your browser asks a server for something, and the server sends a response. That might be the HTML for a page, an image, or some data your application needs.

HTTP defines how those requests and responses are written and understood. The browser is the client: it starts the exchange by making a request. The server handles that request and sends back a response.

For HTTP/1.0 and HTTP/1.1, those messages travel over a TCP connection. Think of the connection as the path between the browser and the server, and HTTP as the rules for the messages travelling along it.

With HTTPS, **TLS** protects that communication. It encrypts the data in transit, detects tampering, and lets the browser check the server's identity through its certificate. We're still exchanging HTTP messages, but other people along the network path shouldn't be able to read or alter them undetected.

Here is one HTTP exchange travelling over a protected connection:

![A browser requests a document and the server responds over a TLS-protected TCP connection.](/images/blog/websocket/http-request-response-notebook.webp)

So, for a simple exchange, the browser opens a connection, sends its request, and reads the response. What happens to the connection afterward? That depends on how it's being managed.

### HTTP/1.0: opening a connection for each exchange

The usual HTTP/1.0 behavior was to close the connection after sending the response. If the browser needed another resource, it opened another connection.

Imagine loading a page, then asking for an image. The simplified sequence looks like this:

![HTTP/1.0 normally uses a separate TCP connection for each request-response exchange.](/images/blog/websocket/http-10-connections-notebook.webp)

Each new connection takes work to establish before we can exchange HTTP messages. For a page with several resources, repeating that setup adds overhead.

Some HTTP/1.0 implementations supported keeping connections open through a keep-alive extension, but persistent connections weren't the default behavior.

### HTTP/1.1: keeping the connection open

HTTP/1.1 made persistent connections the default. Instead of closing a connection after every response, the browser and server can reuse it for more requests and responses.

Now our sequence can look like this:

![HTTP/1.1 can reuse one TCP connection for the page request and the image request.](/images/blog/websocket/http-11-keep-alive-notebook.webp)

This is often called **keep-alive**. We avoid setting up a new connection for every exchange. In HTTP/1.1, we don't need to send `Connection: keep-alive` to request the default behavior. Either side can still close the connection, and servers commonly limit how long an idle connection stays open.

But keeping the connection open doesn't change the basic conversation. The browser still sends a request, and the server responds to it.

### What if the server has something new to tell us?

Let's say we're building a chat application. Sending a message seems straightforward: the browser makes a request containing the message, and the server handles it.

Now someone else sends us a message. The server knows about it, but our browser hasn't asked for anything. How does it find out?

Keeping the connection open doesn't solve that by itself. Once an HTTP response has finished, the server can't simply send another independent response because a new chat message arrived. It needs a request to respond to.

We can build live updates using HTTP. Let's start with the simplest approach and see what we might want to change as our chat application grows.

## Getting live updates with HTTP

### Polling: keep asking for updates

What if our browser asks for new messages every few seconds? The server checks for updates and responds, even when there's nothing new. We display any messages it returns, wait, and ask again. That's **polling**.

Here's what our chat page might do:

![Polling repeatedly asks for updates, including checks when no new message is available.](/images/blog/websocket/polling-notebook.webp)

This works, but the polling interval becomes a tradeoff. Ask less often, and messages wait longer before appearing. Ask more often, and we send more requests, including requests whose only useful answer is "nothing yet."

Keep-alive can let us reuse a connection for these requests. We still have an HTTP request and response for every check, though.

### Long polling: wait until there's something to send

Could we avoid answering "nothing yet" over and over?

With **long polling**, the browser asks for new messages, but the server waits to finish its response until an update is available or a timeout is reached. When an update arrives, the server returns it. The browser handles the response and immediately makes another request to wait for more.

The waiting now happens inside the request:

![Long polling keeps a request pending until an update or timeout, then starts another request.](/images/blog/websocket/long-polling-notebook.webp)

We no longer need to wait for a fixed polling interval before receiving an available update. But each completed response still needs a new request to continue listening. That doesn't necessarily mean a new TCP connection; we may reuse an existing one.

The server also needs to manage pending requests and timeouts. Long polling is useful, but what if we want to keep sending updates without ending the response each time?

### Server-sent events: keep the response open

An HTTP response doesn't have to arrive all at once. The server can send part of its body, then send more later. **Server-sent events**, or SSE, use that idea to deliver a stream of text events over HTTP.

The browser requests an event stream. The server responds with the content type `text/event-stream` and keeps the response open. As updates arrive, it writes more events into that same response.

Now several messages can arrive without the browser requesting each one:

![SSE delivers several server-to-browser events within one open HTTP response.](/images/blog/websocket/sse-stream-notebook.webp)

Notice what changed from long polling: receiving an event doesn't finish the response. We're still using HTTP's request-response model, but the response is a stream.

Browsers provide an API called `EventSource` to receive these events. It can reconnect when the stream is interrupted, although recovering missed events also needs support from the server.

There's a direction to this stream: server to browser. Our chat page can still send messages using separate HTTP requests. SSE plus those requests can be a perfectly useful design; the event stream itself doesn't carry messages back to the server.

## WebSocket: let both sides send messages

So far, we've repeatedly asked for updates, waited longer for a response, and kept a response open as an event stream. Each approach is useful for different needs.

What if our application wants an ongoing conversation in both directions through the same connection? The browser might send a chat message, the server might deliver someone else's message, and either side should be able to send without starting another HTTP request-response exchange.

That's the communication model **WebSocket** provides. The client establishes the connection first. Once it's open, both sides can send messages independently, for as long as the connection remains available.

Once the connection is open, either side can send:

![An open WebSocket connection carries independently initiated messages in both directions.](/images/blog/websocket/websocket-two-way-notebook.webp)

The next question is how the browser and server establish that connection.

### Starting with an HTTP request

Let's follow our chat client connecting to the server. We'll use the HTTP/1.1 handshake here: the client establishes a TCP connection, then sends an HTTP request asking to switch to WebSocket.

For a secure connection, we use `wss://`. TLS is established before the upgrade request is sent, and continues protecting the WebSocket messages afterward.

A request for our chat endpoint might look like this:

```http
GET /chat HTTP/1.1
Host: chat.example
Origin: https://chat.example
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Version: 13
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
```

The `Upgrade` header says which protocol we want to switch to. `Connection: Upgrade` marks this as an upgrade request, and `Sec-WebSocket-Version` identifies the WebSocket protocol version the client wants to use. The browser also sends `Origin`, identifying the origin of the page opening the connection.

If the server accepts, it responds like this:

```http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

### Same connection, different rules

Do we close that TCP connection and open another one for WebSocket? No. After a successful upgrade, we keep the connection used for the handshake. What changes is how we communicate over it.

Remember HTTP keep-alive? That also kept a connection open, but we continued sending HTTP requests and responses. The WebSocket upgrade goes further: after the handshake, the connection carries WebSocket frames, which we'll look at next. Either side can send messages independently.

The change happens at the protocol level, while the underlying TCP connection stays in place:

![An HTTP/1.1 upgrade changes the message protocol to WebSocket while retaining the TCP connection.](/images/blog/websocket/websocket-upgrade-notebook.webp)

### What is the key for?

You might have noticed `Sec-WebSocket-Key` in the request and `Sec-WebSocket-Accept` in the response. Does that key log us in or encrypt our messages?

It does neither. The client supplies a randomly generated value, and the server calculates a response from it using a rule defined by the protocol. The client checks that response as part of validating the handshake.

This helps confirm that the server understood the WebSocket upgrade, rather than treating the request as an ordinary HTTP request. It doesn't prove who the user is or grant access to their account. Authentication is a separate concern.

## The connection is open. Let's send a message

Back to our chat application. The connection is ready, and the user types `Hello`. In the browser, sending that text through an already-open WebSocket can be as simple as:

```js
socket.send("Hello");
```

The server receives a WebSocket message containing `Hello`. It can send `Hi!` back over the same open connection. There is no new HTTP request for this exchange.

The server doesn't have to wait for the browser to send something first. Once the connection is open, it can also send a message when another chat user says something.

### What carries our message?

Calling `send()` doesn't just put the five letters of `Hello` onto the connection by themselves. WebSocket puts the message into a **frame**: a payload, which contains our data, plus information that helps the receiver interpret it.

For a small text message, we can picture it like this:

![A simplified WebSocket frame carries metadata alongside the Hello payload.](/images/blog/websocket/websocket-frame-notebook.webp)

That information includes the type of data and its length. WebSocket supports text messages and binary messages. Our `Hello` is text; binary messages let us send bytes without first turning them into a text format.

A message can also be split across several frames. The browser's WebSocket implementation handles that framing and delivers the complete message to our JavaScript code. We don't have to decode individual frames just to build our chat page.

### But what does `Hello` mean?

The server received the text successfully. How does it know whether `Hello` is a chat message, a username, or something else?

WebSocket doesn't decide that for us. We need an agreement between our client and server. We could decide that every text message is a chat message, but our application may also need to join a room or tell other users that someone is typing.

One option is to send JSON with a field that describes what we want to do:

```json
{
  "type": "chat-message",
  "room": "general",
  "text": "Hello"
}
```

This is still a text message to WebSocket. Our application parses the JSON, reads the fields, and decides what to do. The names `type`, `room`, and `text` are conventions we chose; they aren't built into the WebSocket protocol.

Our application gives the received text its meaning:

![WebSocket delivers text; application code interprets the JSON fields as a chat message.](/images/blog/websocket/application-message-format-notebook.webp)

So we now have a way to carry messages in both directions, but we still need rules for using those messages inside our application. As we add more kinds of messages, that agreement becomes more important.

## What happens when the connection breaks?

Our chat page can send and receive messages now. But the user might lose their internet connection, switch networks, or stay connected while the server restarts. What happens to the conversation then?

### Noticing that the connection is gone

Sometimes the browser knows the connection has closed and tells our code through a `close` event. Other failures take longer to notice. If the network suddenly stops carrying data, neither side necessarily receives a clean goodbye.

So a connection that still looks open might no longer be useful. One way to check is to exchange small messages periodically and expect a reply within a reasonable time. We usually call this a **heartbeat**.

WebSocket has Ping and Pong control frames for checking whether the other endpoint responds. Server libraries can use these, and browsers handle incoming protocol Pings automatically. Browser JavaScript doesn't directly send or receive those control frames through the standard `WebSocket` API.

We can also define a heartbeat in our application's message format. Sending the text `ping` and expecting `pong` is an application agreement, though; those text messages aren't the protocol's Ping and Pong frames. And a heartbeat reply doesn't prove that a previous chat message was saved.

### Opening another connection

Once we know the connection is gone, we can try to reconnect. The browser's standard `WebSocket` object doesn't automatically do this for us. Our code, or a library we choose, needs to create a new connection.

If it fails again, immediately retrying in a tight loop won't help an unavailable server. We can wait between attempts, increase that wait after repeated failures, and add a little randomness so many clients don't all retry at the same moment.

When an attempt succeeds, we have a new connection. Depending on our application, we may need to identify the user again and restore which chat rooms they were listening to.

### What about the messages we missed?

Suppose another user sends two messages while we're disconnected. Opening a new WebSocket doesn't automatically bring those messages back. The connection can carry new data, but WebSocket itself doesn't store our chat history.

If our application needs recovery, the server can save messages with IDs. On reconnect, the client can tell it the last message it received, and the server can return the messages after that point. This needs an application-level agreement and somewhere to keep the history.

That gives us two separate jobs: reconnect to communicate again, then recover any messages we still need.

Reconnecting and recovering missed messages are two separate steps:

![A new connection restores communication, while application-managed history supplies messages missed offline.](/images/blog/websocket/reconnect-and-recovery-notebook.webp)

### What if we don't know whether a message arrived?

There's another awkward case. We send `Hello`, the server saves it, then the connection breaks before its confirmation reaches us. From the browser's point of view, we don't know whether the message was saved.

The sequence could look like this:

![A lost confirmation causes a retry of message 42; application-level duplicate detection recognises the same ID.](/images/blog/websocket/retry-after-lost-confirmation-notebook.webp)

If we retry without any way to recognise the original message, the server might save `Hello` twice. Giving the message a unique ID lets the server recognise a retry and avoid processing the same message again. We also need to define what its confirmation means: received, saved, or delivered to another user.

WebSocket gives us a connection for exchanging messages. Heartbeats, reconnecting, restoring subscriptions, and recovering messages are additional behavior our application has to arrange. We can write that behavior ourselves, or use libraries and messaging protocols that provide parts of it. Libraries save us from implementing everything from scratch; they aren't required to use WebSocket.

## What does STOMP add?

Remember the JSON message we made earlier? It worked because we chose field names and agreed on what they meant. We could keep extending that format ourselves, adding rules for subscriptions, confirmations, and errors.

Another option is to use an existing messaging protocol. **STOMP**, short for Simple Text Oriented Messaging Protocol, gives clients and servers a shared format and a set of commands for exchanging messages.

We can carry STOMP over WebSocket, but it isn't tied to WebSocket. It can also run over a suitable transport such as TCP. In our browser application, WebSocket carries the data, and STOMP describes the messaging operations inside it.

Here is where STOMP fits in our browser application:

![STOMP adds messaging commands above WebSocket and can also operate over direct TCP connections.](/images/blog/websocket/stomp-layers-notebook.webp)

### A shared format for messages

A STOMP frame contains a command, headers, and an optional body. That frame is a different layer from the WebSocket frames we discussed earlier: WebSocket carries the STOMP data.

Before exchanging application messages, the client establishes a STOMP session. After the WebSocket opens, it sends a `CONNECT` command and waits for the server's `CONNECTED` response. Opening WebSocket and establishing the STOMP session are separate steps.

Once the session is ready, let's ask to receive messages from our general chat room:

```text
SUBSCRIBE
id:sub-1
destination:/topic/general
ack:auto

^@
```

`SUBSCRIBE` is the command. The headers give this subscription an ID, name its destination, and choose automatic acknowledgement mode. The blank line separates the headers from the body, which is empty here. In these examples, `^@` represents the null byte that ends a STOMP frame; we don't send the two literal characters.

For our example, we'll configure `/topic/general` to broadcast messages to its subscribers. That path is a server convention, not a universal STOMP rule. The protocol leaves destination naming and routing behavior to the server.

### Sending a message to the subscribers

Now our user types `Hello`. The client sends it to that destination:

```text
SEND
destination:/topic/general
content-type:text/plain

Hello^@
```

The server understands `SEND` and the destination header. It can then deliver the message to clients subscribed to our chat destination. A delivery to subscription `sub-1` looks like this:

```text
MESSAGE
subscription:sub-1
message-id:msg-42
destination:/topic/general
content-type:text/plain

Hello^@
```

The receiving client can tell which subscription this delivery belongs to. Our application still decides what to do with the body, such as displaying `Hello` in the chat window. We could also use JSON in that body; STOMP doesn't define our chat application's data fields.

Follow our subscription and one Hello message through the server:

![A STOMP server records a subscription and delivers a matching Hello message with its subscription and message IDs.](/images/blog/websocket/stomp-subscribe-send-message-notebook.webp)

### Who keeps track of the subscriptions?

The protocol describes the exchange, but software on the server has to do the work. A **message broker** receives messages, keeps track of subscriptions, and routes deliveries to the appropriate subscribers. For our chat, it remembers who subscribed to `general` and distributes messages sent to that destination.

Does that mean we need another server? Not necessarily. The broker can be a component inside our application, or a separate service such as RabbitMQ. The two arrangements look like this:

![Broker behavior can run inside the application or in an external broker reached through the application.](/images/blog/websocket/broker-placement-notebook.webp)

In the external setup shown here, the browser can use STOMP over WebSocket to reach the application, which relays STOMP over TCP to the broker. A client can also connect directly to a broker that exposes a suitable endpoint; the application intermediary isn't a requirement of STOMP.

Our application still handles its business rules, such as whether a user may send to a room. The broker handles message distribution. A broker may also offer persistence or redelivery, but those depend on its capabilities and configuration.

### Acknowledgements, heartbeats, and reconnecting

Earlier, our subscription used `ack:auto`, so it didn't require an explicit acknowledgement from the client. The server assumes receipt when it sends the message, which means an interrupted delivery can be lost. Other acknowledgement modes let the client send `ACK` or `NACK` for deliveries. These concern consuming messages from the server; they aren't proof that another chat user has read a message. Check the server's supported features too: a lightweight built-in broker may implement only part of STOMP.

STOMP also lets both sides negotiate heartbeats to help detect an unresponsive connection. These belong to the STOMP layer and are separate from WebSocket's Ping and Pong control frames.

A client library such as StompJS can handle framing, heartbeats, and reconnect attempts for us. It still needs to restore subscriptions after reconnecting. Whether missed messages can be recovered depends on the server, broker configuration, and application design. Choosing STOMP alone doesn't automatically give our chat durable history or duplicate protection.

## What does Socket.IO add?

Let's look at another way to build our chat. We still want to exchange messages, send them to the right users, and reconnect when the network drops. **Socket.IO** packages much of that behavior behind an event-based API.

### Working with named events

Earlier, we put a `type` field inside our JSON so the receiver could tell what a message meant. With Socket.IO, we can give the event a name and pass its data separately.

On an established Socket.IO client connection, sending a chat event looks like this:

```js
socket.emit("chat-message", { text: "Hello" });
```

The receiving side registers a listener for that event name. For example, a browser can listen for chat events sent by the server:

```js
socket.on("chat-message", (message) => {
  console.log(message.text);
});
```

Socket.IO encodes the event name and data for transport, then decodes them at the other end and calls the matching listener. We still choose what `chat-message` means and which fields its data should contain.

Sending this event to the server doesn't automatically broadcast it to other users. Our server code decides what happens next.

### What carries these events?

There are two layers to understand. **Engine.IO** handles the underlying connection, including transport negotiation and detecting disconnections. **Socket.IO** adds the higher-level event protocol and features such as acknowledgements and broadcasting.

When WebSocket is the selected transport, the layers look like this:

![Socket.IO events sit above Engine.IO, which can use WebSocket or another supported transport.](/images/blog/websocket/socketio-engineio-layers-notebook.webp)

Engine.IO can also use HTTP long polling, so a Socket.IO session doesn't necessarily use WebSocket throughout. Current versions also support WebTransport. Which transport is used depends on the client, server, configuration, and network.

### Sending to a room

Our chat needs to deliver a message to people in the same room. Socket.IO provides server-side groups called **rooms** for this.

Here's a small server-side example that puts every connected client in `general` and forwards incoming chat events to that room:

```js
io.on("connection", (socket) => {
  socket.join("general");

  socket.on("chat-message", (message) => {
    io.to("general").emit("chat-message", message);
  });
});
```

Clients in `general`, including the sender, receive the forwarded event. We don't need to loop through every connection ourselves. In an application with private rooms, our server also needs to decide who is allowed to join and send messages.

Here is the event reaching only the clients in general:

![A Socket.IO room broadcast reaches browsers A and B in general, including the sender, but not browser C outside it.](/images/blog/websocket/socketio-room-broadcast-notebook.webp)

This may remind you of a STOMP destination. Both can help distribute messages, but a Socket.IO room isn't a STOMP subscription. They belong to different protocols and APIs.

### Acknowledgements and reconnecting

Socket.IO supports acknowledgements through callbacks. One side emits an event, and the receiving handler can call a callback to confirm something about its processing. Our application must still define whether that means "received", "saved", or something else. An acknowledgement doesn't automatically mean another user read the message.

The client can also automatically attempt to reconnect after an unexpected disconnection. That's useful work we would otherwise have to add around the browser's WebSocket API.

But remember our missing messages? Reconnecting alone doesn't recover them. By default, Socket.IO doesn't guarantee that an event interrupted by a disconnect will be delivered. It provides ordering for events that arrive, which is a different promise.

It also offers an optional connection-state recovery feature for temporary disconnections, including recovery of missed packets when successful. That feature has configuration and deployment requirements, and recovery can fail. We still need to decide how our application restores its state when that happens.

### Do both ends need Socket.IO?

Yes: both ends need compatible Socket.IO implementations. Even when the transport is WebSocket, Socket.IO adds its own encoding and session rules.

That means our Socket.IO client can't simply connect to a STOMP endpoint. That endpoint expects STOMP commands, while this client speaks Socket.IO. Sharing the WebSocket transport doesn't make their messages compatible.

## What does each option do for our chat?

Let's come back to one message: someone types `Hello` in the `general` room. What does each option help us do with it?

With **plain WebSocket**, we can send the message over an open connection in either direction. Our code decides how to include the room name, how to find the other people in that room, and what to do if the connection breaks. We can build those features ourselves.

With **STOMP over WebSocket**, we have a shared format for messaging. A client can subscribe to a destination, and another can send a message to it. The STOMP server handles delivery according to those subscriptions and its destination rules. WebSocket carries the STOMP frames; STOMP gives the client and server commands they both understand. We still choose implementations and configure the behavior our chat needs.

With **Socket.IO**, our code works with named events such as `chat-message`. Its implementation provides features such as rooms, acknowledgements, and automatic reconnection. Engine.IO handles the underlying connection and selected transport, which can be WebSocket. We still write the chat's rules, including who can join a room and how to restore state when recovery fails.

These are three ways we could build our chat. STOMP and Socket.IO are separate choices; we don't need to stack one on top of the other. Whichever we choose, our application still decides what a message means and who is allowed to receive it.

## Bringing it back to our chat

We started with a browser asking a server for a document. For our chat, the harder question was how to receive something we hadn't just asked for. Polling, long polling, and SSE gave us ways to receive live updates over HTTP. WebSocket gave us an ongoing connection where both sides could send messages independently.

Once we had that connection, we still needed to decide what our messages meant, who should receive them, and what to do when the network disappeared. STOMP gave us a shared messaging language. Socket.IO offered another approach, with named events and behavior such as rooms and automatic reconnection.

For our chat to work well, we still have to decide what happens to a message from the moment someone sends it until the intended user receives it. Choosing a protocol or library helps with parts of that work. Understanding which parts it handles tells us what we still need to build.

## Resources

- [HTTP/1.1 — persistent connections](https://www.rfc-editor.org/rfc/rfc9112.html#section-9.3)
- [Polling and long polling — JavaScript.info](https://javascript.info/long-polling)
- [Using server-sent events — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [WebSocket — protocol specification](https://www.rfc-editor.org/rfc/rfc6455.html#section-1.1)
- [STOMP 1.2 — protocol specification](https://stomp.github.io/stomp-specification-1.2.html)
- [Socket.IO — Engine.IO and transport layers](https://socket.io/docs/v4/how-it-works/)
- [Socket.IO — delivery guarantees and application-level recovery](https://socket.io/docs/v4/delivery-guarantees/)
