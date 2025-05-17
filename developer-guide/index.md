# Contributing to WarpNet

We welcome contributions from developers, researchers, and network engineers who want to improve WarpNet 
as a decentralized, self-hosted social protocol.

---

## 1. Cloning the Repository

```bash
git clone https://github.com/Warp-net/warpnet.git
cd warpnet
```

---

## 2. Building from Source

WarpNet is written in Go. To build it, you’ll need Go 1.24+ installed.

```bash
# bootstrap node
go build -ldflags "-s -w" -gcflags=all=-l -mod=vendor -v -o warpnet cmd/node/bootstrap/main.go
```

```bash
# member node
go build -ldflags "-s -w" -gcflags=all=-l -mod=vendor -v -o warpnet cmd/node/member/main.go
```

You can now run the binary:

```bash
./warpnet -h
```
Full list of available flags:

```bash 
    --database.dir string          Database directory name (default "storage")
    --logging.level string         Logging level (default "info")
    --node.bootstrap string        Bootstrap nodes multiaddr list, comma separated
    --node.host string             Node host (default "0.0.0.0")
    --node.inmemory                Bootstrap node runs without persistent storage
    --node.metrics.server string   Metrics push server address
    --node.network string          Private network. Use 'testnet' for testing env. (default "testnet")
    --node.port string             Node port (default "4001")
    --node.seed string             Bootstrap node seed for deterministic ID generation (random string)
    --server.host string           Server host (default "localhost")
    --server.port string           Server port (default "4002")
```
The above parameters also could be set as environment variables:
```
    NODE_PORT=4001
    NODE_SEED=warpnet1
    NODE_HOST=207.154.221.44
    LOGGING_LEVEL=debug 
    ...
    (etc.)
```

### How to run single node (dev mode)
- bootstrap node
```bash 
    go run cmd/node/bootstrap/main.go
```
- member node
```bash 
    go run cmd/node/member/main.go
```

### How to run multiple nodes (dev mode)
Change database directory name and ports. Run every node as an independent OS process.
```bash 
    go run cmd/node/member/main.go --database.dir storage2 --node.port 4021 --server.port 4022
```

### How to run node in isolated network (dev mode)
Change `node.network` flag to different one.
```bash 
    go run cmd/node/member/main.go --node.network myownnetwork
```


---

## 3. Development Tips

* To enable debug logging, use environment variable:
  `LOGGING_LEVEL=debug ./warpnet`
* WarpNet is modular: each subsystem (auth, chat, discovery, consensus) lives in its own package under `/core/`
* WarpNet is modular: API handlers live in its own package under `/core/handlers` and `/core/middleware`
* Check Makefile for handy commands
* Use Docker to run local member and bootstrap nodes
* TURN OFF VPN!

---

## 4. Issues and Pull Requests

If you’ve found a bug or want to implement a feature:

* Open an issue first if it’s not already reported.
* Fork the repo and create a feature branch.
* Follow Go formatting conventions (`gofmt`, `go vet`)
* Submit a pull request with a clear description.

All code must be tested and documented.

---

## 5. Contributor Scope

Here are areas where contributions are welcome:

* Security protocols improvement
* Improved NAT traversal, NAT hole punching and related.
* UI integrations or mobile clients
* Protocol improvements (compression, versioning)
* Documentation and developer tooling
* Unit testing etc.

---

## 6. Contact and Discussion

Join us on:

* GitHub Discussions: https://github.com/warp-net/warpnet/discussions
* Telegram: https://t.me/warpnetdev

