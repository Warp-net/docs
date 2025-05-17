# WarpNet Protocol

This document describes the peer-to-peer communication layer of WarpNet, including transport channels, routing logic, and delivery semantics. It focuses on how nodes exchange encrypted messages over libp2p.

---

## 1. Transport Protocols

WarpNet uses [libp2p](https://github.com/libp2p/go-libp2p) as its networking layer. 
Communication between nodes occurs over authenticated and encrypted channels using the **Noise** protocol 
and a shared **PSK**.

### What is a libp2p stream?

A **libp2p stream** is:

* A **logical connection**, established between two peers *on top of an existing libp2p connection*
* Identified by a **protocol ID string**, such as `/private/post/tweet/0.0.0`
* **Multiplexed**: multiple streams can share a single physical connection (e.g., TCP + Noise)
* **Bidirectional**: both peers can read and write from/to the stream
* Automatically encrypted and authenticated using the Noise protocol + PSK

---

### How streams are used in WarpNet

Every operation between two WarpNet nodes uses a distinct libp2p stream. For example:

* A timeline post opens a stream using protocol `/private/post/tweet/0.0.0`
* A request to fetch the user's timeline opens a stream `/private/get/timeline/0.0.0`
* A public message broadcast to a peer opens a stream `/public/post/message/0.0.0`

Each stream is:

1. **Opened by the initiating node**
2. **Processed by the recipient’s stream handler**, which is registered per protocol route
3. **Closed** once the operation is complete

---

### Stream-level Isolation

* Stream operations are **sandboxed by protocol**
* Each handler in the node is registered to a specific protocol path
* Streams are subject to **authorization middleware**, especially for private routes 
  (see 4. Stream Authentication Middleware)

---

All WarpNet protocols follow a structured URI-style format that encodes access level, operation type, 
resource domain, and version. This convention is used to route and dispatch messages between peers, 
and also to enforce access boundaries.

```text
/{visibility}/{operation}/{domain}/{version}
```

Where:

| Segment      | Meaning                                           | Example             |
| ------------ | ------------------------------------------------- | ------------------- |
| `visibility` | `public` or `private` access                      | `/private/...`      |
| `operation`  | `get`, `post`, `delete`, etc.                     | `/post/...`         |
| `domain`     | Logical entity (e.g., `tweet`, `message`, `user`) | `/tweet/`, `/chat/` |
| `version`    | Semantic version of protocol                      | `/0.0.0`            |

This makes the protocol self-descriptive and extensible without breaking compatibility.

### 🧾 Example

```text
/private/post/tweet/0.0.0
```

> A private POST call to submit a new tweet using protocol version 0.0.0

---

## Full List of Supported Protocols

Here is the current list of all supported protocol routes used by member nodes:

### Private Protocols

#### `POST`

* `/private/post/admin/pair/0.0.0`
* `/private/post/login/0.0.0`
* `/private/post/logout/0.0.0`
* `/private/post/tweet/0.0.0`
* `/private/post/user/0.0.0`
* `/private/post/reset/0.0.0`
* `/private/post/image/0.0.0`

#### `GET`

* `/private/get/admin/stats/0.0.0`
* `/private/get/chat/0.0.0`
* `/private/get/chats/0.0.0`
* `/private/get/message/0.0.0`
* `/private/get/messages/0.0.0`
* `/private/get/timeline/0.0.0`

#### `DELETE`

* `/private/delete/chat/0.0.0`
* `/private/delete/message/0.0.0`
* `/private/delete/tweet/0.0.0`

---

### Public Protocols

#### `GET`

* `/public/get/followees/0.0.0`
* `/public/get/followers/0.0.0`
* `/public/get/info/0.0.0`
* `/public/get/replies/0.0.0`
* `/public/get/reply/0.0.0`
* `/public/get/tweet/0.0.0`
* `/public/get/tweetstats/0.0.0`
* `/public/get/tweets/0.0.0`
* `/public/get/user/0.0.0`
* `/public/get/users/0.0.0`
* `/public/get/image/0.0.0`

#### `POST`

* `/public/post/admin/verifynode/0.0.0`
* `/public/post/chat/0.0.0`
* `/public/post/follow/0.0.0`
* `/public/post/like/0.0.0`
* `/public/post/message/0.0.0`
* `/public/post/reply/0.0.0`
* `/public/post/retweet/0.0.0`
* `/public/post/unfollow/0.0.0`
* `/public/post/unlike/0.0.0`
* `/public/post/unretweet/0.0.0`

#### `DELETE`

* `/public/delete/reply/0.0.0`

---

## Benefits of Structured Protocols

* **Self-documenting**: Each protocol clearly communicates its purpose
* **Modular dispatch**: Handlers can be dynamically mapped via URI parsing
* **Access control**: Easy to enforce public/private rules by prefix
* **Versionable**: Future changes can use semantic versions without breaking older clients

All application-layer messages are serialized as raw JSON (or binary encoding TBD), and transmitted over multiplexed libp2p streams.

---

### Example: Posting a Tweet

1. The frontend sends an encrypted message to the local node via WebSocket
2. The client node routes it to the main node
3. The main node dials the appropriate peer and opens a stream:

   ```
   body := event.NewTweetEvent{
            CreatedAt: tweet.CreatedAt,
            Id:        tweet.Id,
            ParentId:  tweet.ParentId,
            RootId:    tweet.RootId,
            Text:      tweet.Text,
            UserId:    tweet.UserId,
            Username:  tweet.Username,
            ImageKey:  tweet.ImageKey,
       }
   stream := host.NewStream(ctx, peerID, "/private/post/tweet/0.0.0", body)
   ```
4. The message is written to the stream and the stream is closed

---

### Stream Format

All stream payloads are currently:

* Serialized as **JSON** objects (subject to change)
* Encapsulated per stream: no interleaving, each stream handles a single logical operation
* Length-prefixed (handled by libp2p's stream muxer)

---

## 2. Message Routing

When a message arrives at the node (via WS or internal interface), it is routed based on its type:

- **Public timeline post** → sent to all known friends via `public/post/timeline/0.0.0`
- **Private message** → dialed directly to recipient via `/private/get/chat/0.0.0`

Routing logic is implemented in the **client node**, while **message storage and broadcast** happens 
in the **main node**.

---

## 3. Delivery Semantics

WarpNet operates under **best-effort, eventually-consistent delivery**:

- No strict delivery guarantees are provided
- Duplicate messages are allowed and must be filtered locally
- Each message includes a unique identifier and timestamp
- Timeline merge is **deterministic per node** based on user ID and timestamp

There is no centralized queue or acknowledgment mechanism. All reliability must be handled by retry 
or idempotent storage.

---

## 4. Stream Authentication Middleware

All incoming libp2p streams in WarpNet pass through an **authorization middleware** that 
ensures **only the designated client node** can access private routes on the host node.

### Purpose

* Enforce **access boundaries** between external clients and node internals
* Prevent unauthorized libp2p peers from calling `private/*` protocol handlers
* Allow exactly **one tethered client node** per runtime session

---

### How It Works

1. When a new stream is opened:

    * If the protocol is `PRIVATE_POST_PAIR`, the **first peer to connect** is **registered as the 
      authorized client node**.
    * Its `RemotePeer()` (libp2p PeerID) is stored in `p.clientNodeID`.

2. For all future **`private/*` protocol streams**:
    * The handler **rejects** the stream if:
        * `clientNodeID` is not yet set, or
        * The caller’s `RemotePeer()` ≠ `clientNodeID`
    * If the protocol is **`public/*`**, no check is performed — it's allowed from any peer.

This mechanism allows one and only one **"client-facing" peer** to interact with internal private protocols 
of the node during its lifecycle.

---

### Security Implications

* Once a `clientNodeID` is tethered, only that peer can perform actions like:

    * Posting tweets
    * Reading timelines
    * Deleting chats/messages
* All other peers attempting to access `/private/*` will be rejected with an `ErrUnknownClientPeer`

---

### Lifecycle Consideration

If the node restarts or is re-initialized, a **new `PRIVATE_POST_PAIR`** must be sent to re-bind the client node.

> ❗There is no revocation or rebind support in current implementation — first bind wins for the session.

---

