---
title: Mobile Apps
description: The Warpnet apps for Android and iOS, how they pair with your node, and what works on a phone today.
---

# Mobile Apps

Warpnet has an Android app and an iOS app. Both are companions: they read and post as you through a node you already run, on your computer or on a server. This page explains how to install them, how pairing works, how to remove a phone, and which features are available on the phone.

## Why a phone needs a node

A phone is a poor peer-to-peer node: the system suspends background apps, the radio sleeps, and the IP address changes all the time. So the phone does not hold your account. Your account lives on a **node** (the desktop app or a [remote node](running-a-node.md#remote-node)), which stays online, stores your data and keeps the network connections up. The phone pairs with that node and works through it.

Consequences:

- You create your account in the desktop app or a remote node, not on the phone.
- The node must be running and signed in for the phone to work. Signing out of the desktop app stops the node; use the screen lock instead if you only want to hide the window.
- While at least one phone is paired, the node asks the operating system not to go to sleep (the screen can still turn off and lock).

## Install

| | Android | iOS |
|---|---|---|
| App | Warpnet (`site.warpnet.warpdroid`) | Warpnet (`site.warpnet.warpfone`) |
| Get it | [F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/), or `warpdroid.apk` from the [GitHub release](https://github.com/Warp-net/warpnet/releases/latest) | [App Store](https://apps.apple.com/app/warpnet/id6835178022) |
| Requires | Android 7.0 or newer, 64-bit ARM (`arm64-v8a`) | iOS 17 or newer |
| Based on | [Tusky](https://github.com/tuskyapp/Tusky) (Mastodon client, Kotlin) | Ice Cubes 1.10.31 (Mastodon client, SwiftUI) |
| Source | [`warpdroid/`](https://github.com/Warp-net/warpnet/tree/main/warpdroid) | [`warpfone/`](https://github.com/Warp-net/warpnet/tree/main/warpfone) |

The F-Droid version can lag behind the GitHub release by a few versions. The APK on GitHub is built with the same recipe F-Droid uses and is signed with the project key; its certificate SHA-256 digest is `eabdd61e5bcbd6615a3f54977c06646c0f5422d845d37c818286b7d34285dfec`. A `warpdroid_checksums.txt` file and its `.sig` signature are published next to it (see [Verify the download](index.md#verify-the-download)).

The Android app has no Google Play Services, Firebase or other proprietary dependencies. Notifications arrive over its own connection to your node, not through a push service.

Both apps run the same Go networking code as the desktop node, compiled into the app, so they speak the protocol natively rather than through a server.

## Pair a phone

1. On the computer, sign in to Warpnet. Open the account menu and choose **Sign in by QR-code**. A QR code appears.
2. Open the Warpnet app on the phone. On first launch it opens the QR scanner.
3. Point the camera at the code. The app shows the node, its owner and the address and asks you to confirm. The iOS app also shows the content and conduct rules: turn on **I agree**.
4. Tap **Connect**. The phone dials your node and pairs.

No camera, or the computer is elsewhere? Under the QR code, click **Copy connection data**. On the phone, choose **Enter pairing data manually**, paste the data and tap **Pair**. Send it to the phone over a channel you trust: anyone holding it can pair a device with your node.

### What the QR code contains

The QR code carries your node's pairing information, compressed with gzip and encoded with Base45 so it fits in a QR code:

| Field | Purpose |
|---|---|
| `token` | Pairing token issued by the running node. The node accepts a pairing only with its current token. |
| `psk` | The network key, so the phone can join the right network. |
| `node_id` | Your node's peer ID. The phone checks it during the encrypted handshake and refuses to pair if the node at the address is not that peer. |
| `addresses` | Where to reach your node (local and public addresses). |
| `bootstrap_peers` | The relay nodes your node uses, so the phone can reach the network. |
| `network`, `user_id` | Which network and account the phone joins. |

The QR code never contains your private key or your password. The phone generates its own key, one per node it pairs with, so the same phone keeps the same key when it pairs with the same node again. Each request from the phone is signed with that key, and the node accepts private requests only from keys it has recorded as paired devices.

### How the phone reaches your node

The app tries your node's local network address first, then its public address (a public IP, a port forward, or a UPnP / NAT-PMP mapping the node sets up on your router). If neither works, the connection goes through one of the relay nodes. The relay forwards traffic it cannot read: the Noise encryption runs end to end between the phone and your node. Details are in [Network and transport](../network.md).

A monitor icon in the app's top bar shows the link:

- **Green**: connected to your node, directly or through a relay.
- **Red**: your node is unreachable (the app is closed, the computer is offline or asleep, or the network is down). The phone keeps trying.

### On Android

Some Android vendors stop background apps aggressively, which stops notifications. The app has a **Keep Warpnet running** screen with the settings to change for your device (battery optimisation, and vendor-specific options on Huawei and Xiaomi).

## Manage paired devices

On the computer, **Settings → Devices** lists paired phones with their platform, peer ID and last activity.

| Rule | Value |
|---|---|
| Devices paired at the same time | up to 10 |
| A device that stops checking in is dropped after | 3 days |
| Removing a device | takes effect at once |

**Remove** in **Settings → Devices** revokes a phone immediately. It cannot pair itself back with the data it still holds; scanning a fresh QR code from your node pairs it again as a new device. Losing a phone is therefore a contained problem: remove it, and your account keys were never on it.

From the phone:

- iOS: **Settings → Unpair this device** removes the phone from your node and forgets the pairing.
- Android: **Forget paired node** clears the pairing on the phone. The node keeps listing it until you remove it in **Settings → Devices** or it expires after 3 days.

> **Note:** The pairing token lives in the node's memory and changes every time the node process restarts (the desktop app is closed and reopened, or the computer reboots). A phone that checks in with the old token is told the pairing is no longer accepted and asks you to scan again. Open **Sign in by QR-code** on the computer and scan the new code.
{: .note }

## What works on a phone

Both apps cover the everyday social features. Node administration stays on the computer.

| Feature | Android | iOS | Desktop |
|---|:---:|:---:|:---:|
| Home timeline, threads, profiles | yes | yes | yes |
| Post, reply, edit, delete; images and video | yes | yes | yes |
| Retweets, quotes, emoji reactions, poll votes, pins, bookmarks | yes | yes | yes |
| Follow, unfollow, answer follow requests | yes | yes | yes |
| Require approval for new followers (locked account) | yes | no | no |
| Direct messages | yes | yes | yes |
| Send images and video in direct messages | yes | no | yes |
| Notifications | yes | yes | yes |
| Blocks, mutes, keyword filters | yes | yes | yes |
| Report a post or profile | yes | yes | yes |
| Create an account, sign in, sign out | no | no | yes |
| Pair and remove devices | no | no | yes |
| Import tweets from X | no | no | yes |
| Wallet and sponsored tweets | no | no | yes (testnet) |
| Node rating, network, rate limiting, bridge gateway, e-mail settings | no | no | yes |
| Screen lock (PIN) | no | no | yes |
| Update prompts | no | no | yes |

The table follows the protocol routes each app implements ([`ProtocolIds.kt`](https://github.com/Warp-net/warpnet/blob/main/warpdroid/warpnet-transport/src/main/kotlin/site/warpnet/transport/ProtocolIds.kt) for Android, the router in [`warpfone/Packages/Network`](https://github.com/Warp-net/warpnet/tree/main/warpfone/Packages/Network) for iOS). In the iOS app, screens for Mastodon features the node does not have were removed.

## Privacy on the phone

- The phone stores its own key and the pairing data. It does not store your password or your node's private key.
- What the phone sends to relay nodes: its peer ID and public key, the `warpdroid` user agent (Android) and DHT routing queries. Relays see your IP address, not your posts or messages.
- To keep the project's relays out of the path, run your own relay and start your node with `--node.bootstrap`; the phone uses whatever relay list your node gives it. See [Running a node](running-a-node.md#relay-node).
- Connections are wrapped in a TLS layer that imitates a browser talking to `www.googleapis.com`, so network monitors such as PCAPdroid show that name next to your node's or a relay's address. Nothing is sent to Google. See [Network and transport](../network.md).

## See also

- [Getting started](index.md)
- [Running a node](running-a-node.md)
- [Network and transport](../network.md)
- [Security](../security.md)
- [FAQ](../faq.md)
