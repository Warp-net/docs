---
title: API Reference
description: The routes Warpnet nodes serve, grouped by area, with visibility, purpose and the request and response types each handler decodes and returns.
---

# API Reference

This page lists the routes Warpnet nodes serve, grouped by area. For each route it gives the visibility, what the handler does and the Go types of the request body it decodes and the response it returns. It is for developers writing a client or another node; how to send a request is in [Stream API](stream-API.md) and [WebSocket API](ws-API.md), and the rules behind the columns are in [Protocol](../protocol.md).

## Reading the tables

- **Route**: the libp2p protocol ID. Every route ends in `/0.0.0`; it is left out of the tables for width. The constants are in [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go).
- **Vis**: `private` routes are served only to the node itself and to its paired devices; `public` routes to any peer whose request signature verifies. See [Private and public routes](../protocol.md#private-and-public-routes).
- **Request**: the type the handler decodes from the envelope's `body`. Types without a package are in [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go); `domain.*` types are in [`domain/`](https://github.com/Warp-net/warpnet/tree/main/domain). Many event types are aliases of a domain type, given in brackets. "none" means the handler does not read the body; send `{}`.
- **Response**: what the handler returns. `Accepted` is the literal `{"code":0,"message":"Accepted"}`. Any route can also answer with an error object `{"code":..., "message":...}`; see [Errors](stream-API.md#errors).
- Paginated requests take optional `cursor` and `limit`; responses return the next `cursor`, and the value `end` means there are no more pages.

The member node's handlers are in [`core/handler`](https://github.com/Warp-net/warpnet/tree/main/core/handler) and are registered in [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go). The page covers 120 routes: 114 served by the member node over libp2p, four answered by the desktop app or the remote node's bridge before a request reaches libp2p, one served by relay nodes and one by moderator nodes. The last six are under [Routes outside the member node](#routes-outside-the-member-node).

## Node and devices

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/admin/pair` | private | Pair a device with this node. The only private route any peer may call: the handler checks the session token from the pairing QR code and stores the caller's peer ID as a paired device | `domain.AuthNodeInfo` (`token` required) | `[]string`, the node's multiaddrs |
| `/private/get/admin/devices` | private | Paired devices, without their tokens | none | `GetDevicesResponse` |
| `/private/delete/admin/device` | private | Unpair a device. A paired device may only unpair itself | `DeleteDeviceEvent` | `GetDevicesResponse` (remaining devices) |
| `/public/get/info` | public | Node type, owner, version, addresses, reachability, relay state, served protocols and paired devices. On member and relay nodes the caller is also passed to [discovery](../discovery.md#inbound-info-requests). Served by every node type | none | `warpnet.NodeInfo` |
| `/private/get/admin/stats` | private | Node metrics for the dashboard: traffic, peers online and stored, database, memory and CPU stats | none | `warpnet.NodeMetrics` |
| `/private/get/admin/rating` | private | This node's [rating](../rating.md) as other nodes record it | none | `GetRatingResponse` (`domain.NodeRating`) |

## Tweets and timeline

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/timeline` | private | Home timeline from the local store | `GetTimelineEvent` | `TweetsResponse` |
| `/private/post/tweet` | private | Publish a tweet as the owner: store it, add it to the timeline and publish it on the owner's `user-update-<userId>` gossip topic. A tweet with `parent_id` is a reply: it is stored locally and sent to the parent author's node with `/public/post/reply`. A priced tweet is refused here | `NewTweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/private/post/tweet/edit` | private | Edit the text of one of the owner's tweets or replies; a sponsored tweet cannot be edited. The previous text is kept as an edit record, existing retweets of the tweet are cancelled, and a reply's edit goes to the parent author's node with `/public/post/reply/edit` | `EditTweetEvent` | `EditTweetResponse` (`domain.Tweet`) |
| `/private/delete/tweet` | private | Delete a tweet from the local store. For the owner's own tweet, followers get the deletion on the gossip topic. With `parent_id` or `root_id` it deletes a reply (the owner's own, or any reply in the owner's thread); deleting an own reply is forwarded to the parent author's node with `/public/delete/reply` | `DeleteTweetEvent` | `Accepted` |
| `/private/post/import/twitter/tweet` | private | Import one original tweet from an X archive. The client unpacks the archive and sends the tweets one by one; photos go through the same pipeline as an upload | `ImportTweetEvent` | `ImportTwitterArchiveResponse` |
| `/public/post/timeline` | public | A followed author's new tweet, delivered from the author's gossip topic. Stored and added to the timeline only if the owner follows the author | `NewTweetEvent` | `domain.Tweet` or `Accepted` |
| `/public/delete/timeline` | public | A followed author's deletion, delivered the same way | `DeleteTweetEvent` | `Accepted` |
| `/public/get/tweet` | public | One tweet, from the local store or the author's node. A sponsored tweet comes as a teaser (no text, media or poll) unless the caller is the author's own node or device | `GetTweetEvent` | `domain.Tweet` |
| `/public/get/tweets` | public | A user's tweets, refreshed from their node. With `root_id` or `parent_id` set, the replies under that tweet; with `root_user_id` set, they are asked from the thread author's node | `GetAllTweetsEvent` | `TweetsResponse` |
| `/public/get/tweetstats` | public | Counters of a tweet (views, retweets, replies, reactions per emoji) and the owner's own reaction. For another user's tweet they come from the author's node | `GetTweetStatsEvent` | `TweetStatsResponse` |
| `/public/post/reply` | public | A reply to a thread that lives on this node, sent by the replier's node. Stored, and the owner is notified | `NewTweetEvent` | `domain.Tweet` |
| `/public/post/reply/edit` | public | The reply author's edit, applied to the copy this node keeps | `EditTweetEvent` | `Accepted` |
| `/public/delete/reply` | public | The reply author's deletion, applied to the copy this node keeps | `DeleteTweetEvent` | `Accepted` |
| `/public/post/retweet` | public | Retweet or quote a tweet; stored locally and forwarded to the author's node, which notifies the author | `NewRetweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/public/post/unretweet` | public | Undo a retweet, locally and on the author's node | `UnretweetEvent` | `Accepted` |
| `/public/post/pin` | public | Pin a tweet on its author's profile; only the author's own node or device may do it | `PinTweetEvent` | `domain.Tweet` |
| `/public/post/unpin` | public | Unpin it | `PinTweetEvent` | `domain.Tweet` |

## Reactions, views and polls

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/react` | public | React to a tweet with an emoji (`❤️` if `emoji` is empty); forwarded to the author's node, which notifies the author | `ReactionEvent` | `ReactionsCountResponse` |
| `/public/post/unreact` | public | Remove a reaction, locally and on the author's node | `UnreactionEvent` | `ReactionsCountResponse` |
| `/public/post/view` | public | Count a view of a tweet; the owner's own view is forwarded to the author's node | `ViewEvent` | `ViewsCountResponse` |
| `/public/get/tweet/reactors` | public | Users who reacted to a tweet; asked from the author's node when `owner_user_id` names another user | `GetTweetReactorsEvent` | `UsersResponse` |
| `/public/get/tweet/retweeters` | public | Users who retweeted a tweet, asked the same way | `GetTweetRetweetersEvent` | `UsersResponse` |
| `/private/get/reactions` | private | Tweets the owner reacted to, as references to load with `/public/get/tweet` | `GetReactionsEvent` | `GetReactionsResponse` |
| `/public/post/poll/vote` | public | Vote in a tweet's poll; the vote is forwarded to the author's node | `PollVoteEvent` | `PollResultsResponse` |
| `/public/get/poll` | public | Poll results, counted on the author's node; the owner's own vote is answered locally | `GetPollEvent` | `PollResultsResponse` |

## Follows and trust

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/follow` | public | Follow a user: record it, send the follow to their node (which notifies them) and subscribe to their gossip topic. On the followed user's node the same route records the new follower | `NewFollowEvent` | `Accepted` |
| `/public/post/unfollow` | public | Unfollow, locally and on their node, and unsubscribe from their topic | `NewUnfollowEvent` | `Accepted` |
| `/public/post/isfollowing` | public | Whether this node's owner follows `user_id` | `GetIsFollowingEvent` | `IsFollowingResponse` |
| `/public/post/isfollower` | public | Whether `user_id` follows this node's owner | `GetIsFollowingEvent` | `IsFollowerResponse` |
| `/public/get/followers` | public | Followers of a user; asked from that user's node when it is not the owner | `GetFollowersEvent` | `FollowersResponse` |
| `/public/get/followings` | public | Who a user follows, asked the same way; `is_mutual_only` limits the owner's list to users who follow back | `GetFollowingsEvent` | `FollowingsResponse` |
| `/private/get/trust` | private | Where the given users (up to 100) sit in the owner's [trust circle](../trust-circle.md), answered from memory without network calls | `GetTrustEvent` | `GetTrustResponse` |

## Users

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/get/user` | public | A profile. The owner's comes with tweet, follower and following counts. Another user's comes from the local store and is refreshed from their node in the background, or is fetched from their node when it is not stored (`node_id` is an optional hint; a bridged handle is asked from the bridge gateway) | `GetUserEvent` | `domain.User` |
| `/private/get/user/status` | private | Whether a user is online: asks their node for `/public/get/info` and records `last_seen` | `GetUserEvent` | `UserStatusResponse` |
| `/public/get/users` | public | Users this node knows. In the background the list is refreshed from the node of `user_id`, or from the [bridge gateway](../bridge.md) when `user_id` is the owner | `GetAllUsersEvent` | `UsersResponse` |
| `/public/get/users/search` | public | Search the users this node knows | `SearchUsersEvent` | `SearchUsersResponse` (`UsersResponse`) |
| `/public/get/whotofollow` | public | Follow suggestions, one page per network (`warpnet`, `mastodon`, `threads`, `nostr`) in `networks`, paged by `cursors`; the top-level `users` and `cursor` repeat the `warpnet` page | `GetWhoToFollowEvent` | `WhoToFollowResponse` |
| `/private/post/user` | private | Update the owner's profile | `NewUserEvent` (`domain.User`) | `domain.User` |

## Chats

Chats with bridged users are refused.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/chat` | public | Create a chat with another user; the chat is also created on their node | `NewChatEvent` | `ChatCreatedResponse` (`domain.Chat`) |
| `/public/post/message` | public | Send a message; stored locally and delivered to the other user's node, which notifies them | `NewMessageEvent` (`domain.ChatMessage`) | `NewMessageResponse` (`domain.ChatMessage`) |
| `/private/get/chat` | private | One chat | `GetChatEvent` | `GetChatResponse` (`domain.Chat`) |
| `/private/get/chats` | private | The owner's chats | `GetAllChatsEvent` | `ChatsResponse` |
| `/private/delete/chat` | private | Delete a chat locally | `DeleteChatEvent` | `Accepted` |
| `/private/get/message` | private | One message | `GetMessageEvent` | `ChatMessageResponse` (`domain.ChatMessage`) |
| `/private/get/messages` | private | Messages of a chat | `GetAllMessagesEvent` | `ChatMessagesResponse` |
| `/private/delete/message` | private | Delete a message locally | `DeleteMessageEvent` | `Accepted` |

## Media

Media travel inside JSON as base64 data URIs (`data:<mime>;base64,<data>`). The node re-encodes uploaded images as JPEG and embeds encrypted ownership metadata in every uploaded image and video. A video must be MP4, MOV or M4V, at most 36 MiB and one minute long. Request size limits per route are in [Stream API](stream-API.md#limits-and-good-practice).

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/image` | private | Upload up to four images (`image1` to `image4`); returns their keys | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/image` | public | An image by owner and key, from the local store or the owner's node | `GetImageEvent` | `GetImageResponse` |
| `/private/post/video` | private | Upload a video | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/video` | public | A video by owner and key, from the local store or the owner's node. With `deferred: true` the node answers only with the size of a copy it already has, or with `deferred: true` and no file, and does not fetch it | `GetVideoEvent` | `GetVideoResponse` |
| `/private/post/chat/image` | private | Upload images for a chat, kept apart from public media | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/chat/image` | public | A chat image; served only to the owner's node and devices and to the owner's chat partners | `GetImageEvent` | `GetImageResponse` |
| `/private/post/chat/video` | private | Upload a chat video | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/chat/video` | public | A chat video, served the same way as chat images | `GetVideoEvent` | `GetVideoResponse` |

## Notifications

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/notifications` | private | The owner's notifications and the unread count; within a page, unread first, then newest | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/pushes` | private | The same notifications read from `cursor` in the opposite direction; called by the mobile apps | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/notification` | private | One notification | `GetNotificationEvent` | `GetNotificationResponse` (`domain.Notification`) |
| `/private/post/notification/read` | private | Mark one notification read | `MarkNotificationReadEvent` | `Accepted` |
| `/private/post/notifications/read` | private | Mark all notifications read | none | `Accepted` |

## Settings

Gateway, rate-limit, network and wallet settings are stored in the node's database and applied when the member node starts.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/settings/notification` | private | Email notification settings: SMTP server, recipient, per-type switches | none | `GetNotificationSettingsResponse` (`domain.NotificationSettings`) |
| `/private/post/settings/notification` | private | Save them | `UpdateNotificationSettingsEvent` (`domain.NotificationSettings`) | `GetNotificationSettingsResponse` |
| `/private/get/settings/gateway` | private | Peer ID of the [bridge gateway](../bridge.md) node; the built-in default when none is set | none | `GetGatewaySettingsResponse` (`domain.GatewaySettings`) |
| `/private/post/settings/gateway` | private | Save it; an empty `node_id` stores the default | `UpdateGatewaySettingsEvent` (`domain.GatewaySettings`) | `GetGatewaySettingsResponse` |
| `/private/get/settings/ratelimit` | private | Connection manager watermarks and discovery and stream rate limits, with defaults filled in | none | `ratelimit.Settings` |
| `/private/post/settings/ratelimit` | private | Save them; the low watermark must be below the high one | `ratelimit.Settings` | `ratelimit.Settings` |
| `/private/get/settings/network` | private | Listen hosts, port and bootstrap list, with the start-up values filled in | none | `GetNetworkSettingsResponse` (`domain.NetworkSettings`) |
| `/private/post/settings/network` | private | Save them; hosts, port and bootstrap multiaddrs are validated | `UpdateNetworkSettingsEvent` (`domain.NetworkSettings`) | `GetNetworkSettingsResponse` |
| `/private/get/settings/wallet` | private | Blockchain API endpoint and payment engine path | none | `GetWalletSettingsResponse` (`domain.WalletSettings`) |
| `/private/post/settings/wallet` | private | Save them; the endpoint must be an http(s) URL | `UpdateWalletSettingsEvent` (`domain.WalletSettings`) | `GetWalletSettingsResponse` |
| `/private/get/settings/sponsored` | private | Minimum TRX stake a buyer's wallet needs to buy the owner's sponsored tweets | none | `GetSponsoredSettingsResponse` (`domain.SponsoredSettings`) |
| `/private/post/settings/sponsored` | private | Save it | `UpdateSponsoredSettingsEvent` (`domain.SponsoredSettings`) | `GetSponsoredSettingsResponse` |

`ratelimit.Settings` is defined in [`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go).

## Filters, blocks and mutes

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/settings/filter` | private | One content filter | `GetFilterEvent` | `GetFilterResponse` (`domain.Filter`) |
| `/private/get/settings/filters` | private | All content filters | `GetFiltersEvent` | `GetFiltersResponse` |
| `/private/post/settings/filter` | private | Create a filter | `NewFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/post/settings/filter/update` | private | Update a filter | `UpdateFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/delete/settings/filter` | private | Delete a filter | `DeleteFilterEvent` | `Accepted` |
| `/private/post/settings/filter/keyword` | private | Add a keyword to a filter | `AddFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/post/settings/filter/keyword/update` | private | Change a keyword | `UpdateFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/delete/settings/filter/keyword` | private | Remove a keyword | `DeleteFilterKeywordEvent` | `Accepted` |
| `/private/post/settings/block` | private | Block a user; their node also goes on the peer blocklist, except for bridged users | `BlockEvent` | `Accepted` |
| `/private/post/settings/unblock` | private | Unblock, and take their node off the blocklist | `UnblockEvent` | `Accepted` |
| `/private/get/settings/blocks` | private | Blocked user IDs | `GetBlocksEvent` | `GetBlocksResponse` |
| `/private/post/settings/mute` | private | Mute a user | `MuteEvent` | `Accepted` |
| `/private/post/settings/unmute` | private | Unmute | `UnmuteEvent` | `Accepted` |
| `/private/get/settings/mutes` | private | Muted user IDs | `GetMutesEvent` | `GetMutesResponse` |

## Bookmarks

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/bookmark` | private | Bookmark a tweet | `BookmarkEvent` | `Accepted` |
| `/private/post/unbookmark` | private | Remove a bookmark | `UnbookmarkEvent` | `Accepted` |
| `/private/get/bookmarks` | private | Bookmarks, as references to load with `/public/get/tweet` | `GetBookmarksEvent` | `GetBookmarksResponse` |

## Moderation

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/report` | public | Report a tweet or a user. Only the node's own owner may call it; the node stamps the reporter and publishes the report on the `/warpnet/reports/1.0.0` gossip topic | `ReportEvent` | `Accepted` |
| `/public/post/moderate/result` | public | Apply a moderator verdict. A moderator publishes a verdict that upholds a report on the reported author's gossip topic and sends every verdict directly to the reporter's node. The verdict's signature and its quorum of signed votes are checked before anything is changed | `ModerationVerdictEvent` | `Accepted` |

See [Moderation](../moderation.md) for the full flow.

## Wallet

The node has a built-in TRON wallet whose key is derived from the owner's identity. It is used for transfers and for sponsored tweets and reaches the blockchain through a payment engine process the node runs.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/wallet` | private | Address, balances, staking state and network | none | `WalletResponse` |
| `/private/get/wallet/address` | private | The owner's own address and token | none | `WalletOwnAddressResponse` |
| `/private/get/wallet/history` | private | Recent transfers | `WalletEvent` | `WalletHistoryResponse` |
| `/private/get/wallet/key` | private | Export the wallet's private key | none | `WalletKeyResponse` |
| `/private/get/wallet/contacts` | private | Wallet addresses of the owner's followings and followers, collected from their nodes with `/public/get/wallet/address` | `WalletContactsEvent` | `WalletContactsResponse` |
| `/private/post/wallet/send` | private | Send funds | `WalletSendEvent` | `WalletSendResponse` |
| `/private/post/wallet/stake` | private | Stake TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/unstake` | private | Start unstaking TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/withdraw` | private | Withdraw unstaked TRX that became available | none | `WalletStakeResponse` |
| `/public/get/wallet/address` | public | Another node asks for the owner's payment address; refused when the caller's user has 10 confirmed orders in the last hour | `WalletAddressEvent` | `WalletAddressResponse` |

## Sponsored tweets

A sponsored tweet has a price. Other users see a teaser; a buyer pays the author through the wallet and then receives the full content, with media copies made for that buyer.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/sponsored/tweet` | private | Publish a priced tweet as the owner; it must have text and cannot be a reply or carry a poll | `NewTweetEvent` (`domain.Tweet`) with `price` | `domain.Tweet` |
| `/private/get/sponsored/quote` | private | Price, fee and network costs of buying a sponsored tweet | `GetOrderQuoteEvent` | `OrderQuoteResponse` |
| `/private/post/sponsored/order` | private | Buy a sponsored tweet: open the order and pay the author | `NewOrderEvent` | `OrderResponse` |
| `/public/post/sponsored/order` | public | The buyer's node asks the author's node to verify the payment | `VerifyOrderEvent` | `OrderResponse` |
| `/public/get/sponsored/tweet` | public | The full tweet for a buyer whose order is confirmed; the author's own node and devices get it as stored | `GetTweetEvent` | `domain.Tweet`, or `OrderResponse` while unconfirmed |
| `/public/get/sponsored/image` | public | An image of a bought sponsored tweet | `GetImageEvent` | `GetImageResponse` |
| `/public/get/sponsored/video` | public | A video of a bought sponsored tweet | `GetVideoEvent` | `GetVideoResponse` |
| `/private/get/sponsored/buyer` | private | Match a leaked file against the copies sold, to find which buyer it came from | `GetCopyBuyerEvent` | `CopyBuyerResponse` |

## Routes outside the member node

| Route | Served by | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/login` | desktop app (`App.Call`), remote node's `/ws` bridge | Log in with the login and password, derive the keys and start the node; on a new node this creates the account. Never sent over libp2p | `LoginEvent`: `username` carries the login, plus `password` | `LoginResponse` (`domain.AuthNodeInfo`) |
| `/private/post/logout` | desktop app, remote node's `/ws` bridge | Log out. The desktop app stops the node; the remote bridge only signs this connection out. Never sent over libp2p | none | `["logged_out"]` |
| `/private/get/update` | desktop app only | The pending self-update, if any | none | `UpdateResponse` (`domain.UpdateInfo`) |
| `/private/post/update` | desktop app only | Allow or refuse the pending update | `UpdateEvent` | `Accepted` |
| `/public/post/relay/refuse/reservation` | relay nodes | A node holding a reservation on the relay asks it to stop relaying connections from a peer it has blocklisted; nodes send it when such a peer reaches them through the relay | `RefuseReservationEvent` | `Accepted` |
| `/public/get/moderate/challenge` | moderator nodes | Audit spot check between moderators: every 5 minutes a moderator sends a reference text to a random moderator it has recently seen in a moderation round, which judges it with its own engine and returns a signed answer | `audit.Challenge` | `audit.ChallengeResponse` |

Login, logout and the update routes are handled in [`cmd/node/member/app.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/app.go) and [`cmd/node/member/remote/bridge.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/remote/bridge.go). The moderator audit types are in [`cmd/node/moderator/audit/wire.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/moderator/audit/wire.go).

## Adding a route

New routes follow the same pattern: a constant in `event/paths.go`, request and response types in `event/event.go`, a handler factory in `core/handler`, registration in the member node, and the mirrors in the clients. See the [developer guide](index.md) for the checklist.

## See also

- [Protocol](../protocol.md): envelopes, signing, errors, limits
- [Stream API](stream-API.md): calling routes over libp2p
- [WebSocket API](ws-API.md): calling routes through the remote node's dashboard bridge
- [Clients](clients.md): how the desktop, browser and mobile clients reach these routes
