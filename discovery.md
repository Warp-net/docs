# WarpNet Peer Discovery

WarpNet uses a modular discovery service to locate, connect to, and validate other peers in the network. 
It supports multiple discovery backends simultaneously, and uses a unified handler (`HandlePeerFound`) 
to process and validate incoming peer information.

---

## Core Mechanism: `HandlePeerFound`

The central function of the discovery pipeline is `discoveryService.HandlePeerFound`

This handler is passed to all major discovery backends:

* **PubSub service** (receives peer hints from gossip messages)
* **mDNS** (local peer discovery via multicast DNS)
* **DHT** (peer exchange via the distributed hash table)
* **GetInfo handler** (invoked explicitly during connection requests)

All inbound peer discovery events, regardless of source, go through this unified pipeline.

---

## Discovery Pipeline

Each discovered peer passes through several layers:

1. **Rate limiting** – using internal token limiter
2. **Duplicate filtering** – skip self and known peers
3. **Blocklist check** – ignore banned peers
4. **Connect attempt** – initiate encrypted Noise stream with PSK validation
5. **NodeInfo request** – fetch metadata (`/public/get/info`)
6. **PSK validation** – reject peers from other networks
7. **User sync** – download and store peer user profile

This ensures that only authenticated, PSK-valid, non-malicious peers are admitted.

---

## Discovery Backends

### 1. PubSub-based Discovery

Peers learn about others by observing message gossip in subscribed channels. When a message from an unknown peer
is received, its identity is passed to `HandlePeerFound`.

### 2. Multicast DNS (mDNS)

Used for LAN-based peer discovery. Each peer announces itself periodically. When a new local peer is found, 
mDNS passes its address info to the same handler.

### 3. DHT

WarpNet supports Kademlia-like routing tables. As peers join or query, addresses are learned. 
DHT internally invokes `HandlePeerFound` for each new contact.

### 4. `/public/get/info` handler

When a peer explicitly connects and requests node info, its address is passed through the discovery service.

---

## User Synchronization

Upon successful connection, the discovery service:

1. Fetches the peer's user metadata (OwnerID)
2. Verifies that no conflicting user exists
3. Stores or updates the `User` in the local database

This allows WarpNet to maintain a decentralized but consistent view of the network's users.

---

## Bootstrap Peer Handling

If the discovered peer is identified as a bootstrap node:

* It's marked as a relay candidate
* No user is synced (bootstraps don't carry profiles)
* It's added to the routing layer

---

## Summary

* Discovery is **multi-source** but centrally handled
* All discovered peers are validated cryptographically
* Only peers with a matching PSK are accepted
* Each peer is queried for metadata and user info
* Duplicate or blocklisted nodes are rejected
* Users are synced once per unique node ID

WarpNet discovery is designed for resilience, modularity, and zero-trust-by-default peer authentication.
