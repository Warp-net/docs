---
title: Network and Transport
description: What a Warpnet node and the mobile apps connect to, what is wrapped around every connection (TLS camouflage, public PSK, Noise, yamux), how nodes behind NAT are reached, and who can see what.
---

# Network and Transport

This page describes the network side of Warpnet: which connections a node and the mobile apps make, the layers wrapped around each connection, how nodes behind NAT reach each other, and what an observer on the path can and cannot see. It is written for users who want to know what leaves their machine, for packagers and for reviewers.

## Node roles on the network

| Role | Runs on | On the network |
|---|---|---|
| Member | your computer or server | your node: stores your data, serves the desktop UI, the browser dashboard (remote flavour) and paired phones |
| Relay | a host with a public IP | headless, keeps everything in memory, declares itself publicly reachable; runs the DHT, gossip and a circuit relay v2 service |
| Moderator | a server | judges reported content; see [Moderation](moderation.md) |
| Mobile app | an Android or iOS phone | dial-only client of the member node it is paired with |

"Bootstrap node" is not a role. It is any address in a node's bootstrap list: the first peers the node dials, the seed of its DHT, and the only relays it reserves slots on when it is behind NAT. The built-in list ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)) is three relay nodes run by the project on one host, `207.154.221.44` (IPv4 and IPv6; TCP 4001 to 4003 on `warpnet`, 4011, 4022 and 4033 on `testnet`). How the list is chosen and used: [Discovery](discovery.md#bootstrap-nodes). How to replace it: [Keeping the project's hosts out of the path](#keeping-the-projects-hosts-out-of-the-path).

## The connection stack

All node roles and the mobile apps use the same transport, [libp2p-camouflage-transport](https://github.com/Warp-net/libp2p-camouflage-transport/tree/v0.0.3) (v0.0.3), and the same layers on top of it ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

```text
application streams     Warpnet routes (/private/..., /public/...)
yamux                   stream multiplexing
Noise XX                encryption and peer authentication   <- the security layer
pnet (PSK, XSalsa20)    network and major-version separator, NOT a secret
TLS camouflage (uTLS)   looks like Chrome talking to www.googleapis.com, NOT verified
TCP                     IPv4 and IPv6; the server name is split across two writes
```

TCP is the only transport; relayed connections run inside it. libp2p's private networks do not work over QUIC or WebRTC.

### TLS camouflage

Its only job is to get through networks that block unknown protocols with deep packet inspection (DPI). It is not a security layer.

- **Dialing side.** Sends a TLS ClientHello with a Chrome fingerprint (uTLS `HelloChrome_Auto`), SNI `www.googleapis.com` and ALPN `h2` and `http/1.1`. Within the first 2048 bytes of the connection, a write that contains the server name is split in two in the middle of the name.
- **Listening side** (member, relay, moderator). Answers with Go's `crypto/tls` (TLS 1.2 or newer) and a certificate chain generated at start-up: a leaf for `www.googleapis.com` signed by a throwaway CA named "Cloudflare Inc ECC CA-3". Nobody trusts that CA; it only gives the handshake a realistic shape. The TLS handshake must finish within 10 seconds. At most 64 handshakes run at once; a connection that waits more than 30 seconds for a slot is dropped.
- **No certificate check.** The dialing side does not verify the certificate. The peer is authenticated by Noise inside the tunnel instead.
- **Nothing goes to Google or Cloudflare.** The TCP connection goes to the IP address of the peer. A traffic monitor such as PCAPdroid therefore shows `www.googleapis.com` next to the address of your node or of a relay.

### The pre-shared key is public

libp2p's private-network mode needs a 32-byte key. Warpnet derives it as `SHA-256(network name + major version)` ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)): `SHA-256("warpnet0")` for every 0.x release on `warpnet` (the name `mainnet` is mapped to `warpnet` first), `SHA-256("testnet0")` on `testnet`. Anyone can compute it. The pairing QR code carries it, and a relay started with `--node.print-psk` logs it.

Its purpose is separation, not secrecy. A node from the other network or from another major version fails on the first bytes instead of speaking a protocol it does not understand. A release with a new major version therefore changes the key. See [Protocol](protocol.md#versioning-and-compatibility). Do not count it towards confidentiality.

### Noise

Noise (`Noise_XX_25519_ChaChaPoly_SHA256`, from go-libp2p) encrypts and authenticates every connection with the peers' Ed25519 identity keys. The dialer knows the peer ID it expects (the mobile app takes it from the pairing QR code), and the handshake fails if the other side cannot prove that identity. This is what protects content, including on relayed connections.

On member nodes the peer blocklist is checked in the Noise step: dials to a blocked peer are refused before the handshake, incoming connections as soon as the handshake reveals the peer ID ([`core/warpnet/noise.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/noise.go)).

On top of Noise, a node accepts a request only if it is fresh and signed with the key behind the connection's peer ID. It serves private routes only to itself and to devices registered at pairing; the pairing route itself is the exception ([`core/middleware/auth.go`](https://github.com/Warp-net/warpnet/blob/main/core/middleware/auth.go)). See [Protocol](protocol.md#signing).

### yamux and connection limits

Streams are multiplexed with yamux, with a 15-second keep-alive and a 30-second write timeout ([`core/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/node.go)). libp2p's resource manager caps connections per IPv4 address and per IPv6 /56 and /48 prefix, and rate-limits new connections from one subnet. The connection manager keeps between 20 and 50 connections by default; see [Discovery](discovery.md#peer-prioritisation).

## What a member node does

| Activity | Details | Code |
|---|---|---|
| Listens | TCP 4001 on all IPv4 and IPv6 interfaces. The node's network settings take precedence over `--node.port`, `--node.host.v4` and `--node.host.v6` | [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go) |
| Port mapping | Asks your router for a mapping over UPnP or NAT-PMP | `libp2p.NATPortMap` |
| Reachability | Learns through AutoNAT whether it is reachable from outside, and answers AutoNAT checks for others | `libp2p.EnableAutoNATv2`, `EnableNATService` |
| Relay client | If not reachable, reserves a slot on the relays of its bootstrap list (circuit relay v2, AutoRelay with the bootstrap list as static relays) and advertises `/p2p-circuit` addresses through them | `warpnet.EnableAutoRelayWithStaticRelays` |
| Hole punching | Tries to upgrade relayed connections to direct ones with DCUtR where the NATs allow it, and logs the outcome | [`core/holepunch`](https://github.com/Warp-net/warpnet/tree/main/core/holepunch) |
| Relay service | Runs a circuit relay v2 service with the limits below. Other nodes reserve slots on it only if it is in their bootstrap list | [`core/relay/relay.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/relay.go) |
| Discovery | Kademlia DHT under `/warpnet` or `/testnet`, mDNS on the local network, gossip announcements | [Discovery](discovery.md) |
| Content | Exchanges public content over streams and gossip | [Protocol](protocol.md) |

Relay and moderator nodes use the same AutoNAT, port mapping, AutoRelay, hole punching and relay service. A relay node declares itself publicly reachable at start, so it serves relay reservations without waiting for AutoNAT.

### Relay limits

Every node role runs the same circuit relay v2 configuration ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

| Limit | Value |
|---|---|
| Duration per relayed connection | 1 hour |
| Data per relayed connection | 1 GiB |
| Reservation lifetime | 1 hour |
| Reservations | 128 in total, 8 per IP, 32 per ASN |
| Concurrent relayed connections per peer | 16 |

AutoRelay waits 5 minutes before trying a relay again after a failed reservation.

### Relay reservation refusals

When a member receives a relayed connection from a peer on its blocklist, it rejects the connection and tells the relay with `/public/post/relay/refuse/reservation/0.0.0`. The relay then refuses to connect that peer to the member for one reservation lifetime (1 hour). Only relay nodes serve this route. A relay accepts it only from a peer that holds a reservation on it, and keeps at most 256 refusals per reserved peer ([`core/relay/reservation-refusals.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/reservation-refusals.go)).

### Other outgoing connections

A node makes a few connections outside the Warpnet network:

| Connection | When | Can be turned off |
|---|---|---|
| Release check: `codeberg.org` and `api.github.com` release APIs. When a newer release exists, its checksum list and signature, and after the update is approved, the archive, from the release's download links (GitHub) | Desktop member on Linux (amd64, arm64), Windows (amd64) and macOS, relay and moderator on Linux amd64: one minute after start, then hourly. On macOS only the release itself is read, nothing is downloaded. Not in the Snap package or in the remote (browser dashboard) flavour | `--node.self-update=false` |
| Blockchain API (TronGrid by default: `api.trongrid.io` on `warpnet`, `nile.trongrid.io` on `testnet`) | Only when wallet or sponsored-post features are used, by you or by a peer paying you; the local payment engine starts on first use | `--wallet.endpoint` or the wallet settings set another endpoint |
| SMTP server | Only if you enable email notifications and configure a server | Notification settings |
| `www.youtube-nocookie.com` (from the desktop UI or browser dashboard) | Only when you press play on a YouTube link in a post | Nothing loads before you press play |

## The remote node's dashboard

The remote flavour ([`cmd/node/member/remote-member.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote-member.go)) runs the same member node headless and serves the web UI itself: `/` serves the app and `/ws` carries all requests. By default it listens on `0.0.0.0:4999` (`--node.server.host`, `--node.server.port`).

- Every `/ws` connection starts with a Noise XX handshake (`Noise_XX_25519_ChaChaPoly_SHA256`) between the browser and the node. The node's static key is kept in `ws-noise.key` next to the database directory, and its fingerprint is printed at start-up. The browser pins the key on first contact and refuses to continue if it changes.
- Requests from another site's page are refused (the `Origin` must match the host).
- Only browsers whose key was enrolled by a successful login on this node may call routes. The enrolment lives in memory until logout or until the node stops.
- The page itself (HTML and JavaScript) is served over plain HTTP. On a network you do not trust, bind the dashboard to `127.0.0.1` and reach it through an SSH tunnel, or put a TLS reverse proxy in front.

Message format: [WebSocket API](developer-guide/ws-API.md).

## What the mobile apps do

The Android and iOS apps run the same dial-only libp2p host ([`warpdroid/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/warpdroid/node/node.go), [`warpfone/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/warpfone/node/node.go)): no listening sockets, the same camouflage transport, PSK, Noise and yamux, a circuit relay client and a DHT client. Their user agents are `warpdroid` and `warpfone`. They send requests only to the paired node.

1. **Start.** The app connects to each bootstrap address your node handed it at pairing and refreshes its DHT routing table. That refresh sends DHT queries to the bootstrap nodes and possibly to other publicly reachable Warpnet nodes, whether or not your node is on the local network.
2. **Reaching your node.** It dials the addresses your node reported: private (local network) addresses first, the others 250 ms later, relay addresses last (libp2p's default ranking holds them back a further 500 ms when a public address exists). The first connection that completes is used.
3. **Relayed session.** When only the relay address answers, the session runs phone, relay, node: a stream inside the phone's camouflaged connection to the relay, with its own Noise handshake end to end between the phone and the node. The app does not hole-punch. Your node tries DCUtR on the inbound relayed connection, but the app has no listen addresses and no DCUtR handler, so the node logs `holepunch: protocol error`. A relayed session stays relayed until the next reconnect, and the relay limits above apply.

## Who sees what

| Observer | Sees | Does not see |
|---|---|---|
| Your ISP, Wi-Fi or mobile network | IP addresses and ports, timing and volume, a TLS ClientHello for `www.googleapis.com` | peer IDs, routes, content |
| Bootstrap or relay node (DHT traffic) | your IP address, peer ID and public key, the user agent of the mobile apps, your DHT queries | the content of your streams with other nodes |
| Relay node (relayed session) | both IP addresses and peer IDs, timing and volume | content: it forwards Noise ciphertext |
| Any Warpnet node | your addresses and up to 10 peers you are connected to (gossip announcements); your node info (`/public/get/info`: owner user ID, version, start time, addresses, reachability, peer IDs of paired devices); your public profile and public posts; the requests you send it | your private data and private routes |
| The bridge gateway you use | what your node sends it, including your bridge key; see [Bridges](bridge.md#privacy-and-trust) | anything your node does not send it |
| Your own node | everything the apps and the dashboard do | |

Public content is public by design: anything a public route returns can be fetched by any node on the network. See [Security](security.md) for what is encrypted at rest and how identities work.

## Keeping the project's hosts out of the path

1. Run your own relay node (`cmd/node/relay`, release asset `relay_linux_amd64.tar.gz`) on a host with a public IP.
2. Give it a secret `--node.seed`. The relay's key is derived from the seed; without one it is derived from the network name, database directory, IPv4 host and port, which anyone can guess.
3. Start it with `--node.bootstrap` as well. Otherwise it uses the built-in list and connects to the project's relays.
4. Put your relay's address in your member node's bootstrap list: the Settings screen, or `--node.bootstrap`.

Your member node then starts its DHT from your relay, reserves relay slots only there, and hands the same list to your phone at pairing. It still connects to nodes it discovers through the DHT, gossip or mDNS, which includes the project's relays if a node it talks to announces them.

## See also

- [Protocol](protocol.md): routes, envelopes, signing, versioning
- [Discovery](discovery.md): how peers are found and ranked
- [Relay node architecture](relay-node-architecture.md): the relay role in detail
- [Mobile apps](user-guide/mobile.md): pairing a phone
- [Running a node](user-guide/running-a-node.md): flags and deployment
