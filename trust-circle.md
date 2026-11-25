---
title: Trust Circle
description: How your node works out which people you know, directly or through friends, and blurs media from everyone else until you choose to see it.
---

# Trust Circle

Your trust circle is the set of people your node considers familiar: the people you follow, and the people your mutual follows vouch for. Clients use it to hold back media from strangers and to keep notifications, chats and replies from unfamiliar people apart. Nothing is refused, deleted or reported because of it; it only changes how content is shown on your own screens. This page explains what you see, how the circle is computed and how it relates to the [node rating](rating.md).

## Why it exists

| Problem | Without a circle | With a circle |
|---|---|---|
| Identity is free | A brand-new account looks the same as an old friend | A new account is a stranger until someone you follow mutually vouches for it |
| Shock media from strangers | Shown in full everywhere | Blurred until you tap, and not even downloaded until then |
| Noise from strangers | Mixed into notifications, chats and replies | Kept in separate "Unfamiliar", "Message requests" and folded-reply sections |

Your own node computes the circle from follow lists. No relay or score provider is involved, and the circle never decides whether content is carried, only how it is shown.

## What you see

In the desktop app and the remote node's browser dashboard:

| Where | What changes for people outside your circle |
|---|---|
| Posts | Images and videos are replaced by a "Media from an unfamiliar author" placeholder with a Show button. Text is never touched. The media is not downloaded until you tap |
| Notifications | Follows, reactions, retweets, replies, mentions and messages from unfamiliar people go to an "Unfamiliar" tab with its own unread count. Other notifications, such as moderation results, stay in the main list |
| Sidebar badges | Unread items from unfamiliar people do not light the notification or message badge (only the first page of notifications is checked) |
| Messages | Chats with unfamiliar people sit under "Message requests". Replying or sending a message in one moves it to your chats |
| Your own threads | Replies from unfamiliar people are folded into "Show N replies from unfamiliar people" |
| Profiles | A profile of someone in your circle shows a medal next to the handle |
| Search, Who to follow | People in your circle are listed first within each page |

For notifications, chats and replies, "unfamiliar" means outside the circle **and** not someone whose chat you accepted by writing in it. The media blur depends on the circle alone. If the node cannot answer whether someone is in the circle, the app treats them as familiar, so a failure never hides anything.

To turn the media blur off, enable **Settings → Preferences → Show media from unfamiliar authors**. The setting is stored in that app or browser only, not in your public profile.

The Android app marks media from authors outside the circle as sensitive on timeline pages (your Home timeline, a user's posts, replies), so the app's usual sensitive-media blur covers it. See [Mobile apps](user-guide/mobile.md).

## How the circle is built

Everything is computed on your node from your own follow lists and from the mutual-follow lists of your mutuals. Nothing about the circle is stored, shared or replicated. Code: [`core/trust/circle.go`](https://github.com/Warp-net/warpnet/blob/develop/core/trust/circle.go).

- **Mutuals** are the people you follow who also follow you, according to your node's own follow and follower lists. Your node records a follower only after that follower's node proved it was acting for them.
- For each mutual M, your node asks M's node for M's own mutuals. Only M's node is asked about M; a stranger's node is never asked anything, so a stranger cannot talk its way in by claiming to follow your friends.

### Score

```text
M        = your mutuals (you follow them and they follow you)
mut(m)   = m's own mutuals, as m's node lists them
|mut(m)| = how many mutuals m's node listed

score(A) = 1                                               if A is you, or you follow A
         = min(1, sum over m in M with A in mut(m) of 1 / |mut(m)|)   otherwise

A is in the circle  if  score(A) >= 0.02
```

- **Trust splits by size.** A mutual with 8 mutuals gives each of them 1/8; one with 3,000 mutuals gives each 1/3,000. Following back everyone is not a free entrance.
- **Only mutuals vouch.** People who follow you without being followed back contribute nothing and are not in the circle themselves unless someone vouches for them, so bought or fake followers do not raise anyone's score.
- **Threshold.** 0.02 means one vouching mutual with at most 50 mutuals, or several bigger ones.
- **Bridged accounts** (for example from Mastodon) never vouch, because their lists come from the gateway, not from the person, and nobody vouches for them. They are in the circle only if you follow them directly.

The node also counts how many mutuals vouched for a person (`vouchers`); clients receive the count, never the names.

### Keeping it fresh

| What | When |
|---|---|
| Your own follows and followers | Read live on every question, so a follow or unfollow counts at once. A voucher who stops being a mutual stops counting at once too |
| Full rebuild of the second hop | 1 minute after the node starts, then every 6 hours plus up to 1 hour of random delay |
| Lists of new mutuals | Every 5 minutes, for mutuals that have no list yet, so a new mutual vouches within minutes |
| Pacing | 2 seconds between mutuals, so a refresh is a trickle, not a burst |

- Each mutual's node is asked for its owner's followings with `is_mutual_only` set, 1,000 per page. That node filters its owner's followings against its followers itself and returns only those that follow back.
- A mutual with more than 2,000 mutuals vouches for nobody: at less than 1/2,000 per person it could not lift anyone over the threshold alone. Reading stops there, which bounds memory to about 2,000 IDs per mutual.
- If a mutual's node cannot be reached, its previous list is kept until the next refresh.
- The circle lives in memory only. After a restart it holds only your direct follows until the mutuals' nodes are reached again.

## Wire surface

One private route, batched, because clients render a page of posts at a time. It is answered from memory and never contacts another node while answering ([`core/handler/trust.go`](https://github.com/Warp-net/warpnet/blob/develop/core/handler/trust.go)).

| Route | Request | Limit |
|---|---|---|
| `/private/get/trust/0.0.0` | `{"user_ids": ["...", "..."]}` | 100 IDs per request |

```json
{
  "users": {
    "01JD...A": {"is_trusted": true,  "score": 1,     "vouchers": 0},
    "01JD...B": {"is_trusted": true,  "score": 0.125, "vouchers": 1},
    "01JD...C": {"is_trusted": false, "score": 0,     "vouchers": 0}
  }
}
```

The second hop uses the `/public/get/followings/0.0.0` route with `"is_mutual_only": true`; a node honours the flag only for its own owner's followings and sets it in the answer. Trust depends on who is asking, so it is not a field on stored posts or profiles.

The desktop app collects the questions asked within about 20 ms (up to 100 IDs) into one request and caches answers for 5 minutes. The Android app sends one request per timeline page, for up to 100 authors whose posts carry media.

## Relation to the rating

The two answer different questions and start from opposite ends:

| | Node rating | Trust circle |
|---|---|---|
| Starts at | Full trust for everyone | Zero for strangers |
| Moves on | Evidence of misbehaviour | Vouching through follows |
| Judges | Nodes | Users |
| Shared | Signed records replicated by CRDT | Not shared; each node computes its own |
| Affects | Connection priority, rate limits, gossip, DHT, media from floor peers | Only how clients display content |

The circle never feeds the rating, and the rating does not feed the circle. Being outside someone's circle is not an offence: the rating starts newcomers at full trust, and turning "has no friends" into a penalty would throttle every newcomer.

## Limits

- **A mutual who vouches for fake accounts** lets that group in. Dividing trust by list size limits the damage.
- **Lying lists.** A mutual can list anyone as its mutual. Its weight is still 1/(its list size), so lying buys nothing honest vouching would not.
- **Small networks** mean small circles and a lot of blurred media. The preference to show all media exists for that.
- **Text** is never affected.

## Clients

| Client | What uses the circle |
|---|---|
| Desktop app and browser dashboard | Media blur and preference, Unfamiliar tab, badges, message requests, folded replies, medal, circle-first ordering |
| Android | Media from authors outside the circle marked sensitive on timeline pages |
| iOS | Nothing |

## See also

- [Node rating](rating.md)
- [Moderation](moderation.md)
- [Mobile apps](user-guide/mobile.md)
- [Getting started](user-guide/index.md)
- [Bridges](bridge.md)
