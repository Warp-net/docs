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

A Twitter-style social network with no servers. Every user runs a node: the desktop app (or a headless server version) that stores the user's own data and talks directly to other nodes over [libp2p](https://libp2p.io/). There are no instances, no accounts held by a company and no central database. Phones join as companions of a node. See [Architecture](architecture.md).

### Who owns Warpnet?

Nobody owns the network: it exists as the nodes people run. The software is free and open source under the GNU Affero General Public License v3.0 or later. The project is maintained by its original author, Vadim Filin, and contributors.

### Is it open source?

Yes, all of it: the node, the desktop app, the Android and iOS apps, the relay and moderator roles, and the sister repositories (bridge gateway, moderation, transport). The code is at [github.com/Warp-net/warpnet](https://github.com/Warp-net/warpnet) with a mirror on [Codeberg](https://codeberg.org/Warpnet/warpnet). The AGPL means anyone who runs a modified version that others interact with must share their changes.

### Is it production-ready?

No. Warpnet is pre-1.0 (version 0.8 at the time of writing) and changes quickly. Use testnet to explore, expect rough edges, and report what you find.

### Does it cost anything?

No. There is no subscription, no fee to join and no paid tier. What it costs you is the computer that runs your node and its electricity and traffic. E-mail notifications go through your own SMTP account. The experimental sponsored tweets involve payments between users on the TRON blockchain (see [Monetization](#monetization)).

### Is Warpnet a blockchain?

No. The social network runs on libp2p, an encrypted local database on each node, and a few replicated counters and ratings (see [Synchronization](synchronization.md)). The only blockchain involved is TRON, used by the experimental wallet and sponsored tweets, which are shown on testnet only.

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

Yes, through a bridge gateway. Mastodon (and the wider Fediverse), Threads and Nostr accounts can be found by handle (for example `@user@mastodon.social`), appear in separate tabs of **Who to follow**, and can be followed from Warpnet. Warpnet users can in turn be found and followed from the Fediverse and Nostr. Direct messages are not bridged. The project runs a default gateway; you can run your own and enter its peer ID in **Settings → Bridge gateway**. See [Bridges](bridge.md).

## Using Warpnet

### Do I need a server?

No. The desktop app is a complete node. If you want an always-on node, you can run the same node headless on a server and use it from a browser. See [Running a node](user-guide/running-a-node.md).

### Is there a mobile app?

Yes, for Android ([F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/)) and iOS ([App Store](https://apps.apple.com/app/warpnet/id6835178022)). Both are companions: you pair them with your node by scanning a QR code, and they read and post as you through it. See [Mobile apps](user-guide/mobile.md).

### Can I use Warpnet only on my phone?

Not today. The phone apps do not create accounts and need a node to pair with, either the desktop app on a computer that stays on or a remote node on a server.

### What is the difference between testnet and mainnet?

They are two separate networks. `warpnet` (also called `mainnet`) is the live network and the default; `testnet` is for experiments and may be wiped. They have different network keys, so their nodes never see each other, and each keeps its own database and identity. The wallet is shown on testnet only. See [Choose a network](user-guide/index.md#choose-a-network).

### Do I need to keep my computer online?

Your node serves your profile and posts, so while it is offline other people cannot load them from you. Copies already delivered to your followers stay on their nodes. Messages and other actions sent to you wait on the sender's node and are retried for up to 30 days. Paired phones need the node to be running and signed in.

### Can I use one account on two computers?

Not at the same time. Your node ID comes from your login and password, so two computers signed in with the same credentials would present the same node ID with two different databases. Use one node and pair your phones with it, or run a remote node and use it from any browser. To switch computers, move the database folder: see [Backup and restore](user-guide/backup-and-restore.md).

### I forgot my password. What can I do?

Nothing, unfortunately. There is no reset and nobody holds a copy. The password is part of the key that encrypts your database and of the key that is your identity.

### Can I change my password?

No. A different password derives a different database key and a different identity, so it cannot open your existing data.

### How do I move to a new computer?

Stop the node, copy the database folder to the new computer, and sign in there with the same login and password. Step by step in [Backup and restore](user-guide/backup-and-restore.md).

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

They go straight from your node to the recipient's node over an encrypted libp2p connection; a relay in between cannot read them. They are stored in the encrypted databases of the two participants and are never moderated, reported or read by anyone else. They are not additionally encrypted per message, so anyone who can sign in to either node can read the conversation.

### Is Warpnet anonymous?

It is pseudonymous. Your login is never published, a new profile is shown as `Anonymous`, and your user ID is a random identifier. But the peers you connect to, and relays that forward your traffic, see your IP address, and your node publishes its network addresses so others can reach it. If you use the bridge, your public posts can also appear on other networks. See [Network and transport](network.md) for who sees what.

### Are my posts published to Nostr?

They can be. According to the bridge gateway's source, the gateway republishes to Nostr the public posts and profile of every Warpnet account it knows that is not locked (an account that requires approval of new followers). Locking your account stops it; today that switch is in the Android app. Releases 0.8.110 to 0.8.116 asked about Nostr at sign-up, but nothing read that answer. See [Bridges](bridge.md).

### Does Warpnet track users or collect metrics?

There is no analytics, telemetry or metrics exporter in the code. Things your node does contact besides other nodes:

| What | When | How to avoid it |
|---|---|---|
| Bootstrap relays (three, run by the project) | At start, to join the network | Run your own relay and use `--node.bootstrap` |
| GitHub and Codeberg release APIs, with the app version as user agent | Hourly, for update checks (not Snap, not macOS) | `--node.self-update=false` |
| The bridge gateway (a Warpnet node) | When your node looks up bridged accounts, for example in **Who to follow** or search | Run your own gateway |
| Your SMTP server | Only if you turn on e-mail notifications | Leave it off |
| A TRON API endpoint | Only when the wallet or sponsored tweets are used | Do not use them |
| YouTube | Only when you press play on an embedded video | Do not press play |

Nodes do rate each other's behaviour on the network (bad signatures, malformed or oversized messages and similar) and share those signed observations. That is about nodes, not about what people read or post. See [Node rating](rating.md).

### Why does my traffic monitor show www.googleapis.com?

Warpnet wraps every connection in a TLS layer that looks like a browser talking to `www.googleapis.com`, so that networks that block unknown protocols let it through. The connection actually goes to the IP address of another node or a relay, and nothing is sent to Google. The real protection is the Noise encryption inside. See [Network and transport](network.md).

## Moderation

### How does moderation work?

You can report a post or a profile. The report is broadcast to volunteer moderator nodes; a few of them each judge it independently with an on-device model (currently Llama Guard 3) and vote, and only a strict majority of at least three acts. A violation hides the post from the author's followers (a shadow ban); nothing is deleted from anyone's computer and no human reviews the report. See [Moderation](moderation.md).

### Does AI moderation mean censorship?

It means a small, unpredictable group of independent machines must agree before a post is hidden, and every app recounts their signed votes before applying a verdict. It does not delete content, it never touches direct messages, and it does not decide what you see beyond hiding moderated posts. Be aware of the limits: there is no appeal, and the [Moderation](moderation.md) page explains the attacks it does not stop.

### Can communities set their own moderation rules?

Not as separate policies. Verdicts are applied the same way by every app. What you control is your own feed: blocks, mutes and keyword filters take effect immediately, and you can hold images and videos from people outside your [trust circle](trust-circle.md) until you tap. Anyone can run a moderator node.

### Are direct messages moderated?

No. There is no mechanism to report, read or judge direct messages.

## Running and building

### How does the network work without central servers?

New nodes contact a relay to find their first peers through the DHT. After that, nodes talk directly, and nodes on the same local network find each other through mDNS. When two nodes cannot connect directly because of NAT, a relay forwards their encrypted traffic. Anyone can run a relay; the default list is three relays run by the project. See [Discovery](discovery.md) and [Running a node](user-guide/running-a-node.md#relay-node).

### What is the most useful thing I can run for the network?

A relay node on a machine with a public IP. It stores nothing and helps other nodes connect. See [Running a node](user-guide/running-a-node.md#relay-node).

### Can I build my own client or modify the node?

Yes, under the AGPL. All clients (the desktop app, the browser UI of a remote node and the phone apps) talk to a member node with the same route names, so a new client can do the same. Start with the [Developer guide](developer-guide/index.md) and [Clients](developer-guide/clients.md).

### Does the network check that nodes run the official code?

No. Older pages said nodes verify each other's codebase; nothing in the code does that. Nodes only connect when they share the network name and the major version (both go into the network key, which is public). Protection comes from elsewhere: every message is signed and checked, peers are rate-limited, and nodes that misbehave get a lower [rating](rating.md), which lowers their priority and tightens their limits.

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
