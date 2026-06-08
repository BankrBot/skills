# Community link rules — MANDATORY for every Bankr reply

## The only valid community URL format

```text
https://bankr-community.vercel.app/community/{tokenContractAddress}
```

Replace `{tokenContractAddress}` with the token's **on-chain contract address** (0x + 40 hex chars).

**Never use the ticker/symbol in the path.** Wrong: `/community/TMP` or `/community/ARCHIVE`.

---

## Examples (copy exactly)

| Token | Contract | Community link |
|-------|----------|----------------|
| $TMP | `0x935e13a28849095db45e63040f109c34b757aba3` | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

---

## How to get the link (always call API — never guess)

```http
GET https://bankr-community.vercel.app/api/agent/link?q=TMP
GET https://bankr-community.vercel.app/api/agent/link?q=ARCHIVE
```

Response is **plain text** — paste the entire body as the tweet reply (same as terminal curl).

JSON alternative:

```http
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=ARCHIVE
```

Use the `communityLink` field from JSON if needed.

For "what's the link?" → tweet reply = **only** `communityLink`, nothing else.

For TMP/ARCHIVE on tweet intake, use **`references/instant-link-replies.md`** (no HTTP required).

---

## FORBIDDEN links (never share these for communities)

- `https://bankr.bot` or `bankr.bot`
- `https://t.co/...` (Bankr homepage shortlinks)
- `/community/$TICKER` (symbol in path)
- Any URL not starting with `https://bankr-community.vercel.app/community/0x`

Communities live on **bankr-community.vercel.app**, not bankr.bot.

---

## Reply templates

**Link only:**
```text
https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
```

**Briefing + link:**
```text
$ARCHIVE community — unverified · 1 member · 2 posts
https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
latest: "archive the place..." by @Rayblancoeth
```

**Post confirmation:**
```text
posted to $ARCHIVE holder community: "gm"
https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
```
