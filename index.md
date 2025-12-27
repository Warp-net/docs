Welcome to the official documentation for **WarpNet**, a fully decentralized peer-to-peer social network designed for privacy, autonomy, and resilience.

WarpNet does not rely on centralized servers. All user data is stored locally, and communication happens directly between peers using cryptographic protocols. This documentation provides everything you need to understand, use, contribute to, and deploy WarpNet.

---

## What is WarpNet?

WarpNet is an experimental social protocol that:

- Stores all content **locally on your device**
- Enables **serverless communication** using peer-to-peer networking 
- Uses Diffie–Hellman cryptographic algorithm and Noise protocol to ensure security
- Provides tools for **self-moderation**, **content control**, and **user autonomy** (TODO)
- Encourages an ecosystem of independently operated nodes

---

## Documentation Structure

This documentation is divided into the following sections:

### Overview

- [Architecture](architecture.md) — Core components, how nodes interact, message flow
- [Protocol](protocol.md) — Message formats, discovery, broadcasting
- Consensus — Reaching agreed state between nodes by:
  - [CRDT](CRDT.md) - CRDT Gossip consensus

### Security & Storage

- [Security](security.md) — Codebase integrity, rate limiting, encrypted streams and metadata
- [Storage](storage.md) — How data is stored with BadgerDB, export and recovery

### Integration

- [Mastodon](mastodon.md) - Read-only integration with Mastodon semi-centralized social network

### Participation

- [Moderation](./moderation.md) — How LocalAI is used for content filtering
- [Bootstrap Node](bootstrap-node-architecture.md) — Running your own entry point
- [Member Node Architecture](member-node-achitecture.md) — Core components, how nodes interact, message flow

### User Guide

- [Using WarpNet](user-guide/index.md) — Basic usage
- [Backup & Recovery](user-guide/backup-and-restore.md)
- [FAQ](user-guide/FAQ.md)

### Developer Guide

- [Building and Contributing](developer-guide/index.md)
- [Stream API](developer-guide/stream-API.md)
- [Websocket API](developer-guide/WS-API.yml)
- [Websocket API messages example](developer-guide/WS-API-example.json)

### Legal

- [Privacy Policy](legal/PRIVACY-POLICY.md)
- [Terms & Conditions](legal/T&C.md)
- [Contributor License Agreement (CLA)](legal/CLA.md)
- [License](legal/LICENSE.md)

## How To Help 

- [How To Help](HOW-TO-HELP.md)

## Community & Support

- GitHub: [github.com/Warp-net/warpnet](https://github.com/Warp-net/warpnet)
- Telegram: [t.me/warpnetdev](https://t.me/warpnetdev)

For security concerns, contact the maintainers via GitHub Issues or community channels.

---

## Philosophy

WarpNet is not a centralized service or a traditional social platform. 
It is an autonomous, distributed ecosystem designed for resilient communication 
and user control.

    No Big Brother

Each user operates their own node. Each node enforces its own policies. 
Together, they form a network without masters or intermediaries.
WarpNet prioritizes sovereignty, privacy, and decentralized governance over 
engagement metrics or monetization.
