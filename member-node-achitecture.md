### Member Node Architecture

A **member node** is the core unit of WarpNet used by regular users. It consists of several internal components 
that handle message intake, routing, storage, and optional propagation to the network.
The architecture is designed to **separate responsibilities**, ensure **local privacy boundaries**, 
and support **modular extension**.

![member-node.png](assets/member-node.png)

---

#### Message Lifecycle (User → Network)

Here is the message flow through the internal architecture of a member node:

---

#### 1. **Frontend Input**

* The user composes a message in the **frontend** (e.g., web UI).
* Once submitted, the message is **encrypted** using a session key established via ECDH (Diffie-Hellman) with the node.
* The encrypted payload is sent to the node's **WebSocket API endpoint**.

---

#### 2. **WebSocket Server**

* The **WS server** terminates the client session and receives the encrypted message.
* It performs **session-level authentication** using the established ECDH-derived symmetric key.
* Once decrypted and validated, the message is passed to the **internal message router**.

---

#### 3. **Client-Side Node Component**

* The **client node** is a logical component inside the full member node.
* It is responsible for **routing** the incoming message:

    * Validates message structure and schema.
    * Tags the message with a **local sequence number**.
    * Dispatches the message to the appropriate **protocol handler** (e.g., `timeline`, `chat`, etc.).

The client node does not persist the message permanently, and it doesn't have access to Warpnet itself.

---

#### 4. **Main Node Component**

* The **main node** (or “core node”) handles **persistence and network propagation**.
* It receives the message from the client node and:

    * Writes it to **BadgerDB** with a deterministic key
    * Optionally forwards it to **other peer nodes** via libp2p (using broadcast or direct connection)

---

#### 5. **Network Dissemination (Optional)**

* Based on node settings and message type, the message may be:

    * Broadcast to trusted peers (public posts)
    * Sent directly to recipients (private messages)
    * Withheld entirely (private or draft content)

---

### Internal Component Summary

| Component         | Responsibility                                                 |
| ----------------- | -------------------------------------------------------------- |
| **Frontend**      | Captures and encrypts user input (runs in browser)             |
| **WS Server**     | Accepts encrypted payloads and performs session authentication |
| **Client Node**   | Routes and tags messages, selects appropriate protocol path    |
| **Main Node**     | Stores messages, propagates to network, applies moderation     |
| **Storage Layer** | Writes all persisted data using BadgerDB with ordered keys     |

---

> The separation between *client node* and *main node* ensures that business logic (routing, protocol parsing) 
> remains decoupled from long-term storage and peer interaction.

---

### Sequence diagram

```
User        Frontend       WS Server     Client Node     Main Node     Other Peers
 |              |               |              |              |             |
 |  type msg    |               |              |              |             |
 |─────────────>|               |              |              |             |
 |              | encrypt msg   |              |              |             |
 |              |──────────────>|              |              |             |
 |              |               | decrypt &    |              |             |
 |              |               | auth session |              |             |
 |              |               |─────────────>|              |             |
 |              |               |              | route msg    |             |
 |              |               |              |─────────────>|             |
 |              |               |              |              | persist     |
 |              |               |              |              | & tag msg   |
 |              |               |              |              |────────────>|
 |              |               |              |              | optional     |
 |              |               |              |              | share       |
```
