---
title: API Reference
description: Every Warpnet route from event/paths.go, grouped by area, with visibility, purpose and the request and response types.
---

# API Reference

This page lists every route defined in [`event/paths.go`](https://github.com/Warp-net/warpnet/blob/main/event/paths.go), grouped by area. For each route it gives the visibility, what the handler does and the Go types of the request body and the response. It is for developers writing a client or another node; how to send a request is in [Stream API](stream-API.md) and [WebSocket API](ws-API.md), and the rules behind the columns are in [Protocol](../protocol.md).

## Reading the tables

- **Route**: the libp2p protocol ID. Every route ends in `/0.0.0`; it is left out of the tables for width.
- **Vis**: `private` routes are served only to the node itself and to paired devices; `public` routes to any peer that passes the signature check. See [Private and public routes](../protocol.md#private-and-public-routes).
- **Request**: the type of the envelope's `body`. Types without a package are in [`event/event.go`](https://github.com/Warp-net/warpnet/blob/main/event/event.go); `domain.*` types are in [`domain/`](https://github.com/Warp-net/warpnet/tree/main/domain). "none" means the body is ignored; send `{}`.
- **Response**: the JSON the handler writes. `Accepted` is the literal `{"code":0,"message":"Accepted"}`. Any route can also answer with an error `{"code":..., "message":...}`; see [Errors](../protocol.md#errors-and-responses).
- Paginated requests take optional `cursor` and `limit`; responses return the next `cursor`, and the value `end` means there are no more pages.

Handlers live in [`core/handler`](https://github.com/Warp-net/warpnet/tree/main/core/handler) and are registered in [`cmd/node/member/node/member-node.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/member/node/member-node.go). `event/paths.go` defines 126 routes and a member node serves 120 of them. The other six, plus the moderator challenge route defined in `cmd/node/moderator/audit`, are listed under [Routes outside the member node](#routes-outside-the-member-node).

## Node and devices

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/admin/pair` | private | Pair a device with this node. Any peer may call it; the handler checks the session token and stores the caller's peer ID as a paired device | `domain.AuthNodeInfo` (`token` required) | `[]string`, the node's multiaddrs |
| `/private/get/admin/devices` | private | List paired devices, without their tokens | none | `GetDevicesResponse` |
| `/private/delete/admin/device` | private | Unpair a device. A paired device may only unpair itself | `DeleteDeviceEvent` | `GetDevicesResponse` (remaining devices) |
| `/public/get/info` | public | Node identity and state: type, owner, version, addresses, reachability, relay state, served protocols, paired aliases. Also feeds the caller into [discovery](../discovery.md#inbound-info-requests) | none | `warpnet.NodeInfo` |
| `/private/get/admin/stats` | private | Node metrics for the dashboard: traffic, peers online and stored, database, memory and CPU stats | none | `warpnet.NodeMetrics` |
| `/private/get/admin/rating` | private | What the network says about this node | none | `domain.NodeRating` |
| `/public/get/admin/rating` | public | This node's public view of a peer's rating (median of its observers). Empty `node_id` returns this node's own rating | `GetRatingEvent` | `domain.NodeRating` |

## Tweets and timeline

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/timeline` | private | Home timeline from the local store | `GetTimelineEvent` | `TweetsResponse` |
| `/private/post/tweet` | private | Publish a tweet as the owner: store it, add it to the timeline and gossip it to followers. A tweet with a parent goes through the reply flow | `NewTweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/private/post/tweet/edit` | private | Edit one of the owner's tweets. A reply's edit is also forwarded to the parent author's node | `EditTweetEvent` | `domain.Tweet` |
| `/private/delete/tweet` | private | Delete one of the owner's tweets or replies; followers get the deletion over gossip | `DeleteTweetEvent` | `Accepted` |
| `/private/post/import/twitter/tweet` | private | Import one original tweet from an X archive; the browser unpacks the archive and sends tweets one by one | `ImportTweetEvent` | `ImportTwitterArchiveResponse` |
| `/public/post/timeline` | public | Delivery of a followed author's new tweet, normally from the `user-update-<userId>` gossip topic | `NewTweetEvent` | `domain.Tweet` or `Accepted` |
| `/public/delete/timeline` | public | Delivery of a followed author's deletion | `DeleteTweetEvent` | `Accepted` |
| `/public/get/tweet` | public | One tweet, from the local store or the author's node. A priced (sponsored) tweet is returned as a teaser without content | `GetTweetEvent` | `domain.Tweet` |
| `/public/get/tweets` | public | A user's tweets; with `root_id` set, the replies under that thread | `GetAllTweetsEvent` | `TweetsResponse` |
| `/public/get/tweetstats` | public | Counters of a tweet (retweets, reactions per emoji, replies, views) and the owner's own reaction | `GetTweetStatsEvent` | `TweetStatsResponse` |
| `/public/post/reply` | public | Post a reply; stored on the replier's node and on the parent author's node | `NewTweetEvent` | `domain.Tweet` |
| `/public/post/reply/edit` | public | A reply author's edit, applied to the copy the parent author's node keeps | `EditTweetEvent` | `Accepted` |
| `/public/delete/reply` | public | A reply author's deletion, applied to the copy the parent author's node keeps | `DeleteTweetEvent` | `Accepted` |
| `/public/post/retweet` | public | Retweet; recorded locally and on the author's node | `NewRetweetEvent` (`domain.Tweet`) | `domain.Tweet` |
| `/public/post/unretweet` | public | Undo a retweet | `UnretweetEvent` | `Accepted` |
| `/public/post/pin` | public | Pin a tweet on its author's profile; only the author's node may do it | `PinTweetEvent` | `domain.Tweet` |
| `/public/post/unpin` | public | Unpin it | `UnpinTweetEvent` | `domain.Tweet` |

## Reactions, views and polls

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/react` | public | React to a tweet with an emoji (default reaction if `emoji` is empty); forwarded to the author's node, which notifies the author | `ReactionEvent` | `ReactionsCountResponse` |
| `/public/post/unreact` | public | Remove a reaction | `UnreactionEvent` | `ReactionsCountResponse` |
| `/public/post/view` | public | Count a view of a tweet | `ViewEvent` | `ViewsCountResponse` |
| `/public/get/tweet/reactors` | public | Users who reacted to a tweet | `GetTweetReactorsEvent` | `UsersResponse` |
| `/public/get/tweet/retweeters` | public | Users who retweeted a tweet | `GetTweetRetweetersEvent` | `UsersResponse` |
| `/private/get/reactions` | private | Tweets the owner reacted to, newest first, as references to hydrate with `/public/get/tweet` | `GetReactionsEvent` | `GetReactionsResponse` |
| `/public/post/poll/vote` | public | Vote in a tweet's poll | `PollVoteEvent` | `PollResultsResponse` |
| `/public/get/poll` | public | Poll results, counted on the author's node; "did I vote" answered locally | `GetPollEvent` | `PollResultsResponse` |

## Follows and trust

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/follow` | public | Follow a user: record it, subscribe to their gossip topic and notify their node | `NewFollowEvent` | `Accepted` |
| `/public/post/unfollow` | public | Unfollow and unsubscribe | `NewUnfollowEvent` | `Accepted` |
| `/public/post/isfollowing` | public | Whether this node's owner follows `user_id` | `GetIsFollowingEvent` | `IsFollowingResponse` |
| `/public/post/isfollower` | public | Whether `user_id` follows this node's owner | `GetIsFollowerEvent` | `IsFollowerResponse` |
| `/public/get/followers` | public | Followers of a user; asked from that user's node when it is not the owner | `GetFollowersEvent` | `FollowersResponse` |
| `/public/get/followings` | public | Who a user follows; `is_mutual_only` limits the owner's list to those who follow back | `GetFollowingsEvent` | `FollowingsResponse` |
| `/private/get/follow/requests` | private | Pending follow requests for a locked account | `GetFollowRequestsEvent` | `GetFollowRequestsResponse` |
| `/private/post/follow/request/authorize` | private | Accept a follow request | `FollowRequestActionEvent` | `Accepted` |
| `/private/post/follow/request/reject` | private | Reject a follow request | `FollowRequestActionEvent` | `Accepted` |
| `/private/get/trust` | private | Where the given users sit in the owner's [trust circle](../trust-circle.md), answered from memory. Develop branch only, not in a release yet ([`core/handler/trust.go`](https://github.com/Warp-net/warpnet/blob/develop/core/handler/trust.go)) | `GetTrustEvent` | `GetTrustResponse` |

> **Note:** The follow-request routes serve a queue of pending requests, but no code path in the node adds requests to it yet, so the list is always empty today.
{: .note }

## Users

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/get/user` | public | A profile. The owner's comes with tweet, follower and following counts; others come from the local store or are fetched from their node (`node_id` is an optional hint) | `GetUserEvent` | `domain.User` |
| `/private/get/user/status` | private | Whether a user is online now: asks their node and updates `last_seen` | `GetUserEvent` | `UserStatusResponse` |
| `/public/get/users` | public | Users this node knows. In the background the list is refreshed from the node of `user_id`, or from the Fediverse gateway when `user_id` is the owner | `GetAllUsersEvent` | `UsersResponse` |
| `/public/get/users/search` | public | Search the users this node knows | `SearchUsersEvent` | `UsersResponse` |
| `/public/get/whotofollow` | public | Follow suggestions, with a separate page per bridged network | `GetWhoToFollowEvent` | `WhoToFollowResponse` |
| `/private/post/user` | private | Update the owner's profile | `NewUserEvent` (`domain.User`) | `domain.User` |
| `/private/post/subscribe/user` | private | Get a notification for each new tweet of this user | `SubscribeUserEvent` | `Accepted` |
| `/private/post/unsubscribe/user` | private | Stop those notifications | `UnsubscribeUserEvent` | `Accepted` |

## Chats

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/chat` | public | Create a chat with another user; the chat is also created on their node | `NewChatEvent` | `domain.Chat` |
| `/public/post/message` | public | Send a message; stored locally and delivered to the other user's node | `NewMessageEvent` (`domain.ChatMessage`) | `domain.ChatMessage` |
| `/private/get/chat` | private | One chat | `GetChatEvent` | `domain.Chat` |
| `/private/get/chats` | private | The owner's chats | `GetAllChatsEvent` | `ChatsResponse` |
| `/private/delete/chat` | private | Delete a chat locally | `DeleteChatEvent` | `Accepted` |
| `/private/get/message` | private | One message | `GetMessageEvent` | `domain.ChatMessage` |
| `/private/get/messages` | private | Messages of a chat | `GetAllMessagesEvent` | `ChatMessagesResponse` |
| `/private/delete/message` | private | Delete a message locally | `DeleteMessageEvent` | `Accepted` |

## Media

Images travel as `"<mime type>,<base64>"` strings, videos as base64 strings, all inside JSON. Upload and media routes have larger size limits; see [Size limits](../protocol.md#size-limits-and-timeouts).

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/image` | private | Upload up to four images; returns their keys | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/image` | public | An image by owner and key, from the local store or the owner's node | `GetImageEvent` | `GetImageResponse` |
| `/private/post/video` | private | Upload a video | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/video` | public | A video by owner and key, from the local store or the owner's node. With `deferred` the node answers only with the size of a locally stored copy, or `deferred: true` without the file, and does not fetch it | `GetVideoEvent` | `GetVideoResponse` |
| `/private/post/chat/image` | private | Upload images for a chat (separate store from public media) | `UploadImageEvent` | `UploadImageResponse` |
| `/public/get/chat/image` | public | A chat image | `GetImageEvent` | `GetImageResponse` |
| `/private/post/chat/video` | private | Upload a chat video | `UploadVideoEvent` | `UploadVideoResponse` |
| `/public/get/chat/video` | public | A chat video | `GetVideoEvent` | `GetVideoResponse` |

## Notifications

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/notifications` | private | The owner's notifications with the unread count | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/pushes` | private | The same list read in the reverse direction from a cursor; used by the Android client | `GetNotificationsEvent` | `GetNotificationsResponse` |
| `/private/get/notification` | private | One notification | `GetNotificationEvent` | `domain.Notification` |
| `/private/post/notification/read` | private | Mark one notification read | `MarkNotificationReadEvent` | `Accepted` |
| `/private/post/notifications/read` | private | Mark all notifications read | none | `Accepted` |

## Settings

Network, gateway, rate-limit and wallet settings are stored in the node's database and read when the node starts.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/settings/notification` | private | Email notification settings (SMTP, recipient, per-type switches) | none | `domain.NotificationSettings` |
| `/private/post/settings/notification` | private | Save them | `domain.NotificationSettings` | `domain.NotificationSettings` |
| `/private/get/settings/gateway` | private | Peer ID of the Fediverse gateway node (empty means the built-in default) | none | `domain.GatewaySettings` |
| `/private/post/settings/gateway` | private | Save it | `domain.GatewaySettings` | `domain.GatewaySettings` |
| `/private/get/settings/ratelimit` | private | Connection limits and discovery and stream rate limits, with defaults filled in | none | `ratelimit.Settings` |
| `/private/post/settings/ratelimit` | private | Save them | `ratelimit.Settings` | `ratelimit.Settings` |
| `/private/get/settings/network` | private | Listen hosts, port and bootstrap list | none | `domain.NetworkSettings` |
| `/private/post/settings/network` | private | Save them | `domain.NetworkSettings` | `domain.NetworkSettings` |
| `/private/get/settings/wallet` | private | Blockchain API endpoint and payment engine path | none | `domain.WalletSettings` |
| `/private/post/settings/wallet` | private | Save them | `domain.WalletSettings` | `domain.WalletSettings` |
| `/private/get/settings/sponsored` | private | Minimum TRX stake a buyer needs to buy the owner's sponsored tweets | none | `domain.SponsoredSettings` |
| `/private/post/settings/sponsored` | private | Save it | `domain.SponsoredSettings` | `domain.SponsoredSettings` |

`ratelimit.Settings` is defined in [`core/ratelimit/settings.go`](https://github.com/Warp-net/warpnet/blob/main/core/ratelimit/settings.go).

## Filters, blocks and mutes

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/settings/filter` | private | One content filter | `GetFilterEvent` | `domain.Filter` |
| `/private/get/settings/filters` | private | All content filters | `GetFiltersEvent` | `GetFiltersResponse` |
| `/private/post/settings/filter` | private | Create a filter | `NewFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/post/settings/filter/update` | private | Update a filter | `UpdateFilterEvent` (`domain.Filter`) | `domain.Filter` |
| `/private/delete/settings/filter` | private | Delete a filter | `DeleteFilterEvent` | `Accepted` |
| `/private/post/settings/filter/keyword` | private | Add a keyword to a filter | `AddFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/post/settings/filter/keyword/update` | private | Change a keyword | `UpdateFilterKeywordEvent` | `domain.FilterKeyword` |
| `/private/delete/settings/filter/keyword` | private | Remove a keyword | `DeleteFilterKeywordEvent` | `Accepted` |
| `/private/post/settings/block` | private | Block a user; their node goes on the peer blocklist (except bridged users) | `BlockEvent` | `Accepted` |
| `/private/post/settings/unblock` | private | Unblock and remove their node from the blocklist | `UnblockEvent` | `Accepted` |
| `/private/get/settings/blocks` | private | Blocked user IDs | `GetBlocksEvent` | `GetBlocksResponse` |
| `/private/post/settings/mute` | private | Mute a user | `MuteEvent` | `Accepted` |
| `/private/post/settings/unmute` | private | Unmute | `UnmuteEvent` | `Accepted` |
| `/private/get/settings/mutes` | private | Muted user IDs | `GetMutesEvent` | `GetMutesResponse` |

## Bookmarks

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/bookmark` | private | Bookmark a tweet | `BookmarkEvent` | `Accepted` |
| `/private/post/unbookmark` | private | Remove a bookmark | `UnbookmarkEvent` | `Accepted` |
| `/private/get/bookmarks` | private | Bookmarks, as references to hydrate with `/public/get/tweet` | `GetBookmarksEvent` | `GetBookmarksResponse` |

## Moderation

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/public/post/report` | public | Report a tweet or a user. Only the node's owner may call it; the node publishes the report on `/warpnet/reports/1.0.0` | `ReportEvent` | `Accepted` |
| `/public/post/moderate/result` | public | Apply a moderator verdict, normally delivered over the author's gossip topic. The verdict's signature and quorum of signed votes are checked | `ModerationVerdictEvent` | `Accepted` |

See [Moderation](../moderation.md) for the full flow.

## Wallet

The node has a built-in wallet on the TRON network, derived from the owner's identity, used for transfers and for sponsored tweets. It talks to the blockchain through a local payment engine.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/get/wallet` | private | Address, balances, staking state and network | none | `WalletResponse` |
| `/private/get/wallet/address` | private | The owner's own address and token | none | `WalletOwnAddressResponse` |
| `/private/get/wallet/history` | private | Recent transfers | `WalletEvent` | `WalletHistoryResponse` |
| `/private/get/wallet/key` | private | Export the wallet's private key | none | `WalletKeyResponse` |
| `/private/get/wallet/contacts` | private | Wallet addresses of users the owner follows | `WalletContactsEvent` | `WalletContactsResponse` |
| `/private/post/wallet/send` | private | Send funds | `WalletSendEvent` | `WalletSendResponse` |
| `/private/post/wallet/stake` | private | Stake TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/unstake` | private | Start unstaking TRX | `WalletStakeEvent` | `WalletStakeResponse` |
| `/private/post/wallet/withdraw` | private | Withdraw unstaked TRX that became available | none | `WalletStakeResponse` |
| `/public/get/wallet/address` | public | Another node asks where to pay this node's owner; refused when the caller's hourly order limit is reached | `WalletAddressEvent` | `WalletAddressResponse` |

## Sponsored tweets

A sponsored tweet has a price. Other users see a teaser; a buyer pays the author through the wallet and then receives the full content, with media copies made for that buyer.

| Route | Vis | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/sponsored/tweet` | private | Publish a priced tweet as the owner (not a reply) | `NewTweetEvent` with `price` | `domain.Tweet` |
| `/private/get/sponsored/quote` | private | Price, fees and network costs of buying a sponsored tweet | `GetOrderQuoteEvent` | `OrderQuoteResponse` |
| `/private/post/sponsored/order` | private | Buy a sponsored tweet: open the order and pay | `NewOrderEvent` | `OrderResponse` |
| `/public/post/sponsored/order` | public | The buyer's node asks the author's node to verify the payment | `VerifyOrderEvent` | `OrderResponse` |
| `/public/get/sponsored/tweet` | public | The full tweet for a confirmed buyer; the author's own node returns it as stored | `GetTweetEvent` | `domain.Tweet`, or `OrderResponse` while unconfirmed |
| `/public/get/sponsored/image` | public | An image of a bought sponsored tweet | `GetImageEvent` | `GetImageResponse` |
| `/public/get/sponsored/video` | public | A video of a bought sponsored tweet | `GetVideoEvent` | `GetVideoResponse` |
| `/private/get/sponsored/buyer` | private | Match a leaked file against the copies sold, to find which buyer it came from | `GetCopyBuyerEvent` | `CopyBuyerResponse` |

## Routes outside the member node

| Route | Served by | Purpose | Request | Response |
|---|---|---|---|---|
| `/private/post/login` | desktop app, remote node's `/ws` bridge | Log in, derive the identity and start the node. Never sent over libp2p | `LoginEvent` | `domain.AuthNodeInfo` |
| `/private/post/logout` | desktop app, remote node's `/ws` bridge | Log out. Never sent over libp2p | `LogoutEvent` or `{}` | `["logged_out"]` |
| `/private/get/update` | desktop app only | Pending self-update, if any | none | `domain.UpdateInfo` |
| `/private/post/update` | desktop app only | Allow or refuse the pending update | `UpdateEvent` | `Accepted` |
| `/public/post/relay/refuse/reservation` | relay nodes | A node with a reservation asks the relay to stop connecting a peer to it | `RefuseReservationEvent` | `Accepted` |
| `/public/get/moderate/challenge` | moderator nodes | Moderator-to-moderator audit spot check | `audit.Challenge` | `audit.ChallengeResponse` |
| `/public/post/admin/challenge` | nothing | Defined and rate-limited, but no handler is registered | | |

The moderator audit types are in [`cmd/node/moderator/audit/wire.go`](https://github.com/Warp-net/warpnet/blob/main/cmd/node/moderator/audit/wire.go).

## Adding a route

New routes follow the same pattern: a constant in `event/paths.go`, request and response types in `event/event.go`, a handler factory in `core/handler`, registration in the member node, and the mirrors in the clients. See the [developer guide](index.md) for the checklist.

## See also

- [Protocol](../protocol.md): envelopes, signing, errors, limits
- [Stream API](stream-API.md): calling routes over libp2p
- [WebSocket API](ws-API.md): calling routes through the remote node's dashboard bridge
- [Clients](clients.md): how the desktop, browser and mobile clients reach these routes
