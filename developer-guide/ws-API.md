---
title: WebSocket API
description: The remote node's /ws bridge - Noise XX handshake, encrypted JSON frames, login and enrolment, request and response envelopes, errors.
---

# WebSocket API

The remote flavour of the member node (`cmd/node/member/remote-member.go`, built with the `remote` tag) has no window: it serves the web dashboard to a browser. The dashboard talks to the node over one WebSocket at `/ws`, encrypted end to end with Noise. This page describes that bridge for developers who want to write their own dashboard, a script or a bot against a remote node. The routes are listed in the [API reference](api.md).

## Endpoint

| Item | Value |
|---|---|
| URL | `ws://<host>:<port>/ws` (or `wss://` behind a TLS proxy) |
| Default bind | `0.0.0.0:4999`; change with `--node.server.host` and `--node.server.port` (`NODE_SERVER_HOST`, `NODE_SERVER_PORT`) |
| Other paths | The dashboard's static files; an unknown path serves `index.html` |
| Origin | A request whose `Origin` host differs from the `Host` it connects to is refused. Requests without an `Origin` header (non-browser clients) are allowed |
| Frames | Binary WebSocket messages |

Code: [`cmd/node/member/remote-member.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote-member.go), [`cmd/node/member/remote/bridge.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote/bridge.go), [`security/noise.go`](https://github.com/Warp-net/warpnet/blob/main/security/noise.go). The browser side is [`frontend/src/lib/transport.js`](https://github.com/Warp-net/warpnet/blob/main/frontend/src/lib/transport.js) and [`frontend/src/lib/noise.js`](https://github.com/Warp-net/warpnet/blob/main/frontend/src/lib/noise.js).

## Handshake

Each connection starts with a Noise handshake, `Noise_XX_25519_ChaChaPoly_SHA256`, with an empty prologue. The client is the initiator, the node the responder. Each handshake message is one binary WebSocket message:

```mermaid
sequenceDiagram
    participant C as Client
    participant N as Node
    C->>N: message 1 (e)
    N->>C: message 2 (e, ee, s, es)
    C->>N: message 3 (s, se)
    Note over C,N: transport keys established
    C->>N: encrypted request
    N->>C: encrypted response
```

- The handshake must finish within 10 seconds of the upgrade.
- **Node key.** The node's static X25519 key is stored in `ws-noise.key` in the network's data directory, next to the database directory (`~/.warpdata/<network>/ws-noise.key` on Linux and macOS), and is created on first start. At start-up the node prints its fingerprint: the hex SHA-256 of the static public key.
- **Client key.** The client brings its own long-lived static X25519 key. The browser dashboard generates one on first use and keeps it in `localStorage` (`warpnet.client.key`).
- **Pinning.** The dashboard pins the node's fingerprint on first contact (`warpnet.node.key`) and refuses to continue if it ever changes. A custom client should do the same, or compare the fingerprint with the one the node printed.

There is no pre-shared secret and no plaintext fallback.

## Transport frames

After the handshake, every binary WebSocket message in either direction is one Noise transport message: ChaCha20-Poly1305 with a counter nonce, so messages must be decrypted in the order they arrive. The plaintext is one UTF-8 JSON document.

- A message that fails to decrypt closes the connection.
- A message that decrypts but is not a valid envelope is logged and dropped **without a reply**; the client will only see its own timeout.
- The node handles up to 32 requests per connection at the same time, so responses can arrive in any order. Match them to requests by `message_id`.

## Request envelope

The plaintext of a request is an `event.Message` ([`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go)):

```json
{
  "path": "/private/get/timeline/0.0.0",
  "body": {"user_id": "01JD7Q...", "limit": 20},
  "message_id": "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
  "timestamp": "2026-11-24T10:15:30Z"
}
```

| Field | Required | Notes |
|---|---|---|
| `path` | yes | A route from the [API reference](api.md), or one of the bridge paths below |
| `body` | yes | The route's request type as JSON; `{}` when it takes none |
| `message_id` | yes | Unique per request (the dashboard uses UUIDs) and copied into the response. A route call without it fails with `middleware: internal node error` |
| `timestamp` | no | RFC 3339. If missing, the node uses the current time. A value that is not RFC 3339 makes the envelope invalid |
| `node_id`, `version`, `signature` | no | Not needed. The node signs the request itself |

You do not sign anything: the Noise channel authenticates the client, and the bridge signs the envelope with the owner's key before it passes it to the node's own handler as a loopback call. Because the call comes from the node itself, private routes are allowed and the 5-minute freshness check does not apply.

## Response envelope

```json
{
  "body": {"cursor": "end", "tweets": [], "user_id": "01JD7Q..."},
  "message_id": "6f1c2a7e-3b4d-4e5f-8a9b-0c1d2e3f4a5b",
  "node_id": "",
  "path": "/private/get/timeline/0.0.0",
  "timestamp": "2026-11-24T10:15:30.481Z",
  "version": "0.0.0",
  "signature": ""
}
```

`message_id` and `path` are copied from the request. `body` is exactly what the route returned: the response type from the [API reference](api.md), `Accepted`, or an error object. `node_id` and `signature` are empty.

## Bridge paths

| Path | Needs login | Body | Response body |
|---|---|---|---|
| `is-first-run` (no leading slash) | no | `{}` | `true` until the first login has created the node's database, then `false` |
| `/private/post/login/0.0.0` | no | `LoginEvent`: `{"username": "<login>", "password": "..."}` | `LoginResponse` (`domain.AuthNodeInfo`): `user_id`, `token`, `psk`, `node_id`, `addresses`, `bootstrap_peers`, `network` |
| `/private/post/logout/0.0.0` | yes | `{}` | `["logged_out"]` |
| any other route | yes | the route's request type | the route's response |

The `username` field of `LoginEvent` carries the account's **login**, the name typed into the "Login" field of the sign-in form. It is not the profile name other users see. The login response is also what the dashboard encodes into the pairing QR code for phones.

## Login and enrolment

The bridge authorizes a connection by the client static key the Noise handshake proved, not by cookies or tokens:

1. On a connection from a client key that is not enrolled, only `is-first-run` and login work. Everything else answers `401`.
2. A successful login opens the node's encrypted database and **enrols** the client's static key; the connection is authorized at once. The first login of the node process also starts the member node. On a node without an account, the first login creates it with the given login and password.
3. Later connections with the same client key are authorized without logging in again, for as long as the node process runs. Enrolments are kept in memory only.
4. Logout removes the client's key from the enrolment list and de-authorizes the connection. The node keeps running, and other enrolled clients stay signed in.

Login and logout on a connection wait for that connection's in-flight requests to finish, then run alone.

The login and the password together are the account's identity: the node derives its identity key and the database key from both. With a different login or a different password the node derives different keys and cannot open the existing database. The password must be 8 to 32 characters with an uppercase letter, a lowercase letter, a digit and a special character. Details are in [Security](../security.md#identity-and-key-derivation).

## Errors

Errors arrive as a response envelope whose `body` is an error object:

| Body | Meaning |
|---|---|
| `{"code":401,"message":"this connection is not signed in: log in on this node first"}` | The connection is not enrolled, or the node is not signed in |
| `{"code":500,"message":"not attached server node"}` | Signed in, but the member node has not finished starting |
| `{"code":500,"message":"..."}` | Login failed (for example `authentication failed: ...` or a password rule), or the request could not be dispatched (for example `node: selfstream: no handler for path ...`) |
| `{"code":5000,"message":"..."}`, `{"code":5001,...}` and others | Passed through from the route itself; see [Stream API](stream-API.md#errors) |

`/private/get/update/0.0.0` and `/private/post/update/0.0.0` exist only in the desktop app; on a remote node they fail with a "no handler" error, because the remote node does not update itself.

## Timeouts

The node gives each request 1 minute inside the loopback call, 10 minutes for `/private/post/import/twitter/tweet/0.0.0`. The browser dashboard waits 30 seconds by default, and longer for archive import (10 minutes), sponsored-tweet orders (7 minutes), video (3 minutes), copy-buyer checks (2 minutes) and order quotes (1 minute).

## Security notes

- The WebSocket payload is encrypted end to end between client and node, but the node serves the dashboard's HTML and JavaScript over plain HTTP. On a network you do not trust, bind the dashboard to `127.0.0.1` and use an SSH tunnel, or put a TLS reverse proxy in front.
- Anyone who can reach the port can try to log in. Whoever knows the login and the password controls the account, so keep both private and the password strong.

## See also

- [API reference](api.md): the routes you can call
- [Stream API](stream-API.md): calling a node over libp2p instead
- [Clients](clients.md): how each client reaches its node
- [Running a node](../user-guide/running-a-node.md): starting a remote node
- [Network](../network.md#the-remote-nodes-dashboard): what the dashboard exposes on the network
