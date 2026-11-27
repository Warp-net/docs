---
title: Getting Started
description: Install Warpnet, choose a network, create your account, connect your phone and learn what your login and password protect.
---

# Getting Started

This page takes you from download to your first post: installing the desktop app, choosing a network, creating an account, connecting the mobile app, and where your data lives. Operators of always-on servers should continue with [Running a node](running-a-node.md).

Warpnet has no central servers and no company holding accounts. The app you install *is* your node: it keeps your profile, posts, follows and chats on your computer and talks directly to other nodes. Nothing is registered anywhere.

## Install

### Desktop

Download the app from **[warpnet.site/download](https://warpnet.site/download)**. The buttons there fetch the files of the [latest GitHub release](https://github.com/Warp-net/warpnet/releases/latest).

| System | File | What you run |
|---|---|---|
| Windows x64 | `warpnet_windows_amd64.zip` | `warpnet.exe` |
| Linux x86-64 | `warpnet_linux_amd64.tar.gz` | `warpnet` |
| Linux ARM64 | `warpnet_linux_arm64.tar.gz` | `warpnet` |
| macOS (Intel and Apple silicon) | `warpnet_darwin.tar.gz` | `warpnet.app` |
| Linux (Snap) | `sudo snap install warpnet --beta` | `warpnet` |

Unpack the archive and run the file inside it. The Linux archive needs GTK 3 and WebKitGTK 4.1 installed (on Debian and Ubuntu the package is `libwebkit2gtk-4.1-0`).

> **Warning:** The macOS build is not signed, so macOS blocks the first launch. Try to open `warpnet.app` once, then open **System Settings → Privacy & Security**, scroll down, click **Open Anyway** and confirm.
{: .warning }

### Updates

| Installed from | How it updates |
|---|---|
| Windows or Linux archive | The app checks the latest release on GitHub a minute after start and then every hour. When a newer version is out, it asks you: **Update now** replaces the app and restarts it, so you sign in again; **Later** skips that version until the app restarts. If the app cannot replace its own file (it sits in a folder only the system can write to), it only tells you about the new version and offers **Download**. |
| Snap | Snap updates the app; the in-app updater is off. |
| macOS | The app checks for releases the same way, but never replaces itself: when a newer version is out, it tells you and offers **Download**. Install the new version the same way as the first one. |

Start the app with `--node.self-update=false` to turn the check off.

### Verify the download

Every archive on the [GitHub release page](https://github.com/Warp-net/warpnet/releases/latest) has a `<name>_checksums.txt` file with its SHA-256 hash and a `<name>_checksums.txt.sig` file with an Ed25519 signature of that file. Checking the hash:

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

The built-in updater checks every release against the same key before installing it ([`core/selfupdate/selfupdate.go`](https://github.com/Warp-net/warpnet/blob/main/core/selfupdate/selfupdate.go)).

### Phone

The phone apps have no accounts of their own: they pair with a running desktop app or [remote node](running-a-node.md#remote-node).

| Platform | Where |
|---|---|
| Android 7.0 or newer (64-bit ARM) | [F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/), or **Android (apk)** on [warpnet.site/download](https://warpnet.site/download) |
| iOS 17 or newer | [App Store](https://apps.apple.com/app/warpnet/id6835178022) |

Install the app now if you like, but connect it after you have created your account: see [Connect your phone](#connect-your-phone).

## Choose a network

Warpnet runs two networks that never mix:

| Network | Name | Use |
|---|---|---|
| Main | `warpnet` (alias `mainnet`) | The live network. The default. |
| Test | `testnet` | Trying things out. |

While the selected network has no account on this computer, the welcome screen shows a **Network** selector under **Sign up** (**Warpnet (main)** or **Testnet**). Picking one restarts the app on that network. From the command line:

```bash
warpnet --node.network testnet   # test network
warpnet --node.network mainnet   # main network
```

Things to know:

- Each network has its own data folder and its own account. The same login and password on another network give a different identity.
- Nodes talk only to nodes with the same network name and the same major version.
- The app starts on the main network unless told otherwise. To open an existing testnet account, start the app with `--node.network testnet` (or the environment variable `NODE_NETWORK=testnet`), or pick **Testnet** again on the welcome screen.
- The wallet is shown on testnet only.

## Sign up

Click **Sign up** on the welcome screen. The wizard has four steps and a progress bar.

**Step 1 of 4: Login.** Type the login you will sign in with. It is used exactly as typed (letter case and spaces count), there is no second field to confirm it, and it cannot be changed later. The login is not your name: it is never published, and your profile is shown to others as `Anonymous` until you set a name under **Edit profile → Name**.

**Step 2 of 4: Important information.** Tick all four statements to continue:

| Statement | In short |
|---|---|
| User Responsibility | You are responsible for what you upload. Objectionable content and abusive users are not tolerated and can be reported, hidden and blocked. |
| Content Distribution | What you publish is distributed to other nodes, which store it and show it. Messages go to the recipients' nodes. Copies other nodes already received may remain after you delete the original. |
| Local Storage Disclaimer | Your data is stored only on your device. Lose access to the device and the account is lost. |
| Future Advertising | Warpnet may introduce sponsored content or advertisements. |

**Step 3 of 4: Password.** Type the password twice. A checklist turns green as each rule is met, and **Next** stays disabled until all rules pass and both fields match. The password must have:

- 8 to 32 characters
- one uppercase letter (A–Z)
- one lowercase letter (a–z)
- one digit (0–9)
- one special character: anything other than A–Z, a–z and 0–9 (`_` counts)

Leading and trailing spaces are removed before the password is used. The node counts the length in bytes, so letters outside the Latin alphabet count as two or more characters.

**Step 4 of 4.** The dialog links the Terms and the Privacy Policy (also in these docs: [Terms and Conditions](../legal/T&C.md), [Privacy Policy](../legal/PRIVACY-POLICY.md)). Click **Sign up**. The node creates your encrypted database, starts and joins the network.

A short tour then points out the main parts of the app. Replay it with **Take the tour** in the account menu.

## Sign in

On later launches the welcome screen shows a **Login** and **Password** form. Enter both exactly as at sign-up and click **Log in**. If either is wrong, the database does not open and the app shows an error.

**Sign out** in the account menu stops your node. To hide the window but keep the node running, set a PIN in **Settings → Screen lock** and use **Lock screen** in the account menu.

## Your login and password are your identity

Your login and password together are the secret behind your account. Two keys are derived from them:

| Derived from | Key | Used for |
|---|---|---|
| login + password | database key | Encrypts the local database: profile, posts, follows, chats, settings. |
| login + password + network | identity key | Your node ID and the signature on everything your node sends. |

Neither key is stored on disk; they exist only while you are signed in. Consequences:

- **There is no reset.** Nobody holds a copy of your login, password or keys.
- **Neither can be changed.** A different login or password gives a different database key and a different identity, so it cannot open your existing data.
- **The same login and password on another computer give the same node ID, but not your account.** Your user ID, profile, posts, follows and chats live in the database. Without a copy of the data folder you start over with an empty profile. See [Backup and restore](backup-and-restore.md).
- **Your public name is separate.** Others see your profile name and user ID, never your login.

## Connect your phone

The Android and iOS apps work through your node, so your account, keys and data stay on your computer.

1. On the computer, sign in, open the account menu and choose **Sign in by QR-code**. A QR code appears.
2. Open the app on the phone. Until it is paired, it opens the QR scanner.
3. Scan the code. The app shows the node it found and asks you to confirm. On iOS, also turn on **I agree** for the content rules.
4. Tap **Connect**. The phone dials your node and pairs.

No camera at hand? Click **Copy connection data** under the QR code, send it to the phone over a channel you trust, choose **Enter pairing data manually** in the app and paste it. Anyone holding that data can pair a device with your node.

The phone and the computer do not have to be on the same Wi-Fi. The app tries your node's local address first, then its public address, and then goes through one of your node's bootstrap nodes; the traffic stays end-to-end encrypted between the phone and your node. A monitor icon in the app's top bar is green while your node is reachable and red while it is not.

Keep in mind:

- **Your node must be running and signed in** for the phone to work. If the computer sleeps or the app is closed, the phone shows red and keeps retrying.
- **Scan again after every sign-in.** Each time you sign in, your node starts and unpairs all phones. After the app restarts, the QR code is new: scan it. After signing out and back in without closing the app, the old code stays the same but no longer pairs: close and reopen the app, sign in and scan the new code.
- **Manage devices in Settings → Devices.** Up to 10 phones can be paired; **Remove** revokes one at once. The QR code never contains your login, password or private keys.

What the QR code contains, how the phone connects and what each app can do: [Mobile apps](mobile.md).

## What you can do

A Twitter-style network with nothing in the middle. Everything below is served by your own node.

| Area | Features |
|---|---|
| Posting | Tweets up to 2048 bytes, replies, retweets, quotes, edits, deletion, pinned tweets, polls (up to 4 options), images and video, emoji |
| Reading | Home timeline, threads, view counts, emoji reactions, who reacted and who retweeted |
| People | Profiles, follow and unfollow, user search (name, user ID or Fediverse handle), **Who to follow** with online status |
| Messages | Direct chats with text, images and video, delivered node to node; queued for up to 30 days while the other node is offline |
| Notifications | In-app notifications; optional e-mail through your own SMTP account (**Settings → Email notifications**) |
| Your controls | Bookmarks, blocks, mutes, keyword filters. Images and videos from people outside your [trust circle](../trust-circle.md) wait for a tap; **Show media from unfamiliar authors** in **Settings → Preferences** loads them right away |
| Bring your history | **Import tweets from X** (Home screen or **Settings**): original tweets with up to four photos each from your X archive; replies, retweets, GIFs and videos are skipped |
| Other networks | Mastodon, Threads and Nostr accounts through a bridge gateway; see [Bridges](../bridge.md) |
| Node | **Settings → Node rating**, **Devices**, **Network**, **Rate limiting**, **Bridge gateway** |
| Experimental | Sponsored tweets that readers unlock by paying in USDT on TRON, and a TRON wallet (wallet on testnet only) |

## Report content

On a tweet or a profile, choose **Report**, tick one or more reasons (spam or scam, harassment or bullying, hate speech, violence or threats, sexual content, child safety, self-harm or suicide, privacy violation, dangerous or weapons), optionally add a comment and submit. Keep the comment short: the node rejects a report longer than 256 characters, the selected reasons included.

- Reports go to moderator nodes, not to the reported user.
- Your report carries your user ID so the outcome can reach you as a notification.
- Only tweets and profiles can be reported. Direct messages cannot.

Blocks, mutes and keyword filters act on your own feed at once and need nobody's agreement. How verdicts are reached: [Moderation](../moderation.md).

## Where your data lives

| System | Folder |
|---|---|
| Linux, macOS | `~/.warpdata/<network>/storage/` |
| Linux (Snap) | `~/snap/warpnet/current/.warpdata/<network>/storage/` |
| Windows | `%LOCALAPPDATA%\warpdata\<network>\storage\` |

`<network>` is `warpnet` or `testnet`. The database inside is encrypted with your database key. Do not delete or move files while the app is running. To keep a copy or move to another computer, follow [Backup and restore](backup-and-restore.md).

When it starts, your node dials the bootstrap nodes in its list: by default, relay nodes run by the project. They help your node find other nodes, and if your node is behind NAT, other nodes and your phone reach it through them; relayed traffic stays end-to-end encrypted. You can use your own list in **Settings → Network** (applied when the node restarts). See [Network and transport](../network.md).

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
