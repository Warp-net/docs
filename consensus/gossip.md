# Gossip-Based Consensus (Not implemented, TODO)

The WarpNet supports a **lightweight, peer-to-peer gossip-based consensus** protocol for decentralized 
validation tasks.

This mechanism is designed for use cases where consensus is required across arbitrary sets of nodes 
without centralized coordination or long-term membership, such as validating new peers, content, 
or moderation results in real time.

---

## How It Works

The gossip consensus flow consists of **three distinct phases**:

### 1. Broadcasting the Validation Request

The initiating node uses `AskValidation` to broadcast a validation request using the **Gossip PubSub** system. This request is wrapped in a message that includes:

* the validation target (e.g. peer ID),
* metadata (timestamp, version, etc.),
* the endpoint to be invoked (a path).

### 2. Validation via Direct Streams

Each node that receives the broadcasted request establishes a **direct stream**
to its own internal `Validate` endpoint. Inside that handler:

* each node applies its own set of registered `ValidatorFunc`s to the request,
* a result (`Valid` or `Invalid`) is produced,
* the node sends the result **directly** to the original requestor using its 
  `ValidationResult` endpoint via libp2p stream.

This hybrid model uses pubsub for dissemination and streams for response, 
reducing pubsub noise and supporting reliable responses.

### 3. Aggregating Results and Quorum Evaluation

The initiating node listens for incoming validation responses in a background goroutine. 
It tracks responders and applies a **quorum rule**:

* the consensus is accepted if at least **75% of known peers** respond and no one returns an `Invalid`,
* if fewer than 75% respond within a timeout, or any node explicitly rejects the request, the consensus fails.

Timeouts and retries are handled automatically in the background.

---

## Purposes and Use Cases

Gossip-based consensus is ideal for:

* validating dynamic content (e.g. moderation decisions),
* performing **ad-hoc trust coordination** between peers,
* validating behavior of **non-bootstrap nodes**,
* augmenting Raft consensus in loosely connected network regions.

It supports decentralized checks without requiring globally synchronized state or topology.

---

## Technical Notes

* Gossip messages are wrapped in `event.Message` and sent via `PublishValidationRequest`.
* Responses use typed `ValidationEventResponse` messages.
* Peers are dynamically discovered via `GetConsensusTopicSubscribers()`.
* Self-validation and duplicate responses are ignored.
* Results are delivered to the `recvChan` channel and processed with timeout logic.

---

## Limitations

* No persistent state is shared or stored — it's a one-shot consensus mechanism.
* Validations are only as strong as the validator functions registered.
* There is no Byzantine fault tolerance — nodes are assumed to be honest but independent.
