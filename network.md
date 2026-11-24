---
title: Network and Transport
description: What a Warpnet node and the Android app connect to, what is wrapped around every connection (TLS camouflage, public PSK, Noise, yamux), how nodes behind NAT are reached, and who can see what.
---

# Network and Transport

This page describes the network side of Warpnet: which connections a node and the Android app make, the layers wrapped around each connection, how nodes behind NAT reach each other, and what an observer on the path can and cannot see. It is written for users who want to know what leaves their machine, for packagers and for reviewers. Each statement points to the code behind it.

## Node roles on the network

| Role | Runs on | On the network |
|---|---|---|
| Member | your computer or server | your node: stores your data, serves the desktop UI, the browser dashboard (remote flavour) and paired phones |
| Relay | a host with a public IP | bootstrap entry point to the DHT and circuit relay v2 for nodes behind NAT; keeps nothing on disk |
| Moderator | a server | judges reported content; see [Moderation](moderation.md) |

The built-in bootstrap list ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)) is three relay nodes run by the project on one host, `207.154.221.44` (IPv4 and IPv6; TCP 4001 to 4003 on mainnet, 4011, 4022 and 4033 on testnet). You can replace it entirely; see [Keeping the project's hosts out of the path](#keeping-the-projects-hosts-out-of-the-path).

## The connection stack

All roles and the Android app use the same transport, [libp2p-camouflage-transport](https://github.com/Warp-net/libp2p-camouflage-transport) (v0.0.3), and the same layers on top of it ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

```text
application streams     Warpnet routes (/private/..., /public/...)
yamux                   stream multiplexing
Noise XX                encryption and peer authentication   <- the security layer
pnet (PSK, XSalsa20)    network and major-version separator, NOT a secret
TLS camouflage (uTLS)   looks like Chrome talking to www.googleapis.com, NOT verified
TCP                     IPv4 and IPv6; the TLS greeting is split in two segments
```

QUIC and WebRTC are not used: libp2p's private networks only work over TCP-like transports.

### TLS camouflage

Its only job is to get through networks that block unknown protocols with deep packet inspection (DPI). It is not a security layer.

- **Dialing side.** Sends a TLS ClientHello with a Chrome fingerprint (uTLS `HelloChrome_Auto`), SNI `www.googleapis.com` and ALPN `h2` and `http/1.1`. During the first 2048 bytes, the write that carries the SNI is split in the middle of the name, so the name never sits whole in one TCP segment ([`dpi-spoof.go`](https://github.com/Warp-net/libp2p-camouflage-transport/blob/main/dpi-spoof.go)).
- **Listening side** (member, relay, moderator). Answers with Go's `crypto/tls` (TLS 1.2 or newer) and a certificate chain generated at start-up: a leaf for `www.googleapis.com` signed by a throwaway CA named like a Cloudflare intermediate. Nobody trusts that CA; it only gives the handshake a realistic shape. Under TLS 1.3 the certificate is encrypted anyway. A client that negotiates an unexpected ALPN protocol is dropped, and the handshake must finish within 10 seconds, which limits active probing ([`tls-camouflage.go`](https://github.com/Warp-net/libp2p-camouflage-transport/blob/main/tls-camouflage.go)).
- **No certificate check.** The dialing side does not verify the certificate. The peer is authenticated by Noise inside the tunnel instead.
- **Nothing goes to Google or Cloudflare.** The TCP connection goes to the IP address of the peer. A traffic monitor such as PCAPdroid therefore shows `www.googleapis.com` next to the address of your node or of a relay.

### The pre-shared key is public

libp2p's private-network mode needs a 32-byte key. Warpnet derives it as `SHA-256(network name + major version)`, for example `SHA-256("warpnet0")` for every 0.x mainnet release ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)). Anyone can compute it: the pairing QR code carries it for convenience, and `--node.print-psk` prints it.

Its purpose is separation, not secrecy. A node from another network (mainnet vs testnet) or from an incompatible major version fails on the first bytes instead of speaking a protocol it does not understand. This is how incompatible versions are rejected; see [Protocol](protocol.md#versioning-and-compatibility). Do not count it towards confidentiality.

### Noise

Noise (`Noise_XX_25519_ChaChaPoly_SHA256`, from go-libp2p) encrypts and authenticates every connection with the peers' Ed25519 identity keys. The dialer knows the peer ID it expects (the Android app takes it from the pairing QR code), and the handshake fails if the other side cannot prove that identity. This is what protects content, including on relayed connections.

On member nodes the peer blocklist is checked inside the Noise step: outgoing dials to a blocked peer are refused before the handshake, incoming ones as soon as the handshake reveals the peer ID ([`core/warpnet/noise.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/noise.go)).

On top of Noise, a node accepts a request only if it is fresh and signed with the key behind the connection's peer ID, and serves private routes only to itself and to devices registered at pairing ([`core/middleware/auth.go`](https://github.com/Warp-net/warpnet/blob/main/core/middleware/auth.go)). See [Protocol](protocol.md#signing).

### yamux and connection limits

Streams are multiplexed with yamux, with a 15-second keep-alive and a 30-second write timeout ([`core/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/node.go)). libp2p's resource manager caps connections per IPv4 address and per IPv6 /56 and /48 prefix, and rate-limits new connections from one subnet. The connection manager keeps between 20 and 50 connections by default; see [Discovery](discovery.md#peer-prioritisation).

## What a member node does

| Activity | Details | Code |
|---|---|---|
| Listens | TCP 4001 on all IPv4 and IPv6 interfaces (`--node.port`, `--node.host.v4`, `--node.host.v6`, or the node's network settings) | [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go) |
| Port mapping | Asks your router for a mapping over UPnP or NAT-PMP | `libp2p.NATPortMap` |
| Reachability | Learns whether it is reachable from outside with AutoNAT v2, and answers AutoNAT checks for others | `libp2p.EnableAutoNATv2`, `EnableNATService` |
| Relay client | If not reachable, reserves a slot on the bootstrap relays (circuit relay v2, AutoRelay with the bootstrap list as static relays) and advertises `/p2p-circuit` addresses through them | `warpnet.EnableAutoRelayWithStaticRelays` |
| Hole punching | Upgrades relayed connections to direct ones with DCUtR where the NATs allow it, and logs each attempt | [`core/holepunch`](https://github.com/Warp-net/warpnet/tree/main/core/holepunch) |
| Relay service | Runs a circuit relay v2 service with the limits below | [`core/relay/relay.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/relay.go) |
| Discovery | Kademlia DHT under `/warpnet` or `/testnet`, mDNS on the local network, gossip announcements | [Discovery](discovery.md) |
| Content | Exchanges public content over streams and gossip | [Protocol](protocol.md) |

### Relay limits

Every node role runs the same circuit relay v2 configuration ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

| Limit | Value |
|---|---|
| Duration per relayed connection | 1 hour |
| Data per relayed connection | 1 GiB |
| Reservation lifetime | 1 hour |
| Reservations | 128 in total, 8 per IP, 32 per ASN |
| Concurrent circuits per peer | 16 |

Relay nodes declare themselves publicly reachable at start, so they serve relay reservations without waiting for AutoNAT. NAT-ed members reserve slots only on their bootstrap list.

### Relay reservation refusals

When a member receives a relayed connection from a peer on its blocklist, it rejects the connection and tells the relay with `/public/post/relay/refuse/reservation/0.0.0`. The relay then refuses to connect that peer to the member for one reservation lifetime (1 hour). A relay accepts this only from a peer that holds a reservation on it, and keeps at most 256 refusals per reserved peer ([`core/relay/reservation-refusals.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/reservation-refusals.go)).

### Other outgoing connections

A member node makes a few connections outside the Warpnet network:

| Connection | When | Can be turned off |
|---|---|---|
| Release check: `api.github.com` and `codeberg.org` release APIs | Desktop member, relay and moderator: hourly. Not the remote (browser dashboard) flavour or the Snap package | `--node.self-update=false` |
| Blockchain API (TronGrid by default: `api.trongrid.io` on mainnet, `nile.trongrid.io` on testnet) | Only when wallet or sponsored-tweet features are used, by you or by a peer paying you; the local payment engine starts on first use | `--wallet.endpoint` sets another endpoint |
| SMTP server | Only if you enable email notifications and configure a server | Notification settings |

## The remote node's dashboard

The remote flavour (`cmd/node/member/remote-member.go`) runs the same member node headless and serves the web UI itself: `/` serves the app and `/ws` carries all requests. By default it listens on `0.0.0.0:4999` (`--node.server.host`, `--node.server.port`).

- Every `/ws` connection starts with a Noise XX handshake (`Noise_XX_25519_ChaChaPoly_SHA256`) between the browser and the node. The browser pins the node's static key on first contact and refuses to continue if it changes; the node prints the key fingerprint at start-up for comparison.
- Requests from another site's page are refused (the `Origin` must match the host).
- Only browsers whose key was enrolled by a successful login on this node may call routes; the enrolment lives in memory until the node stops.
- The page itself (HTML and JavaScript) is served over plain HTTP. On a network you do not trust, bind the dashboard to `127.0.0.1` and reach it through an SSH tunnel, or put a TLS reverse proxy in front.

Message format: [WebSocket API](developer-guide/ws-API.md).

## What the Android app does

The app runs a dial-only libp2p host ([`warpdroid/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/warpdroid/node/node.go)): no listening sockets, the same camouflage transport, PSK, Noise and yamux, a circuit relay client and a DHT client.

1. **Start.** It connects to every bootstrap address your node handed it at pairing and refreshes its DHT routing table. That refresh sends DHT queries to the bootstrap nodes and possibly to other publicly reachable Warpnet nodes, whether or not your node is on the local network.
2. **Reaching your node.** It dials all addresses your node reported at once: private (local network) addresses first, the others 250 ms later, relay addresses last (libp2p's default ranking holds them back a further 500 ms when a public address exists). The first connection that completes is used and the other dials are cancelled.
3. **Relayed session.** When only the relay address answers, the session runs phone, relay, node: a stream inside the phone's camouflaged connection to the relay, with its own Noise handshake end to end between the phone and the node. The app does not hole-punch. Your node tries DCUtR on the inbound relayed connection, but the app has no listen addresses and no DCUtR handler, so the node logs `holepunch: protocol error`. A relayed session stays relayed until the next reconnect, and the relay limits above apply.

The app makes no other network connections: no Google services, no analytics, no update checks. Its user agent is `warpdroid`.

## Who sees what

| Observer | Sees | Does not see |
|---|---|---|
| Your ISP, Wi-Fi or mobile network | IP addresses and ports, timing and volume, a TLS ClientHello for `www.googleapis.com` | peer IDs, routes, content |
| Bootstrap or relay node (DHT traffic) | your IP address, peer ID and public key, the `warpdroid` user agent for the app, your DHT queries | your posts, messages or anything else from your node |
| Relay node (relayed session) | both IP addresses and peer IDs, timing and volume | content: it forwards Noise ciphertext |
| Any Warpnet node you connect to | your peer ID, addresses, public profile and public posts, the requests you send it | your private data and private routes |
| Your own node | everything the app and the dashboard do | |

Public content is public by design: anything a public route returns can be fetched by any node on the network. See [Security](security.md) for what is encrypted at rest and how identities work.

## Keeping the project's hosts out of the path

Run your own relay node (`cmd/node/relay`) on a host with a public IP and start your member node with `--node.bootstrap` pointing at it, or save the list in the node's network settings. The member node uses that list for discovery and relaying and hands the same list to the phone at pairing, so neither of them contacts `207.154.221.44`. If your relay itself joins the public network, DHT queries can still reach other public Warpnet nodes.

## See also

- [Protocol](protocol.md): routes, envelopes, signing, versioning
- [Discovery](discovery.md): how peers are found and ranked
- [Relay node architecture](relay-node-architecture.md): the relay role in detail
- [Mobile apps](user-guide/mobile.md): pairing a phone
- [Running a node](user-guide/running-a-node.md): flags and deployment
