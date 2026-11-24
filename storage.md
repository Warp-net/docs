---
title: Local Storage
description: Where a Warpnet node keeps its data, how the database is encrypted with a key derived from your password, how keys are laid out, and what expires on its own.
---

# Local Storage

Every member node keeps its owner's data in an encrypted database on the owner's own disk: posts, profile, follows, chats, media, settings and the node's share of the replicated stores. This page covers where that database lives, how it is encrypted, how keys are organised, what is deleted automatically, the outbox for offline peers, and the in-memory mode used by test nodes. The first sections are for users and operators; the rest is for developers.

## Overview

| Topic | Answer |
|---|---|
| Engine | [BadgerDB](https://github.com/dgraph-io/badger) v4, an embedded key-value store |
| Encryption | Always on, with a key derived from your username and password |
| Location | `~/.warpdata` on Linux, macOS and Android; `%LOCALAPPDATA%\warpdata` on Windows |
| One database per | Network (`warpnet`, `testnet`) and database directory name |
| Who stores data on disk | Member nodes: the desktop app and the remote node |
| Who keeps its data in memory only | Echo nodes, relays and moderators |
| Backup or export command | None (see [Backup](#backup-and-export)) |

## Where data lives

The application directory depends on the operating system ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)):

| OS | Application directory |
|---|---|
| Linux, macOS, Android | `$HOME/.warpdata` |
| Windows | `%LOCALAPPDATA%\warpdata` (the node exits if the variable is missing) |
| Anything else | Not supported; the node exits |

Inside it, the database path is built from three parts, and the database adds a schema-version folder:

```text
<application dir>/<network>/<database dir>/v0
```

With the defaults (`--node.network=warpnet`, `--database.dir=storage`) that is `~/.warpdata/warpnet/storage/v0`. A typical tree:

```text
~/.warpdata/
├── fontconfig.conf        Linux desktop app only (font settings for the window)
├── warpnet/               main network
│   ├── ws-noise.key       remote node only
│   └── storage/
│       └── v0/
│           ├── run.lock   written after the first successful login
│           └── ...        BadgerDB files
└── testnet/
    └── storage/
        └── v0/
```

| Setting | Flag | Environment variable | Default |
|---|---|---|---|
| Network | `--node.network` | `NODE_NETWORK` | `warpnet` (`mainnet` is accepted as an alias) |
| Database directory name | `--database.dir` | `DATABASE_DIR` | `storage` |

There is no configuration file: settings come from flags and environment variables. Running on testnet, or with another `--database.dir`, gives a completely separate database. This is how several nodes can run on one machine.

`ws-noise.key` is the remote node's static key for the encrypted dashboard channel. It is a plain file readable only by its owner (mode `0600`) and sits outside the encrypted database.

In the project's Docker deployments the node runs as `root`, so the data is under `/root/.warpdata`; mount a volume there to keep it across container restarts.

> **Warning:** BadgerDB locks its directory, and the desktop app allows only one running instance. Two nodes cannot share one database directory.
{: .warning }

## Which nodes store what

| Node | Database | Replicated stores |
|---|---|---|
| Desktop app (member) | Encrypted BadgerDB on disk | Stats and rating, inside the same database |
| Remote node (member) | Encrypted BadgerDB on disk | Stats and rating, inside the same database |
| Echo node (member, test bot) | BadgerDB **in memory** | Stats and rating, in memory |
| Relay | No BadgerDB; in-memory datastores for the peerstore and DHT | Rating only, in memory |
| Moderator | No BadgerDB; in-memory datastores | Rating only, in memory |

Relays and moderators lose their state on restart and get their rating view back from peers, see [Synchronization](synchronization.md#startup-and-recovery).

## Encryption at rest

The database is opened only after login, with a key derived from your credentials ([`security/kdf.go`](https://github.com/Warp-net/warpnet/blob/main/security/kdf.go), [`security/aes.go`](https://github.com/Warp-net/warpnet/blob/main/security/aes.go)):

```text
salt = SHA-256("warpnet/kdf/v1/database-key" || 0x00 || username)
key  = Argon2id(password, salt, time=1, memory=64 MiB, threads=4, length=32 bytes)
```

- The 32-byte key is passed to BadgerDB as its encryption key and is never written to disk.
- BadgerDB encrypts its files with AES (a 32-byte key selects AES-256) in CTR mode. It encrypts data with internal data keys, which are themselves protected by this key and rotated every 10 days by default.
- A wrong username or password fails to open the database and is reported as "wrong username or password".
- The database key depends only on username and password. Networks are kept apart by directory, not by key.
- Your node's identity key is derived separately, from username, password **and** network, with its own context string. See [Security](security.md).

There is no password recovery and no password change. If you forget your password, the database cannot be decrypted. Because identity is derived from the same credentials, logging in with them on another machine gives the same node ID, but the data itself is only in the old database.

## Engine settings

From [`database/local-store/db.go`](https://github.com/Warp-net/warpnet/blob/main/database/local-store/db.go):

| Setting | On disk | In memory |
|---|---|---|
| Synchronous writes | off | off |
| Compression | ZSTD | none |
| Index cache | 256 MiB | 256 MiB |
| Block cache | 512 MiB | 512 MiB |
| Compactors | 4 | 2 |
| Value-log garbage collection | at start, then every hour | not run |
| Directory watcher | every second | not run |

With synchronous writes off, BadgerDB does not force each write to disk. A power loss or OS crash can lose the most recent writes.

A BadgerDB sequence under the key `/SEQUENCE` hands out monotonic numeric IDs.

## Lifecycle

1. **Start.** The node prepares the database but does not open it yet. It checks whether `run.lock` exists in the database folder; if not, this is a first run.
2. **Login.** The key is derived and the database opened. On the first successful login `run.lock` is written.
3. **Running.** Value-log garbage collection runs once at start and then every hour, repeating until BadgerDB reports nothing left to rewrite. Every second the node checks that `run.lock` is still there; if the folder has been emptied while the node runs, the node stops with an error instead of carrying on with a blank database.
4. **Logout or shutdown.** The database is closed. Logging in again reopens it.

## Key layout

BadgerDB is a flat, byte-sorted key-value store. Warpnet builds path-like keys with a prefix builder ([`prefix-tree.go`](https://github.com/Warp-net/warpnet/blob/main/database/local-store/prefix-tree.go)):

```text
/<NAMESPACE>[/<SUBPREFIX>...]/<root id>/<range>/<id>[/<id>...]
```

- **Namespace:** upper-case, one per repository, for example `/TWEETS`.
- **Root ID:** usually the owning user's ID.
- **Range:** the literal `fixed`, the literal `none`, or a number.
- **IDs:** ULIDs, hashes or peer IDs.

### Fixed and sortable keys

Most listed entities are written twice. A post, for example:

```text
/TWEETS/{userId}/fixed/{tweetId}                 -> the sortable key below
/TWEETS/{userId}/9223370241376375807/{tweetId}   -> the post as JSON
```

(The number is the reversed timestamp of a post made at 00:00 UTC on 24 November 2026.)

The **fixed** key finds an item by ID. The **sortable** key carries a reversed timestamp, `MaxInt64 - unixMillis`, zero-padded to 19 digits, so a plain prefix scan returns the newest items first. Scans refuse a prefix containing `fixed` and skip any `fixed` key they meet, so listings never return an item twice.

### Listing

Prefix scans are paginated. A page holds 20 items by default and at most 1,000. The scan returns an opaque cursor for the next page, or the literal `end` when the prefix is exhausted. Large batch writes that exceed one transaction are committed and resumed automatically.

## Namespaces

| Prefix | Contents |
|---|---|
| `/AUTH` | The owner record (user ID, login, creation time) |
| `/USERS` | Profiles: the owner's and every user this node has seen |
| `/TWEETS` | Posts, edits, reply and retweet counters, retweeters, viewers, view counters |
| `/TIMELINE` | The owner's home timeline |
| `/REACTIONS` | Reaction totals, per-emoji counts, who reacted |
| `/POLLS` | Poll vote counters and who voted for what |
| `/FOLLOW` | Followings, followers, counts, follow requests |
| `/SUBSCRIPTIONS` | "Notify me about new posts from this user" |
| `/BLOCKS`, `/MUTES` | Users the owner blocked or muted |
| `/FILTERS` | The owner's content filters |
| `/BOOKMARKS` | Bookmarked posts |
| `/NOTIFICATIONS` | Notifications |
| `/CHATS`, `/MESSAGES` | Direct chats and their messages |
| `/MEDIA` | Images and videos of posts |
| `/CHATMEDIA` | Chat attachments |
| `/SPONSOREDMEDIA` | Per-buyer marked copies of paid media and image hashes of posts |
| `/ORDERS`, `/ORDERPAYERS` | Orders for paid posts and the payer addresses bound to them |
| `/WALLETS` | Public wallet addresses per chain and user |
| `/SETTINGS` | Notification settings and node settings (gateway, rate limits, sponsored content, network, wallet) |
| `/ALIASES` | Paired mobile devices |
| `/OUTBOX` | Writes waiting for an offline peer (see below) |
| `/NODES` | The libp2p peerstore, DHT records and the peer blocklist |
| `/STATS/DAYS` | Replica of the stats CRDT |
| `/RATING/DAYS` | Replica of the rating CRDT |
| `/SEQUENCE` | BadgerDB's ID sequence |
| `/ECHO_SEEN` | Echo test nodes only |

The repositories are in [`database/`](https://github.com/Warp-net/warpnet/tree/main/database), one file per namespace.

## What expires on its own

Some entries are written with a time-to-live and BadgerDB drops them automatically:

| Data | Kept for |
|---|---|
| Notifications | 24 hours |
| Paired devices | 72 hours |
| Cached images and videos from other users | 7 days |
| Posts fetched from another node while browsing its profile | 30 days |
| Outbox messages | 30 days |
| Peer blocklist entries | 1 hour, 24 hours, 7 days, then permanent, escalating on each repeat |

Your own content (posts, chats, timeline, settings, bookmarks, follows) has no expiry.

The replicated stores clean up separately: counters of posts older than 30 days and rating records past their retention are dropped day by day, see [Synchronization](synchronization.md#day-dags).

## Outbox

When a member node sends a write to another node (a follow, a reply to someone's thread, and similar non-read requests), the write is first stored in the outbox and then sent ([`core/stream/outbox.go`](https://github.com/Warp-net/warpnet/blob/main/core/stream/outbox.go), [`database/outbox-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/outbox-repo.go)).

```text
/OUTBOX/{destinationNodeId}/{messageId}   -> route, body, timestamp (JSON)
```

- If the peer confirms, the entry is deleted.
- If the peer is offline or the send fails, the entry stays and the caller is told the write was queued.
- Queued writes are retried when the peer connects, every 5 minutes, and when the node starts.
- If the peer answers with a rate-limit error, that route stays queued for the next attempt.
- The same write queued twice in a row for the same peer is stored once.
- Read requests are never queued.
- Entries expire after 30 days if the peer never comes back.

## Media

Images and videos are stored inside BadgerDB as base64 strings, under `/MEDIA/IMAGES/{userId}/{key}` and `/MEDIA/VIDEOS/{userId}/{key}`, where `key` is the hex SHA-256 of the stored data. The same content therefore always gets the same key. Your own media is kept until deleted; media fetched from other users is cached for 7 days. Chat attachments use `/CHATMEDIA` with the same layout.

There is no separate file store for media. Another user's image is fetched from that user's node over a stream when it is viewed, checked, and then cached locally.

## Versions and migration

- The `v0` folder is a schema-version guard. A future breaking change would move to a new folder and start a clean database rather than migrate in place. Only `v0` exists today.
- Inside `v0`, changes are handled by switching prefixes. When the replicated stores moved to day DAGs, they got new prefixes (`/STATS/DAYS`, `/RATING/DAYS`); the old data under `/CRDT` and `/RATING` stays on disk and is not read.

## Backup and export

There is no export, import or backup command for the database. What exists:

- The database directory can be copied while the node is **stopped**. The copy can only be opened with the same username and password.
- Identity is reproducible: the same username, password and network give the same node ID on any machine, even without the old data.
- The wallet seed is not stored in the database either: it is derived from your identity key, network and login, so the same credentials give the same wallet.

See [Backup and restore](user-guide/backup-and-restore.md) for the user-facing procedure.

## In-memory mode

`DefaultOptions().WithInMemory(true)` runs BadgerDB entirely in memory. The echo test node uses it ([`cmd/node/member/echo-member.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/echo-member.go)). In this mode:

- nothing is written to disk and everything is lost on exit;
- no `run.lock` is written, and neither garbage collection nor the directory watcher runs;
- encryption is still configured with a derived key, as on disk.

The echo node opens its database before login so it can seed its fixed owner; opening an already running database is a no-op, so the seeded data is not lost.

## Packages

| Package | Role |
|---|---|
| [`database/local-store`](https://github.com/Warp-net/warpnet/tree/main/database/local-store) | The BadgerDB wrapper: open with a derived key, transactions, counters, paginated scans, TTL, GC, the prefix builder |
| [`database`](https://github.com/Warp-net/warpnet/tree/main/database) | One repository per namespace, plus `NodeRepo`, which adapts the store to the `go-datastore` interface for libp2p and the CRDT stores |
| [`database/datastore`](https://github.com/Warp-net/warpnet/tree/main/database/datastore) | Thin aliases over `go-datastore` and the IPFS blockstore helpers used by the CRDT stores |

## See also

- [Synchronization](synchronization.md)
- [Security](security.md)
- [Backup and restore](user-guide/backup-and-restore.md)
- [Running a node](user-guide/running-a-node.md)
- [Member node architecture](member-node-architecture.md)
