---
title: FAQ
description: Short answers about what Warpnet is, how it compares, where your data lives, moderation, mobile apps and running a node.
redirect_from:
  - /user-guide/FAQ.html
---

# FAQ

Short answers to the questions people ask most, for users first and developers second. Each answer links to the page with the details. If your question is missing, ask in [Telegram](https://t.me/warpnetdev).

## About Warpnet

### What is Warpnet?

A Twitter-style social network with no servers. Every account lives on its owner's node: the desktop app (or a headless server version) that stores the account's data and talks directly to other nodes over [libp2p](https://libp2p.io/). There are no instances, no accounts held by a company and no central database. Phones join as companions of a node. See [Architecture](architecture.md).

### Who owns Warpnet?

Nobody owns the network: it exists as the nodes people run. The software is free and open source. The project is maintained by its original author, Vadim Filin, and contributors.

### Is it open source?

Yes. The node in all its roles (desktop app, remote node, relay, moderator), the desktop UI and the Android app are under the GNU Affero General Public License v3.0 or later; the iOS app is under the Apache License 2.0. The code is at [github.com/Warp-net/warpnet](https://github.com/Warp-net/warpnet), and the related repositories (bridge gateway, moderation engine, camouflage transport) are under [github.com/Warp-net](https://github.com/Warp-net). For the AGPL parts, anyone who runs a modified version that others interact with must share their changes.

### Is it production-ready?

No. Warpnet is pre-1.0 (version 0.8) and changes quickly. Use testnet to explore, expect rough edges, and report what you find.

### Does it cost anything?

No. There is no subscription, no fee to join and no paid tier. What it costs you is the computer that runs your node and its electricity and traffic. E-mail notifications go through your own SMTP account. The experimental sponsored tweets involve payments between users on the TRON blockchain (see [Monetization](#monetization)).

### Is Warpnet a blockchain?

No. The social network runs on libp2p, an encrypted local database on each node, and a few replicated counters and ratings (see [Synchronization](synchronization.md)). The only blockchain involved is TRON, used by the experimental wallet and sponsored tweets; the wallet is shown on testnet only.

## Compared with other networks

### How is it different from X (Twitter)?

X is one company that owns the accounts, the servers, the ranking and the moderation rules. Warpnet has no operator: your account and data live on your node, and nodes talk to each other directly. Nobody can suspend your account, because nobody holds it.

### How is it different from Mastodon?

Mastodon is federated: you join an instance whose admin holds your data, sets the rules and can shut the server down or cut it off from others. Warpnet has no instances and no admins; you are the node.

### How is it different from Bluesky?

Bluesky's AT Protocol stores your data on a personal data server run by a provider, with relays and indexers in between. Warpnet has no hosted tier: your node is the only home of your data.

### How is it different from Nostr?

Nostr stores your events on relay servers, which can refuse or delete them. Warpnet's relays store nothing: they help nodes find each other and forward encrypted traffic when two nodes cannot connect directly. Your posts are served by your own node.

### Can Warpnet talk to other networks?

Yes, through a bridge gateway, a Warpnet node run by the project. Through it you can find Mastodon (and the wider Fediverse), Threads and Nostr accounts by handle (for example `@user@mastodon.social`), see them in their own tabs of **Who to follow**, and follow them. Direct messages to bridged accounts are not supported. You can point your node at another gateway in **Settings → Bridge gateway**. See [Bridges](bridge.md).

## Using Warpnet

### Where do I download Warpnet?

From [warpnet.site/download](https://warpnet.site/download): Windows, Linux (x86-64 and ARM64), macOS and the Android APK. The links there point to the latest [GitHub release](https://github.com/Warp-net/warpnet/releases/latest). On Linux you can also run `sudo snap install warpnet --beta`. Phone apps are on F-Droid and the App Store. See [Getting started](user-guide/index.md).

### Do I need a server?

No. The desktop app is a complete node. If you want an always-on node, you can run the same node headless on a server and use it from a browser. See [Running a node](user-guide/running-a-node.md).

### Is there a mobile app?

Yes, for Android ([F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/) or the APK from [warpnet.site/download](https://warpnet.site/download)) and iOS ([App Store](https://apps.apple.com/app/warpnet/id6835178022)). Both are companions: you pair them with your node by scanning a QR code, and they read and post as you through it. See [Mobile apps](user-guide/mobile.md).

### Can I use Warpnet only on my phone?

Not today. The phone apps do not create accounts and need a node to pair with, either the desktop app on a computer that stays on or a remote node on a server.

### What is the difference between testnet and mainnet?

They are two separate networks. `warpnet` (also called `mainnet`) is the live network and the default; `testnet` is for experiments. They have different network keys, so their nodes never see each other, and each keeps its own database and identity. The wallet is shown on testnet only. See [Choose a network](user-guide/index.md#choose-a-network).

### Do I need to keep my computer online?

Your node serves your profile and posts, so while it is offline other people cannot load them from you. Copies already delivered to your followers stay on their nodes. Messages and other actions sent to you wait on the sender's node and are retried for up to 30 days. Paired phones need the node to be running and signed in.

### Is my login my username?

No. Your login and password sign you in to your node, and your keys are derived from them. The login is stored only in your encrypted database and is never published. Your public name starts as `Anonymous`; change it in **Edit profile → Name**.

### Can I use one account on two computers?

Not at the same time. Your node ID is derived from your login and password, so two computers signed in with the same credentials would present the same node ID with two different databases. Use one node and pair your phones with it, or run a remote node and use it from any browser. To switch computers, move the database folder: see [Backup and restore](user-guide/backup-and-restore.md).

### I forgot my login or password. What can I do?

Nothing, unfortunately. There is no reset and nobody holds a copy. Your login and password together are your identity: both go into the key that encrypts your database and into the key that is your node's identity.

### Can I change my login or password?

No. A different login or password derives a different database key and a different identity, so it cannot open your existing data.

### How do I move to a new computer?

Stop the node, copy the database folder to the new computer, and sign in there with the same login and password on the same network. Step by step in [Backup and restore](user-guide/backup-and-restore.md).

## Data and privacy

### Where are my posts and media stored?

| Where | What |
|---|---|
| Your node | Everything you create: profile, posts, media, follows, chats, bookmarks, settings. |
| Your followers' nodes | Copies of the public posts delivered to their timelines. |
| Any node that opens your profile | A cache of your posts for 30 days and of your images and videos for 7 days. |
| The recipient's node | The direct messages you send them. |
| Relay nodes | Nothing. |

There is no global replication: content is not stored in the DHT or spread to random nodes. All databases are encrypted on disk with their owner's key. See [Storage](storage.md).

### Can I delete something I posted?

Yes. Deleting a post removes it from your node and sends a delete to your followers, whose nodes remove their copy. Nodes that were offline when the delete went out, nodes that only cached the post, and nodes running modified software may keep a copy. You agree to this at sign-up: copies already received by other nodes may remain.

### Are direct messages private?

They go from your node to the recipient's node over an encrypted libp2p connection; a relay in between cannot read them. They are stored in the encrypted databases of the two participants and cannot be reported or moderated. They are not additionally encrypted per message, so anyone who can sign in to either node can read the conversation.

### Is Warpnet anonymous?

It is pseudonymous. Your login is never published, a new profile is shown as `Anonymous`, and your user ID is a random identifier. But the peers you connect to, and relays that forward your traffic, see your IP address, and your node publishes its network addresses so others can reach it. See [Network and transport](network.md) for who sees what.

### Does Warpnet track users or collect metrics?

There is no analytics, telemetry or metrics exporter in the code. Things your node does contact besides other nodes:

| What | When | How to avoid it |
|---|---|---|
| Bootstrap nodes (by default three, run by the project) | At start, to join the network | Put your own nodes in **Settings → Network → Bootstrap peers** or `--node.bootstrap` |
| The latest release on GitHub, with the app version as user agent | Every hour, desktop app outside Snap | `--node.self-update=false` |
| The bridge gateway (a Warpnet node) | When your node looks up bridged accounts, for example in **Who to follow** or search | Set another gateway in **Settings → Bridge gateway** |
| Your SMTP server | Only if you turn on e-mail notifications | Leave it off |
| A TRON API endpoint | Only when the wallet or sponsored tweets are used | Do not use them |
| YouTube | Only when you press play on an embedded video | Do not press play |

Nodes do rate each other's behaviour on the network (bad signatures, malformed or oversized messages and similar) and share those signed observations. That is about nodes, not about what people read or post. See [Node rating](rating.md).

### Why does my traffic monitor show www.googleapis.com?

Warpnet wraps every connection in a TLS handshake that looks like a browser talking to `www.googleapis.com`, so that networks that block unknown protocols let it through. The connection actually goes to the IP address of another node, and nothing is sent to Google. The real protection is the Noise encryption inside. See [Network and transport](network.md).

## Moderation

### How does moderation work?

You can report a post or a profile. The report is broadcast to moderator nodes, which anyone can run. Several of them judge it independently with a model running on their own machine (Llama Guard 3) and vote; a verdict needs at least three signed votes and a strict majority. A violation hides the post from the author's followers (a shadow ban): their nodes drop it from their timelines, while the author's node keeps it and the author is not told. No human reviews the report. See [Moderation](moderation.md).

### Does AI moderation mean censorship?

It means several independent machines must agree before a post is hidden, and every node recounts their signed votes before applying a verdict. It does not delete content from the author's node, it never touches direct messages, and it does not decide what you see beyond hiding moderated posts. Be aware of the limits: there is no appeal, and the [Moderation](moderation.md) page explains the attacks it does not stop.

### Can communities set their own moderation rules?

Not as separate policies. Verdicts are applied the same way by every node. What you control is your own feed: blocks, mutes and keyword filters take effect immediately, and you can hold images and videos from people outside your [trust circle](trust-circle.md) until you tap. Anyone can run a moderator node.

### Are direct messages moderated?

No. There is no mechanism to report, read or judge direct messages.

## Running and building

### How does the network work without central servers?

A node starts by dialing the addresses in its bootstrap list (by default three relay nodes run by the project) and finds further peers through the DHT and gossip. Nodes on the same local network also find each other through mDNS. After that, nodes talk directly. When a node is behind NAT, it tries hole punching; until a direct connection works, its encrypted traffic goes through one of its bootstrap nodes acting as a relay. You can replace the bootstrap list with your own relays. See [Discovery](discovery.md) and [Running a node](user-guide/running-a-node.md#relay-node).

### What is the most useful thing I can run for the network?

A relay node on a machine with a public IP address. It stores nothing, takes part in the DHT that nodes use to find each other, and forwards traffic for the nodes that list it as a bootstrap node. See [Running a node](user-guide/running-a-node.md#relay-node).

### Can I build my own client or modify the node?

Yes, within the licences. All clients (the desktop app, the browser UI of a remote node and the phone apps) talk to a member node with the same route names, so a new client can do the same. Start with the [Developer guide](developer-guide/index.md) and [Clients](developer-guide/clients.md).

### Does the network check that nodes run the official code?

No. Nodes only connect when they share the network name and the major version: both go into the network key, which anyone can compute. Protection comes from elsewhere: every message is signed and checked, peers are rate-limited, and nodes that misbehave get a lower [rating](rating.md), which lowers their connection priority and tightens their limits.

### How can I help?

Use testnet and report bugs, run a relay, or pick up an issue. See [How to help](HOW-TO-HELP.md).

### Where do I report a bug?

On [GitHub Issues](https://github.com/Warp-net/warpnet/issues), or in [Telegram](https://t.me/warpnetdev). Other questions: contact@warpnet.site.

## Monetization

### Are there ads?

No. The sign-up screen says Warpnet may introduce sponsored content or advertisements in the future; today there is no advertising and no behavioural targeting.

### What are sponsored tweets?

An experimental pay-to-read feature: an author can mark a tweet as sponsored and set a price, and a reader pays it once in USDT on TRON to unlock it. Authors can require buyers to hold staked TRX (**Settings → Sponsored tweets**). The wallet that pays is shown on testnet only, where it uses the TRON test network.

## See also

- [Getting started](user-guide/index.md)
- [Mobile apps](user-guide/mobile.md)
- [Backup and restore](user-guide/backup-and-restore.md)
- [Moderation](moderation.md)
- [Security](security.md)
