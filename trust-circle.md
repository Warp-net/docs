---
title: Trust Circle
description: How your node works out which people you know, directly or through friends, and blurs media from everyone else until you choose to see it.
---

# Trust Circle

Your trust circle is the set of people your node considers familiar: the people you follow, and the people your mutual follows vouch for. Clients use it to hold back media from strangers and to sort unfamiliar notifications, chats and replies apart. Nothing outside the circle is hidden, refused or reported; it only changes how content is shown on your own screens. This page explains what you see, how the circle is computed, how it relates to the [node rating](rating.md), and what is still missing.

> **Note:** the trust circle is in the development branch and not yet part of a tagged release. The desktop app has the full feature, Android has the media blur, iOS has nothing yet. See [Status](#status).
{: .note }

## Why it exists

| Problem | Without a circle | With a circle |
|---|---|---|
| Identity is free | A brand-new account looks the same as an old friend | A new account is a stranger until a real person you know follows it back |
| Shock media from strangers | Shown in full everywhere | Blurred until you tap, and not even downloaded until then |
| Too much noise from strangers | Mixed into notifications and chats | Kept in separate "Unfamiliar" and "Message requests" sections |

The idea is a web of trust built from follows of follows, as in some other networks, with two differences: your own node computes it, not a relay or a score provider, and it only ever changes how content is shown, never whether it is carried.

## What you see

In the desktop app:

| Where | What changes for people outside your circle |
|---|---|
| Posts | Images and videos are replaced by a "Media from an unfamiliar author" placeholder with a Show button. Text is never touched. The media is not downloaded until you tap |
| Notifications | Follows, reactions, retweets, replies, mentions and messages from unfamiliar people go to an "Unfamiliar" tab with its own unread count. Moderation and sales notifications always stay in the main list |
| Sidebar badges | Unread items from unfamiliar people do not light the notification or message badge (only the first page of notifications is checked) |
| Messages | Chats with unfamiliar people sit under "Message requests". Replying or sending a message in one moves it to your chats |
| Your own threads | Replies from unfamiliar people are folded into "Show N replies from unfamiliar people" |
| Profiles | Members of your circle get a medal next to their handle |
| Search, Who to follow | People in your circle are listed first within each page |

"Unfamiliar" means outside the circle **and** not someone whose chat you accepted. If the node cannot answer whether someone is in the circle, the app treats them as familiar, so a failure never hides anything.

To turn the media blur off, enable **Settings → Preferences → Show media from unfamiliar authors**. The setting is stored on that device only, not in your public profile.

On Android, media in timeline pages from authors outside the circle is marked sensitive, so the app's usual sensitive-media blur covers it. See [Mobile apps](user-guide/mobile.md).

## How the circle is built

Everything is computed on your node from your own follow list and the lists your mutual follows publish. No list is shared, stored or replicated.

### Edges

| Edge | Where it comes from | How far it is trusted |
|---|---|---|
| You follow X | Your node's own follow list | Fully: your own action |
| X follows you | Your node's own follower list, written only after X's node proved it was acting for X | Fully: first-hand and authenticated |
| Your mutual M follows Y and Y follows M back | M's node, asked for M's mutual follows | As far as you trust M: M vouches for its own list |

Nothing is ever asked of a stranger's node, so a stranger cannot talk its way in by claiming to follow your friends.

### Score

```text
M        = your mutuals (you follow them and they follow you)
mut(m)   = m's own mutuals, as m's node lists them

score(A) = 1                                          if A is you, or you follow A
         = min(1, sum over m in M with A in mut(m) of 1 / |mut(m)|)   otherwise

A is in the circle  if  score(A) >= 0.02
```

- **Trust splits by size.** A mutual with 8 mutuals gives each of them 1/8; one who follows back 3,000 accounts gives each 1/3,000. Following back everyone is not a free entrance.
- **Only mutuals vouch.** Followers who are not your mutuals contribute nothing, so bought or fake followers do not raise anyone's score.
- **The threshold is provisional.** 0.02 means one vouching mutual with at most 50 mutuals, or several bigger ones. It is meant to be set from measurements on the main network.
- **Bridged accounts** (for example from Mastodon) are never expanded, because their lists come from the gateway, not from the person. They are in the circle only if you follow them directly.

The node also counts how many mutuals vouched for a person (`vouchers`); clients receive the count, never the names.

### Keeping it fresh

From [`core/trust/circle.go`](https://github.com/Warp-net/warpnet/blob/develop/core/trust/circle.go):

| What | When |
|---|---|
| Your own follows and followers | Read live on every question, so a follow or unfollow counts at once. A voucher who stops being a mutual stops counting at once too |
| Full rebuild of the second hop | About 1 minute after the node starts, then every 6 hours plus up to 1 hour of random delay |
| Lists of new mutuals | Every 5 minutes, for mutuals that have no list yet, so a new mutual vouches within minutes |
| Pacing | 2 seconds between mutuals, so a refresh is a trickle, not a burst |

- Each mutual's node is asked for its owner's followings with `is_mutual_only` set, 1,000 per page. That node filters its followings against its followers itself and returns only those that follow back.
- Past 2,000 mutuals, reading stops and that mutual's list is not kept: at less than 1/2,000 per person it could not lift anyone over the threshold alone. This bounds memory to about 2,000 IDs per mutual.
- A node too old to understand `is_mutual_only` (it does not echo the flag) vouches for nobody until it updates.
- If a mutual's node is offline, its previous list is kept until the next refresh. After a restart, the circle is empty beyond your direct follows until the mutuals are reached again.
- The circle lives in memory only: there is no database prefix and no CRDT for it.

## Wire surface

One private route, batched, because clients render a page of posts at a time. It is answered from memory and never contacts another node while answering.

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

The second hop uses the existing `PUBLIC_GET_FOLLOWINGS` route with `"is_mutual_only": true`; a node honours it only for its own owner's followings and echoes the flag back. Trust depends on who is asking, so it is deliberately not a field on stored posts or profiles. Handler: [`core/handler/trust.go`](https://github.com/Warp-net/warpnet/blob/develop/core/handler/trust.go).

The desktop client groups questions asked within the same moment into one request and caches answers for 5 minutes ([`frontend/src/service/service.js`](https://github.com/Warp-net/warpnet/blob/develop/frontend/src/service/service.js)). Android sends one request per timeline page for the authors whose posts have media ([`WarpnetRepository.kt`](https://github.com/Warp-net/warpnet/blob/develop/warpdroid/app/src/main/java/site/warpnet/warpdroid/warpnet/WarpnetRepository.kt)).

## Relation to the rating

The two answer different questions and start from opposite ends:

| | Node rating | Trust circle |
|---|---|---|
| Starts at | Full trust for everyone | Zero for strangers |
| Moves on | Evidence of misbehaviour | Vouching through follows |
| Judges | Nodes | Users |
| Shared | Signed records replicated by CRDT | Not shared; each node computes its own |
| Affects | Priority, rate limits, gossip, DHT | Only how clients display content |

**The circle never feeds the rating.** Being outside someone's circle is not an offence. The rating starts newcomers at full trust by design, and every rating dimension reaches transport-level enforcement; turning "has no friends" into a penalty would throttle every newcomer.

**The rating may feed the circle later.** A planned change is to reduce the weight of a vouching mutual whose node your node rates degraded or floor. This is not implemented: today the circle does not read the rating at all.

## Limits

- **A mutual who vouches for fake accounts** lets that group in. Dividing trust by list size limits the damage; nothing else stops it yet.
- **Small networks** mean small circles and a lot of blurred media. The preference to show all media exists for that.
- **Lying lists.** A mutual can list anyone as its mutual. Its weight is still 1/(its list size), so lying buys nothing honest vouching would not.
- **Text** is never affected, by design.
- **Private profiles.** If a user's lists ever become private, that user drops out of other people's second hop.

## Status

| Part | State |
|---|---|
| Circle computation, refresh loop, member node wiring | Done (development branch) |
| `/private/get/trust/0.0.0` route and mutual-only followings | Done |
| Desktop app: media blur, preference, Unfamiliar tab, badges, message requests, folded replies, medal, circle-first ordering | Done |
| Android: media in timeline pages marked sensitive | Done; posts opened on their own, outside a timeline page, are not marked. Not yet confirmed whether the image is downloaded before it is revealed |
| Android: notifications, chats, replies, ordering | Not started |
| iOS: any of it | Not started; the route ID is generated but unused |
| Rating-based discount of vouchers | Planned |
| Threshold from main-network measurements | Planned |
| Witness reports and penalties for people who keep vouching for offenders | Later steps, built on top of the circle |

The design document is [`docs/TRUST_CIRCLE.md`](https://github.com/Warp-net/warpnet/blob/develop/docs/TRUST_CIRCLE.md).

## See also

- [Node rating](rating.md)
- [Moderation](moderation.md)
- [Mobile apps](user-guide/mobile.md)
- [Getting started](user-guide/index.md)
- [Bridges](bridge.md)
