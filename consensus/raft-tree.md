# WarpNet Raft-Tree Consensus Model (Not implemented, TODO)

WarpNet uses an internal consensus protocol based on [Raft](https://raft.github.io/) to coordinate 
certain network-wide operations between **bootstrap nodes**. Unlike classic blockchain systems, 
consensus is not used for ordering all user actions or storing global state, but rather for 
**shared validation and coordination of core infrastructure logic**.

> ⚠️ **Scalability Note**: The canonical Raft protocol is designed for small clusters 
> (typically up to 5–10 nodes). To support broader consensus across WarpNet, the system 
> employs a **Raft Tree** architecture: a multi-layer hierarchical structure of Raft clusters.
> Each cluster operates independently but forwards certain consensus decisions upstream 
> through designated leader nodes.

## Overview

Consensus is restricted to **bootstrap nodes only**. These nodes form a bounded, trusted set of 
long-running peers that:

* maintain stable identities and addresses,
* run publicly reachable nodes,
* participate in a **Raft-based consensus tree**.

Member, business, and moderator nodes **do not participate in consensus**.

The consensus tree ensures scalability beyond the traditional Raft limit, while preserving 
the core Raft properties within each layer of the tree.

---

## Purposes of Consensus

### 1. Network Cohesion and Health

Consensus ensures that the bootstrap layer operates as a **coherent, living organism** rather 
than a random set of relays. Examples:

* agreement on who is online and healthy
* quorum-based decisions for routing
* leader election for coordination responsibilities

The Raft Tree allows these guarantees to hold across multiple Raft clusters while enabling 
horizontal scaling of bootstrap infrastructure.

---

### 2. Security and Validation

Consensus enhances **network integrity** by allowing bootstrap nodes to:

* verify the identity and status of other nodes
* reject malicious or misconfigured participants via quorum rules
* avoid sybil attacks at the control-plane level

The Raft Tree design ensures that security policies and rejection rules can propagate up 
through the consensus hierarchy without overwhelming any single Raft cluster.

---

### 3. Unique User ID Validation

The consensus layer is used to validate **global uniqueness of user IDs**.
Since data in WarpNet is local and distributed, user ID collisions are possible. 
Bootstrap nodes coordinate to:

* confirm that a user ID has not already been claimed
* reject duplicates at the time of user creation

In a Raft Tree model, this operation is routed to the **root cluster**, 
which holds the authority over globally unique keys.

---

### 4. Node's Codebase Integrity Validation

WarpNet includes **codebase integrity validation** using a consensus-based FSM 
(Finite State Machine) mechanism built on **Hashicorp Raft**. This ensures that only nodes 
with approved and previously registered code versions (identified by their code hash) 
are accepted into the cluster.

#### Motivation

To increase trust and stability in the network, WarpNet nodes now verify that consensus has 
approved a joining peer's codebase hash.
This prevents unauthorized or modified nodes from participating without explicit approval.

#### How It Works

* Each node computes a code hash (e.g., SHA256 of the source tree).
* This hash must be **pre-registered** in the Raft Tree (typically at or above the level of the joining node).
* When a node attempts to join, its hash is passed through the **FSM-based validation layer**,
  which is triggered by a `LogCommand` in the Raft log.
* FSM validators verify the hash against trusted entries in BadgerDB.
* If the hash is unrecognized or malformed, the log application is rejected and the consensus entry fails.

---

## Architecture

* Raft is deployed in a **tree topology** (Raft Tree), with multiple clusters organized hierarchically.
* Each cluster independently elects a **leader** from publicly reachable nodes.
* Leaders of lower-tier clusters act as **voters** in higher-tier clusters, recursively forming 
  a consensus tree.
* Bootstrap nodes are added to a cluster via `raft.AddVoter(...)`, initiated by the leader of that cluster.
* `DiscoveryService` integrates with Raft to facilitate cluster formation and cross-tier propagation.
* Global actions (e.g., user ID registration) are routed upward to the root cluster for final validation.

---

## Limitations

* Consensus is not used for storing application data (i.e. tweets, messages, or reactions).
* There is no distributed ledger or replicated database.
* If a local Raft cluster or upstream cluster becomes unreachable, critical operations like user 
  ID registration or node admission may fail,
  but existing local operations continue.
* Each Raft cluster is limited in size (≤10 nodes); thus the **tree structure is mandatory** 
  for scaling the network.

---

## Related Docs

* [Raft Protocol Specification](https://raft.github.io/raft.pdf)
* [LibP2P-Raft library](https://github.com/filinvadim/libp2p-raft-go)
* [Raft Tree Design](./raft_tree.md) // TODO

---

