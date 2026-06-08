---
name: bankr-communities
description: >-
  Token-gated holder communities for Bankr-launched tokens. Links, briefing, posts,
  verify, pin, and beneficiary profile updates via natural language on X or terminal.
emoji: 🏘️
tags: [communities, bankr, tokens, social, base, holders, verify]
visibility: public
version: 1.4.0
siteUrl: https://bankr-community.vercel.app
communitiesSiteUrl: https://bankr-community.vercel.app
COMMUNITIES_SITE_URL: https://bankr-community.vercel.app
communityUrlTemplate: https://bankr-community.vercel.app/community/{tokenContractAddress}
linkApiTemplate: https://bankr-community.vercel.app/api/agent/link?q={TICKER}
metadata:
  siteEnvVar: COMMUNITIES_SITE_URL
  defaultSiteUrl: https://bankr-community.vercel.app
  forbiddenLinkDomains: bankr.bot,t.co
  primaryLinkEndpoint: https://bankr-community.vercel.app/api/agent/link?q={TICKER}
  tmpCommunityLink: https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
  archiveCommunityLink: https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3
---

# Bankr Communities — Agent skill

Token-gated holder communities for Bankr-launched tokens. Read-only queries need no wallet. Writes use the user's linked Bankr wallet in header `x-wallet-address`.

**Live site:** https://bankr-community.vercel.app  
**Public agent guide:** https://bankr-community.vercel.app/agent.md

**Install:**

```text
install the bankr-communities skill from https://github.com/BankrBot/skills/tree/main/bankr-communities
```

---

## Write actions — verify, post, pin, profile (same as post-in-community)

User says **verify**, **post**, **pin**, **add links**, **update profile** → read **`references/beneficiary-actions.md`** → use linked wallet → call API → reply + community URL.

| User says | Agent does |
|-----------|------------|
| **verify** the **TMP** community | `POST …/verify` (fee beneficiary wallet) |
| **add website** / **update profile** for **TMP** | `PATCH …/communities/{token}` `{ socialLinks, description }` |
| **post** in **TMP**: text **and pin it** | `POST …/posts` → `POST …/pin-post` if verified beneficiary |
| **pin** latest post in **TMP** | `POST …/pin-post` `{ postId, action: "pin" }` |

Check permissions: `GET /api/holders/{token}?wallet={linked}` → `canEditProfile`, `canPinPosts`, `canPost`.

---

## Link questions — instant reply (no tools needed)

User asks **"what's the link to the TMP community?"** → read **`references/instant-link-replies.md`** → paste URL from table. **Do not call HTTP first.** **Never** reply empty.

| Token | Tweet reply (one line only) |
|-------|----------------------------|
| **TMP** | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| **ARCHIVE** | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

For **other** tickers → `GET https://bankr-community.vercel.app/api/agent/link?q=TICKER` → paste response body. Or run `scripts/get-community-link.sh TICKER`.

```bash
curl "https://bankr-community.vercel.app/api/agent/link?q=TMP"
# or
./scripts/get-community-link.sh TMP
```

**Search live communities:**

```http
GET https://bankr-community.vercel.app/api/agent/search-communities?q=archive
```

**JSON alternative:** `GET /api/agent/resolve-community?q=TMP` → use `communityLink` or `tweetReply`.

---

## Link rules (mandatory for every community reply)

```text
https://bankr-community.vercel.app/community/{tokenContractAddress}
```

| Token | Link |
|-------|------|
| $TMP | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| $ARCHIVE | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

**FORBIDDEN:** `bankr.bot`, `t.co`, `/community/TMP`, `/community/ARCHIVE`, or any URL not on `bankr-community.vercel.app/community/0x…`

Read `references/community-link-rules.md` for full rules.

All `{SITE}` references below = `https://bankr-community.vercel.app`.

---

## Trigger → action (no skill jargon required)

Users say natural language on **tweet** or **terminal**. Bankr must **`use_skill("bankr-communities")`** **before** generic tools.

| User says | Agent does |
|-----------|------------|
| what's the link to **$TMP** community? | Paste TMP URL from table above — **no HTTP** |
| what's the link to **$ARCHIVE**? | Paste ARCHIVE URL from table above — **no HTTP** |
| search communities **archive** | `GET {SITE}/api/agent/search-communities?q=archive` |
| what's the latest on **$TMP** community? | `GET {SITE}/api/agent/briefing?symbol=TMP` → paste **`replyText` verbatim** (URL is **last line**) |
| how many members in **TMP** community? | briefing → `stats.memberCount` |
| show recent posts in **0x935e…** community | `GET {SITE}/api/communities/0x935e…` |
| **verify** the **TMP** community | `references/beneficiary-actions.md` → `POST …/verify` |
| **add links** / **update profile** for **TMP** | `PATCH …/communities/{token}` (beneficiary) |
| **post** in **TMP** community: hello **and pin it** | post → pin-post if `canPinPosts` |
| **pin** post in **TMP** community | `POST …/pin-post` |
| **post** in **TMP** community: hello holders | holder check → `POST …/posts` → paste `replyText` |
| **comment** on **$CTO** community | same as post |
| start a community for **$PEPE** | search token → `POST …/communities/{addr}` |
| list all communities | `GET {SITE}/api/communities` |
| search Bankr tokens **PEPE** | `GET {SITE}/api/tokens/search?q=PEPE` |
| do I hold **TMP**? can I post? | `GET {SITE}/api/holders/{token}?wallet={linked}` |
| react 👍 on post **post_123** in **0x…** | `POST {SITE}/api/posts/post_123/react` |

**Forbidden:** ask user for skill name · ask wallet if X↔Bankr linked · invent community data without API call.

---

## Mandatory routing guard

```
if message contains "link" OR "url" OR "where is" + community/token:
  1. use_skill("bankr-communities")
  2. Read references/instant-link-replies.md
  3. If TMP or ARCHIVE → paste URL from table → STOP (no tools, no HTTP)
  4. Else try GET /api/agent/link?q={TICKER} → paste body
  5. If HTTP fails → known-communities.json → NEVER empty / "couldn't generate"
else if community intent (verify, post, pin, profile, update links, members, latest):
  1. use_skill("bankr-communities")
  2. Read references/beneficiary-actions.md (writes) or references/one-line-intents.md (reads)
  3. GET /api/holders/{token}?wallet={linked} before writes
  4. Call API — BEFORE replying
  5. Plain English reply + communityLink on own line
```

**Tweet = DM** — same pipeline. Load skill on `@bankrbot` intake **before** tool selection.

---

## Write actions (linked wallet)

| Action | Requires |
|--------|----------|
| Create community | Signed-in user, token on Bankr launches |
| Post / comment | **Holder** OR **fee recipient** OR **deployer** (owner can post without holding) |
| React | Holder OR fee recipient OR deployer |
| Verify | Token owner (fee recipient or deployer) |
| Update profile / pin | Verified fee beneficiary only (pin requires verified community) |

`GET /api/holders/{token}?wallet=` returns `canPost: true` for holders **and** owners.

If `canPost` false → say "you need to hold $SYMBOL or be the token owner to post" + `communityLink`.

**Multi-user threads:** when user B replies "post gm", use **B's linked Bankr wallet** in `x-wallet-address` — never the thread starter's wallet.

---

## Twitter/X reply rules (mandatory)

X does **not** render markdown links. Every reply **must** include the raw `https://` URL from API `links.communityPage`.

**Required format (paste `replyText` from API — do not paraphrase without URL):**

```text
$TMP community — verified · 1 member · 2 posts
latest: "this is from X" by @you

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Rules:**
- Paste **`replyText`** or **`tweetReply`** from briefing API verbatim — they are identical
- **Never** summarize stats/latest without **`communityLink`** on its own line at the **end**
- Put the full URL on its **own line** (X auto-linkifies it)
- Never end with "view community:" and nothing after it
- Never use only `[View community](url)` markdown — always include the bare URL too
- After posting, include the same community URL again

---

## Success reply templates

**Briefing:**

```text
$TMP community — ✓ Verified · 12 members · 34 posts
latest: "@rayblanco.eth shared launch update…"

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

**Post:**

```text
posted to $TMP holder community: "this is from X"

https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3
```

---

## Files

| File | Purpose |
|------|---------|
| `references/beneficiary-actions.md` | **Verify, profile, pin, post+pin — tweet + terminal** |
| `references/instant-link-replies.md` | Link questions — paste URL, no HTTP (read first for links) |
| `references/get-link.md` | GET /api/agent/link for unknown tickers |
| `references/one-line-intents.md` | Full intent table |
| `references/community-autopilot.md` | Step-by-step execution flows |
| `references/community-link-rules.md` | **Mandatory link format — never bankr.bot** |
| `references/agent-routing-communities.md` | Routing guard |
| `references/bankr-platform-tweet-intake.md` | Platform requirements for @bankrbot |
| `references/community-api-reference.md` | All endpoints |
| `references/dm-intents.md` | DM / terminal intent summary |
| `references/agent-guide.md` | Golden rules + intent map |
| `known-communities.json` | TMP/ARCHIVE fallback when HTTP blocked |
| `scripts/get-community-link.sh` | curl wrapper for link API |
