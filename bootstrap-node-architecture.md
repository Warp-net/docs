# WarpNet Bootstrap Node Architecture

A Bootstrap Node in WarpNet is a special-purpose libp2p node used to help new peers join the network. 
It performs peer discovery, propagates routing information, and provides public stream endpoints for 
essential metadata and validation. It does **not** participate in accessing and storing user content or timelines.

---

## Responsibilities

* Accept inbound peer connections using Noise + PSK
* Act as an entry point for peer discovery
* Act as relay for private nodes connection (nodes behind NAT)
* Host a public DHT and PubSub overlay
* Participate in public streams (e.g., `verifynode`, `get/info`)
* Optionally coordinate with other bootstrap nodes via Raft consensus

---

## Internal Components

**1. Core**
The core bootstrap node, initialized with:

* Noise protocol (encrypted and authenticated transport)
* PSK-gated access
* Static public address
* Relay service (so NATed nodes can connect)
* Full resource manager and connection limits

**2. Deprecated**

**3. DiscoveryService**
Handles:

* Initial peer exchange
* Maintenance of known node address book
* Exposure to gossip layer

**4. PubSubService**
Enables lightweight gossip-based dissemination of verification and infrastructure-related announcements.

**5. DistributedHashTable (DHT)**
Provides optional routing for peer lookup and proximity queries. State is ephemeral (in-memory).

**6. In-Memory Peerstore**
Stores libp2p peer information (PeerID, addresses) without persistence. Cleaned on shutdown.

---

## Stream Behavior

Bootstrap nodes do not respond to or emit user-level content streams (e.g., timeline, chat). They only respond to:

* Public stream routes for Consensus validation (`/public/post/admin/verifynode`)
* Node metadata retrieval (`/public/get/info`)
* Discovery and peer status tracking (internal use)

---

## PSK and Access Control

* The PSK is derived and required at startup.
* If the connecting peer does not present a matching PSK, Noise handshake fails.
* This prevents unauthorized nodes from discovering or accessing the bootstrap node.

---

## Network Behavior

* Bootstrap nodes are marked as **publicly reachable** by default, overriding libp2p’s NAT detection.
* Relay services are enabled to allow NATed peers to communicate through the bootstrap node.
* Hole punching and NAT service are enabled to assist connecting peers.

---

## Persistence and Memory

* All data is kept in memory (`pstoremem`, `datastore.NewMapDatastore`)
* No filesystem writes occur
* Bootstrap nodes are stateless and disposable by design

---

## Related Docs

- [Bootstrapping node Wiki](https://en.wikipedia.org/wiki/Bootstrapping_node)

---