---
title: How to Help
description: Ways to support Warpnet, from testing on testnet and reporting bugs to running a relay or moderator node, writing code, translating, and donating.
---

# How to Help

Warpnet is free software under the AGPLv3, with no company, no team and no monetization behind it. It is built and maintained by one person, so every bug report, relay node, pull request or translation has an outsized effect. This page lists the ways to help, from the ones that need no technical skill to the ones that need a compiler.

## Start here

- **Users:** install Warpnet as described in the [user guide](user-guide/index.md) and try it on testnet.
- **Developers:** read the [developer guide](developer-guide/index.md), then the repository's [Contributor Onboarding Guide](https://github.com/Warp-net/warpnet/blob/main/docs/ONBOARDING.md) for the reasoning behind the architecture.
- **Everyone:** the [Telegram dev chat](https://t.me/warpnetdev) is the quickest way to ask a question or find a task that fits you.

## Test on testnet

Testnet is a separate network for experiments. Nothing you do there reaches mainnet, and the two never exchange data.

- **Desktop.** The sign-up screen on first launch lets you pick the network. From a terminal, `warpnet --node.network testnet` starts it on testnet directly.
- **Mobile.** Install [warpdroid from F-Droid](https://f-droid.org/packages/site.warpnet.warpdroid/) (Android 7.0 or newer) or [Warpnet from the App Store](https://apps.apple.com/app/warpnet/id6835178022) (iOS 17 or newer) and pair it with a testnet node: the network comes from the QR code. See [Mobile apps](user-guide/mobile.md).
- **Several nodes.** Run a desktop node and a [remote node](user-guide/running-a-node.md) on two machines in your LAN or VPN with two accounts, follow one from the other, chat, react, and check what reaches the other side.
- **Clean slate.** Testnet data lives in `~/.warpdata/testnet/` (Windows: `%LOCALAPPDATA%\warpdata\testnet\`). Deleting it, or `make prune-testnet` in a source checkout, starts you over.

Use the UI, try to break it, and report what happens.

## Report bugs

Open an issue at [github.com/Warp-net/warpnet/issues](https://github.com/Warp-net/warpnet/issues). A useful report contains:

| Item | Where to find it |
|---|---|
| Version | printed on the first line when the node starts |
| Client | desktop, browser dashboard (remote node), Android or iOS |
| Operating system | and how you installed (Snap, release archive, F-Droid, App Store, source) |
| Network | `warpnet` (mainnet), `testnet`, or your own |
| Steps | what you did, what you expected, what happened |
| Logs | run the node with `LOGGING_LEVEL=debug` and attach the relevant part |

Remove anything private from logs before posting. If the bug is a security problem, write to contact@warpnet.site instead of opening a public issue.

## Run a relay node

Relays are the network's entry points. A relay takes part in the DHT that nodes use to find each other, and it relays encrypted traffic (circuit relay v2) for nodes behind NAT when they cannot connect directly. It keeps its working state in memory, writes nothing to disk, and holds no user data. A relay you start joins mainnet through the built-in bootstrap nodes and becomes useful to everyone else from there. More public relays make the network harder to block.

What you need:

- a machine with a public IP address and a stable connection; the release binary and the Docker image are for Linux amd64, and other platforms except Windows can build the relay from source;
- TCP port 4001 (or the port you choose with `--node.port`) open for IPv4 and, if you have it, IPv6.

**From a release.** Download `relay_linux_amd64.tar.gz` from the [latest release](https://github.com/Warp-net/warpnet/releases/latest), check it against `relay_linux_amd64_checksums.txt`, unpack it, and run:

```bash
NODE_SEED="<a long random string>" ./relay
```

**With Docker.** CI publishes the image `ghcr.io/warp-net/warpnet-relay`; `latest` follows the `main` branch.

```bash
docker run -d --name warpnet-relay --network host --restart unless-stopped \
  -e NODE_SEED="<a long random string>" \
  ghcr.io/warp-net/warpnet-relay:latest
```

You can also build the image yourself from `Dockerfile.relay` in the repository.

> **Note:** The relay's peer ID is derived from `--node.seed`. Without it, the seed is computed from the network name, database directory, bind address and port, which anyone can reproduce. Set a long random `NODE_SEED` and keep it, so your relay keeps the same identity across restarts and nobody else can derive its key.
{: .note }

The relay runs on mainnet by default (add `--node.network testnet` to help testnet instead) and, on Linux amd64, updates itself from signed releases unless you pass `--node.self-update=false`. All options are in [Running a node](user-guide/running-a-node.md); the internals are in [Relay node architecture](relay-node-architecture.md).

## Run a moderator node

Moderator nodes judge reported content with a small language model running locally. Anyone can run one: there is no application and no approval, and no special power either. Your vote counts the same as any other moderator's, and you cannot choose which reports you judge. Your machine will fetch reported content and judge it, answer spot-checks from other moderators, and sign its verdicts with its node key. How the process works is described in [Moderation](moderation.md).

What you need:

- a Linux machine with enough memory and CPU for a 1B-parameter model, and a stable connection (the release archive is for amd64);
- the model file `Llama-Guard-3-1B-Q4_K_M.gguf`, placed in the directory the moderator runs from. The file name is fixed in the code and the model is not shipped with Warpnet;
- either the `moderator_linux_amd64.tar.gz` release archive (built on Ubuntu 24.04 and linked dynamically against the C and C++ runtime libraries), or Docker with `Dockerfile.moderator` from the repository. `deploy/docker-compose-moderator.yml` shows how to mount the model file into the container.

To build and run one from source on testnet, see [Moderator](developer-guide/index.md#moderator) in the developer guide.

## Write code

Read the [developer guide](developer-guide/index.md) first: it covers building every role, the project layout, and the worked example of adding a route. Then pick an issue labelled [`good first issue`](https://github.com/Warp-net/warpnet/labels/good%20first%20issue) or [`help wanted`](https://github.com/Warp-net/warpnet/labels/help%20wanted).

Areas where help is most needed:

| Area | Where | Skills |
|---|---|---|
| Desktop and browser UI | `frontend/` | Vue 3, JavaScript, Tailwind |
| Android app | `warpdroid/` | Kotlin |
| iOS app | `warpfone/` | Swift, SwiftUI |
| Client/node contract checks | `frontend/src/service/service.js` and `ProtocolIds.kt` against `event/paths.go` | scripting, CI; the iOS app already generates its route list, the desktop and Android mirrors are still kept in step by hand |
| NAT traversal and connectivity | `core/relay`, `core/holepunch`, `core/discovery` | libp2p, networking |
| Tests and CI | everywhere | Go testing |
| Error messages and CLI help | `config/`, handlers | plain writing |

The short version of the workflow: fork, branch off `develop` as `<IssueNumber>/<ShortName>`, add the AGPL header to new Go files, run `make tests`, `go vet ./...` and `golangci-lint run`, and open a pull request against `develop` that names the routes you touched. Contributions are covered by the [Contributor License Agreement](legal/CLA.md); opening a pull request is your agreement, and there is nothing to sign.

The repository is mirrored at [codeberg.org/Warpnet/warpnet](https://codeberg.org/Warpnet/warpnet) if you prefer to read it there.

### Sister projects

| Repository | What it is |
|---|---|
| [bridge-gateway](https://github.com/Warp-net/bridge-gateway) | stateless gateway that connects Warpnet to Mastodon and the Fediverse (ActivityPub), Threads and Nostr; see [Bridges](bridge.md) |
| [moderation](https://github.com/Warp-net/moderation) | local content-moderation engine: Llama Guard via llama.cpp, no external API |
| [libp2p-camouflage-transport](https://github.com/Warp-net/libp2p-camouflage-transport) | libp2p transport that disguises traffic to get past deep packet inspection; see [Network](network.md) |

## Research and review

- Review the cryptography: Noise transport, the network key (PSK), identity keys derived from username and password, the Noise channel of the remote dashboard, and release signing. Start with [Security](security.md).
- Propose improvements to [moderation](moderation.md), [discovery](discovery.md) and [node rating](rating.md).
- Help design coordination methods that do not need a trusted party.

## Translate and document

- **Store listing.** The F-Droid listing in `fastlane/metadata/android/` exists only in `en-US`. Adding a language is a small, self-contained first contribution.
- **Desktop UI.** The Vue app has no translation layer yet; adding one would open it to other languages.
- **These docs.** The documentation lives in the [Warp-net/docs](https://github.com/Warp-net/docs) repository. Corrections, translations and tutorials (for example, how Warpnet stores your posts locally) are welcome as pull requests.

## Spread the word

- Tell people who care about decentralized, self-hosted tools about Warpnet.
- Star the [repository](https://github.com/Warp-net/warpnet); it helps others find the project.

## Donate

If you want to support the project financially:

| Currency | Address |
|---|---|
| BTC | `bc1quwwnec87tukn9j93spr4de7mctvexpftpwu09d` |
| USDT (Tron) | `THXiCmfr6D4mqAfd4La9EQ5THCx7WsR143` |

Double-check the address and the network before sending: crypto transfers cannot be reversed.

## Contact

- Email: contact@warpnet.site
- Telegram: [t.me/warpnetdev](https://t.me/warpnetdev)
- GitHub: [github.com/Warp-net/warpnet](https://github.com/Warp-net/warpnet)

## See also

- [Developer guide](developer-guide/index.md)
- [Running a node](user-guide/running-a-node.md)
- [Moderation](moderation.md)
- [Contributor License Agreement](legal/CLA.md)
