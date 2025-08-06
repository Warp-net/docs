# WarpNet Architecture

WarpNet is a fully decentralized, peer-to-peer (P2P) social network. 
It is designed to operate without central servers, providing each user with full control over their data,
identity, and communication. This document outlines the architectural structure of WarpNet, including its 
core components and how they interact.

---

## Core Components

### 1. **Node**

Each WarpNet instance is a self-contained **node**, responsible for:

- Storing the user’s data locally (using [BadgerDB](https://github.com/dgraph-io/badger))
- Connecting to other peers via [Libp2p](https://github.com/libp2p/go-libp2p)
- Exchanging encrypted messages
- Enforcing local moderation and storage policies (TODO)
- Connecting to other peers via Libp2p
- Agreeing on some network state via [Raft](https://github.com/hashicorp/raft)

Nodes form the backbone of the network. There is no central server — only independent peers.

#### 🔹 Node Types

WarpNet defines four primary node roles:

| Node Type     | Description                                                                                                                                                     |
| ------------- |-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Bootstrap** | Provides initial peer discovery via DHT or MDNS. Does **not store user content (and any application layer content)**. Acts as a relay for initial connectivity. |
| **Member**    | A standard user node. Stores profile, timeline, chats, and peer data locally. Participates fully in message exchange.                                           |
| **Business**  | A special-purpose node that can represent an organization or service. May publish sponsored content.                                                            |
| **Moderator** | A node configured for content filtering and moderation. May run AI models (e.g., via LocalAI) and flag or block content based on custom policies.               |

All nodes are technically equal in protocol rights; these types are defined by **behavior and configuration**, not protocol-level enforcement.

---

### 2. **Identity**

## Identity

Each WarpNet node has a **cryptographic identity** defined by the [libp2p](https://libp2p.io) stack. 
This identity is used to uniquely identify peers at the transport layer and establish 
encrypted channels.

### Libp2p Peer Identity

Libp2p generates a **peer ID** from the node’s public key:

* Nodes are assigned an asymmetric keypair on first startup (e.g., Ed25519 or RSA).
* The **public key** is hashed (using SHA-256) to generate a stable **Peer ID**.
* The **Peer ID** is used for:

    * Stream routing
    * Peer discovery
    * Signature verification of message envelopes
    * Noise handshake (in `libp2p-noise` mode)

WarpNet does **not expose** Peer IDs as usernames or global handles. They are used strictly within the transport and trust layer.

> Example:
> `QmZxu3P3AnkVxyz...` ← libp2p Peer ID (Base58 of public key hash)

---

### PSK and Network Access

In addition to identity, WarpNet uses a **Pre-Shared Key (PSK)** to define network access boundaries.

* The PSK is injected into the libp2p transport layer using `libp2p/pnet` (private networks).
* Peers must prove possession of the same PSK to connect.
* Even valid Peer IDs are rejected if the PSK does not match.

> ⚠️ Peer identity ≠ network membership.
> Only peers with valid PSK **and** known public key can participate in the WarpNet overlay.

---

### 3. **Networking**

WarpNet uses [libp2p](https://libp2p.io) for peer discovery and transport abstraction. Networking includes:

- **Direct peer-to-peer connections**
- **Bootstrap node discovery** via shared keys and static IPs
- **Gossip-style broadcast** for timeline propagation
- **Latency-based routing** (for optional future ad delivery)
- **Relay traffic routing** 

NAT traversal is attempted via libp2p’s built-in mechanisms.

---

### 4. **Storage Layer**

Storage is strictly local. No data is replicated unless the user configures backup/export mechanisms manually.

---

### 5. **Moderation**

Warpnet filters and moderates content on a per-node basis.
It is fully supported by LLM moderator node using
IPFS and Llama 7b chat AI model.

---

## Peer Discovery and Topology

- Bootstrap nodes provide initial peer lists via static DNS/IP + shared PSK
- After the first connection, peers share additional addresses
- Peers are cached locally and reconnected to opportunistically
- WarpNet does use DHT and MDNS discovery by default

---

## Security Model

WarpNet employs a layered security architecture spanning peer-to-peer transport, user interface communication, 
and message-level authenticity.

---

### 1. Peer-to-Peer Transport Security (Noise + PSK)

All connections between WarpNet nodes are secured using the **Noise Protocol Framework** via the libp2p 
transport layer.

- The `XX` or `IK` Noise handshake provides **mutual authentication** and **forward secrecy**
- Session keys are derived using ephemeral key exchanges
- All communication is **encrypted** and **authenticated**

Additionally, all nodes must present a valid **Pre-Shared Key (PSK)** to participate in the WarpNet overlay. 
The PSK acts as a cryptographic admission token.

#### PSK Generation

The PSK is deterministically derived from:

- Network identifier (e.g. `"testnet"`)
- **Hash of the node’s codebase**
- Major version number
- Local entropy (anchored randomness)

This ensures that only nodes running matching versions and code can join the same network.

## Consistency Model

WarpNet implements a **hybrid consistency model** combining **local transactional guarantees** 
with **eventual global consistency** across the peer-to-peer network.

---

### Local Consistency (ACID)

Each WarpNet node uses an embedded **BadgerDB** key-value store, which provides:

- **ACID properties** for local operations
- **Strict write ordering** for messages and state transitions
- **Deterministic merge behavior** via sortable keys (e.g., prefixed by timestamp or logical counter)

This ensures that within a single node:

- Messages are stored and processed in a defined, conflict-free order
- Timeline entries and chats are persisted reliably, even across crashes
- Local views are fully consistent and fault-tolerant

---

### Global Consistency (Eventual)

Between nodes, WarpNet relies on **eventual consistency**:

- Messages may arrive in any order and with delay
- There is **no global clock**, only **logical timestamps** (or per-node counters)
- Timeline reconstruction is based on:
    - Origin node ID
    - Origin User ID
    - Local message timestamp

Each node independently merges remote updates into its local view according to its own consistency rules. 
There is no centralized coordination or conflict resolution mechanism.

> In summary:  
> **Local state is strictly ordered and consistent.**  
> **Global state is eventually convergent, but unordered.**

---

## Example Lifecycle of a Message

1. User writes a post on their node
2. Post is timestamped and post ID generated
3. Node broadcasts the post to connected peers (only followers)
4. Posts propagate transitively through the network
5. Moderation filters apply on receipt or rendering 

---

## Extensibility

The protocol and data formats are versioned. Nodes can implement optional capabilities such as:

- End-to-end encrypted chats
- AI moderation functionality (TODO)
- Offline sync/export (TODO)
- Feed ranking or recommendations (TODO)

---

## Related Docs

- [Protocol Specification](./protocol.md)
- [Storage Structure](./storage.md)
- [Security & Encryption](./security.md)
- [Moderation System](./moderation.md)

---
