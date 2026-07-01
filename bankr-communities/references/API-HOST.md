# API host — read before any HTTP call

## ONLY these hosts

| Role | URL |
|------|-----|
| **Space API** | `https://www.bankr.space` |
| **Alias** | `https://bankr.space` (redirects to www) |
| **Bankr profiles (read)** | `https://api.bankr.bot` — public `GET /agent-profiles/…` only |
| **Bankr profiles (write)** | `https://api.bankr.bot/agent/profile` — requires user `X-API-Key: bk_…` |

Preflight: `GET https://www.bankr.space/api/agent/briefing?symbol=TMP` → JSON `{ "ok": true, … }`

## FORBIDDEN assumptions

- **NOT** Twitter/X audio Spaces — "post in $TMP space" = **bankr.space** API
- **NOT** `bankr.bot` for community links in tweets — use `bankr.space/community/{token}`
- Do not guess API paths — use `references/community-api-reference.md`

## Core agent endpoints

```
GET  https://www.bankr.space/api/agent/link?q={TICKER}
GET  https://www.bankr.space/api/agent/briefing?symbol={SYMBOL}
POST https://www.bankr.space/api/agent/start-vote
GET  https://www.bankr.space/api/agent/bankr-project-payload?symbol={SYMBOL}
POST https://www.bankr.space/api/agent/bankr-project-payload?symbol={SYMBOL}
GET  https://www.bankr.space/api/agent/space-from-bankr-project?symbol={SYMBOL}
POST https://www.bankr.space/api/communities/{tokenAddress}/posts
PATCH https://www.bankr.space/api/communities/{tokenAddress}
```

## URL allowlist (links shown to users)

Before displaying **any** URL from an API response (`communityLink`, `linkReply`, `bankrProfileUrl`, `tweetReply`):

Read `known-hosts.json` → `allowedUrlHosts`.

| Type | Rule |
|------|------|
| Space page | Host `www.bankr.space` or `bankr.space`, path `/community/0x…` |
| Agent briefing link | Same host, path `/community/0x…` |
| Bankr project page | Host `bankr.bot`, path `/agents` or `/agents/{slug}` |
| Original tweet | Host `x.com` or `twitter.com`, path `/…/status/…` |
| Tweet images | Host `pbs.twimg.com` only for hotlink profile media |

**Reject** and do not display: `javascript:`, `t.co` shorteners, unknown hosts, or API URLs that fail the allowlist. Use `known-hosts.json` `instantLinks` or `communityUrlTemplate` instead.

See `references/RESPONSE-SAFETY.md`.
