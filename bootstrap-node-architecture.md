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

**2. Raft Consensus**
Used to manage dynamic peer state and allow coordinated control between bootstrap nodes 
(e.g., voting, quorum-based decisions). 

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

## Consensus Role

Bootstrap nodes are the **only nodes authorized to participate in consensus** via the Raft protocol. 
They maintain a coordinated control plane over shared network state such as trusted peer registries or 
routing metadata.

### Consensus Topology Rules:

* **All Warpnet nodes may be part of the Raft voter set**
* **Only **public** bootstrap nodes may serve as Raft leader**
* **Only bootstrap nodes may initialize the consensus state (first cluster boot)**

### Leader Responsibilities:

* The **Raft leader** is responsible for managing the cluster configuration
* New bootstrap nodes are discovered via the **DiscoveryService**
* When a new candidate node is identified, the leader may call:

```go
raft.AddVoter(nodeID, address)
```

* This ensures that joining nodes are known, reachable, and authenticated via PSK

### Dynamic Membership:

* The leader uses the discovery mechanism to detect and evaluate candidates
* If a node misbehaves or becomes unreachable, the leader can remove it via:

```go
raft.RemoveVoter(nodeID)
```

This allows flexible and semi-automated control over the consensus set without requiring manual 
configuration on all nodes.

> All consensus membership changes are persisted in Raft log and replicated to all voters.

---

## Related Docs

- [Raft Protocol Specification](https://raft.github.io/raft.pdf)
- [Bootstrapping node Wiki](https://en.wikipedia.org/wiki/Bootstrapping_node)

---