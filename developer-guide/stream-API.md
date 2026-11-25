---
title: Stream API
description: How to call a Warpnet node over libp2p streams - connecting, framing, the signed JSON envelope, a full request/response example, pairing for private routes, and error handling.
---

# Stream API

Every Warpnet route is a libp2p protocol, and every call is one request and one response on its own stream. This page shows how a client or another node makes such a call: what it needs to connect, how a request is framed and signed, what comes back, how errors look and how a device gets access to private routes. It is for developers writing a node, a bot or a client in another language. The route list is in the [API reference](api.md); the design behind it is in [Protocol](../protocol.md).

## What you need to connect

A Warpnet node accepts only connections that use its exact libp2p stack. A client needs:

| Piece | Value | Why |
|---|---|---|
| Identity | An Ed25519 key pair; the peer ID is derived from the public key | The node verifies every request against the key in your peer ID |
| Transport | TCP inside a TLS tunnel, as done by [libp2p-camouflage-transport](https://github.com/Warp-net/libp2p-camouflage-transport) | It is the only transport nodes listen on; a plain libp2p TCP dial fails |
| Private network key | `SHA-256(network name + major version)`, for example `SHA-256("warpnet0")` for 0.x releases on the main network or `SHA-256("testnet0")` on testnet | Without it the connection is dropped at once. The relay binary prints it with `--node.print-psk`; a paired phone gets it in hex as `psk` in the pairing data |
| Security | Noise | The only security protocol the node offers |
| Multiplexer | yamux | The only muxer the node offers |
| Node address | A multiaddr with the node's peer ID, for example `/ip4/203.0.113.5/tcp/4001/p2p/12D3KooW...` | From the pairing data, the node's start-up log (`NODE STARTED WITH ID ... AND ADDRESSES ...`) or `/public/get/info` |

The Go side of all of this is in [`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go) and [`core/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/core/node/node.go); the mobile apps' dial-only host in [`warpdroid/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/warpdroid/node/node.go) is a compact reference for a client. Details of each layer: [Network](../network.md#the-connection-stack).

Your clock must be within 5 minutes of the node's, or every request is rejected as stale.

## Framing

One stream carries exactly one call:

1. Open a stream to the node with the route as the protocol ID, for example `/public/get/info/0.0.0`.
2. Write the request envelope as one JSON document.
3. Close the write side of the stream (half-close). End of stream is the only delimiter: there is no length prefix and no newline framing.
4. Read until end of stream. The whole response is one JSON document.
5. Close the stream.

Do not send a second request on the same stream; open a new one. The node closes the stream after it has written the response.

If the node is reachable only through a circuit relay, the connection is a limited one and libp2p refuses to open streams on it unless the stream's context allows it. In Go, wrap the context with `network.WithAllowLimitedConn` as the node and the mobile apps do.

## The request envelope

```json
{
  "body": {},
  "message_id": "01JD7Q3K8V6N2M4P5R7S9T0W1X",
  "node_id": "12D3KooWClient...",
  "path": "/public/get/info/0.0.0",
  "timestamp": "2026-11-24T10:15:30.123456789Z",
  "version": "0.0.0",
  "signature": "Base64Signature..."
}
```

| Field | Required | Notes |
|---|---|---|
| `body` | yes | The route's request type from the [API reference](api.md), as JSON. Use `{}` for routes without input |
| `message_id` | yes | Unique per request. On routes with `/post/` in the path it is the idempotency key: reuse it only when you retry the same request |
| `node_id` | no | Your peer ID. The node authenticates you by the connection, not by this field |
| `path` | yes | The route, identical to the stream's protocol ID; it is part of the signed bytes |
| `timestamp` | yes | RFC 3339, UTC recommended. Must be within 5 minutes of the node's clock |
| `version` | no | Nodes send `0.0.0`; the field is not checked |
| `signature` | yes | See below |

The type is `event.Message` in [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go). Encoding is plain JSON, UTF-8, snake_case field names; binary media is base64 inside JSON strings.

### Signing

Sign these bytes with your Ed25519 private key and put the base64 (standard alphabet) result in `signature`:

```text
exact bytes of the "body" value  ||  timestamp as decimal Unix nanoseconds  ||  path
```

The node checks the signature against the public key inside the peer ID of the connection. Sign the body bytes exactly as you write them into the envelope: the node verifies the raw JSON of `body` byte for byte, so re-encoding it after signing (changing whitespace or key order) breaks the signature. The timestamp you sign must be the one you send, at nanosecond precision.

## Example in Go

This is what a node does for every outgoing call ([`core/stream/stream.go`](https://github.com/Warp-net/warpnet/blob/main/core/stream/stream.go)), reduced to the essentials:

```go
body, _ := json.Marshal(event.GetUserEvent{UserId: userId})

msg := event.Message{
    Body:        body,
    MessageId:   ulid.Make().String(),
    NodeId:      host.ID().String(),
    Destination: event.PUBLIC_GET_USER, // serialized as "path"
    Timestamp:   time.Now().UTC(),
    Version:     "0.0.0",
}
msg.Signature = security.Sign(privKey, msg.SigningBytes())
data, _ := json.Marshal(msg)

ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
defer cancel()
ctx = network.WithAllowLimitedConn(ctx, "warpnet") // allow a relayed connection
s, err := host.NewStream(ctx, nodePeerID, protocol.ID(event.PUBLIC_GET_USER))
if err != nil {
    return err
}
defer s.Close()

_, _ = s.Write(data)
_ = s.CloseWrite()

_ = s.SetReadDeadline(time.Now().Add(2 * time.Minute))
resp, err := io.ReadAll(s) // a domain.User, or an error object
```

## Example on the wire

Request for `/public/get/info/0.0.0`:

```json
{"body":{},"message_id":"01JD7Q3K8V6N2M4P5R7S9T0W1X","node_id":"12D3KooWClient...","path":"/public/get/info/0.0.0","timestamp":"2026-11-24T10:15:30.123456789Z","version":"0.0.0","signature":"..."}
```

Response (`warpnet.NodeInfo`), shortened:

```json
{
  "type": "member",
  "owner_id": "01JD7Q...",
  "node_id": "12D3KooWNode...",
  "aliases": null,
  "version": "0.8.124",
  "addresses": ["/ip4/203.0.113.5/tcp/4001", "/ip6/2001:db8::5/tcp/4001"],
  "start_time": "2026-11-24T09:00:00Z",
  "relay_state": "waiting",
  "bootstrap_peers": null,
  "reachability": 1,
  "protocols": ["/public/get/info/0.0.0", "/public/get/user/0.0.0", "..."],
  "network": "warpnet"
}
```

`type` is `member`, `relay` or `moderator`. `aliases` lists the peer IDs of paired devices. `reachability` is libp2p's value: 0 unknown, 1 public, 2 private. `relay_state` becomes `running` once the node has a relay (`/p2p-circuit`) address.

Responses are the bare result type of the route, not wrapped in an envelope, and not signed. Their integrity comes from the Noise channel to the peer you dialed.

## Errors

A failed call returns an error object instead of the result type:

```json
{"code":5000,"message":"middleware: auth: stale or replayed message"}
```

| Code | Meaning |
|---|---|
| `0` with message `Accepted` | Success for routes that return nothing else |
| `5000` | The handler failed (the message is the handler's error), or the auth middleware rejected the request: `middleware: internal node error` for an unparseable envelope, a missing `message_id` or signature, or a bad signature; `middleware: auth: stale or replayed message` for a timestamp outside the window; `middleware: auth: unknown client peer` for a private route from a peer that is not paired |
| `5001` | `middleware: too many requests for this route`: the rate limit for this route is exhausted; retry later |
| `0` with another message | The node could not read the request (`middleware: stream: reading failed`), is shutting down (`node is offline`) or the handler returned nothing (`empty response`) |

A request larger than the route's limit gets no response: the node resets the stream. A practical check on the client side: if the response parses as `{code, message}` with a non-zero code, or a code of 0 with a message other than `Accepted`, treat it as an error.

## Public and private routes

The auth middleware ([`core/middleware/auth.go`](https://github.com/Warp-net/warpnet/blob/main/core/middleware/auth.go)) lets a request through when its signature verifies and:

- the route is `public`, from any peer;
- the route is `private` and the caller is the node itself (a loopback call) or one of its paired devices;
- the route is `/private/post/admin/pair`, from any peer.

Handlers that act for a user check that the peer at the other end of the stream is that user's node, so a peer can act only for its own identity. A paired device counts as the member node it is paired with: it can call public routes on its node as the owner, for example to post a reply or react.

### Pairing a device

1. Get the node's pairing data: the login response `domain.AuthNodeInfo` (`user_id`, `token`, `psk`, `node_id`, `addresses`, `bootstrap_peers`, `network`). The desktop app and the browser dashboard show it under "Sign in by QR-code" as a QR code (the JSON gzip-compressed and Base45-encoded); "Copy connection data" in the same dialog gives the plain JSON.
2. Start a libp2p host with your own Ed25519 key and the PSK from `psk` (hex), and dial one of `addresses` with `/p2p/<node_id>` appended, so the Noise handshake proves the node's identity.
3. Call `/private/post/admin/pair/0.0.0` with that JSON as `body`.
4. On success the node answers with a JSON array of its current multiaddrs and stores your peer ID as a paired device. Errors come back as error objects with code 5000, for example `token mismatch`, `pairing revoked` or `too many aliases`.

A pairing lasts 72 hours from the last successful pair request; sending the same request again renews it and returns fresh addresses. A node keeps at most 10 paired devices. The pairing ends earlier when the owner removes the device, or when the member node starts again: every start unpairs all devices, and on the desktop app every sign-in starts the node (a remote node starts it on the first sign-in of its process). A device that was unpaired cannot pair again with the same token (`pairing revoked`). The token changes only when the node's process restarts, so the device needs pairing data from after that restart. Device rules from the clients' side are in [Clients](clients.md#pairing).

This is how the Android and iOS apps work ([Mobile apps](../user-guide/mobile.md)). The desktop UI and the browser dashboard do not open libp2p connections; they reach the same handlers through an in-process loopback stream, see [Clients](clients.md).

## Limits and good practice

- Keep one connection per node and open a new stream per call; streams are cheap on yamux.
- Request size: 50 MiB for `/private/post/image`, `/private/post/video`, `/private/post/import/twitter/tweet` and `/private/get/sponsored/buyer`; 1 MiB for every other route, chat uploads included. The node reads a request for at most 15 seconds, 5 minutes on the 50 MiB routes.
- Rate limits are counted per peer and route ([`core/ratelimit/stream.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/stream.go)). By default `get` routes allow a burst of 60 and 300 per minute, other routes 30 and 120; the owner can change both in the rate-limit settings. Some routes have their own budget: media downloads 150 and 600, uploads 10 and 30, timeline and moderation-result delivery 200 and 1200, chat creation and messages 60 and 300, reports 10 and 30, pairing 5 and 15. A peer with a low [rating](../rating.md) gets a fraction of the budget. Video download routes also accept at most 2 concurrent streams per peer.
- When a response is lost, retry with the same `message_id`, a new timestamp and a new signature. On `/post/` routes the node keeps successful responses for 10 minutes, keyed by route, peer and `message_id`, and answers a repeat from that cache instead of running the handler again. Error responses and responses over 64 KiB are not cached.
- Nodes wait up to 2 minutes for a response; a handler that has to ask another node can take that long.
- Expect relayed connections: if the node is behind NAT you may reach it through a circuit relay. A relay run by a Warpnet node limits each relayed connection to 1 hour and 1 GiB.

## See also

- [API reference](api.md): every route with its request and response types
- [WebSocket API](ws-API.md): the remote node's browser bridge
- [Protocol](../protocol.md): envelope, signing, gossip, versioning
- [Network](../network.md): transport stack and NAT traversal
- [Clients](clients.md): how each Warpnet client reaches its node
