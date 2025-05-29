Отлично, Вадим. Вот строгое и подробное описание **консенсуса в WarpNet**, отражающее его текущие и потенциальные задачи:

---

# WarpNet Consensus Model

WarpNet uses an internal consensus protocol based on [Raft](https://raft.github.io/) to coordinate certain network-wide operations between **bootstrap nodes**. Unlike classic blockchain systems, consensus is not used for ordering all user actions or storing global state, but rather for **shared validation and coordination of core infrastructure logic**.

## Overview

Consensus is restricted to **bootstrap nodes only**. These nodes form a bounded, trusted set of long-running peers that:

* maintain stable identities and addresses,
* run publicly reachable nodes,
* participate in a Raft-based consensus cluster.

Member, business, and moderator nodes **do not participate in consensus**.

---

## Purposes of Consensus

### 1. Network Cohesion and Health

Consensus ensures that the bootstrap layer operates as a **coherent, living organism** rather than a random set of relays. Examples:

* agreement on who is online and healthy
* quorum-based decisions for routing
* leader election for coordination responsibilities

This makes peer discovery and routing more stable, especially in dynamic network conditions.

---

### 2. Security and Validation

Consensus enhances **network integrity** by allowing bootstrap nodes to:

* verify the identity and status of other nodes
* reject malicious or misconfigured participants via quorum rules
* avoid sybil attacks at the control-plane level

It acts as a decentralized trust root without needing a certificate authority.

---

### 3. Unique User ID Validation

The consensus layer is used to validate **global uniqueness of user IDs**. 
Since data in WarpNet is local and distributed, user ID collisions are possible. Bootstrap nodes coordinate to:

* confirm that a user ID has not already been claimed
* reject duplicates at the time of user creation

This ensures that `@12345678` means the same person across the network, without requiring global account registration.

---

### 4. Node's Codebase Integrity Validation

WarpNet includes **codebase integrity validation** using a consensus-based FSM (Finite State Machine) 
mechanism built on **Hashicorp Raft**. This ensures that only nodes with approved and previously 
registered code versions (identified by their code hash) are accepted into the cluster.

#### Motivation

To increase trust and stability in the network, WarpNet nodes now verify that consensus has approved a 
joining peer's codebase hash.
This prevents unauthorized or modified nodes from participating 
without explicit approval.

#### How It Works

* Own node code hashes (e.g., SHA256 of the node’s source tree) must be previously registered and stored 
  in the system under a known consensus key.
* When a node attempts to join, its hash is passed through the **FSM-based validation layer**, 
  which is driven by Raft.
* FSM validators are executed for every `LogCommand` entry applied to the consensus log. Such 
  validator nsures the node's hash is already stored in the BadgerDB. 
  If the hash isn't found or is malformed, the log application is rejected and consensus finishes with error.

---

## Architecture

* Raft runs on each node.
* A single node is elected **leader**. Only public node could be leader.
* New bootstrap nodes are added via `raft.AddVoter(...)`, initiated by the leader.
* DiscoveryService integrates with Raft to identify and connect new voters.
* Any changes (adding/removing voters) are replicated through the consensus log.

---

## Limitations

* Consensus is not used for storing application data (i.e. tweets, messages, or reactions).
* There is no distributed ledger or replicated database.
* If the consensus cluster is unreachable or degraded, new user ID registrations may fail, 
  but local operation continues.

---

## Related Docs

- [Raft Protocol Specification](https://raft.github.io/raft.pdf)

---