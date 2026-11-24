---
title: Backup and Restore
description: What to back up, how to restore or move your Warpnet account to another machine, and what cannot be recovered.
---

# Backup and Restore

Warpnet keeps your account only on your own node. There is no server copy and nobody who can restore it for you. This page explains what to back up, how to restore it or move it to another computer or a server, and what is lost for good if you skip it.

## What makes up your account

Two things, and you need both:

| Piece | Where it is | What it gives you |
|---|---|---|
| Login and password | In your head or your password manager | The keys. The database key comes from login + password; your identity key comes from login + password + network name. |
| Database folder | On the node's disk | Everything else: your user ID, profile, posts, follows and followers, chats, bookmarks, notifications, paired devices, settings. |

The keys are never written to disk, so the folder is useless without the password, and the password alone does not bring the data back. See [Your password is your identity](index.md#your-password-is-your-identity).

## What to back up

| Item | Path | Needed? |
|---|---|---|
| Database folder | `<base>/<network>/storage/` (or your `--database.dir`) | Yes |
| Browser channel key | `<base>/<network>/ws-noise.key` | Remote node only |
| Your login and password | Your password manager | Yes, kept separately |
| X archive `.zip` | Wherever you downloaded it | Optional, if you imported tweets |

`<base>` depends on the system:

| System | `<base>` |
|---|---|
| Linux, macOS | `~/.warpdata` |
| Linux, Snap | `~/snap/warpnet/current/.warpdata` |
| Windows | `%LOCALAPPDATA%\warpdata` |
| Docker (remote image) | `/root/.warpdata` inside the container (your volume) |

`<network>` is `warpnet` for the main network and `testnet` for the test network. Each network is a separate account and needs its own backup.

Not in the folder, so set them again after a move: the desktop screen-lock PIN, the theme and other display preferences kept by the app's web view.

## Make a backup

1. **Stop the node.** In the desktop app, open the account menu and choose **Sign out**: this stops the node and closes the database. Or quit the app. For a remote node, stop the process or container. The database writes to disk lazily, so a copy taken while the node runs can miss recent changes.
2. **Copy the folder** somewhere safe.
3. **Start the node again** and sign in.

Linux and macOS:

```bash
tar -czf warpnet-backup-$(date +%F).tar.gz -C ~/.warpdata warpnet/storage
```

Snap: use `-C ~/snap/warpnet/current/.warpdata` instead. For testnet replace `warpnet/storage` with `testnet/storage`.

Windows (PowerShell):

```powershell
Compress-Archive -Path "$env:LOCALAPPDATA\warpdata\warpnet\storage" -DestinationPath warpnet-backup.zip
```

Docker volume of a remote node (stop the container first):

```bash
docker run --rm -v warpnet-data:/data -v "$PWD":/backup ubuntu:24.04 \
  tar -czf /backup/warpnet-data.tar.gz -C /data .
```

> **Warning:** The backup is encrypted with a key derived from your login and password (Argon2id), and nothing else protects it. Anyone who gets a copy can try passwords offline as long as they like. Store it like you store the password itself.
{: .warning }

## Restore or move to another machine

The same steps restore a backup and move an account to a new computer.

1. **Install Warpnet** on the target machine. Do not sign up: launching the app without signing up creates no database.
2. **Stop the old node** if it still runs, and do not run both later. Both copies would present the same node ID to the network.
3. **Put the folder back** at `<base>/<network>/storage/` on the target. If you already signed up there by mistake, move that `storage` folder aside first.
4. **Start the app on the same network** (`--node.network testnet` for testnet) and sign in with the same login and password. Because the folder exists, the app shows the login form instead of **Sign up**.
5. **Pair your phones again.** Every node restart issues a new pairing token, and devices that have not checked in for 3 days are removed anyway. Open **Sign in by QR-code** and scan.

Your node ID, user ID, profile, follows, posts, chats and settings are back. Followers keep following you, because nothing about your identity changed.

### Moving between the desktop app and a remote node

The desktop app and the remote node use the same database format and layout, so an account can move between them in either direction:

- desktop to server: copy `~/.warpdata/<network>/storage/` into the container volume at `/root/.warpdata/<network>/storage/`, start the remote node and sign in from the browser;
- server to desktop: copy it back the other way.

A remote node also has `ws-noise.key`. Keep it when you move or restore a server, or every browser that used the node will refuse to connect because the node's key changed. If it is lost, clear the site data for the dashboard in each browser and connect again.

### Moving between networks

Not possible. The identity key depends on the network name, so a main-network account and a testnet account are different identities even with the same login and password.

## Settings stored with the account

Several settings live in the encrypted database and therefore move with it:

- **Settings → Network**: listen address, port, bootstrap peers. If the new machine needs a different port or address, change it there after signing in; these values override flags and environment variables (see [Configuration reference](running-a-node.md#configuration-reference)).
- **Settings → Wallet backend**, **Bridge gateway**, **Rate limiting**, **Email notifications** (including your SMTP password).
- Blocks, mutes, keyword filters and the list of paired devices.

## What cannot be recovered

| Situation | Result |
|---|---|
| Forgotten login or password | No reset exists. The database cannot be opened, and the identity cannot be rebuilt. |
| Database lost, no backup | Signing in with the same login and password gives the same node ID but a **new, empty account** with a new user ID. Posts, follows, followers, chats, bookmarks and settings are gone. |
| Want to change the password | Not supported. A new password means a new database key and a new identity. |
| Phone lost | Nothing to recover: the phone held no account data. Remove it in **Settings → Devices**. |

Copies of your public posts may still exist on your followers' nodes, but there is no function to pull them back into a new account.

## Export and import

Warpnet has no account export. The supported import is **Import tweets from X** (Home screen or **Settings**): it reads the `.zip` of your X data archive and adds your original tweets with up to four photos each. Replies, retweets, likes, direct messages, GIFs, videos and profile data are skipped ([`core/handler/import.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/import.go)). Keep the archive if you may need to import it again into a new account.

On testnet the wallet page has **Show private key**, which exports the TRON key so you can use the account in another TRON wallet. The wallet key is derived from your identity key, network and login, so the same login and password recreate it even without the database folder.

## Wipe an account

To remove an account from a machine, stop the node and delete `<base>/<network>/storage/` (or the whole `<base>/<network>/` folder). Do not delete it while the node runs: a node whose folder disappears stops on purpose. This removes the data from this machine only; copies of public posts that other nodes received are outside your control.

## See also

- [Getting started](index.md)
- [Running a node](running-a-node.md)
- [Storage](../storage.md)
- [Security](../security.md)
- [FAQ](../faq.md)
