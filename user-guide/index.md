---
title: Getting Started
description: Install Warpnet, choose a network, create your account, connect your phone and learn what your password protects.
---

# Getting Started

This page takes you from download to your first post. It covers installing the desktop app, choosing a network, creating an account, what your password does, connecting the mobile app, and where your data lives. It is written for people who want to use Warpnet; operators of always-on servers should continue with [Running a node](running-a-node.md).

Warpnet has no servers and no company holding accounts. The app you install *is* your node: it stores your profile, posts, follows and chats on your computer and talks directly to other nodes. Nothing is registered anywhere.

## Install

### Desktop

| Platform | How to get it | What you run |
|---|---|---|
| Linux (Snap) | `sudo snap install warpnet --beta` | `warpnet` |
| Linux x86-64 | `warpnet_linux_amd64.tar.gz` | `warpnet` |
| Linux ARM64 | `warpnet_linux_arm64.tar.gz` | `warpnet` |
| Windows x64 | `warpnet_windows_amd64.zip` | `warpnet.exe` |
| macOS (Intel and Apple silicon) | `warpnet_darwin.tar.gz` | `warpnet.app` |

Archives are attached to every [GitHub release](https://github.com/Warp-net/warpnet/releases/latest). The Linux and Windows archives are mirrored to [Codeberg](https://codeberg.org/Warpnet/warpnet/releases). Unpack the archive and run the file inside it.

- **Snap.** Builds are published to the Snap Store `beta` channel, so the `--beta` flag is needed. The Snap updates itself through `snapd`; the in-app updater is off there.
- **Linux archive.** The app is a GTK window with an embedded WebKit view. It needs GTK 3 and WebKitGTK 4.1 installed (on Debian and Ubuntu the package is `libwebkit2gtk-4.1-0`).
- **Windows and Linux archives** check GitHub and Codeberg for a newer release once an hour and ask you before installing it. Installing restarts the node, so you sign in again afterwards. Start with `--node.self-update=false` to turn this off.

> **Warning:** The macOS build is not signed or notarized, so Gatekeeper blocks the first launch. Try to open `warpnet.app` once, then open **System Settings → Privacy & Security**, scroll down, click **Open Anyway** and confirm. macOS builds are not updated in place: download each new release yourself.
{: .warning }

### Verify the download

Every archive has a `<name>_checksums.txt` file with its SHA-256 hash, and a `<name>_checksums.txt.sig` file with an Ed25519 signature of that listing. Checking the hash:

```bash
sha256sum -c warpnet_linux_amd64_checksums.txt        # Linux
shasum -a 256 -c warpnet_darwin_checksums.txt          # macOS
```

On Windows, run `Get-FileHash warpnet_windows_amd64.zip` in PowerShell and compare the hash with the one in `warpnet_windows_amd64_checksums.txt`.

Checking the signature needs OpenSSL 3 or later. Save the project's release key as `release.pub`:

```text
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA+PJtnzN+C//o1UVdUWlQkhMPrT0QTZfB+s87rLQgvUk=
-----END PUBLIC KEY-----
```

```bash
base64 -d warpnet_linux_amd64_checksums.txt.sig > listing.sig
openssl pkeyutl -verify -pubin -inkey release.pub -rawin \
  -in warpnet_linux_amd64_checksums.txt -sigfile listing.sig
```

This is the same key the built-in updater uses to check a release before installing it ([`core/selfupdate/selfupdate.go`](https://github.com/Warp-net/warpnet/blob/main/core/selfupdate/selfupdate.go)).

### Phone

The phone apps are companions: they do not create accounts and need a running desktop or remote node to pair with.

| Platform | Where |
|---|---|
| Android 7.0 or newer (ARM64) | [F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/), or `warpdroid.apk` from the GitHub release |
| iOS 17 or newer | [App Store](https://apps.apple.com/app/warpnet/id6835178022) |

Install the app now if you like, but connect it after you have created your account: see [Connect your phone](#connect-your-phone).

## Choose a network

Warpnet runs two public networks that never mix:

| Network | Name | Use it for |
|---|---|---|
| Main | `warpnet` (alias `mainnet`) | The live network. This is the default. |
| Test | `testnet` | Trying things out. Data there may be wiped. |

On the first launch the welcome screen of the desktop app has a **Network** selector under **Sign up**. Picking a network restarts the app on it. From the command line:

```bash
warpnet --node.network testnet   # test network
warpnet --node.network mainnet   # main network
```

Things to know:

- Each network has its own database folder, so a testnet account and a mainnet account are separate even with the same login and password.
- Nodes talk only to nodes on the same network name and the same major version. The network key is derived from both ([`security/psk.go`](https://github.com/Warp-net/warpnet/blob/main/security/psk.go)); it separates networks but is not a secret.
- The selector is shown only on the first-run screen. If you use testnet, start the app with `--node.network testnet` (or `NODE_NETWORK=testnet`) to be sure it opens there. If the app opens on the main network's sign-up screen although you already have a testnet account, pick **Testnet** in the selector again.
- The wallet is shown on testnet only.

## Sign up

Click **Sign up** on the welcome screen. The wizard has four steps and a progress bar.

**Step 1 of 4: Login.** Type the login you will sign in with. The login is never published: it is half of the secret that unlocks your data. A new profile is shown to others as `Anonymous` until you set a display name in your profile.

**Step 2 of 4: Important information.** Tick all four statements to continue:

| Statement | In short |
|---|---|
| User Responsibility | You are responsible for what you upload. Objectionable content and abusive users are not tolerated and can be reported, hidden and blocked. |
| Content Distribution | What you publish is distributed to other nodes, which store it and show it. Messages go to the recipients' nodes. Copies other nodes already received may remain after you delete the original. |
| Local Storage Disclaimer | Your data is stored only on your device. Lose the device and the account is lost. |
| Future Advertising | Warpnet may introduce sponsored content or advertisements. |

**Step 3 of 4: Password.** Type the password twice. A checklist turns green as each rule is met, and **Next** stays disabled until all rules pass and both fields match. The password must have:

- 8 to 32 characters
- one uppercase letter (A–Z)
- one lowercase letter (a–z)
- one digit (0–9)
- one special character: anything other than A–Z, a–z and 0–9 (`_` counts)

Leading and trailing spaces are removed before the password is used. The node counts the length in bytes, so letters outside the Latin alphabet count as two or more characters. **Reveal password** shows what you typed. The node checks the same rules ([`cmd/node/member/auth/auth.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/auth/auth.go)).

**Step 4 of 4: Terms.** Read the [Terms and Conditions](../legal/T&C.md) and the [Privacy Policy](../legal/PRIVACY-POLICY.md), then click **Sign up**. The node creates your encrypted database, starts, and joins the network.

> **Note:** Releases 0.8.110 to 0.8.116 also ask on this step whether to show your posts on Nostr. Nothing on the node reads that answer, and newer builds no longer ask.
{: .note }

After sign-up a short tour points out the main parts of the app. You can replay it from the account menu.

## Your password is your identity

Read this section twice. Your login and password are used for two things ([`security/kdf.go`](https://github.com/Warp-net/warpnet/blob/main/security/kdf.go)):

| Derived from | What it is | Used for |
|---|---|---|
| login + password | database key (Argon2id) | Encrypts the local database: profile, posts, follows, chats, settings. |
| login + password + network | identity key (Argon2id, Ed25519) | Your node ID and the signature on everything your node sends. |

Neither key is stored on disk. They exist only after you sign in. Consequences:

- **There is no password reset.** Nobody holds a copy of your password or keys.
- **There is no password change.** A different password derives a different database key and a different identity, so it cannot open your existing data.
- **The same login and password on another computer give the same node ID, but not your account.** Your user ID, profile, posts, follows and chats live in the database. Without a copy of the database folder you start over with an empty profile. See [Backup and restore](backup-and-restore.md).
- **Signing out stops your node.** Paired phones cannot reach it until you sign in again. Use **Settings → Screen lock** (desktop app) to hide the window behind a PIN while the node keeps running.

## Connect your phone

The Android and iOS apps do not have accounts of their own. The phone pairs with the node you just created and works through it, so your account, keys and data stay on your computer.

1. Install the app: [F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/) (Android 7.0+) or the [App Store](https://apps.apple.com/app/warpnet/id6835178022) (iOS 17+).
2. On the computer, sign in to Warpnet, open the account menu and choose **Sign in by QR-code**. A QR code appears.
3. Open the app on the phone. On first launch it opens the QR scanner.
4. Scan the code. The app shows your node, its owner and its address. On iOS, also turn on **I agree** for the content rules.
5. Tap **Connect**. The phone dials your node and pairs.

No camera at hand? Click **Copy connection data** under the QR code, send it to the phone over a channel you trust, then choose **Enter pairing data manually** in the app and paste it. Anyone holding that data can pair a device with your node.

The phone and the computer do not have to be on the same Wi-Fi. The app tries your node's local address first, then its public address, and falls back to a relay node; the traffic stays end-to-end encrypted between the phone and your node. A monitor icon in the app's top bar is green while your node is reachable and red while it is not.

Keep in mind:

- **Your node must be running and signed in** for the phone to work. If the computer sleeps or the app is closed, the phone shows red and keeps retrying.
- **Scan again after the node restarts.** The pairing token changes every time the desktop app starts, so after a restart or reboot the phone asks you to scan a new code.
- **Manage devices in Settings → Devices.** Up to 10 phones can be paired; **Remove** revokes one at once. The QR code never contains your password or keys, so a lost phone is removed without risk to your account.

Details on what the QR code contains, background work on Android and what each app can do are in [Mobile apps](mobile.md).

## What you can do

A Twitter-style network with nothing in the middle. Everything below is served by your own node.

| Area | Features |
|---|---|
| Posting | Tweets up to 2048 bytes, replies, retweets, quotes, edits, deletion, pinned tweets, polls (up to 4 options), images and video, emoji |
| Reading | Home timeline, threads, view counts, emoji reactions, who reacted and who retweeted |
| People | Profiles, follow and unfollow, follow requests, user search by name, user ID or Fediverse handle, **Who to follow** with online status |
| Messages | Direct chats with text, images and video, delivered node to node; queued for up to 30 days if the other node is offline |
| Notifications | In-app notifications; optional e-mail delivery through your own SMTP account (**Settings → Email notifications**) |
| Your controls | Bookmarks, blocks, mutes, keyword filters; optionally hold images and videos from people outside your [trust circle](../trust-circle.md) until you tap (**Settings → Preferences**) |
| Bring your history | **Import tweets from X**: original tweets and their photos from your X archive (replies, retweets, likes, DMs, GIFs and videos are skipped) |
| Other networks | Mastodon, Threads and Nostr accounts through the bridge gateway; see [Bridges](../bridge.md) |
| Node | **Settings → Node rating**, **Devices**, **Network**, **Rate limiting**, **Bridge gateway** |
| Experimental | Sponsored tweets (readers pay once in USDT on TRON to unlock them) and a TRON wallet to pay with (wallet on testnet only) |

Public posts travel peer to peer. Your timeline, chats, bookmarks and drafts stay on your node and on the nodes of the people you talk to.

Approving followers manually (a locked account) can be switched on from the Android app today; the desktop app shows and answers follow requests.

## Report content

On a tweet or a profile, choose **Report**, tick one or more reasons (spam or scam, harassment, hate speech, violence, sexual content, child safety, self-harm, privacy violation, dangerous content), optionally add up to 500 characters of detail, and submit.

- Reports go to moderator nodes on the network. The reported user is not notified.
- Your report carries your user ID so the result can reach you. Moderators see it; the reported user does not.
- Direct messages cannot be reported and are never moderated.
- You get one notification with the outcome.

For your own feed, blocks, mutes and keyword filters take effect immediately and need nobody's agreement. How verdicts are reached is explained in [Moderation](../moderation.md).

## Where your data lives

| System | Folder |
|---|---|
| Linux, macOS | `~/.warpdata/<network>/storage/` |
| Linux (Snap) | `~/snap/warpnet/current/.warpdata/<network>/storage/` |
| Windows | `%LOCALAPPDATA%\warpdata\<network>\storage\` |

`<network>` is `warpnet` or `testnet`. The database inside is encrypted with your database key. Do not delete or move files while the app is running. To keep a copy or move to another computer, follow [Backup and restore](backup-and-restore.md).

Your node connects to the network through relay (bootstrap) nodes. They help nodes find each other and forward encrypted traffic for nodes behind NAT; they cannot read it and store none of your data. See [Network and transport](../network.md).

## Get help

- Telegram: [t.me/warpnetdev](https://t.me/warpnetdev)
- Bug reports: [github.com/Warp-net/warpnet/issues](https://github.com/Warp-net/warpnet/issues)
- E-mail: contact@warpnet.site

Warpnet is pre-1.0 and changes quickly. Use testnet to explore and report what breaks.

## See also

- [Mobile apps](mobile.md)
- [Running a node](running-a-node.md)
- [Backup and restore](backup-and-restore.md)
- [FAQ](../faq.md)
- [Security](../security.md)
