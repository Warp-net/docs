---
title: Stream API
description: How to call a Warpnet node over libp2p streams - connecting, framing, the signed JSON envelope, a full request/response example, pairing for private routes, and error handling.
---

# Stream API

Every Warpnet route is a libp2p protocol, and every call is one request and one response on its own stream. This page shows how a client or another node makes such a call: what it needs to connect, how a request is framed and signed, what comes back and how errors look. It is for developers writing a node, a bot or a client in another language. The route list is in the [API reference](api.md); the design behind it is in [Protocol](../protocol.md).

## What you need to connect

A Warpnet node accepts only connections that use its exact libp2p stack. A client needs:

| Piece | Value | Why |
|---|---|---|
| Identity | An Ed25519 key pair; the peer ID is derived from the public key | The node verifies every request against the key in your peer ID |
| Transport | TCP wrapped in TLS, as done by [libp2p-camouflage-transport](https://github.com/Warp-net/libp2p-camouflage-transport) | Nodes listen only through it; a plain libp2p TCP dial fails |
| Private network key | `SHA-256(network + major version)`, for example `SHA-256("warpnet0")`; `--node.print-psk` prints it | Without it the connection is dropped at once |
| Security | Noise | The only security protocol the node offers |
| Multiplexer | yamux | The only muxer the node offers |
| Node address | A multiaddr with the node's peer ID, for example `/ip4/203.0.113.5/tcp/4001/p2p/12D3KooW...` | From the pairing QR code, the node's start-up log or `/public/get/info` |

The Go side of all of this is in [`core/warpnet/options.go`](https://github.com/Warp-net/warpnet/blob/main/core/warpnet/options.go); the Android app's dial-only host in [`warpdroid/node/node.go`](https://github.com/Warp-net/warpnet/blob/main/warpdroid/node/node.go) is a compact reference for a client. Details of each layer: [Network](../network.md#the-connection-stack).

Your clock must be within 5 minutes of the node's, or every request is rejected as stale.

## Framing

One stream carries exactly one call:

1. Open a stream to the node with the route as the protocol ID, for example `/public/get/info/0.0.0`.
2. Write the request envelope as one JSON document.
3. Close the write side of the stream (half-close). End of stream is the only delimiter: there is no length prefix and no newline framing.
4. Read until end of stream. The whole response is one JSON document.
5. Close the stream.

Do not send a second request on the same stream; open a new one. The node closes the stream after it has written the response.

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
| `message_id` | yes | Unique per request. Reuse it only when you retry the same request: on `post` routes the node then answers from its idempotency cache instead of running the handler again |
| `node_id` | no | Your peer ID. The node authenticates you by the connection, not by this field |
| `path` | yes | The route, identical to the stream's protocol ID |
| `timestamp` | yes | RFC 3339, UTC recommended. Must be within 5 minutes of the node's clock |
| `version` | no | `0.0.0` |
| `signature` | yes | See below |

The type is `event.Message` in [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go). Encoding is plain JSON, UTF-8, snake_case field names; binary media is base64 inside JSON strings.

### Signing

Sign these bytes with your Ed25519 private key and put the base64 (standard alphabet) result in `signature`:

```text
exact bytes of the "body" value  ||  timestamp as decimal Unix nanoseconds  ||  path
```

Sign the body bytes exactly as you write them into the envelope. The node verifies the raw JSON of `body` byte for byte, so re-encoding it after signing (changing whitespace or key order) breaks the signature. The timestamp you sign must be the one you send, at nanosecond precision.

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
  "owner_id": "a1b2c3...",
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

`type` is `member`, `relay` or `moderator`. `reachability` is libp2p's value: 0 unknown, 1 public, 2 private. `relay_state` is `running` once the node advertises relay (`/p2p-circuit`) addresses.

Responses are the bare result type of the route, not wrapped in an envelope, and not signed. Their integrity comes from the Noise channel to the peer you dialed.

## Errors

A failed call returns an error object instead of the result type:

```json
{"code":5000,"message":"middleware: auth: stale or replayed message"}
```

| Code | Meaning |
|---|---|
| `0` with message `Accepted` | Success for routes that return nothing else |
| `5000` | The handler failed (the message is the handler's error), or the auth middleware rejected the request: `middleware: internal node error` for an unparseable envelope, a missing `message_id` or signature, or a bad signature; `middleware: auth: stale or replayed message` for a timestamp outside the window; `middleware: auth: unknown client peer` for a private route without pairing |
| `5001` | Rate limit for this route exceeded; retry later |
| `0` with another message | The node could not read the request (`middleware: stream: reading failed`), is shutting down (`node is offline`) or the handler returned nothing (`empty response`) |

If the request is larger than the route's limit (1 MiB for most routes, 50 MiB for media uploads), the node resets the stream without any response. A practical check on the client side: if the response parses as `{code, message}` with a non-empty message that is not `Accepted`, treat it as an error. The full table and the size limits are in [Protocol](../protocol.md#errors-and-responses).

## Public and private routes

Any peer can call `public` routes. Handlers that act for a user check that the user belongs to the node at the other end of the stream, so you can act only for the identity of your own node.

`private` routes act on the owner's data. A node serves them only to itself and to paired devices. To become a paired device:

1. Get the node's session token. The desktop app and the remote dashboard show it in the pairing QR code, which holds the login response `domain.AuthNodeInfo` (`user_id`, `token`, `psk`, `node_id`, `addresses`, `bootstrap_peers`, `network`) as gzip-compressed, Base45-encoded JSON.
2. Connect with your own identity and call `/private/post/admin/pair/0.0.0` with that object as `body`.
3. On success the node answers with its current multiaddrs and accepts private routes from your peer ID until it is unpaired or restarted.

This is how the Android and iOS apps work ([Mobile apps](../user-guide/mobile.md)). The desktop UI and the browser dashboard do not use streams at all; they go through the node's in-process bridge or the [WebSocket API](ws-API.md).

## Limits and good practice

- Keep one connection per node and open a new stream per call; streams are cheap on yamux.
- Respect the rate limits: by default 60 burst and 300 per minute for reads, 30 and 120 for writes, less for uploads and pairing ([Protocol](../protocol.md#middleware-chain)).
- When a response is lost, retry with the same `message_id`, a new timestamp and a new signature. The node's idempotency cache is keyed by route, peer and `message_id` and holds results for 10 minutes, so a `post` route is not executed twice.
- Allow up to 2 minutes for a response, more for video. The node itself gives up reading a request after 15 seconds (5 minutes on upload routes).
- Expect relayed connections: if the node is behind NAT you may reach it through a circuit relay, where the 1-hour and 1 GiB per-connection relay limits apply.

## See also

- [API reference](api.md): every route with its request and response types
- [WebSocket API](ws-API.md): the remote node's browser bridge
- [Protocol](../protocol.md): envelope, signing, gossip, versioning
- [Network](../network.md): transport stack and NAT traversal
- [Clients](clients.md): how each Warpnet client reaches its node
