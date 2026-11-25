---
title: Security
description: How Warpnet derives your keys, encrypts your data and connections, authenticates every message, limits abuse, and what it does not protect against.
---

# Security

This page describes the security model of Warpnet as it is implemented: where your keys come from, what is encrypted and with what, how nodes authenticate each other's messages, how abuse is limited, and which threats are out of scope. Where a protection is weak or missing, the page says so.

## Threat model in brief

Warpnet has no server tier: every user runs a node that keeps the account's data on the user's own machine and talks to other nodes directly. The design assumes that the network in between, other peers and relays may be hostile, and that nobody holds a master key or a backdoor.

| Asset | Protected by | Not protected against |
|---|---|---|
| Your account and node identity | Keys derived from your login and password with Argon2id; never stored on disk | A weak password combined with a stolen database; malware on your computer |
| Your stored data | Database encryption at rest (AES-256) under a key derived from your login and password | Anyone who knows your login and password; an unlocked running node |
| Traffic between nodes | Noise XX encryption and mutual authentication on every connection | Connection metadata: who connects to whom, when, from which IP |
| Requests and events | Ed25519 signature on every message, freshness check, author checks | A peer that signs garbage with its own valid key (handled by rate limits and rating) |
| Moderation verdicts | Signed votes, recounted by every node before use | An attacker with several throwaway moderator keys (see [Moderation](moderation.md#limits)) |
| The software you run | Signed release checksums, verified by the self-updater | Peers running modified builds |

## Identity and key derivation

Your identity is not a file. Every time you sign in, the node derives your keys from three inputs: your **login**, your **password** and the **network** (`warpnet` or `testnet`). Your login and password together are your identity. Nothing secret is written to disk, so the same login and password on another computer produce the same node identity.

The login is not your public name. A new profile is called "Anonymous" until you rename it, and the profile name is edited separately. The login is stored only inside your encrypted database and is never published.

### Password rules

The node rejects a password unless it is 8 to 32 characters long and contains at least one uppercase letter, one lowercase letter, one digit and one special character. Leading and trailing spaces are trimmed first. The login only has to be non-empty ([`cmd/node/member/auth/auth.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/auth/auth.go)).

### What is derived

All keys derived from the password use Argon2id with time cost 1, 64 MiB of memory, 4 lanes and a 32-byte output. The salt is not random: it is a SHA-256 hash of a fixed context string and your account details, joined with zero bytes ([`security/kdf.go`](https://github.com/Warp-net/warpnet/blob/main/security/kdf.go)).

```text
identity salt = SHA-256("warpnet/kdf/v1/identity-key" 0x00 network 0x00 login)
identity seed = Argon2id(password, identity salt)
identity key  = Ed25519 key whose seed is SHA-256(identity seed || hash-algorithm id || key-type id)
node ID       = libp2p peer ID of the identity public key

database salt = SHA-256("warpnet/kdf/v1/database-key" 0x00 login)
database key  = Argon2id(password, database salt)

wallet salt   = SHA-256("warpnet/kdf/v1/wallet-seed" 0x00 network 0x00 login)
wallet seed   = Argon2id(identity private key, wallet salt)

bridge key    = HKDF-SHA256(Ed25519 seed of the identity key, info "warpnet/bridge/v1"), 32 bytes
```

The intermediate identity seed is wiped from memory after use. The bridge key is described [below](#bridge-key).

What follows from this:

- **No recovery.** There is no reset link and no recovery key. If you forget your login or your password, the identity and the encrypted database are gone.
- **Both halves count.** A different login or a different password gives different keys: the existing database does not open and the node ID changes.
- **One identity per network.** The network name is part of the identity salt, so the same login and password give a different node ID on `warpnet` and on `testnet`.
- **Your node ID is derived, your user ID is not.** The user ID (a ULID) is created at random on first sign-in and stored in the database. Signing in with the same login and password on a fresh machine gives you the same node ID but a new, empty account. Keep a backup of the data directory ([Backup and restore](user-guide/backup-and-restore.md)).
- **The password is the strength of everything.** Argon2id makes each guess expensive, but a short or common password can still be guessed offline by someone who has copied your database files.

### Session token

At the first successful sign-in in a node process, the node generates a session token from 32 random bytes (base64-encoded). It lives only in memory and authorizes device pairing (see [Device pairing](#device-pairing)). It stays the same across sign-outs and sign-ins; only a new process gets a new token ([`database/auth-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/auth-repo.go)).

### Other node roles

Relay and moderator nodes have no account and no password.

- A moderator generates a fresh random key every time it starts ([`cmd/node/moderator/main.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/moderator/main.go)).
- A relay derives its key from `--node.seed`. When the flag is empty, the seed is the string `seed` followed by the network name, the database directory, the IPv4 listen host and the port ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)). With default flags anyone can compute that seed and the relay's private key, so give a relay you run a secret seed. See [Relay node architecture](relay-node-architecture.md).

## Encryption at rest

A member node stores everything in an embedded [BadgerDB](https://github.com/dgraph-io/badger) database. The node opens it with the 32-byte database key above, and Badger encrypts its data files with AES-256 in CTR mode ([`database/local-store/db.go`](https://github.com/Warp-net/warpnet/blob/main/database/local-store/db.go)). A wrong login or password surfaces as an encryption-key mismatch, and the node answers "wrong username or password".

Keep in mind:

- The database key does not include the network name, but each network has its own database directory, so the two never share data.
- Files kept outside the database, such as the remote node's dashboard key `ws-noise.key` (permissions `0600`), are not encrypted by Warpnet.
- While the node runs and you are signed in, the key is in memory and the data is readable by the node process. See [Process hardening](#process-hardening).
- Full-disk encryption on your computer is still recommended: it protects against a stolen laptop even if your password is weak.

More on the data layout: [Storage](storage.md).

## Transport encryption

Every connection between Warpnet nodes, including the mobile apps, is encrypted and mutually authenticated with **Noise XX** (`Noise_XX_25519_ChaChaPoly_SHA256`) using the nodes' Ed25519 identity keys. A node dialing a known peer ID aborts if the other side cannot prove that identity. Underneath Noise sit a private-network layer keyed with a public pre-shared key and a camouflage transport; neither of them is a security layer. The full stack and what each observer can see are described in [Network](network.md).

### The pre-shared key is public

The pre-shared key (PSK) is `SHA-256(network name + major version)`, for example `SHA-256("warpnet0")` ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)). Anyone can compute it, and a relay prints it when started with `--node.print-psk`. Its job is to separate networks and incompatible major versions so that they fail on the first bytes instead of half-talking. Do not count it towards confidentiality or access control.

### Clients and your node

How the apps reach your node depends on the build:

| Client | Channel | Protection |
|---|---|---|
| Desktop app | In-process calls (Wails); no network listener for the UI | Local only |
| Browser, remote node | WebSocket `/ws` on the node's dashboard port | Noise XX inside the WebSocket, node key pinned by the browser, sign-in required |
| Android and iOS apps | libp2p connection to your node as a paired device | Noise XX, pinned node ID, pairing token, per-request signatures |

The remote (headless) node is the one exposed to a network, so it has extra protections ([`cmd/node/member/remote/bridge.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote/bridge.go), [`cmd/node/member/remote-member.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote-member.go)):

- Each WebSocket starts with a Noise XX handshake (X25519, ChaCha20-Poly1305, SHA-256) against a static node key stored in `ws-noise.key` next to the database. The handshake must finish within 10 seconds.
- The node prints the key's fingerprint at start-up. The browser pins it on first connect and refuses to continue if it ever changes (trust on first use).
- A browser request whose `Origin` host does not match the `Host` it connects to is rejected, so another website cannot open a socket to your node.
- Until you sign in on a connection, only the sign-in and the "is first run" check are answered; everything else returns "not signed in". After sign-in, the browser's own Noise key is remembered in memory until you sign out or the node stops.
- At most 32 requests per connection are processed at once.
- By default the dashboard listens on all interfaces (`--node.server.host 0.0.0.0`, port `4999`). Set `--node.server.host 127.0.0.1` to serve it to the local machine only.
- The page itself (HTML and JavaScript) is served over plain HTTP, so on a network you do not trust it could be altered before the Noise channel exists. Reach a remote node through an SSH tunnel or a TLS reverse proxy.

## Message authentication

Encryption protects the pipe. On top of it, every request between nodes carries its own proof of origin ([`core/middleware/auth.go`](https://github.com/Warp-net/warpnet/blob/main/core/middleware/auth.go), [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go)):

- **Signed envelopes.** Every stream message is an envelope signed with the sender's Ed25519 key. The signature covers the body, the timestamp (decimal Unix nanoseconds) and the destination route. The receiver recovers the public key from the peer ID of the connection, so a peer cannot sign as someone else. Unsigned, malformed or badly signed messages are rejected.
- **Freshness.** A message from a remote peer whose timestamp is more than 5 minutes away from local time, in either direction, is rejected as stale or replayed. Loopback requests from the node to itself are exempt.
- **Private routes.** Routes under `/private/` answer only the node itself and devices paired with it. The pairing route is the one exception, and it is gated by the session token.
- **Authorship.** An event that names an author (a post, a reply, a follow, a chat) is accepted only if it arrived from that author's node, or from a paired device acting for the local owner ([`core/warpnet/warpnet.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/warpnet.go)).
- **Idempotency.** Routes with `/post/` in their path remember each successful response for 10 minutes, keyed by route, peer and message ID, so a retried request returns the first answer instead of repeating the action. The cache holds up to 1024 entries; error responses are not cached ([`core/middleware/idempotency.go`](https://github.com/Warp-net/warpnet/blob/main/core/middleware/idempotency.go)).
- **Size and time limits.** A request may be at most 1 MiB, except image and video uploads, tweet import and the sponsored-content buyer route (50 MiB). Responses are capped at 50 MiB for public and sponsored image and video downloads, 8 MiB for other reads and 1 MiB otherwise. Reading a request times out after 15 seconds, or 5 minutes for the 50 MiB routes ([`core/stream/stream.go`](https://github.com/Warp-net/warpnet/blob/main/core/stream/stream.go)).
- **Gossip.** Messages published on gossip topics are wrapped in the same envelope and signed with the publisher's node key; the receiver checks the signature against the publisher's node ID before handling the message.
- **Moderation verdicts.** A verdict carries a signature from the moderator that publishes it and a signed vote from every moderator it was counted from. Each node checks both and recounts the votes before applying anything. See [Moderation](moderation.md#signed-verdicts).
- **Media.** Uploaded images and videos carry a metadata block signed with the uploader's node key over a hash of the file; see [Media metadata](#media-metadata).

## Release integrity

Nothing checks what software a peer runs. A modified build derives the same PSK and joins the network normally, and everything on this page assumes that other peers may run modified software. What exists:

- **Version separation.** The PSK includes the major version, so nodes of different major versions cannot connect. Warpnet is in the 0.x series, so all 0.x releases share one PSK. This checks compatibility, not code.
- **Signed releases.** Every release asset is published with a SHA-256 checksum listing and an Ed25519 signature of that listing (`*_checksums.txt` and `*_checksums.txt.sig`). The self-updater checks the latest release on GitHub a minute after start and then every hour, verifies the signature against a release public key compiled into the binary, checks the archive's SHA-256, and only then replaces the running binary. If the new version fails to restart, the previous binary is put back and the process exits ([`core/selfupdate/selfupdate.go`](https://github.com/Warp-net/warpnet/blob/main/core/selfupdate/selfupdate.go)).
- **Who updates itself.** The desktop app on Linux (amd64, arm64) and Windows (amd64) asks its owner before installing an update; the Snap package and the macOS app do not update themselves. Relay and moderator nodes on Linux amd64 install updates unattended. The remote node does not run the updater. `--node.self-update=false` turns the updater off. A copy that cannot replace its own binary only announces new versions.

## Rate limiting and abuse resistance

### Per-peer stream limits

Every request from a remote peer passes a leaky-bucket limiter before it reaches a handler. Each bucket belongs to one peer on one route: it holds up to *burst* requests and drains at a steady per-minute rate. Requests from the node itself and from loopback are not limited. A limited request gets an error response with code `5001` ([`core/ratelimit/stream.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/stream.go)).

| Routes | Burst | Per minute |
|---|---|---|
| Other read routes (`/get/`) | 60 | 300 |
| Other write routes | 30 | 120 |
| Image and video downloads (incl. chat and sponsored media) | 150 | 600 |
| Image and video uploads | 10 | 30 |
| Timeline delivery, moderation results | 200 | 1200 |
| New chats and chat messages | 60 | 300 |
| Reports | 10 | 30 |
| Device pairing | 5 | 15 |
| Any route, when the caller is the bridge gateway | 600 | 6000 |

Peers with a poor [rating](rating.md) get a fraction of each budget: half, a quarter or a tenth depending on their tier, but never less than one request. In addition, libp2p's resource manager caps streams, buffers and memory per peer with its auto-scaled defaults, and a peer may hold at most 2 inbound streams at a time on each video download route.

### Discovery and connections

- **Discovery.** Each discovered peer is charged to the IP address in its announced addresses: a burst of 64, refilling at 32 per 10 seconds per IP. Peers announced without an address share one bucket ([`core/ratelimit/ip.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/ip.go)).
- **Connection manager.** The node trims its connections back to 20 once it exceeds 50.
- **Settings.** The network, discovery and read/write values above can be changed in **Settings → Rate limiting** and take effect after a restart. Routes with a limit of their own keep it. Relay and moderator nodes use the defaults ([`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go)).

### Blocklist

When you block a user, your node also puts the node of that user on a permanent peer blocklist. A connection gater then refuses to dial blocked peers and drops inbound connections from them once their identity is known; a sweep every 10 seconds closes any connection that is still open. If a blocked peer reaches you through a relay, your node also asks that relay to stop relaying the peer to you. Unblocking removes the entry. Blocks of bridged accounts are not applied at this level, because those accounts live on the shared gateway node ([`core/node/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/options.go), [`core/handler/block.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/block.go)).

## Process hardening

The `security` package hardens the process when it starts ([`security/anti-debugger.go`](https://github.com/Warp-net/warpnet/blob/main/security/anti-debugger.go), [`security/anti-debugger_darwin.go`](https://github.com/Warp-net/warpnet/blob/main/security/anti-debugger_darwin.go)):

| Platform | What the node does |
|---|---|
| Linux | Unsets `LD_PRELOAD`; disables core dumps (`PR_SET_DUMPABLE=0`); if a tracer is attached and the process command line mentions `gdb` or `lldb`, it stops |
| macOS | Unsets `DYLD_INSERT_LIBRARIES` and `LD_PRELOAD`; sets the core-dump limit to 0; calls `PT_DENY_ATTACH`, so a debugger cannot attach |
| Windows | Nothing |

These measures make it harder to read keys out of a running node; they do not stop an administrator or malware on the same machine.

## Screen lock

The desktop app can hide its window behind a PIN while the node keeps running, so paired phones stay connected ([`frontend/src/lib/screen-lock.js`](https://github.com/Warp-net/warpnet/blob/develop/frontend/src/lib/screen-lock.js)):

- Turn it on in **Settings → Screen lock** with a PIN of 4 to 8 digits. Lock the window from the account menu or with Ctrl+L, or let it lock itself after 1, 5, 15, 30 or 60 minutes without keyboard, mouse or touch input.
- The PIN is stored only as a salted Argon2id hash in the app's local storage. The locked state survives a reload of the window.
- Every PIN check counts, including the one on the settings page. After 5 wrong PINs the app signs out and asks for the password; signing in with the password clears the lock state.

The screen lock is a convenience for the UI, not encryption: the node and its decrypted database stay open behind it.

## Device pairing

A phone does not get a copy of your account. It pairs with your node and acts through it ([`core/handler/device.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/device.go), [`database/aliases-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/aliases-repo.go)):

1. Your node shows a QR code with its node ID, addresses, bootstrap peers, network, your user ID, the PSK and the **session token**. It never contains a private key.
2. The phone creates its own key pair and dials your node at the pinned node ID. Noise fails if anyone else answers.
3. The phone sends the pairing request with the token. The node accepts only if the token matches its current session token, then records the phone's peer ID as a paired device.
4. From then on the phone signs every request with its own key, and the node serves it the private routes.

Limits and revocation:

- Up to 10 devices can be paired at once. A pairing expires if the phone does not refresh it for 72 hours.
- **Settings → Devices** lists paired phones and removes them. A removed phone loses access at once.
- Every sign-in starts the node afresh and revokes every paired device, so phones must scan the QR code again after each sign-in.
- A revoked device is refused if it presents the session token it was paired with. The token changes only when the app process restarts, so a device revoked in the running process can pair again only with a QR code shown after a restart.
- A paired phone may remove only itself, and the device list it can read does not include other devices' tokens.
- Pairing attempts are rate-limited to a burst of 5 and 15 per minute per peer.
- The token is a bearer secret while the node runs: anyone who photographs the QR code can pair a device. Check the device list if in doubt.

The user side of pairing is in [Mobile apps](user-guide/mobile.md).

## Bridge key

To act for you on bridged networks, the [bridge gateway](bridge.md) needs a key of yours. Your node derives a 32-byte **bridge key** with HKDF-SHA256 (info string `warpnet/bridge/v1`) from the seed of its Ed25519 identity key ([`security/bridge-key.go`](https://github.com/Warp-net/warpnet/blob/main/security/bridge-key.go)). It attaches the key, hex-encoded, to every message it sends to the configured gateway peer, and to no other peer. The field travels inside the Noise-encrypted connection; it is not part of the signed bytes.

HKDF is one-way, so the bridge key does not reveal your identity key or your password. It is also stable: it changes only if your identity changes, and any gateway that has received it could keep it. See [Bridges](bridge.md#bridge-key).

## Media metadata

Uploaded images are decoded and re-encoded as JPEG (quality 100), which drops the original file's EXIF data such as camera and GPS fields. Warpnet then embeds its own block into the image (EXIF) or video container ([`core/media-meta/upload.go`](https://github.com/Warp-net/warpnet/blob/main/core/media-meta/upload.go)):

- **Contents.** Your node information, your user record, and the hardware (MAC) addresses of all network interfaces of the uploading machine.
- **Encryption.** AES-256-GCM under an Argon2id key (time 1, 64 MiB, 4 lanes) derived from a single-use random password drawn from a deliberately small space of 110,000,000,000 values (about 2^36.7). The password is wiped after use and never stored. Salt and nonce are random and travel with the file.
- **Signature.** The block is signed with your node key over a hash of the file, so it can be checked against the uploader.

This is weak by design. Ordinary users cannot read the block, but an adversary willing to spend serious computation can brute-force it and recover the node, user and hardware addresses behind any image or video you publish. The code estimates the search at roughly 12 days on a 1000-core cluster; treat that as an order of magnitude. If this trade-off does not fit your threat model, do not publish media through Warpnet.

## What Warpnet does not protect against

- **Network metadata.** Peers you connect to see your IP address. Relays see which peers talk to each other, when and how much, but not the content. Your ISP sees that you connect to IP addresses, though not which protocol. See [Network](network.md#who-sees-what).
- **Copies of public content.** Posts are copied to your followers' nodes. Deleting a post or having it moderated does not remove those copies.
- **The other end of a chat.** Direct messages are encrypted in transit and stored on both your node and the other person's node. Warpnet cannot control what the other node does with its copy.
- **A weak password.** Someone who copies your database files can try passwords offline. Argon2id slows this down; it does not stop it.
- **A compromised computer.** Malware or an administrator on the machine running your node can read what the node reads.
- **Modified software.** Peers can run modified builds, ignore moderation verdicts on their own screens, and create new identities at no cost.
- **The PSK as a secret.** It is public by design.
- **Media metadata.** Recoverable by a well-resourced adversary, as described [above](#media-metadata).
- **Bridged networks.** Whatever crosses the bridge gateway is in plain text on the gateway for a moment and is stored by the other network's servers. See [Bridges](bridge.md#privacy-and-trust).
- **An exposed dashboard.** A remote node listens on all interfaces unless you set `--node.server.host`.

## Reporting a vulnerability

If you find a security problem, email **contact@warpnet.site** with a description, the affected version and steps to reproduce. Please do not open a public issue for a vulnerability that can be exploited until it is fixed. Other bugs go to [GitHub issues](https://github.com/Warp-net/warpnet/issues); questions and discussion to [Telegram](https://t.me/warpnetdev).

## See also

- [Network](network.md): transport stack, camouflage, NAT traversal, who sees what
- [Storage](storage.md): datastore layout and encryption at rest
- [Moderation](moderation.md): signed votes and verdicts
- [Bridges](bridge.md): the gateway and the bridge key
- [Rating](rating.md): how peers are rated and slowed down
