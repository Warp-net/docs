---
title: Node Rating
description: How every Warpnet node is rated by the nodes around it, how a rating heals on its own, and what a low rating changes for a node.
---

# Node Rating

Every node in Warpnet has a rating: a score from 0 to 1000 that its neighbours build from what they observe it doing on the network. A node never rates itself. The first part of this page explains the rating for users and operators: what it means, how it drops, how it recovers and what a low rating does. The second part describes the model, the records and the enforcement points for developers.

## What a rating is

- **Every node type has one:** member nodes (the desktop app, the remote node), relays and moderators.
- **It is computed by others.** Each node keeps its own view of every peer it has evidence about. There is no central score and no rating field a node could fill in about itself.
- **New nodes start at full trust.** A node nobody has seen misbehave scores 1000. There is no probation period.
- **It heals on its own.** Every observation fades with time; old ones stop counting altogether.
- **It slows a node down, it never cuts it off.** A low rating lowers a node's priority and its request allowance. It never blocks a node, refuses its requests, or bans it.

## Tiers

| Score | Tier | What other nodes do |
|---|---|---|
| 800 to 1000 | trusted | Nothing special |
| 500 to 799 | watched | Lower connection priority, half the usual request allowance, a slightly negative gossip score |
| 200 to 499 | degraded | Low connection priority, a quarter of the request allowance, a lower gossip score |
| 0 to 199 | floor | Lowest priority, a tenth of the allowance, kept out of DHT routing, gossip messages ignored, images and videos stripped from posts it delivers |

A node's tier is the lowest tier across the areas it is judged on (see [Dimensions](#dimensions)). A moderator that is clean on the wire but hands out malformed verdicts is not a "mostly fine" node.

## How a node is penalised

Observations fall into three areas:

| Area | Examples of what is observed |
|---|---|
| Network (every node) | Unsigned or wrongly signed requests, malformed or oversized messages, requests with a timestamp more than 5 minutes off, calling a private route without permission, hitting rate limits, 4 connections within a minute, appearing too often in peer discovery, publishing forged rating records |
| Application | A moderator quorum upheld a report against the node's content, sending a request that claims to act for another node, sustained rate-limit hits on write routes |
| Moderation | Failing spot-checks by other moderators, not answering spot-checks, sending a verdict that names no content or user |

A failed dial is not charged at all. The "pressure" kinds are each capped per observer: reconnections at 200, rate-limit hits and discovery floods at 300. Reconnections alone therefore cost at most 200 and leave a node in the trusted tier.

## How it heals

Each observation's weight halves after a fixed time and is ignored entirely after eight half-lives:

| Area | Half-life | Ignored after |
|---|---|---|
| Network | 12 hours | 4 days |
| Application | 7 days | 56 days |
| Moderation | 7 days | 56 days |

Example: a node sends three unsigned requests to yours within an hour. Each costs 250, so your node scores it 250 (degraded). Twelve hours later the penalty has halved to about 375 and the score is about 625 (watched). After a day it is back above 800 (trusted). Nothing has to happen for this; the score is simply recomputed with less weight on old evidence.

Network problems are usually a bad build or a bad link and heal fast. Content and moderation problems last longer on purpose.

## Slander protection

Your node trusts its own eyes most. What other nodes report is weighted and capped:

- Each remote observer can lower a score by at most 150, and all remote observers together by at most 400.
- A remote observer counts only while your node is connected to it, over a connection that has been open for at least an hour. A key created a minute ago has no voice.
- A remote observer's word is weighted by how your node itself rates that observer.

The result: **reports from other nodes alone can never push a peer below 600**, the watched tier. Reaching degraded or floor takes evidence your node gathered itself. A coordinated campaign against an honest node costs it a mild priority drop and nothing more.

## Your own rating

In the desktop app and the remote node's browser dashboard, **Settings → Node rating** shows how the network sees your node: the overall score, one bar per area, and the offences recently observed with their counts. The node information panel shows the same score in short form, for example `1000/1000 trusted (0 observers)`. The mobile apps do not show ratings.

What you see there is the **public view**: for each area, the median score across the observers your node currently hears, as described below. It is built only from what other nodes wrote; your node holds no opinion of itself.

If your rating drops, the recent offences tell you what to look at:

| Offence | Usual cause |
|---|---|
| `stale_or_replayed` | The computer's clock is wrong; requests are rejected when their timestamp is more than 5 minutes off |
| `bad_signature`, `missing_signature`, `malformed_frame` | An outdated or modified build; update the app |
| `rate_limit_hit`, `write_flood` | Something is sending requests too fast |
| `connection_flap` | An unstable network connection |
| `moderation_upheld` | Content from your node was judged against the rules by moderators, see [Moderation](moderation.md) |

## What a rating does not do

- It does not block or blocklist any node. The peer blocklist is a separate, manual mechanism.
- It does not refuse routes. A node at the floor is served slowly and last, never told "no".
- It does not weight moderator votes. A vote round must reach the same result on every participant, and ratings differ between nodes.
- It does not lower anyone's rating for being outside your [trust circle](trust-circle.md).
- It is not proof. A record shows that an observer claimed something, not that it happened.

---

## Dimensions

The implementation is in [`core/rating`](https://github.com/Warp-net/warpnet/tree/main/core/rating).

| Dimension | Wire name | Half-life | Retention | Witnessed by |
|---|---|---|---|---|
| Network | `net` | 12 h | 4 d | Every node type |
| Application | `app` | 7 d | 56 d | Member and moderator nodes |
| Moderation | `mod` | 7 d | 56 d | Member and moderator nodes |

A node writes only the dimensions its role can witness: a relay records only `net`, whatever it observes. A member witnesses `mod` because a malformed verdict reaches members too.

`MaxScore` is 1000 and `MinScore` 0. A peer's score is the minimum over the dimensions with evidence; a peer with no evidence scores 1000.

## Offences

From [`offence.go`](https://github.com/Warp-net/warpnet/blob/main/core/rating/offence.go). Weight is the penalty of one occurrence before decay; ceiling is the most one kind can cost in one penalty (per observer), before it is summed.

| Wire name | Dimension | Weight | Ceiling | Raised when |
|---|---|---|---|---|
| `bad_signature` | net | 250 | none | Request signature does not verify |
| `missing_signature` | net | 250 | none | Request carries no signature |
| `private_route_denied` | net | 200 | none | Peer calls a private route it may not use |
| `oversize_payload` | net | 150 | none | Request larger than the stream limit |
| `malformed_frame` | net | 120 | none | Request envelope cannot be parsed or has no message ID |
| `stale_or_replayed` | net | 120 | none | Request timestamp outside a 5-minute window |
| `forged_observation` | net | 400 | none | Peer authored a signed rating record that breaks the structural rules |
| `rate_limit_hit` | net | 15 | 300 | Peer hits a route's rate limit |
| `discovery_flood` | net | 25 | 300 | 32 discovery events about one peer within 10 minutes |
| `connection_flap` | net | 10 | 200 | 4 connections with one peer within 1 minute |
| `moderation_upheld` | app | 300 | none | The moderator that carried a decided round charges the node named in the upheld report |
| `foreign_authorship` | app | 350 | none | Peer sends a request in the name of a node other than itself (or than the node it is paired to) |
| `write_flood` | app | 20 | 300 | 20 rate-limit hits on write routes within 5 minutes |
| `audit_invalid` | mod | 500 | none | A moderator's spot-check standing worsens to banned |
| `verdict_malformed` | mod | 200 | none | A verdict that passed the signature and vote checks names no object or user |
| `audit_wrong` | mod | 60 | 400 | A moderator's spot-check standing worsens to suspect |
| `audit_unreachable` | mod | 5 | 100 | A spot-check gets no answer |

Detection sites emit plain observations ([`core/warpnet/peer-event.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/peer-event.go)): the auth middleware, the rate limiter, the stream reader, discovery, connection events, the moderation handler, the moderator that carries a verdict and the moderator's spot-check ledger. The engine turns them into offences. A dial failure is observed but never charged. Emitters never block: if the engine falls behind, observations are dropped.

## Scoring

### Penalty with decay

Observations are counted in one-hour buckets. For one dimension and one set of records:

```text
penalty = sum over kinds of min( ceiling(kind),
              sum over records of weight(kind) x count x 2^(-age_hours / half_life) )
```

Records older than the dimension's retention contribute nothing. Decay is computed at read time, so there is no background rewrite of stored data and every node with the same records gets the same penalty.

### Local score (enforced)

This is the only score that changes how a node treats a peer ([`engine.go`](https://github.com/Warp-net/warpnet/blob/main/core/rating/engine.go)):

```text
own    = penalty(records this node wrote)                       full weight, no cap
remote = min(400, sum over other observers of
             min(150, penalty(observer's records) x w(observer)))
score  = clamp(1000 - own - remote, 0, 1000)

w(observer) = observer's score from this node's own records only / 1000
```

An observer counts only while this node has a connection to it that was opened at least one hour ago. The weight uses first-hand evidence only, so the recursion stops after one level.

### Public view (display only)

For each dimension: the unweighted median of `1000 - penalty` across observers, counting only observers this node hears (itself, or connected for at least an hour) whose records are still within retention. The overall value is the minimum across dimensions. This view never reaches a rate limiter, a priority tag or a gossip score.

## Records

A node's observations are folded per peer, dimension and hour, signed, and written every 30 seconds ([`record.go`](https://github.com/Warp-net/warpnet/blob/main/core/rating/record.go), [`domain/rating.go`](https://github.com/Warp-net/warpnet/blob/main/domain/rating.go)):

```json
{
  "peer_id": "12D3KooW...subject",
  "observer_id": "12D3KooW...observer",
  "dimension": "net",
  "bucket": 498744,
  "generation": "9f3c0a51d2e44b7a8c61e0f2b5d7a913",
  "offences": [
    {"kind": "rate_limit_hit", "count": 37},
    {"kind": "stale_or_replayed", "count": 2}
  ],
  "updated_at": "2026-11-24T00:30:00Z",
  "signature": "..."
}
```

- `bucket` is the Unix hour; `generation` is a 128-bit random value minted at every engine start.
- The signature is the observer's Ed25519 signature over `peer|observer|dimension|bucket|generation|kind=count,...|updated_at(ms)`, with offences sorted by kind. It is verified against the key embedded in the observer's peer ID.
- Kinds and dimensions travel by name, so renumbering a constant never changes what a record means.
- Each `(peer, observer, dimension, bucket, generation)` has exactly one writer for its whole life. A restarted node gets a new generation and never overwrites the records it wrote before; readers add generations up.

### Authenticity

| Case | What happens |
|---|---|
| Signature does not verify | Refused by the rating store before merge. Nobody is charged, because the named observer may be innocent |
| Signed, but breaks a structural rule (rates itself, kind from another dimension, malformed peer ID or generation, no offences) | Not used for scoring; the observer is charged `forged_observation` once, when the record arrives |
| Signed, but its bucket is past retention or more than one hour in the future | Ignored; nobody is charged (a late replica or a bad clock) |

### Replication and expiry

Records are replicated by the rating CRDT on gossip topic `/warpnet/rating/1.0.0` ([`core/crdt/rating/store.go`](https://github.com/Warp-net/warpnet/blob/main/core/crdt/rating/store.go)), keyed:

```text
/record/{peerID}/{observerID}/{dimension}/{bucket}/{generation}
```

Records are kept in one DAG per dimension and UTC day (`net-20781`, for example). About once an hour every node drops, locally, the whole days that fell out of each dimension's retention, its own records and other nodes' alike, and refuses those days from then on. No deletes travel over the network. See [Synchronization](synchronization.md) for the replication engine.

| Node | Where its replica lives | After a restart |
|---|---|---|
| Member | The encrypted local database, under `/RATING/DAYS` | Reads it from disk, catches up from peers |
| Relay | Memory | Rebuilds it from peers |
| Moderator | Memory | Rebuilds it from peers |

### Index and caching

Enforcement points never read the CRDT: they read a tier table that the engine refreshes in the background.

- Peers are loaded into an in-memory index one at a time, on first use, and kept current by the store's merge hooks.
- The index holds at most 16,384 peers; the least recently used is evicted (from the index only, never from the store).
- A computed score is reused for up to 5 minutes while the peer's records are unchanged.
- Every 30 seconds the engine re-rates every indexed peer that has records and writes its tier to the shared `PeersRatings` table (up to 4,096 entries, 24-hour expiry). A peer that is trusted, or that nobody has rated, holds no entry and reads as trusted.
- If a peer's records cannot be read, it scores 1000: an enforcement point must not act on evidence it has not seen.

## Enforcement

The modules that act on a rating read only the tier, through `PeersRatings` ([`ratings.go`](https://github.com/Warp-net/warpnet/blob/main/core/rating/ratings.go), [`tier.go`](https://github.com/Warp-net/warpnet/blob/main/core/rating/tier.go)):

| Tier | Connection tag | Gossip score | Rate multiplier | In DHT | Media kept |
|---|---|---|---|---|---|
| trusted | 60 | 0 | 1.0 | yes | yes |
| watched | 30 | -10 | 0.5 | yes | yes |
| degraded | 10 | -60 | 0.25 | yes | yes |
| floor | 1 | -200 | 0.1 | no | no |

| Module | Uses | Effect |
|---|---|---|
| Connection manager ([`core/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/node.go)) | Connection tag | A separate `rating` tag set when a peer connects and refreshed for every connected peer every 30 seconds; low-tagged peers are pruned first |
| Gossipsub ([`core/pubsub/gossip.go`](https://github.com/Warp-net/warpnet/blob/main/core/pubsub/gossip.go)) | Gossip score | Application-specific peer score. A negative score costs a peer its place in the gossip mesh; the graylist threshold is -100, so only floor peers are not read at all |
| Stream rate limiter ([`core/ratelimit`](https://github.com/Warp-net/warpnet/tree/main/core/ratelimit)) | Rate multiplier | Burst and refill rate scaled; burst never drops below 1 |
| DHT ([`core/dht/dht.go`](https://github.com/Warp-net/warpnet/blob/main/core/dht/dht.go)) | In DHT | Floor peers are kept out of the routing table and out of query results |
| Timeline and reply handlers (member nodes) | Media kept | Posts and replies delivered by a floor peer are stored without image and video keys |

Every knob is a weighting, not a refusal. Rating has no configuration and no off switch: a node cannot opt out of being rated, and a node that ignored what it observes would only be a free rider.

## Wire surface

| Route | Answers |
|---|---|
| `/private/get/admin/rating/0.0.0` | The public view of this node, built from records other nodes wrote. Used by the desktop app and the browser dashboard |

Response:

```json
{
  "node_id": "12D3KooW...",
  "overall": 625,
  "tier": "watched",
  "dimensions": [
    {
      "name": "net",
      "score": 625,
      "tier": "watched",
      "recent": [{"kind": "missing_signature", "count": 3, "last_at": "2026-11-24T09:00:00Z"}]
    }
  ],
  "observers": 1,
  "updated_at": "2026-11-24T21:00:00Z"
}
```

`recent` lists raw, undecayed counts within retention, busiest first. The handler is in [`core/handler/rating.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/rating.go).

## Limits

- **Identity is free.** A node at the floor can come back with a new key at 1000. The rating raises the cost of sustained abuse from one identity; it does not price identities.
- **Remote evidence is advisory.** The caps that defeat slander also mean an offender is fully sanctioned only by the peers it actually misbehaved against.
- **Observer weighting is circular.** A large honest-looking group can still shift the public view, which is why the public view never enforces.
- **Moderation is noisy.** Moderators may run different models and disagree honestly; spot-check offences other than invalid answers have low weights and ceilings for that reason.
- **Recovery depends on peers.** Relays and moderators get their view back only from peers that still hold the records.
- **Unsigned garbage is not attributable.** A record whose signature fails is dropped without charging anyone, so a flood of them costs bandwidth that the rating cannot price.

## See also

- [Synchronization](synchronization.md)
- [Trust circle](trust-circle.md)
- [Moderation](moderation.md)
- [Network](network.md)
- [Discovery](discovery.md)
