---
title: Mobile Apps
description: The Warpnet apps for Android and iOS, how they pair with your node, and what works on a phone today.
---

# Mobile Apps

Warpnet has an Android app and an iOS app. Both read and post as you through a node you already run: the desktop app or a [remote node](running-a-node.md#remote-node). This page covers installing them, pairing, removing a phone, and which features work on a phone.

## Why a phone needs a node

A phone is a poor peer-to-peer node: the system suspends background apps, the radio sleeps and the IP address keeps changing. So your account does not live on the phone. It lives on your **node**, which stays online, stores your data and keeps the network connections up. The phone pairs with that node and works through it.

Consequences:

- You create your account in the desktop app or on a remote node, not on the phone.
- The node must be running and signed in for the phone to work. Signing out of the desktop app stops the node; to only hide the window, use the screen lock.
- Once a phone pairs, the desktop app keeps the computer from going to sleep (on Linux it also keeps the screen on) until the last paired device is removed in **Settings → Devices** or the app is closed.

## Install

| | Android | iOS |
|---|---|---|
| App | Warpnet (`site.warpnet.warpdroid`) | Warpnet (`site.warpnet.warpfone`) |
| Get it | [F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/), or **Android (apk)** on [warpnet.site/download](https://warpnet.site/download) | [App Store](https://apps.apple.com/app/warpnet/id6835178022) |
| Requires | Android 7.0 or newer, 64-bit ARM (`arm64-v8a`) | iOS 17 or newer |
| Based on | [Tusky](https://github.com/tuskyapp/Tusky) (Mastodon client) | Ice Cubes 1.10.31 (Mastodon client) |
| Source | [`warpdroid/`](https://github.com/Warp-net/warpnet/tree/main/warpdroid) | [`warpfone/`](https://github.com/Warp-net/warpnet/tree/main/warpfone) |

The APK (`warpdroid.apk` in the GitHub release) is signed with the project key; its certificate SHA-256 digest is `eabdd61e5bcbd6615a3f54977c06646c0f5422d845d37c818286b7d34285dfec`. The release also carries `warpdroid_checksums.txt` and its `.sig` signature (see [Verify the download](index.md#verify-the-download)).

The Android app has no Google Play Services or Firebase. Notifications arrive over its own connection to your node, not through a push service.

Each app contains its own peer-to-peer client and connects to your node directly over the Warpnet protocol, not through a web server.

## Pair a phone

1. On the computer, sign in to Warpnet. Open the account menu and choose **Sign in by QR-code**. A QR code appears.
2. Open the Warpnet app on the phone. Until it is paired, it opens the QR scanner.
3. Point the camera at the code. The app shows the node it found and asks you to confirm. The iOS app also shows the content and conduct rules: turn on **I agree**.
4. Tap **Connect**. The phone dials your node and pairs.

No camera, or the computer is elsewhere? Under the QR code, click **Copy connection data**. On the phone, choose **Enter pairing data manually**, paste the data and tap **Pair**. Send it to the phone over a channel you trust: anyone holding it can pair a device with your node.

### What the QR code contains

The QR code carries your node's pairing data, compressed with gzip and encoded with Base45 so it fits in a QR code. **Copy connection data** gives the same data as plain JSON.

| Field | Purpose |
|---|---|
| `token` | Pairing token of the running node. The node accepts a pairing only with its current token. |
| `psk` | The network key, so the phone joins the right network. |
| `node_id` | Your node's peer ID. The phone checks it during the encrypted handshake and refuses to pair if the node at the address is a different peer. |
| `addresses` | Where to reach your node. |
| `bootstrap_peers` | Your node's bootstrap nodes, through which the phone can reach it. |
| `network`, `user_id` | Which network and account the phone joins. |

The QR code never contains your login, password or private keys. The phone creates its own key, one per node it pairs with, and keeps it when it pairs with the same node again. Each request from the phone is signed with that key, and the node accepts private requests only from keys it has recorded as paired devices.

### How the phone reaches your node

The app tries your node's local network address first, then its public address (a public IP, a port forward, or a UPnP / NAT-PMP mapping the node sets up on your router). If neither works, it connects through one of your node's bootstrap nodes. Those relay traffic they cannot read: the Noise encryption runs end to end between the phone and your node. Details are in [Network and transport](../network.md).

A monitor icon in the app's top bar shows the link:

- **Green**: connected to your node, directly or through a relay.
- **Red**: your node is unreachable (the app is closed, the computer is offline or asleep, or the network is down). The phone keeps trying.

### On Android

Some Android vendors stop background apps aggressively, which stops notifications. When notifications are allowed, the app asks to be excluded from battery optimisation, and on devices whose vendor settings also need changing (Huawei, Xiaomi) it shows a **Keep Warpnet running** screen once, with buttons to those settings.

## Manage paired devices

On the computer, **Settings → Devices** lists paired phones with their peer ID, when they were paired and when they were last seen.

| Rule | Value |
|---|---|
| Devices paired at the same time | up to 10 |
| A device that stops checking in is dropped after | 3 days |
| Removing a device | takes effect at once |

**Remove** revokes a phone immediately. The phone cannot pair again with the pairing data it already holds; it can pair again after the desktop app restarts and shows a new QR code. A lost phone is therefore a contained problem: remove it, and your account keys were never on it.

From the phone:

- iOS: **Settings → Unpair this device** removes the phone from your node and forgets the pairing.
- Android: **Log out** in the side menu forgets the pairing on the phone and returns to the scanner. The node keeps listing the phone until you remove it in **Settings → Devices** or it expires after 3 days.

> **Note:** Each time your node starts, it unpairs every phone. The node starts when you sign in, both after opening the desktop app and after signing out and back in. The pairing token lives in the app's memory and changes only when the app itself is closed and reopened. After reopening the app, sign in, open **Sign in by QR-code** and scan the new code. After signing out and back in without closing the app, the token is the same, and the node refuses a phone that presents a token it was unpaired with: close and reopen the app, sign in and scan the new code.
{: .note }

## What works on a phone

Both apps cover the everyday social features. Node administration stays on the computer.

| Feature | Android | iOS | Desktop app |
|---|:---:|:---:|:---:|
| Home timeline, threads, profiles | yes | yes | yes |
| Post, reply, edit, delete; images and video | yes | yes | yes |
| Retweets, quotes, emoji reactions, poll votes, pins, bookmarks | yes | yes | yes |
| Follow, unfollow | yes | yes | yes |
| Direct messages | yes | yes | yes |
| Send images and video in direct messages | yes | no | yes |
| Notifications | yes | yes | yes |
| Blocks, mutes, keyword filters | yes | yes | yes |
| Report a tweet or profile | yes | yes | yes |
| Create an account, sign in, sign out | no | no | yes |
| List and remove paired devices | no | no | yes |
| Import tweets from X | no | no | yes |
| Wallet and sponsored tweets | no | no | yes (wallet on testnet) |
| Node rating, network, rate limiting, bridge gateway, e-mail settings | no | no | yes |
| Screen lock (PIN) | no | no | yes |
| Update prompts | no | no | yes |

## Privacy on the phone

- The phone stores its own key and the pairing data. It does not store your login, password or your node's private key.
- The phone connects to your node's bootstrap nodes. They see the phone's IP address, its peer ID and an app name (`warpdroid` or `warpfone`), not your posts or messages.
- The phone uses whatever bootstrap list your node gives it. To keep the project's relays out of the path, run your own [relay node](running-a-node.md#relay-node) and put it in your node's list (**Settings → Network** or `--node.bootstrap`).
- Connections are wrapped in a TLS layer that imitates a browser talking to `www.googleapis.com`, so network monitors such as PCAPdroid show that name next to your node's or a relay's address. Nothing is sent to Google. See [Network and transport](../network.md).

## See also

- [Getting started](index.md)
- [Running a node](running-a-node.md)
- [Network and transport](../network.md)
- [Security](../security.md)
- [FAQ](../faq.md)
