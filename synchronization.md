---
title: Synchronization
description: How Warpnet nodes agree on shared counters and node ratings without a server, using signed Merkle-CRDTs split into day-sized DAGs.
redirect_from:
  - /CRDT.html
---

# Synchronization

Warpnet has no server that holds the "real" number of likes on a post or the "real" opinion of a node. A small amount of shared state is replicated between nodes as conflict-free replicated data types (CRDTs), so every node converges on the same values without coordination. This page explains which data is replicated, how changes travel, what a node refuses, how history is bounded, and how a node recovers after losing its data. The first sections are for anyone curious about how the network stays consistent; the later ones are for developers.

## In short

- Only two things are replicated network-wide: **engagement counters** (reactions, retweets, replies, views, poll votes) and **node rating records**.
- Both use the same engine: a Merkle-CRDT from [go-ds-crdt](https://github.com/ipfs/go-ds-crdt), wrapped by Warpnet in [`core/crdt/store`](https://github.com/Warp-net/warpnet/tree/main/core/crdt/store).
- Every replicated value is **signed by the node that wrote it** and checked before it is merged. A node can only ever write its own entries.
- Changes are announced over gossip and the data blocks are fetched peer to peer. There is no leader and no global order of changes.
- History is cut into **one DAG per day**. Days past the retention window are dropped and refused, which bounds how much a new node has to download.
- Nothing a peer sends can delete data on your node: deletes from peers are ignored, and only whole expired days are removed, locally.

## What is replicated

| Store | What it holds | Who runs it | Gossip topic | Kept for |
|---|---|---|---|---|
| Stats | Per-node sub-counters for reactions, retweets, replies, views and poll votes | Member nodes (desktop, remote, echo) | `/warpnet/stats/1.0.0` | 30 days after the tweet was created |
| Rating | Signed observations one node made about another | Member, relay and moderator nodes | `/warpnet/rating/1.0.0` | 4 days (network dimension), 56 days (application, moderation) |

The two stores are fully separate: each has its own datastore namespace, its own gossip topic and its own Bitswap protocol prefix (`/warpnet/stats` and `/warpnet/rating`). A go-ds-crdt instance owns its whole namespace and set of heads, so two stores sharing a topic or a datastore would merge each other's data.

## What is not replicated

Most of Warpnet is **not** in a CRDT:

| Data | How it moves instead |
|---|---|
| Posts, replies, profiles, follows, chats, media | Stored on the owner's node and exchanged over direct libp2p streams and gossip topics, see [Protocol](protocol.md) |
| Who reacted, who voted, who viewed; reactions per emoji | Kept only in the local database of the nodes involved |
| Timelines, notifications, bookmarks, settings | Local only, see [Storage](storage.md) |
| Moderation verdicts | Decided by quorum voting between moderator nodes, see [Moderation](moderation.md) |
| Trust circle | Computed in memory by each node from its owner's follow graph, see [Trust circle](trust-circle.md) |

Warpnet keeps no global ledger of its own and no total order of events. The CRDT stores only guarantee that nodes which have seen the same set of changes compute the same result.

## How a change travels

Each store is an observed-remove set of keys and values. Every local write becomes a **delta block** in a Merkle-DAG. The newest blocks are the DAG's **heads**; their content identifiers (CIDs) are announced on the store's gossip topic. A node that hears about a head it does not have fetches the missing blocks from peers over Bitswap, finding providers through the DHT, then merges them.

```mermaid
sequenceDiagram
    participant A as Node A
    participant G as Gossip topic
    participant B as Node B
    A->>A: write, sign, store delta block
    A->>G: announce new head (CID)
    G->>B: head received
    B->>B: drop heads of expired or future days
    B->>A: fetch missing blocks over Bitswap
    A-->>B: blocks
    B->>B: validate every entry, then merge
```

Engine settings, from [`core/crdt/store/store.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/store/store.go):

| Setting | Value | Meaning |
|---|---|---|
| Rebroadcast interval | 5 minutes | Heads are re-announced, so a node that missed a message catches up |
| DAG syncer timeout | 1 minute | How long a block fetch may wait |
| Workers | 16 | Blocks fetched and applied in parallel |
| Multi-head processing | on | Several heads are processed concurrently |
| Block size cap | 256 KiB | Writes are packed into as few blocks as this allows |
| Automatic repair interval | off | Replaced by one full repair at every start (see below) |

The gossip adapter ([`core/crdt/broadcast/gossip.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/broadcast/gossip.go)) buffers 100 incoming messages; when the buffer is full it drops the oldest one rather than block. A dropped announcement is recovered at the next rebroadcast. Peers that were already connected when the store starts are handed to Bitswap immediately, otherwise small clusters would not converge.

## Day DAGs

Every write is filed under a **named DAG** for one UTC day: `<prefix>-<day>`, where `<day>` is the number of days since the Unix epoch. For example, counters of a tweet created on 24 November 2026 live in `stats-20781`.

| Store | Prefix | Which day |
|---|---|---|
| Stats | `stats` | The day the tweet was created, read from the tweet's ULID |
| Rating | `net`, `app` or `mod` (the rating dimension) | The day of the record's hour bucket |

A day DAG is **live** when its name is well-formed, its prefix belongs to the store, it is not older than the store's first live day, and it is not more than one day ahead of the local clock. The rules, from [`core/crdt/store/epochs.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/store/epochs.go):

- Heads of non-live DAGs are removed from outgoing and incoming announcements, so expired days travel in neither direction.
- Once a day falls out of retention, the node drops every block of that DAG from its own datastore.
- A block reached from one day's head that claims to belong to another day is refused ([`lineage.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/store/lineage.go)).

This keeps the replicated history to a sliding window instead of the whole lifetime of the network.

## What a node accepts

Every received block is decoded through a checked delta ([`delta.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/store/delta.go)) before anything is merged:

1. **Tombstones are discarded.** A peer cannot delete anything on your node. Deletion happens only by dropping whole expired days locally.
2. **Every entry is validated** by its store. An entry that fails is removed from the block; the rest of the block is still merged.
   - Stats: the counter must carry a valid Ed25519 signature from the node named in its key, and sit in the DAG of its tweet's day.
   - Rating: the record must be signed by its observer and sit in the DAG of its own dimension and day.
3. **Replays lose.** go-ds-crdt normally picks between two values of a key by block priority, but priority is not signed. Warpnet therefore reads every stored priority as the lowest and lets the store decide: a stats counter keeps the larger running total, a rating record keeps the version with the later `updated_at`. An old value re-sent by an attacker never replaces a newer one.

On top of this, gossip messages are signed by libp2p pubsub with the sender's key (default strict signing), so a head announcement is bound to the peer that published it.

## Engagement counters

The stats store ([`core/crdt/stats/store.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/stats/store.go)) is a PN-counter: increments and decrements are kept in separate sub-counters, and each node only ever writes its own.

### Keys and values

```text
/STATS/{incr|decr}/{dataKey}/{nodeID}/{generation}
```

- `{dataKey}` is the counter's key in the local database (table below).
- `{nodeID}` is the writing node's libp2p peer ID.
- `{generation}` is a 128-bit random nonce, hex-encoded, minted once per process start.
- The value is the sub-counter's **running total** (8 bytes, big-endian) followed by a 64-byte Ed25519 signature over the key, a zero byte and the total.

| Counter | `dataKey` | Most one node can add |
|---|---|---|
| Reactions (all emoji together) | `/REACTIONS/INCR/{tweetId}` | 1 |
| Retweets | `/TWEETS/RETWEETSCOUNT/{tweetId}` | 1 |
| Replies | `/TWEETS/TWEETSCOUNT/{parentId}` | no limit |
| Views | `/TWEETS/VIEWS/{tweetId}` | 1 |
| Poll votes | `/POLLS/VOTES/INCR/{tweetId}/{option}` | 1 |

The per-node limits are defined next to each repository ([`reaction-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/reaction-repo.go), [`tweet-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/tweet-repo.go), [`poll-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/poll-repo.go)): a node's owner reacts, retweets, views and votes once, but may reply many times.

### Writing

- A user action bumps an in-memory counter. Every 30 seconds (and on shutdown) all changed counters are signed and published together.
- Because each `(node, generation)` pair has exactly one writer, a node never reads the CRDT before writing. No increment can be lost to replication lag.
- Only the node where the action **originated** bumps the replicated counter. An action is often stored on both the actor's node and the author's node; the second copy updates the local counter only, so the action is counted once.
- Duplicates are filtered locally before any CRDT write: one reaction per user per tweet (changing the emoji does not change the total), one final vote per voter, one view per viewer.
- Counters of a tweet older than 30 days, or of a tweet whose ID is not a ULID, are not replicated. Such tweets are counted from local data only.

### Reading

For each writing node, the reader sums its increments across all its generations, subtracts its decrements, drops the node if the result is zero or less, and applies the per-node limit. The totals of all nodes are then added up. The node's own not-yet-flushed changes are included.

What the app shows is the **larger** of this replicated total and the node's own local counter. If the CRDT cannot be read, or no stats store is running, the local counter is used alone.

### Where it runs

Only member nodes run the stats store: the desktop app, the remote node and the echo node. Relays and moderators do not.

## Rating records

The rating store ([`core/crdt/rating/store.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/rating/store.go)) replicates signed observations, not counters:

```text
/record/{peerID}/{observerID}/{dimension}/{bucket}/{generation}
```

The value is the JSON record, signed by the observer. A node writes only records whose observer is itself. Member nodes keep their replica in the encrypted local database; relays and moderators keep it in memory and rebuild it from peers after every restart. Scoring, signatures and enforcement are described in [Node rating](rating.md).

## Startup and recovery

### Every start

When a store starts it announces its current heads and launches a full DAG **repair** in the background. Repair walks the DAG from the heads and fetches any block that is missing. It runs unconditionally: a clean shutdown in the middle of a sync can leave a gap without marking the store dirty, and the library's own repair would not notice it.

### A new or empty node

A node with an empty replica downloads every **live** day DAG from its peers: up to 30 days of counters and up to 56 days of rating records. Heads of expired days are filtered out, so those days are never requested.

> **Note:** the stats store sets its cut-off as soon as it starts. The rating store sets its cut-off on its first clean-up pass, about an hour after start; until then it accepts rating days of any age (records past retention are still ignored when scores are computed) and drops them at that first pass.
{: .note }

### A node that lost its data

Identity is derived from username, password and network, so logging in again on a fresh database gives the same node ID. The node mints a new generation and starts new sub-counters next to the old ones. Its previous generations are still held by peers, still carry valid signatures from the same key, and are replayed back during sync. Counts converge to what they were, without double counting.

Relays and moderators keep their rating replica in memory only, so they refill it from peers this way after every restart.

### Limits

- A node can only recover what some reachable peer still holds. After a restart into an empty or partitioned network, nothing comes back until peers appear.
- Data older than the retention window is gone for everyone.
- Each restart adds a generation per counter it touches; these sub-counters live until their day expires.

## Checkpoints and compaction

**What the code does today:** history is bounded only by day DAGs and their expiry. There are no checkpoints, snapshots or compaction of a live day.

The project researched faster bootstrap in November 2026 ([`docs/CRDT_CHECKPOINT_RESEARCH.md`](https://github.com/Warp-net/warpnet/blob/main/docs/CRDT_CHECKPOINT_RESEARCH.md), in Russian). Findings, in brief:

- A fresh go-ds-crdt replica rebuilds its state by replaying the history of changes, and the unconditional repair at start walks the DAG on top of that. Removing the repair alone would not remove the initial download.
- A prototype, on a separate branch and **not** merged, placed a checkpoint block inside the DAG. Sync and repair stopped at the checkpoint and a new replica fetched only three blocks. But to keep the observed-remove semantics the snapshot had to carry every live version and tombstone (1,000 overwrites of one key still meant 1,000 blocks), a single state block was capped at 1 MiB, and there was no way to check a snapshot's correctness without trusted nodes.
- Options weighed: making repair conditional (proposed, not adopted), persistent stores for relays and moderators, a snapshot from a trusted source (rejected: there are no trusted nodes), IPFS Cluster style export and import (needs every participant to switch at once), and independent DAGs per time period.

The last option is what shipped: the day DAGs described above were added to both stores in the same week and are what bounds history today. Still open: whether compact per-author state can replace replaying changes, how a node could accept a snapshot from untrusted peers, how stale replicas are handled after pruning, and chunked state for large snapshots.

## Legacy data

Earlier versions kept unsigned counters under `/CRDT` and the rating history in a single DAG under `/RATING` in the local database. The current stores use `/STATS/DAYS` and `/RATING/DAYS` ([`stats-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/stats-repo.go), [`rating-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/rating-repo.go)). The old prefixes are left on disk and never read. Counts from that period survive only in each node's local counters, which the app still takes into account.

## Security notes

| Property | How it holds |
|---|---|
| Nobody can write another node's counter | Each counter is signed by the node named in its key; unsigned or foreign entries are dropped before merge |
| Nobody can lower someone else's count | A decrement is a node's own sub-counter and only offsets that node's increments |
| One node cannot inflate a count | Per-node limits of 1 for reactions, retweets, views and votes |
| No remote deletes | Received tombstones are discarded |
| No replays | Running totals only grow; rating records only move forward in time |
| No far-future data | DAGs more than one day ahead of the local clock are refused |

What this does **not** stop: many identities. Node IDs are free to create, so a large number of nodes can each add one reaction or view. The [node rating](rating.md) and the [trust circle](trust-circle.md) address parts of this problem; neither closes it.

## See also

- [Node rating](rating.md)
- [Storage](storage.md)
- [Protocol](protocol.md)
- [Moderation](moderation.md)
- [Architecture](architecture.md)
