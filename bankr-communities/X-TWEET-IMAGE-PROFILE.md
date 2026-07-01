# X tweet image → Space banner / icon (hotlink, no IPFS)

When a user **replies on X** with an image tweet (or replies to one) and asks @bankrbot to set banner or icon, use the **tweet’s `pbs.twimg.com` URL** — **do not** call `/api/upload/banner` (that pins to IPFS and uses storage).

Pair with **`BENEFICIARY-ACTIONS.md`** (profile PATCH) and **`X-REPLY-POST-CONTENT.md`** (parent tweet resolution).

---

## Golden rule

| Do | Don’t |
|----|--------|
| `PATCH …/communities/{token}` with `tweetBannerFrom` / `tweetIconFrom` or `customBannerUrl` / `customIconUrl` = `https://pbs.twimg.com/…` | `POST`/`PUT /api/upload/banner` for X-sourced images |
| Resolve parent tweet URL when user says **this / that / the photo** | Re-upload the image to Pinata |

Hotlinked Twitter CDN URLs are stored as-is — **saves Space storage**. Bankr project sync (if enabled) can use the same HTTPS URL for `profileImageUrl`.

---

## User phrases (implicit — reply to image tweet)

```text
@bankrbot use this as Space banner
@bankrbot set this as $TMP space banner
@bankrbot make this the Space icon
@bankrbot use this photo for $BNKR banner
@bankrbot banner this on ARCHIVE space
```

**Steps:**

1. Resolve **parent tweet** status URL from X reply context (same as **X-REPLY-POST-CONTENT.md** Mode A).
2. `GET {SITE}/api/oembed/tweet/media?url={parent_status_url}`  
   → `suggested.banner`, `suggested.icon`, full `media[]` list.
3. `GET /api/holders/{token}?wallet={linked}` → `canEditProfile` → else 403 message.
4. **One-shot PATCH** (preferred):

```http
PATCH /api/communities/{tokenAddress}
Header: x-wallet-address: {linked}
Body: { "tweetBannerFrom": "https://x.com/user/status/123" }
```

Or for icon:

```json
{ "tweetIconFrom": "https://x.com/user/status/123" }
```

Multi-image tweet (pick 2nd photo):

```json
{ "tweetBannerFrom": "https://x.com/user/status/123", "tweetImageIndex": 1 }
```

5. Reply: what was set + **bankr.space/community/0x…** URL. Mention image is hotlinked from X (not re-uploaded).

---

## User phrases (explicit pbs URL)

If Bankr exposes `media_url_https` in tweet context, or user pastes CDN URL:

```text
@bankrbot set Space space banner to https://pbs.twimg.com/media/xxxxx.jpg
```

```http
PATCH /api/communities/{tokenAddress}
{ "customBannerUrl": "https://pbs.twimg.com/media/xxxxx.jpg?format=jpg&name=orig" }
```

Optional: `"useDexBanner": false` only if you need Dex fallback hidden — custom URL already wins in display order.

---

## Media lookup API

```http
GET /api/oembed/tweet/media?url=https://x.com/user/status/123
GET /api/oembed/tweet/media?url=…&index=1
```

**Response (200):**

```json
{
  "ok": true,
  "statusId": "123",
  "statusUrl": "https://x.com/user/status/123",
  "media": [{ "url": "https://pbs.twimg.com/media/….jpg", "width": 1500, "height": 500, "type": "photo" }],
  "suggested": {
    "banner": "https://pbs.twimg.com/media/….jpg?format=jpg&name=orig",
    "icon": "https://pbs.twimg.com/media/….jpg?format=jpg&name=large"
  },
  "storageNote": "hotlink"
}
```

**404** — tweet has no photos (video-only → ask user to post a screenshot or paste image URL).

---

## PATCH fields (tweet → profile image)

| Field | Description |
|-------|-------------|
| `tweetBannerFrom` | X status URL → widest ~3:1 photo → `customBannerUrl` |
| `tweetIconFrom` | X status URL → most square photo → `customIconUrl` |
| `tweetImageIndex` | Optional 0-based index when tweet has multiple images |
| `customBannerUrl` / `customIconUrl` | Direct `https://pbs.twimg.com/…` also OK |

Response may include `tweetMediaApplied` with resolved URLs.

---

## Bankr project sync

If fee recipient enabled **Bankr project sync** on the Space, profile PATCH (including tweet banner/icon) triggers server-side sync to [bankr.bot/agents](https://bankr.bot/agents). No extra step for @bankrbot.

---

## Decision tree

```
1. User wants banner/icon from X?
   → YES: load this doc + BENEFICIARY-ACTIONS.md

2. User replied to a tweet with image (this/that/banner this)?
   → parent status URL → GET /api/oembed/tweet/media → PATCH tweetBannerFrom or tweetIconFrom

3. User pasted pbs.twimg.com URL?
   → PATCH customBannerUrl / customIconUrl directly

4. Never use /api/upload/banner for X images unless user explicitly asks to "pin to IPFS"
```

---

## Tweet examples (acceptance)

| User tweet | Expected API |
|------------|----------------|
| Reply to image tweet: `@bankrbot use this as $SPACE banner` | `GET …/oembed/tweet/media?url={parent}` then `PATCH` `{ tweetBannerFrom: parent }` |
| `@bankrbot set Space icon from https://x.com/a/status/999` | `PATCH` `{ tweetIconFrom: "https://x.com/a/status/999" }` |
| `@bankrbot set banner to https://pbs.twimg.com/media/x.jpg` | `PATCH` `{ customBannerUrl: "https://pbs.twimg.com/…" }` |

**Fail:** calling `PUT /api/upload/banner` for tweet-sourced images without user asking for IPFS pin.  
**Fail:** "I can't set images from tweets" — resolve media and PATCH.

See also: **BENEFICIARY-ACTIONS.md**, **X-REPLY-POST-CONTENT.md**, `{SITE}/agent.md`
