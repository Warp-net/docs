# WarpNet Security Model

![sec-model.png](assets/sec-model.png)

WarpNet is designed as a secure, decentralized, serverless communication system. Its security architecture 
is layered and cryptographically grounded, with no need for third-party trust or certification authorities.

## 1. Storage Layer Security (main security level)

WarpNet uses [BadgerDB](https://github.com/dgraph-io/badger) as its embedded storage engine. 
All user data is stored locally and **encrypted at rest**.

### Encrypted Local Database

When the node is started, it requires the user to log in with a **username and password**. 
These credentials are used to:

1. **Unlock and decrypt** the BadgerDB database
2. **Generate an in-memory session token** used for frontend-backend authentication
3. **Derive the node’s long-term private key**

> This means that access to the database is impossible without the correct username/password pair. 
> There is no "backdoor", recovery key, or fallback mode (yet).

---

### Credential-Derived Secrets

On login, the following occurs:

#### Session Token Generation

A random + time-based seed is hashed to create a one-time session token:

```javascript
tokenSeed = username + "@" + password + "@" + randomChar + "@" + currentTime
token = sha256(tokenSeed)
```

This token is used for authenticating requests from the frontend (e.g. over WebSocket) and from client node.

#### Deterministic Private Key

The node's private key is derived deterministically from the login credentials:

```javascript
pkSeed = sha256(username + "@" + password + repeat("@", password.length)) // no random
privateKey = GenerateKeyFromSeed(pkSeed)
```

This ensures that the private key is:

* **Not stored on disk**
* Reproducible from credentials alone
* Consistent between sessions (if the user logs in again)

> If the user forgets their password, the private key and database are unrecoverable.

---

### File-level Protection

BadgerDB files are only accessible to the user that runs the node. It is recommended to use file-system encryption 
and OS-level sandboxing in addition to the internal crypto.

---

## 2. Peer-to-Peer Encryption with Noise + PSK

All WarpNet nodes communicate using [libp2p](https://libp2p.io), which provides an encrypted transport layer using 
the Noise Protocol Framework. Specifically, WarpNet uses the `XX` handshake pattern, combined with a Pre-Shared Key 
(PSK) to gate network access.

### Key Features

- **End-to-end encryption** between nodes using Noise
- **Mutual authentication** without certificates
- **Session keys** established via **ephemeral Diffie-Hellman**
- **Access control** via PSK — only authorized nodes can connect

### No Certificates Required
- No TLS, no certificate authorities
- Each libp2p node generates its own asymmetric keypair (e.g. Ed25519)
- The Noise handshake handles identity and encryption without central trust anchors

---

## 3. Pre-Shared Key (PSK)

The PSK acts as a **gatekeeping mechanism** — nodes with mismatched PSKs cannot connect or handshake.

### PSK Derivation Logic

The PSK is derived locally at node startup as follows:

```javascript
seed = networkName + codeHash + majorVersion + entropy
psk = sha256(seed)
````

### Input Components:

* `networkName` — network name (e.g. `warpnet`, `testnet`)
* `codeHash` — SHA-256 of the current codebase
* `majorVersion` — semantic version (e.g. 1 from 1.2.3)
* `entropy` — locally generated anchored entropy for uniqueness

This approach ensures:

* All participating nodes run the same code
* Version mismatches or tampered codebases fail silently
* No static keys in repo; all PSK generation is dynamic and deterministic

---

## 4. Internode challenge using node own codebase and signature verification

WarpNet now includes a cryptographic challenge-response mechanism as part of the node discovery process. 
This feature ensures that newly connected peers are authentic, running the expected codebase, and not attempting to 
spoof or impersonate legitimate nodes.

The idea is that challenge-response system provides a lightweight, cryptographically secure proof-of-identity for each 
peer.
It helps protect the network from:
- Malicious or rogue nodes,
- Nodes with invalid or outdated codebases,
- Sybil attacks or spam connections,
- Man-in-the-middle or replay attacks.

How it works:

1. Challenge Generation:
    - During discovery discovering, node randomly selects a file and line from its local codebase.
    - It extracts a substring, generates a `SHA-256` hash of it combined with a random `nonce`.

2. Challenge Request:
    - The node sends the file location and the `nonce` to the remote peer.

3. Challenge Response:
    - The remote peer resolves the same substring on its end, computes the same hash, and signs it using its Ed25519 
      private key
    - It returns both the raw hash (`hex-encoded`) and the signature (`base64`).

4. Verification:
    - The requesting node compares the received hash with its own.
    - It then verifies the signature using the peer's public key from the peerstore.
    - If either fails, the peer is considered untrusted and may be temporarily blocklisted.

---

## 5. Frontend-to-Backend Encryption via ECDH

To secure local UI interaction (e.g. browser frontend ↔ local node backend), WarpNet establishes a secure 
session using Elliptic Curve Diffie-Hellman (ECDH):

### Handshake Flow

1. Frontend generates ephemeral ECDH keypair using WebCrypto
2. Sends public key to backend via WebSocket
3. Backend replies with its own ephemeral key
4. Both derive the same symmetric session key via `ECDH(PubA, PrivB)`
5. All further communication is encrypted using this shared key

This protects against:

* Local man-in-the-middle (e.g. rogue browser extensions)
* Session hijacking on local ports
* Frontend/backend desynchronization

Session keys are valid per browser session only and not persisted.

---

## 6. Built-in Abuse Protection (libp2p Rate Limiting)

WarpNet leverages [libp2p’s built-in protection services](https://pkg.go.dev/github.com/libp2p/go-libp2p-p2p/security) to prevent abuse and denial-of-service (DoS):

### Included Protections:

* Connection gating: deny inbound peers based on PSK, IP, PeerID, etc.
* Stream rate limiting: per protocol, per peer
* Dial-backoff: exponential cooldown for bad/misbehaving peers
* Resource management: max open streams, buffers, memory usage per peer

These are enforced automatically by the libp2p host stack and can be customized via `ResourceManager` interfaces.

---
## Related Docs

- [Noise Protocol Framework Specification](http://www.noiseprotocol.org/)
- [Elliptic Curve Diffie-Hellman Wikipedia](https://en.wikipedia.org/wiki/Elliptic-curve_Diffie%E2%80%93Hellman)
- [Challenge–response authentication](https://en.wikipedia.org/wiki/Challenge%E2%80%93response_authentication)

---

