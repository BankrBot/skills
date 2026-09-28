# Projects Reference

Create and manage public **project pages** at [bankr.bot/terminal/projects](https://bankr.bot/terminal/projects). A project page showcases project info, team, token data with live charts, weekly fee revenue, products, GitHub activity, Ethos credibility, and activity.

> **The CLI says `project`, the API says `profile`.** The command is `bankr project`, but the REST paths (`/agent/profile`, `/agent-profiles`), the JSON field names and the socket events all use "profile" — nothing you parse says "project".

**Eligibility**: You must have deployed a token through Bankr (Doppler or Clanker) or be a fee beneficiary on the token to create a project page. The token address is verified against your deployment and beneficiary history.

## Project Fields

| Field | Required | Description | Limits |
|-------|----------|-------------|--------|
| **projectName** | Yes | Display name | 1-100 chars |
| **description** | No | Project description | Max 2000 chars |
| **profileImageUrl** | No | Logo/avatar URL (auto-populated from Twitter if linked) | Valid URL |
| **tokenAddress** | Yes | Token contract address — must be a token deployed through Bankr (Doppler or Clanker) | - |
| **tokenChainId** | **Derived** | Set automatically from `tokenAddress` — one of base, ethereum, polygon, solana, robinhood, arbitrum. **Not accepted as input**; sending it has no effect | - |
| **tokenSymbol** | No | Token ticker symbol | Max 20 chars |
| **tokenName** | No | Full token name | Max 100 chars |
| **twitterUsername** | No | Twitter handle (auto-populated from linked account) | Max 50 chars |
| **teamMembers** | No | Array of team members with name, role, and links | Max 20 |
| **products** | No | Array of products with name, description, url | Max 20 |
| **revenueSources** | No | Array of revenue sources with name and description | Max 20 |

## CLI Usage

### View Project

```bash
bankr project              # Pretty-printed view
bankr project --json       # JSON output
```

### Create Project

```bash
# Interactive wizard
bankr project create

# Non-interactive with flags
bankr project create \
  --name "My Agent" \
  --description "AI-powered trading agent on Base" \
  --token 0x1234...abcd \
  --image "https://example.com/logo.png"
```

### Update Project

```bash
bankr project update --description "Updated description"
bankr project update --token 0xNEW...ADDR
```

### Add Project Updates

Project updates appear in a timeline on the profile detail page. Capped at 50 entries (oldest are pruned).

```bash
# Interactive
bankr project add-update

# Non-interactive
bankr project add-update --title "v2 Launch" --content "Shipped new swap engine and portfolio dashboard"
```

### Delete Project

```bash
bankr project delete   # Requires confirmation
```

## REST API Endpoints

All endpoints under `/agent/profile` require API key authentication (`X-API-Key` header) and `agentApiEnabled`.

### One wallet can hold several projects

The endpoints below describe the **single-profile (v2-compat) contract**, which is what you get when you send no `multi` parameter. A wallet can hold more than one project page, and the multi-profile contract is opt-in per request:

| Request | Default (no `multi`) | With `?multi=true` |
|---------|----------------------|--------------------|
| `GET /agent/profile` | Returns one profile object | Returns an **array** of every profile on the wallet |
| `POST /agent/profile` | Refuses a second profile with `409` | Creates an additional profile |

Once a wallet holds more than one, the write endpoints take an optional slug to say which one you mean — `PUT /agent/profile/{slug}`, `DELETE /agent/profile/{slug}` and `POST /agent/profile/{slug}/update`. The slugless forms (`PUT /agent/profile`, `POST /agent/profile/update`) still work and address the single profile. On the CLI this is the `--slug` flag, required once you have more than one project.

`GET /agent/profile/token-eligibility?address=0x…` checks whether a token can be linked to one of the wallet's profiles before you try to save it — same rule as the create/update path (the wallet deployed the token through Bankr, or is one of its fee beneficiaries). Eligibility is partly on-chain, so call this rather than reproducing the rule client-side; the `403` on save is still the final guard.

**The [OpenAPI spec](https://docs.bankr.bot/openapi/api.yaml) is authoritative for these shapes** and documents the slug and `multi` variants in full.

### GET /agent/profile

Returns the authenticated user's profile.

```bash
curl "https://api.bankr.bot/agent/profile" \
  -H "X-API-Key: $BANKR_API_KEY"
```

### POST /agent/profile

Create a new profile. Returns 409 if one already exists.

```json
{
  "projectName": "My Agent",
  "description": "AI trading agent",
  "tokenAddress": "0x1234...abcd",
  "tokenChainId": "base",
  "tokenSymbol": "AGENT",
  "twitterUsername": "myagent",
  "teamMembers": [
    { "name": "Alice", "role": "Lead Dev", "links": [{ "type": "twitter", "url": "https://x.com/alice" }] }
  ],
  "products": [
    { "name": "Swap Engine", "description": "Optimized DEX routing", "url": "https://myagent.com/swap" }
  ],
  "revenueSources": [
    { "name": "Trading fees", "description": "0.3% on each swap" }
  ]
}
```

### PUT /agent/profile

Update specific fields. Only include fields you want to change. Set a field to `null` to clear it.

```json
{
  "description": "Updated description",
  "tokenAddress": null
}
```

### DELETE /agent/profile

Delete the authenticated user's profile. Returns `{ "success": true }`.

### POST /agent/profile/update

Add a project update entry.

```json
{
  "title": "v2 Launch",
  "content": "Shipped swap optimization, portfolio dashboard, and new onboarding flow."
}
```

## Public Endpoints (No Auth Required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agent-profiles` | List approved profiles |
| `GET` | `/agent-profiles/:identifier` | Profile detail by token address or slug |
| `GET` | `/agent-profiles/:identifier/llm-usage` | Public LLM usage statistics |
| `GET` | `/agent-profiles/:identifier/tweets` | Recent tweets from linked Twitter |

### Query Parameters for Listing

| Param | Default | Description |
|-------|---------|-------------|
| `limit` | 20 | Results per page (1-100) |
| `offset` | 0 | Pagination offset |
| `sort` | marketCap | Sort: `marketCap` or `newest` |
| `includeFeatured` | — | `1` also returns every ops-featured profile on the first unfiltered page. That page may then exceed `limit`, so size your buffer off the array you get back rather than off `limit` |

## Approval Workflow

Profiles start with `approved: false` and are not publicly visible. After admin approval, the profile appears in the public listing at `/terminal/projects` and receives automatic market cap and revenue updates from background workers.

## Auto-Populated Fields

- **profileImageUrl**: Auto-populated from linked Twitter profile image if no manual URL is provided
- **twitterUsername**: Auto-populated from linked Twitter social account
- **marketCapUsd**: Updated every 5 minutes by background worker (via CoinGecko)
- **weeklyRevenueWeth**: Updated every 30 minutes by background worker (from Doppler fee data)

## LLM Usage Stats

`GET /agent-profiles/:identifier/llm-usage` returns public LLM usage statistics for an approved profile. Cached for 5 minutes.

Query parameters:
- `days` (default: 30, range: 1-90) — lookback period

Response includes:
- `totals` — totalRequests, totalTokens, totalInputTokens, totalOutputTokens, successRate (0-100), avgLatencyMs
- `byModel` — per-model breakdown with requests, totalTokens, successRate, avgLatencyMs
- `daily` — array of `{ date, requests, totalTokens }` entries for charting (gaps filled with zeros)

No cost data is included (public-safe).

## Derived Cards (GitHub, Ethos)

Two cards on the project page are derived from links already on the profile — there is nothing extra to configure, and no dedicated field to set. Both are approved-profiles-only, cached, and rate-limited per IP.

### GitHub Activity

`GET /agent-profiles/:identifier/github-activity` returns the linked repository's activity. The repo is resolved from the **first** `github.com/{owner}/{repo}` URL found across the profile's `website`, then product URLs, then team-member links — so if you want a specific repo on the card, put it in `website`.

```json
{
  "activity": {
    "repo": { "owner": "myorg", "name": "myagent", "fullName": "myorg/myagent", "url": "https://github.com/myorg/myagent", "verified": true },
    "stats": {
      "commits": 1840,
      "pullRequests": 212,
      "releases": 18,
      "lastPushAt": "2026-03-02T18:30:00.000Z",
      "weekly": [{ "weekStart": "2025-03-09", "commits": 24 }]
    }
  }
}
```

- `activity` is `null` when the profile links no GitHub repo at all.
- `stats` is `null` when GitHub was unreachable or rate-limited — **the repo link still resolves**, so don't read a null `stats` as "no repo".
- `commits` covers the last 52 weeks; `pullRequests` / `releases` cover the last 12 months. Each is individually `null` if GitHub hadn't finished computing it.
- `repo.verified` means the profile owner's linked GitHub account owns or maintains that repo.
- `weekly` holds up to 52 buckets, oldest first.

### Ethos Credibility

`GET /agent-profiles/:identifier/ethos` returns [Ethos](https://ethos.network) credibility cards for the X accounts on the profile: the project's own linked X account first, then up to five team members whose links include an X profile, deduped on the Ethos username.

```json
{
  "cards": [
    {
      "source": "project",
      "role": "Founder",
      "ethos": {
        "username": "myagent",
        "score": 1640,
        "level": "reputable",
        "profileUrl": "https://app.ethos.network/profile/x/myagent",
        "reviews": { "positive": 38, "neutral": 4, "negative": 1, "positivePercent": 88, "items": [] },
        "vouches": { "count": 6, "eth": "1.4" }
      }
    }
  ]
}
```

- `source` is `project` for the profile's own X account, `team` for a team member's; `role` falls back to `Founder` on the project card.
- **Accounts without an Ethos profile are omitted entirely, so `cards` can be empty** — that is not an error.
- `reviews.positivePercent` is `null` until the account has at least one review; `reviews.items` holds at most three, newest first.

## Tweets

`GET /agent-profiles/:identifier/tweets` returns up to 10 recent original tweets (excludes replies/retweets) from the profile's linked Twitter account. Cached for 10 minutes.

Response: `{ tweets: [{ id, text, createdAt, metrics: { likes, retweets, replies }, url }] }`

Returns empty array if no Twitter account is linked or if fetch fails.

## Real-Time Updates

The `/agent-profiles` WebSocket namespace provides live updates:
- `AGENT_PROFILE_UPDATE` — profile listing changes (market cap, revenue updates)
- `AGENT_PROFILE_DETAIL_UPDATE` — detail page changes (subscribe to a specific profile via `socket.emit("subscribe", slug)`)
