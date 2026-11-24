---
title: Relay Node Architecture
description: The relay node, formerly called the bootstrap node - what it does, what it keeps in memory, its circuit relay limits, and how to run your own.
redirect_from:
  - /bootstrap-node-architecture.html
---

# Relay Node Architecture

A relay node is the network's entry point. New nodes dial it to join the DHT, and nodes behind NAT reach each other through it. It holds no user content and writes nothing to disk. This page explains what a relay does, what it keeps, the limits it enforces, and how to run one. Older documents call it the **bootstrap node**; it is the same role.

## What a relay does

| Job | How |
|---|---|
| Entry point | Every member node starts with a list of relays for its network and dials them first. |
| DHT | Runs the Kademlia DHT under the network's prefix (`/warpnet` or `/testnet`). Its reachability is forced to public, so the DHT's automatic mode serves it as a DHT server from the start. |
| Circuit relay | Serves libp2p circuit relay v2, so a node behind NAT can hold a reservation on the relay and be reached through it. |
| Gossip | Takes part in GossipSub and forwards the discovery, report, moderation-vote and rating topics. It handles discovery announcements and the rating topic itself; reports and votes it only passes on. |
| Discovery | Connects to every peer it hears about, asks for its node information, sets its connection priority and remembers which phones belong to which member node. It does not fetch user profiles. |
| Rating | Rates peers from what it sees on the wire and keeps a replica of the network's rating records in memory. See [Rating](rating.md). |

What a relay does not do: it stores no posts, profiles or timelines, keeps no post statistics, runs no mDNS, and has no database. The relay role is the same AGPL code as everything else ([`cmd/node/relay`](https://github.com/Warp-net/warpnet/tree/main/cmd/node/relay)), so anyone can run one.

### Routes

Besides libp2p's own protocols (identify, ping, circuit relay, AutoNAT, hole punching, Kademlia, GossipSub), a relay registers two Warpnet routes ([`cmd/node/relay/node/relay-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/relay/node/relay-node.go)):

| Route | Purpose |
|---|---|
| `/public/get/info/0.0.0` | Returns the relay's node information. The caller is also fed into discovery. |
| `/public/post/relay/refuse/reservation/0.0.0` | Lets a member that holds a reservation on this relay refuse circuits from a peer it has blocked (see [Refusing circuits](#refusing-circuits)). |

Requests pass the same middleware chain as on a member node: logging, rate limiting, signature check and idempotency. A relay has no paired devices, so it serves no `private` routes to anyone else.

### Node information and the bootstrap marker

A relay reports `type: "relay"` in its node information. For compatibility with older nodes, which recognised relays by owner ID before the `type` field existed, it also sends `owner_id: "bootstrap"`. Current nodes treat a peer as a relay if `type` is `relay` or `owner_id` is `relay` or `bootstrap` ([`core/warpnet/warpnet.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/warpnet.go)). Member nodes connect to relays but never add them as users.

## What it keeps

Everything lives in memory and is gone after a restart.

| Data | Store | Lifetime |
|---|---|---|
| Peerstore (peer IDs, addresses, public keys) | in-memory peerstore | until shutdown |
| DHT routing table and records | in-memory map | records expire after one hour; all gone at shutdown |
| Rating records | in-memory replica of the rating CRDT | until shutdown; rebuilt from other nodes after a restart |
| Circuit reservations and refusals | relay service | one hour per reservation |
| Phone-to-node map | discovery cache | up to 4096 entries, 72 hours |

The relay itself writes nothing to disk. Two things on the host do touch the filesystem:

- At start-up the shared configuration code creates the application directory `~/.warpdata` if it does not exist ([`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go)). Nothing is written into it.
- The self-updater, when it is active, downloads a new release next to the binary, replaces the binary and keeps the previous one beside it ([`core/selfupdate`](https://github.com/Warp-net/warpnet/tree/main/core/selfupdate)). See [Self-update](#self-update).

Logs go to standard output.

## Transport and limits

A relay uses the same transport stack as every other role: camouflage TLS, the network key (PSK), Noise XX and yamux, listening on TCP over IPv4 and IPv6 on one port. See [Network](network.md). What is specific to the relay:

- **Forced public reachability.** A relay is deployed on a static public address by definition, so it does not wait for AutoNAT to confirm it. NATed peers need the relay before they can help confirm anything.
- **Auto-relay to other relays.** It uses the other relays of its bootstrap list (never itself) as static relays.
- **No application state**, as described above.

### Circuit relay v2 limits

The limits are the same on every role ([`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go)):

| Limit | Value |
|---|---|
| Duration of one relayed connection | 1 hour |
| Data per relayed connection | 1 GiB |
| Reservation lifetime | 1 hour |
| Reservations in total | 128 |
| Reservations per IP address | 8 |
| Reservations per ASN | 32 |
| Open relayed connections per peer | 16 |
| Relay buffer size | 4096 bytes |

A relayed connection carries Noise ciphertext end to end between the two nodes. The relay sees both IP addresses and peer IDs, timing and volume, but not content.

Every role builds this relay service, but member nodes only make reservations on the relays in their bootstrap list, so in practice relayed traffic runs through relay nodes.

### Refusing circuits

When a member node has blocked a peer and that peer tries to reach it through a relay, the member's connection gater rejects the connection and asks the relay, on `/public/post/relay/refuse/reservation/0.0.0`, to refuse further circuits from that peer ([`core/node/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/options.go)). The relay accepts this only from a peer that holds a reservation on it, keeps the refusal for the reservation lifetime (one hour) and holds at most 256 refused peers per member ([`core/relay/reservation-refusals.go`](https://github.com/Warp-net/warpnet/blob/main/core/relay/reservation-refusals.go)).

### Connection limits

A relay runs the libp2p resource manager with per-subnet connection limits and a per-subnet connection rate limit, and a connection manager with the default watermarks of 20 and 50 connections and a one-hour grace period for new connections ([`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go)). When the connection manager has to trim, it keeps publicly reachable and well-rated peers first. Inbound discovery is rate-limited per IP address, so a burst of announcements cannot exhaust the node.

## Default relays

The built-in lists in [`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go) point at three relays run by the Warpnet project on one host, `207.154.221.44` (IPv6 `2a03:b0c0:3:f0:0:3:2477:f000`). Each relay is listed with an IPv4 and an IPv6 address.

| Network | TCP port | Peer ID |
|---|---|---|
| warpnet (mainnet) | 4001 | `12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j` |
| warpnet (mainnet) | 4002 | `12D3KooWSjbYrsVoXzJcEtmgJLMVCbPXMzJmNN1JkEZB9LJ2rnmU` |
| warpnet (mainnet) | 4003 | `12D3KooWNXSGyfTuYc3JznW48jay73BtQgHszWfPpyF581EWcpGJ` |
| testnet | 4011 | `12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j` |
| testnet | 4022 | `12D3KooWSjbYrsVoXzJcEtmgJLMVCbPXMzJmNN1JkEZB9LJ2rnmU` |
| testnet | 4033 | `12D3KooWNXSGyfTuYc3JznW48jay73BtQgHszWfPpyF581EWcpGJ` |

A full entry is a multiaddress such as:

```text
/ip4/207.154.221.44/tcp/4001/p2p/12D3KooWMKZFrp1BDKg9amtkv5zWnLhuUXN32nhqMvbtMdV2hz7j
```

Any other network name has no built-in relays. `--node.bootstrap` (or `NODE_BOOTSTRAP`), a comma-separated list of multiaddresses, **replaces** the built-in list; it is not added to it. A member node can also store its own list in its network settings, which takes precedence over the configuration.

## Running a relay

You need a host with a public IP address and an open TCP port. The relay builds without cgo and does not build for Windows (`//go:build !windows` in [`cmd/node/relay/main.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/relay/main.go)).

### From source

```bash
# run directly, on testnet, printing the network key
go run cmd/node/relay/main.go --node.network testnet --node.print-psk

# or build a static binary
CGO_ENABLED=0 go build -o warpnet-relay cmd/node/relay/main.go
./warpnet-relay --node.network testnet --node.port 4011 \
  --node.host.v4 203.0.113.10 --node.seed 'a long random secret'
```

On start the relay prints its peer ID and addresses:

```text
RELAY NODE STARTED WITH ID 12D3KooW... AND ADDRESSES [...]
```

Combine the public address, port and peer ID into a multiaddress (`/ip4/<address>/tcp/<port>/p2p/<peer ID>`) and give it to your member nodes with `--node.bootstrap` or in their network settings.

### With Docker

[`Dockerfile.relay`](https://github.com/Warp-net/warpnet/blob/main/Dockerfile.relay) builds a static binary into a distroless image. The project's own testnet relays run the image `ghcr.io/warp-net/warpnet-relay:latest` with host networking and a 192 MiB memory limit ([`deploy/docker-compose-testnet.yml`](https://github.com/Warp-net/warpnet/blob/main/deploy/docker-compose-testnet.yml)). The same setup, built locally:

```bash
docker build -f Dockerfile.relay -t warpnet-relay .
docker run -d --name warpnet-relay --network host --restart unless-stopped \
  -e NODE_NETWORK=testnet \
  -e NODE_PORT=4011 \
  -e NODE_HOST_V4=203.0.113.10 \
  -e NODE_SEED='a long random secret' \
  -e LOGGING_FORMAT=json \
  warpnet-relay
```

### Options

Flags and environment variables are read by [`config/config.go`](https://github.com/Warp-net/warpnet/blob/main/config/config.go); a flag wins over its environment variable.

| Flag | Environment variable | Default | Meaning for a relay |
|---|---|---|---|
| `--node.network` | `NODE_NETWORK` | `warpnet` | network to serve; `mainnet` is an alias of `warpnet` |
| `--node.port` | `NODE_PORT` | `4001` | TCP port, on IPv4 and IPv6 |
| `--node.host.v4` | `NODE_HOST_V4` | `0.0.0.0` | IPv4 address to listen on |
| `--node.host.v6` | `NODE_HOST_V6` | `::` | IPv6 address to listen on |
| `--node.seed` | `NODE_SEED` | empty | seed of the relay's key and peer ID |
| `--node.bootstrap` | `NODE_BOOTSTRAP` | built-in list | other relays to join; replaces the built-in list |
| `--node.print-psk` | `NODE_PRINT_PSK` | `false` | log the network key after start |
| `--node.self-update` | `NODE_SELF_UPDATE` | `true` | install new releases automatically |
| `--logging.level` | `LOGGING_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `--logging.format` | `LOGGING_FORMAT` | `text` | `text` or `json` |
| `--database.dir` | `DATABASE_DIR` | `storage` | no database on a relay; only used in the fallback seed |

The full configuration reference is in [Running a node](user-guide/running-a-node.md).

### Identity and the seed

The relay's Ed25519 key is derived from the seed, so the same seed always gives the same peer ID and your multiaddress stays valid across restarts and hosts.

> **Warning:** If `--node.seed` is empty, the seed is built from the string `seed` plus the network name, `--database.dir`, the IPv4 listen address and the port. All of these are public, so anyone can recompute the relay's private key and impersonate its peer ID. Always set `--node.seed` to a long random secret and keep it private.
{: .warning }

### The network key

`--node.print-psk` logs the network key after start as 64 hex characters:

```text
CURRENT PSK: <hex>
```

The key is `SHA-256(network name + major version)` ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)). It is not a secret: it separates networks and major versions so that a mismatched node fails on the first bytes. Printing it is useful to check that a relay and its clients are on the same network and version. See [Network](network.md).

### Self-update

With `--node.self-update` on (the default), the relay checks Codeberg and GitHub for a newer release one minute after start and then every hour. Unlike a member node, it does not ask anyone: it verifies the release's signed checksum list, replaces its own binary and restarts. Relay release assets exist for Linux on amd64 only; on any other platform self-update stays off. A new major version changes the network key, so an updated relay joins the peers that run the new major version. Set `--node.self-update=false` to update by hand.

### Your own private network

To run a fully separate network, start your relay and your member nodes with the same custom `--node.network` name and give the members your relay's multiaddress with `--node.bootstrap`. The custom name gives a different network key and DHT prefix, so these nodes never meet the public network. To stay on mainnet but avoid the project's relays, point your member nodes at your own relay instead; the member hands the same list to paired phones. If your relay itself joins the public network, DHT queries can still reach other public Warpnet nodes.

## See also

- [Architecture](architecture.md)
- [Member node architecture](member-node-architecture.md)
- [Network](network.md)
- [Discovery](discovery.md)
- [Running a node](user-guide/running-a-node.md)
