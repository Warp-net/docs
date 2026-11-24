---
title: Developer Guide
description: Build Warpnet from source, run every node role locally, find your way around the code, add a route, and get a change merged.
---

# Developer Guide

This guide takes you from a fresh clone to a merged pull request. It covers the toolchain, how to build and run each node role, how to set up a local multi-node network, how the code is laid out, a worked example of adding a route, tests and CI, and how releases are cut. It is written for contributors; if you only want to run Warpnet, start with the [user guide](../user-guide/index.md).

The repository's own [Contributor Onboarding Guide](https://github.com/Warp-net/warpnet/blob/main/docs/ONBOARDING.md) explains the reasoning behind the architecture in more depth. Where it and this page disagree, this page follows the current code.

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Go | 1.26.3 or newer (`go 1.26.3` in `go.mod`) | everything |
| Wails CLI | v2.10.2 | the desktop member node |
| C/C++ compiler | not pinned | the desktop member node and the moderator (both use cgo) |
| Node.js and npm | not pinned | rebuilding the desktop UI in `frontend/` |
| golangci-lint | v2 (the config uses `version: "2"`) | linting |
| JDK 17, Android SDK, NDK r27c (`27.2.12479018`) | as in CI | the Android app |
| macOS with Xcode | CI uses Xcode 27.2 | the iOS app |

Install the Wails CLI at the version CI and the Makefile use:

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@v2.10.2
```

> **Note:** `go.mod` pins the Wails library at a newer version (v2.17.1) than the CLI. Every build command in the repository passes `-m -nosyncgomod`, so the CLI neither tidies nor rewrites `go.mod`. Use the same flags.
{: .note }

### System packages

**Linux (Debian/Ubuntu).** The desktop node links GTK and WebKitGTK:

```bash
sudo apt update
sudo apt install -y pkg-config build-essential
sudo apt install -y \
  libgtk-3-dev libwebkit2gtk-4.1-dev libglib2.0-dev libcairo2-dev \
  libpango1.0-dev libgdk-pixbuf-2.0-dev libatk1.0-dev libsoup-3.0-dev
```

**macOS and Windows.** The release workflow builds both on stock GitHub runners with only Go and the Wails CLI installed. If a build fails, `wails doctor` reports what the Wails toolchain is missing.

Headless roles (relay, echo, remote) need only Go.

## Get the source

```bash
git clone https://github.com/Warp-net/warpnet.git
cd warpnet
git checkout develop
```

- **Branches.** `develop` is where work lands; `main` receives merges from `develop`. Branch off `develop` and target it with pull requests.
- **Vendored modules.** `vendor/` is committed and Go builds use `-mod=vendor`. Do not edit it by hand; after changing dependencies run `go mod tidy && go mod vendor`.
- **Submodule.** `core/moderation` is a git submodule pointing at [Warp-net/moderation](https://github.com/Warp-net/moderation). Only the moderator needs it: `git submodule update --init core/moderation` (or `--recursive`).
- **Mirror.** The repository is mirrored at [codeberg.org/Warpnet/warpnet](https://codeberg.org/Warpnet/warpnet).

## Node roles and entry points

One codebase builds several binaries. Build tags pick the entry point.

| Role | Entry point | Build tag | CGO | Dockerfile |
|---|---|---|---|---|
| member (desktop) | `cmd/node/member/main.go` + `app.go` | none (`!echo && !remote`) | `1` | `Dockerfile.member` (compile check only, not runnable) |
| remote (headless, browser UI) | `cmd/node/member/remote-member.go` | `remote` | not set | `Dockerfile.remote` |
| echo (test bot) | `cmd/node/member/echo-member.go` | `echo` | `0` | `Dockerfile.echo` |
| relay | `cmd/node/relay/main.go` | none (file is `!windows`) | `0` | `Dockerfile.relay` |
| moderator | `cmd/node/moderator/main.go` | `llama` | `1` | `Dockerfile.moderator` |
| mobile node | `warpdroid/node`, `warpfone/node` | `mobile` | gomobile | none |

There is no `cmd/node/bootstrap` any more: the relay role is the network's entry point. See [Architecture](../architecture.md) for what each role does.

## Build and run each role

### Member (desktop)

```bash
cd cmd/node/member
wails build -m -nosyncgomod -devtools -tags webkit2_41
./build/bin/warpnet --node.network testnet
```

`make run-main` does the same (it installs the Wails CLI first) and runs the node on testnet with `--node.port 4000`. On macOS the output is `build/bin/warpnet.app`; on Windows it is `build/bin/warpnet.exe`. To cross-build for Windows:

```bash
cd cmd/node/member
wails build -clean -platform windows -tags webkit2_41 -m -nosyncgomod
```

The binary embeds the UI from `frontend/dist` through `//go:embed` in `embedded.go`, and `wails.json` sets `skipfrontend: true`, so `wails build` never compiles the Vue app. After changing anything under `frontend/src`, rebuild the bundle and then the binary:

```bash
make frontend        # cd frontend && make rebuild: clean npm install + npm run build
```

`frontend/dist` is committed on purpose, so a Go-only contributor can build a working binary without Node.js. If you change the UI, commit the rebuilt `dist` with your source changes.

### Remote node (headless, UI in a browser)

```bash
go run -tags remote ./cmd/node/member/remote-member.go \
  --node.network testnet --node.server.host 127.0.0.1
```

Open `http://127.0.0.1:4999`. The node serves the same embedded UI over HTTP and bridges it to the node over an encrypted WebSocket (see [Clients](clients.md#remote-node-http-and-ws)). At startup it prints the fingerprint of its WebSocket key. This is also the easiest way to work on the UI without GTK or Wails.

With Docker, `docker compose up --build` uses the repository's `docker-compose.yaml`, which builds `Dockerfile.remote` and runs a remote node on testnet with host networking.

### Echo bot

```bash
make echo-main
# = go run -tags echo cmd/node/member/echo-member.go --node.network testnet \
#     --node.seed echo --database.dir echo --node.port 4002
```

The echo node is a member node with an in-memory store and a fixed account named `Echo`. It answers chats, replies to tweets with an `echo: ` prefix, and posts once a day. It writes nothing to disk, so `--database.dir` has no effect on it, and because the account is fixed its peer ID depends only on the network (see the note under [Local networks](#local-networks)).

### Relay

```bash
make relay-main
# = go run cmd/node/relay/main.go --node.network testnet --node.print-psk
```

The release build is static:

```bash
cd cmd/node/relay
CGO_ENABLED=0 go build -ldflags "-s -w" -gcflags=all=-l -mod=vendor -o relay
```

The relay keeps its state in memory only. Its peer ID comes from `--node.seed` (which defaults to a value derived from network, database dir, host and port), and it prints `RELAY NODE STARTED WITH ID <id> AND ADDRESSES [...]` once it is up. The relay does not build on Windows.

### Moderator

The moderator needs the `core/moderation` submodule, a C/C++ toolchain, and the model file `Llama-Guard-3-1B-Q4_K_M.gguf` in its **working directory**. The path is hard-coded in `cmd/node/moderator/moderator/moderator.go`; there is no flag for it. The model is not shipped with Warpnet.

```bash
git submodule update --init core/moderation
make run-moderator
# = CGO_CXXFLAGS="-w -Wno-format -Wno-delete-incomplete" go run -tags=llama \
#     cmd/node/moderator/main.go --node.network testnet --node.port 4002 --node.seed moderatorlocalhost
```

The moderator generates a fresh random identity on every start. `Dockerfile.moderator` builds with `-mod=mod`; `deploy/docker-compose-moderator.yml` shows how the model file is mounted into the container. How moderation works is described in [Moderation](../moderation.md).

## Build tags and CGO

| Tag | Used by | Effect |
|---|---|---|
| `webkit2_41` | member | Selects the WebKitGTK 4.1 bindings Wails uses on Linux. |
| `remote` | remote | Swaps the Wails entry point for the HTTP/WebSocket one. |
| `echo` | echo | Builds the in-memory bot entry point. |
| `llama` | moderator | Compiles the moderation engine and its llama.cpp cgo bindings. |
| `mobile` | `warpdroid/node`, `warpfone/node` | Gates the gomobile bridge; the module-wide `go test ./...` skips these files. |

CGO is on for the member (GTK/WebKit) and the moderator (llama.cpp), and off for the relay and echo so they link statically into `distroless` images. `Dockerfile.remote` leaves it unset.

## Local networks

### Ports used by the Makefile targets

| Target | Role | Network | Port | Notes |
|---|---|---|---|---|
| `run-main` | member | testnet | 4000 | default `storage` directory |
| `run-second` | member | testnet | 4002 | `--node.seed backendtest --database.dir backend1` |
| `relay-main` | relay | testnet | 4001 | prints the PSK |
| `echo-main` | echo | testnet | 4002 | in memory |
| `run-moderator` | moderator | testnet | 4002 | needs the model file |

> **Warning:** `run-second`, `echo-main` and `run-moderator` all use port 4002. Override `--node.port` when you run more than one of them. The desktop app also holds a single-instance lock (`net.warpnet.app`), so a second desktop member on the same machine just hands over to the first one. For a second full member on one machine, run a remote node with its own `--database.dir`, `--node.port` and `--node.server.port`.
{: .warning }

A practical local swarm is one desktop member, a relay, an echo node and one or more remote nodes with their own accounts. The `--node.seed` values the Makefile passes to member, echo and moderator targets have no effect: a member's peer ID comes from its account credentials, and the moderator draws a random one.

> **Note:** Every echo node logs in with the same built-in account, so all echo nodes on one network share one peer ID. Run at most one per network. Testnet already has a public echo node, so a local echo bot is most useful on your own isolated network.
{: .note }

### An isolated network

Any network name other than `warpnet` (mainnet) and `testnet` gives you a private network with no built-in bootstrap nodes. Nodes connect only if they use the same network name and the same **major** version: the network key (PSK) is `SHA-256(network + major version)` (`security/psk.go`).

1. Start a relay and note its peer ID from the startup line:

   ```bash
   go run cmd/node/relay/main.go --node.network devnet --node.seed devrelay \
     --node.self-update=false
   ```

2. Point the other nodes at it:

   ```bash
   ./build/bin/warpnet --node.network devnet --node.port 4000 \
     --node.bootstrap /ip4/127.0.0.1/tcp/4001/p2p/<relay-peer-id>

   go run -tags echo cmd/node/member/echo-member.go --node.network devnet \
     --node.port 4003 --node.bootstrap /ip4/127.0.0.1/tcp/4001/p2p/<relay-peer-id>
   ```

Member nodes on the same LAN also find each other over mDNS. A member node prefers bootstrap addresses saved in its own network settings over `--node.bootstrap`; the flag applies while those settings are empty. Self-update (`--node.self-update`, on by default) replaces the binary with the newest release, and a relay does so without asking, so switch it off for local builds.

### Data directory

Each member or remote node keeps its data in `~/.warpdata/<network>/<database.dir>` (Windows: `%LOCALAPPDATA%\warpdata\...`). `--node.network mainnet` is normalised to `warpnet`. The remote node's WebSocket key is `~/.warpdata/<network>/ws-noise.key`. Relay, moderator and echo nodes write nothing there.

`make prune-testnet` deletes `~/.warpdata/testnet/*`. Without `--node.network` or `NODE_NETWORK`, the desktop node starts on mainnet, unless a testnet database already exists, in which case it reopens testnet.

### Flags

Every flag can also be set as an environment variable: upper-case, with dots and dashes replaced by underscores (`node.server.port` becomes `NODE_SERVER_PORT`). A flag on the command line wins over the environment.

| Flag | Default | Purpose |
|---|---|---|
| `--node.network` | `warpnet` | Network name; `testnet` for testing. |
| `--node.port` | `4001` | libp2p TCP port (IPv4 and IPv6). |
| `--node.host.v4` / `--node.host.v6` | `0.0.0.0` / `::` | Bind addresses. |
| `--node.seed` | derived | Seed for a deterministic peer ID; read by the relay only. |
| `--node.bootstrap` | empty | Comma-separated multiaddrs. If set, it **replaces** the built-in list. |
| `--node.print-psk` | `false` | Log the network PSK on start; read by the relay only. |
| `--node.self-update` | `true` | Replace the binary with new releases; a member node asks its owner first. |
| `--node.server.host` / `--node.server.port` | `0.0.0.0` / `4999` | Remote node dashboard. |
| `--database.dir` | `storage` | Sub-directory under `~/.warpdata/<network>/`. |
| `--logging.level` / `--logging.format` | `info` / `text` | Log level; `text` or `json`. |
| `--wallet.binary-path` | empty | Payment engine binary. |
| `--wallet.endpoint` | TronGrid on `warpnet` and `testnet` | Blockchain API endpoint. |

The full operator reference is in [Running a node](../user-guide/running-a-node.md).

## Project layout

```text
warpnet/
├── cmd/node/
│   ├── member/        # main.go (desktop), remote-member.go, echo-member.go, app.go (Wails App)
│   │   ├── auth/      #   login, owner record, key derivation via the auth repo
│   │   ├── deeplink/  #   warpnet:// URL scheme registration per OS
│   │   ├── node/      #   member-node.go: wires the node, registers handlers
│   │   ├── pubsub/    #   member gossip topics
│   │   └── remote/    #   /ws bridge and static file server for the remote node
│   ├── relay/         # relay node
│   └── moderator/     # moderator node: rounds, votes, audit, isolation
├── core/              # networking, streams, handlers, middleware, subsystems
├── database/          # repositories over the embedded store (*-repo.go)
│   └── local-store/   #   BadgerDB wrapper and prefix-key builder
├── domain/            # shared domain types (User, Tweet, AuthNodeInfo, ...)
├── event/             # wire protocol: paths.go (routes), event.go (DTOs, envelope)
├── security/          # keys, signatures, PSK, Noise for the remote /ws channel
├── config/            # flags, env vars, defaults, built-in bootstrap nodes
├── frontend/          # Vue 3 UI; dist/ is committed and embedded in the binary
├── warpdroid/         # Android app (Tusky fork) + gomobile node in node/
├── warpfone/          # iOS app (Ice Cubes fork) + gomobile node in node/
├── keepalive/         # keeps the host awake while devices are paired
├── deploy/            # testnet and moderator compose files, deploy script
├── snap/              # Snap packaging
├── fastlane/          # F-Droid store listing
├── embedded.go        # go:embed of version, icon, frontend/dist
└── version            # the release version (see Release process)
```

Selected `core/` packages:

| Package | Responsibility |
|---|---|
| `core/node` | libp2p host, handler registration behind middleware, `SelfStream` loopback |
| `core/stream` | route type, request framing, loopback streams, peer stream pool |
| `core/handler` | one file per feature; the unit you usually add |
| `core/middleware` | logging, rate limiting, signature auth, idempotency |
| `core/discovery`, `core/dht`, `core/mdns` | peer discovery |
| `core/pubsub` | GossipSub topics |
| `core/relay`, `core/holepunch` | circuit relay v2, hole-punching diagnostics |
| `core/crdt` | replicated counters and rating store (see [Synchronization](../synchronization.md)) |
| `core/rating`, `core/ratelimit` | node reputation, per-peer limits |
| `core/trust` | trust circle |
| `core/authorship` | checks that an event came from the actor's own node |
| `core/selfupdate` | release polling and binary replacement |
| `core/warpnet` | libp2p type aliases, options, protocol constants |

The protocol itself is documented in [Protocol](../protocol.md); the route list is in [API reference](api.md).

## How the node is shaped

The member node is laid out like a familiar MVC web app, so you can map what you know onto it:

| MVC role | Warpnet | What lives there |
|---|---|---|
| Router | `event/paths.go` + `setupHandlers` in `member-node.go` | route strings and the handler each one dispatches to |
| Controller | `core/handler/<feature>.go` | request handling, forwarding to other nodes |
| Model | `database/<feature>-repo.go` + `domain/` | persistence over BadgerDB, domain types |
| View | `frontend/`, `warpdroid/`, `warpfone/` | UIs that reach the controller over one of the [client transports](clients.md) |

Underneath there is no HTTP server: the router dispatches libp2p streams. Every request, whether it comes from your own UI over the in-process loopback or from another peer, goes through the same chain:

```mermaid
flowchart LR
  A[Stream] --> B[Read and size check]
  B --> C[Logging]
  C --> D[Rate limiter]
  D --> E[Auth]
  E --> F[Idempotency]
  F --> G[Handler]
  G --> H[Repository]
  H --> I[(BadgerDB)]
```

- **Auth** (`core/middleware/auth.go`) verifies the Ed25519 signature over body, timestamp and route, rejects messages from remote peers whose timestamp is more than 5 minutes off, and lets `/private/...` routes through only from the node itself, a paired device, or the pairing route.
- **Idempotency** caches responses by route, peer and `message_id` for 10 minutes, so a retried request is not executed twice.
- **Handlers** are factory functions that take narrow interfaces and return a `warpnet.WarpHandlerFunc`:

```go
type WarpHandlerFunc func(msg []byte, s WarpStream) (any, error)
```

The narrow interfaces are what make handlers unit-testable without a running node.

## Worked example: adding a route

The reference feature is **emoji reactions**: small, cross-node, and present in every client.

> **Note:** Older docs (including the repository README) point at `core/handler/like.go`, `like_test.go` and `database/like-repo.go`. Those files no longer exist: likes were replaced by emoji reactions. Use the reaction files below.
{: .note }

| Layer | File | What is there |
|---|---|---|
| Route | [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go) | `PUBLIC_POST_REACT = "/public/post/react/0.0.0"` |
| DTOs | [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go) | `ReactionEvent{TweetId, UserId, OwnerId, Emoji}`, `ReactionsCountResponse{Count, Reactions}` |
| Handler | [`core/handler/reaction.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/reaction.go) | `StreamReactionHandler(repo, userRepo, notifyRepo, streamer)` |
| Storage | [`database/reaction-repo.go`](https://github.com/Warp-net/warpnet/blob/main/database/reaction-repo.go) | `ReactionRepo.React(tweetId, userId, emoji, isTransitive)` |
| Wiring | [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go) | repo built in `setupHandlers`, handler listed in `engagementHandlers`; the `ReactionsProvider` interface is in `types.go` |
| Test | [`core/handler/reaction_test.go`](https://github.com/Warp-net/warpnet/blob/main/core/handler/reaction_test.go) | `TestStreamReactionHandler` with stub repositories |
| Desktop UI | [`frontend/src/service/service.js`](https://github.com/Warp-net/warpnet/blob/main/frontend/src/service/service.js) | `PUBLIC_POST_REACT` constant, `reactToTweet()` |
| Android | `warpdroid/warpnet-transport/.../ProtocolIds.kt`, `dto/WarpnetDtos.kt`, `app/.../WarpnetRepository.kt` | route constant, Moshi DTO, repository call |
| iOS | `warpfone/Packages/WarpnetTransport/.../ProtocolIds.swift`, `WarpnetEvents.swift`, `Packages/Network/.../WarpnetRouter.swift` | generated route constant, DTO, router call |

The handler shows the usual peer-to-peer pattern: verify the actor, store locally, then forward to the author's node, and treat an offline peer as success.

```go
reactor, err := authorship.VerifyActor(userRepo, streamer, s, ev.OwnerId)
// ...
num, err := repo.React(tweetId, ev.OwnerId, emoji, ev.OwnerId == ownNodeInfo.OwnerId) // store locally
// ...
reactionDataResp, err := streamer.GenericStream( // forward to the author's node
    reactedUser.NodeId, event.PUBLIC_POST_REACT, event.ReactionEvent{ /* same fields */ },
)
if errors.Is(err, warpnet.ErrNodeIsOffline) {
    return resp, nil // the author is offline: keep the local result
}
```

### Checklist

1. **Route.** Add a constant to `event/paths.go`: `/<private|public>/<verb>/<entity>[/<sub>]/<version>`. `private` routes act on the owner's own data and are accepted only from the node itself or a paired device; `public` routes are what other peers may call.
2. **DTOs.** Add request and response structs to `event/event.go` (shared types go in `domain/`).
3. **Handler.** Create `core/handler/<feature>.go` with narrow interfaces for its dependencies and a `Stream<Feature>Handler(...) warpnet.WarpHandlerFunc` factory.
4. **Storage.** Add repository methods under `database/`, using the prefix builder in `database/local-store`.
5. **Wiring.** Build the repository and register `{route, handler}` in `cmd/node/member/node/member-node.go` (one of the `*Handlers` groups called from `setupHandlers`); add the interface to `types.go` if needed.
6. **Test.** Add `core/handler/<feature>_test.go`; copy the stub style from `reaction_test.go`.
7. **Clients.** If a UI calls the route, mirror it in each client (details in [Clients](clients.md#keeping-the-contract-in-lockstep)):
   - desktop: constant and method in `frontend/src/service/service.js`, then the Vue component;
   - Android: `ProtocolIds.kt`, a Moshi DTO, a `WarpnetRepository` method, then rebuild the AAR;
   - iOS: run `warpfone/scripts/generate-protocol-ids.sh`, add the DTO and the router case.
8. **House rules.** License header on new files, tests and linters clean (below).

## Tests and linters

```bash
make tests            # CGO_ENABLED=0 go test -short -p 8 -v ./...
go test -race -short ./...   # close to the Linux CI run (-race needs cgo)
go vet ./...
golangci-lint run     # config: .golangci.yaml
```

- `.golangci.yaml` enables all linters (`default: all`) minus an explicit disable list, runs in vendor mode, relaxes a few linters for `_test.go` files, and relaxes style linters for `warpdroid/node/` because gomobile returns errors as strings.
- The mobile node is behind the `mobile` tag, so `./...` skips it. Test it with `go test -race -count=1 -tags mobile ./warpfone/node/... ./warpdroid/node/...`.
- Frontend: `cd frontend && npm test` runs Vitest (`tests/**/*.spec.js`). `npm run serve` starts the Vue dev server; in development mode `src/lib/backend-mock.js` replaces the Go bindings with an in-memory mock, so it needs no node. For real data use a remote node.
- iOS: `swift test --package-path warpfone/Packages/WarpnetTransport` and `swift test --package-path warpfone/Packages/Network`.
- `make check-heap` prints a stack-to-heap escape report, the same one CI posts on pull requests.

## CI workflows

All workflows live in [`.github/workflows`](https://github.com/Warp-net/warpnet/tree/main/.github/workflows).

| Workflow | Runs on | What it does |
|---|---|---|
| `tests-static-check.yaml` | every PR, push to `main` | `go mod verify`, golangci-lint, govulncheck (non-blocking), `go test -race` on Linux amd64/arm64, macOS (`-short`) and Windows, coverage to Codecov |
| `heap-escape-analysis.yaml` | every PR, push to `main` | informational escape-analysis report as a PR comment |
| `build-warpdroid.yml` | PRs to `develop` | builds the AAR with gomobile and the debug APK; posts the build log on failure |
| `fdroid-check.yml` | PRs touching `warpdroid/`, `go.mod`, `go.sum`; `v*` tags | no committed binaries, AAR built from source, licence check, no Google Play dependencies, release build inside F-Droid's buildserver image |
| `build-warpfone.yml` | PRs to `develop` | builds `Warpnet.xcframework` for the simulator and the app with `xcodebuild` |
| `test-warpfone.yaml` | PRs to `develop` touching `warpfone/`, `warpdroid/node/`, `event/paths.go` | checks `ProtocolIds.swift` is regenerated, checks the two mobile node copies match, runs Swift and mobile Go tests |
| `build.yaml` (Build Mainnet) | push to `main`, manual | builds and pushes the relay image `ghcr.io/warp-net/warpnet-relay` |
| `build-deploy-testnet.yaml` | manual | builds relay, moderator, echo and remote images and deploys the testnet host |
| `release.yaml` | manual, with a tag | release artifacts (below) |
| `release-warpfone.yaml` | manual, with a tag | iOS build to TestFlight |
| `snap.yml` | push to the `snap` branch, manual | builds the Snap and uploads it to the `beta` channel |

## Release process

The `version` file is the single source of truth. It is embedded into the binary, and its major number feeds the network key.

1. **Version bump.** The `pre-commit` hook in `.githooks/` increments the patch number on every commit to `main` or `develop` and keeps `snap/snapcraft.yaml`, `frontend/package.json`, `warpdroid/fdroid/versionCode`, `warpfone/Version.xcconfig` and the F-Droid changelog file in step. Maintainers enable it with `make setup-hooks`; on any other branch the hook does nothing. Do not edit the version by hand.
2. **Tag.** The maintainer tags `v<version>` on `main` and pushes the tag.
3. **Release workflow.** Run **Release** with that tag. It does not bump versions, commit or tag. It builds:
   - the member binary for Linux amd64 and arm64, macOS (universal) and Windows amd64;
   - the relay and the moderator for Linux amd64;
   - the signed Android APK;
   - a SHA-256 checksum file per artifact, then signs every checksum file with the release Ed25519 key (`*.sig`), and mirrors the release to Codeberg.
4. **iOS.** Run **Release / Warpfone** with the same tag when the release touches the iOS app; it uploads to TestFlight.
5. **Snap.** Pushing to the `snap` branch publishes to the Snap Store `beta` channel.

Nodes with self-update enabled poll the GitHub and Codeberg releases hourly and verify the checksum file and its signature before replacing their binary. The release workflow does not sign or notarize the macOS build.

## Contribution workflow

1. Find or open an issue. Labels [`good first issue`](https://github.com/Warp-net/warpnet/labels/good%20first%20issue) and [`help wanted`](https://github.com/Warp-net/warpnet/labels/help%20wanted) are the usual starting points; ask in [Telegram](https://t.me/warpnetdev) if unsure.
2. Fork, then branch off `develop`: `git checkout -b <IssueNumber>/<ShortName>`.
3. Make the change:
   - every new `.go` file carries the AGPL header: copy the comment block from the top of an existing file such as `core/handler/reaction.go`, including the `// SPDX-License-Identifier: AGPL-3.0-or-later` line. Kotlin files in `warpdroid/` carry a short SPDX header of their own;
   - commit a rebuilt `frontend/dist` if you changed the UI;
   - do not touch `vendor/` by hand or bump `version`.
4. Run `make tests`, `go vet ./...` and `golangci-lint run`.
5. Commit in the imperative present tense ("Add bookmark filter handler").
6. Open a pull request against `develop` and name the route(s) you touched; reviewers map changes to layers by route string.

Contributions are made under the [Contributor License Agreement](../legal/CLA.md). Submitting a pull request is your agreement; there is nothing to sign.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| UI changes do not show up in the desktop build | `skipfrontend: true` and the embedded `dist`: run `make frontend`, then rebuild the binary. |
| Two local nodes never see each other | Different `--node.network`, a different major version, or a custom network without `--node.bootstrap`. |
| `bind: address already in use` | Two Makefile targets on the same port (4002); pass `--node.port`. |
| Second desktop window does not open | Single-instance lock; use a remote node instead. |
| Moderator exits soon after start, or never judges | Model file missing from the working directory (it exits), or built without `-tags=llama` (no engine is compiled in). |
| `wails build` fails on Linux | Missing GTK/WebKit dev packages, or `-tags webkit2_41` left out. |
| Android shows blank fields while desktop is fine | Kotlin DTO or `ProtocolIds.kt` out of step with Go; see [Clients](clients.md#keeping-the-contract-in-lockstep). |
| Need more detail | `LOGGING_LEVEL=debug`, and `--logging.format json` for structured logs. |

## See also

- [Clients](clients.md): how the desktop, browser and mobile apps reach a node
- [API reference](api.md): every route in `event/paths.go`
- [Stream API](stream-API.md): request framing over libp2p streams
- [Architecture](../architecture.md): roles, components and data flow
- [How to help](../HOW-TO-HELP.md): where contributions are most needed
