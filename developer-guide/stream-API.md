# WarpNet Stream API Specification

This document maps protocol routes (stream paths) to their request/response models and semantic roles. 
WarpNet uses libp2p streams as RPC endpoints, each identified by a structured path.

---

## Conventions

* All protocols follow the format:
  `/visibility/action/domain/version`
  Example: `/private/post/tweet/0.0.0`

* `visibility`: `private` (requires auth) or `public`

* `action`: `get`, `post`, `delete`

* `domain`: entity type (e.g., `tweet`, `user`, `chat`)

* `Accepted` response equeals to `{"code":0,"message":"Accepted"}` JSON object.

---

## Admin

| Path                            | Request | Response           | Description                                    |
| ------------------------------- | ------- |--------------------|------------------------------------------------|
| `/public/post/admin/verifynode` | -       | `{"string":"string"}` | Node verification. Returns new consensus state |
| `/private/post/admin/pair`      | -       | `Accepted`           | Pairing front/backend                          |
| `/private/get/admin/stats`      | -       | `warpnet.NodeStats` | Internal status metrics                        |

---

## Timeline / Tweets

| Path                     | Request              | Response             | Description            |
| ------------------------ | -------------------- | -------------------- | ---------------------- |
| `/private/post/tweet`    | `NewTweetEvent`      | `Tweet`              | Create a tweet         |
| `/private/delete/tweet`  | `DeleteTweetEvent`   | `Accepted`           | Delete a tweet         |
| `/private/get/timeline`  | `GetTimelineEvent`   | `TweetsResponse`     | Get timeline           |
| `/public/get/tweet`      | `GetTweetEvent`      | `Tweet`              | Get a single tweet     |
| `/public/get/tweets`     | `GetAllTweetsEvent`  | `TweetsResponse`     | Get all tweets by user |
| `/public/get/tweetstats` | `GetTweetStatsEvent` | `TweetStatsResponse` | Get tweet statistics   |

---

## Users

| Path                 | Request            | Response        | Description        |
| -------------------- | ------------------ | --------------- | ------------------ |
| `/private/post/user` | `NewUserEvent`     | `User`          | Create/update user |
| `/public/get/user`   | `GetUserEvent`     | `User`          | Fetch user info    |
| `/public/get/users`  | `GetAllUsersEvent` | `UsersResponse` | List users         |

---

## Follows

| Path                    | Request             | Response            | Description     |
| ----------------------- | ------------------- | ------------------- | --------------- |
| `/public/post/follow`   | `NewFollowEvent`    | `Accepted`          | Follow a user   |
| `/public/post/unfollow` | `NewUnfollowEvent`  | `Accepted`          | Unfollow a user |
| `/public/get/followees` | `GetFolloweesEvent` | `FolloweesResponse` | Who I follow    |
| `/public/get/followers` | `GetFollowersEvent` | `FollowersResponse` | Who follows me  |

---

## Likes / Retweets

| Path                     | Request           | Response   | Description    |
| ------------------------ | ----------------- | ---------- | -------------- |
| `/public/post/like`      | `LikeEvent`       | `LikesCountResponse` | Like a tweet   |
| `/public/post/unlike`    | `UnlikeEvent`     | `LikesCountResponse` | Unlike a tweet |
| `/public/post/retweet`   | `NewRetweetEvent` | `Tweet` | Retweet        |
| `/public/post/unretweet` | `UnretweetEvent`  | `Tweet` | Remove retweet |

---

## Replies

| Path                   | Request              | Response           | Description        |
| ---------------------- | -------------------- | ------------------ | ------------------ |
| `/public/post/reply`   | `NewReplyEvent`      | `NewReplyResponse` | Create reply       |
| `/public/get/replies`  | `GetAllRepliesEvent` | `RepliesResponse`  | Fetch replies tree |
| `/public/get/reply`    | `GetReplyEvent`      | `Tweet`            | Get single reply   |
| `/public/delete/reply` | `DeleteReplyEvent`   | `Accepted`         | Delete reply       |

---

## Chat & Messaging

| Path                      | Request               | Response               | Description            |
| ------------------------- | --------------------- | ---------------------- | ---------------------- |
| `/public/post/chat`       | `NewChatEvent`        | `ChatCreatedResponse`  | Initiate chat          |
| `/public/post/message`    | `NewMessageEvent`     | `NewMessageResponse`   | Send message           |
| `/private/get/chat`       | `GetChatEvent`        | `GetChatResponse`      | Get chat metadata      |
| `/private/get/chats`      | `GetAllChatsEvent`    | `ChatsResponse`        | List all chats         |
| `/private/get/messages`   | `GetAllMessagesEvent` | `ChatMessagesResponse` | Get messages in chat   |
| `/private/get/message`    | `GetMessageEvent`     | `ChatMessageResponse`  | Get a specific message |
| `/private/delete/message` | `DeleteMessageEvent`  | `Accepted`             | Delete a message       |
| `/private/delete/chat`    | `DeleteChatEvent`     | `Accepted`             | Delete a chat          |

---

## Media

| Path                  | Request            | Response              | Description           |
| --------------------- | ------------------ | --------------------- | --------------------- |
| `/private/post/image` | `UploadImageEvent` | `UploadImageResponse` | Upload user image     |
| `/public/get/image`   | `GetImageEvent`    | `GetImageResponse`    | Retrieve image by key |

---

## Node Info

| Path               | Request | Response           | Description                 |
| ------------------ | ------- | ------------------ | --------------------------- |
| `/public/get/info` | -       | `warpnet.NodeInfo` | Public metadata of the node |
