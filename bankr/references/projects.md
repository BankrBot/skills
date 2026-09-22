# Projects Reference

Project pages at [bankr.bot/terminal/projects](https://bankr.bot/terminal/projects) showcase a project: its description, team, token data with a live chart and market cap, weekly fee revenue, products, update timeline, GitHub activity, Ethos credibility and recent X posts. Docs: [docs.bankr.bot/projects/overview](https://docs.bankr.bot/projects/overview).

> **The CLI says `project`, the API says `profile`.** The command is `bankr project`, but the REST paths (`/agent/profile`, `/agent-profiles`), the JSON field names and the socket events all use "profile".

## Creating a Project

Only `projectName` is required, and a wallet can hold several projects.

- **Linking a token is optional.** To link one, the wallet must have launched it through Bankr or be one of its fee beneficiaries (Bankr's own fee wallets never qualify). An ineligible token is refused with `403`. Check first with `GET /agent/profile/token-eligibility?address=0x…`, which answers `200` with `eligible: false` rather than an error, because part of the check is on-chain.
- **Derived fields aren't accepted as input:** `tokenChainId` (one of base, ethereum, polygon, solana, robinhood, arbitrum) and `tokenSymbol` come from the token, `tokenName` too unless you set it, and `twitterUsername` comes from the wallet's linked X account. That X account also supplies `profileImageUrl` when you don't send one.
- **Everything else is optional:** `description` (up to 2,000 characters), `website`, `profileImageUrl`, `teamMembers` (up to 20, each with up to 10 links), `products` and `revenueSources` (up to 20 each), `projectImages` (up to 3 URLs), `tags` (up to 10) and `isPublished`. The [OpenAPI spec](https://docs.bankr.bot/openapi/api.yaml) has every field and limit.

## Review and Visibility

A new project is a **draft** (`isPublished: false`) that only its owner can see. Publishing it (`isPublished: true`, or the Publish toggle in the web form) submits it for review, and Bankr approves projects for the public listing. An unpublished project can't be approved. The owner's view of a project carries `reviewStatus`: `draft`, `pending`, `approved` or `declined`. A declined project stays unlisted; the owner has to contact the Bankr team for another review.

Approved projects appear in the listing and get their market cap refreshed every 5 minutes and their weekly fee revenue every 30 minutes.

## CLI

```bash
bankr project [--json]                               # view your projects
bankr project create                                 # interactive
bankr project create --name "My Agent" --description "AI trading agent" \
  --token 0x1234...abcd --image https://example.com/logo.png --website https://myagent.xyz
bankr project update --description "Updated description"   # also --name, --token, --image, --website
bankr project add-update --title "v2 Launch" --content "Shipped a new swap engine"
bankr project delete                                 # asks for confirmation
```

- With more than one project, `update`, `add-update` and `delete` ask which one. Pass `--slug <slug>` when running non-interactively.
- The CLI can't publish a project or set team members, products, revenue sources, tags or images. Use the web form or the REST API for those, so a project created from the CLI stays a draft until then.
- **Updates** form a timeline on the project page. Each has a title (up to 200 characters) and content (up to 5,000), and only the newest 50 are kept.

## REST API

`/agent/profile` needs an API key (`X-API-Key`) with Agent API access. These routes follow the single-profile contract unless you pass `multi=true`:

| Request | Without `multi` | With `?multi=true` |
|---------|-----------------|--------------------|
| `GET /agent/profile` | The most recently created profile, or `404` if the wallet has none | An array of the wallet's profiles (up to 50, newest first) |
| `POST /agent/profile` | `409` if the wallet already has one | Creates another profile |

Once a wallet holds more than one, writes take the project's slug: `PUT /agent/profile/{slug}` (send only the fields to change; `null` unlinks the token or clears the website, image or token name), `DELETE /agent/profile/{slug}` and `POST /agent/profile/{slug}/update` (a timeline entry). The slugless forms address the wallet's most recently created profile. Request and response shapes are in the [OpenAPI spec](https://docs.bankr.bot/openapi/api.yaml).

```bash
curl -X POST "https://api.bankr.bot/agent/profile?multi=true" \
  -H "X-API-Key: $BANKR_API_KEY" -H "Content-Type: application/json" \
  -d '{"projectName": "My Agent", "tokenAddress": "0x...", "isPublished": true}'
```

## Public Endpoints (No Auth)

| Method | Path | Returns |
|--------|------|---------|
| `GET` | `/agent-profiles` | Approved projects. Query: `limit` (1-100, default 20), `offset`, `sort` (`marketCap` or `newest`), `q` (matches name, token symbol and tags), and `includeFeatured=1`, which adds every featured project to the first unfiltered page, so that page can run past `limit` |
| `GET` | `/agent-profiles/{identifier}` | Detail by token address or slug. An unapproved project is shown only to its owner's API key |
| `GET` | `/agent-profiles/{identifier}/market-cap` | Live market cap |
| `GET` | `/agent-profiles/{identifier}/llm-usage` | LLM gateway usage over `days` (1-90, default 30): `totals`, `byModel`, `daily`. No cost data. Cached 5 minutes |
| `GET` | `/agent-profiles/{identifier}/x402-revenue` | Revenue and request totals of the wallet's live x402 endpoints |
| `GET` | `/agent-profiles/{identifier}/skills` | Public skills the wallet has published |
| `GET` | `/agent-profiles/{identifier}/github-activity` | Activity of the linked GitHub repo (below) |
| `GET` | `/agent-profiles/{identifier}/ethos` | Ethos credibility cards (below) |
| `GET` | `/agent-profiles/{identifier}/tweets` | Up to 10 recent original posts (no replies or reposts) from the linked X account, cached for 2 hours. Empty when no account is linked or the fetch fails |

Field-level response shapes: [REST API reference](https://docs.bankr.bot/projects/rest-api).

### Derived cards

Both cards come from links the project already has; there is nothing extra to configure. They are served for approved projects only, cached, and rate-limited per IP.

- **GitHub activity** uses the first `github.com/{owner}/{repo}` URL found in `website`, then the product URLs, then team-member links, so put the repo you want in `website`. `activity` is `null` when no repo is linked. `stats` is `null` when GitHub was unreachable or rate-limited, and the repo link still resolves, so a null `stats` doesn't mean "no repo". `commits` covers the last 52 weeks and `pullRequests` / `releases` the last 12 months; each can be `null` while GitHub is still computing it. `repo.verified` means the owner's linked GitHub account owns or maintains the repo, and `weekly` holds up to 52 buckets, oldest first.
- **Ethos** returns a card for the project's linked X account first, then for up to five team members whose links include an X profile, deduplicated by Ethos username. Accounts without an Ethos profile are left out, so an empty `cards` array isn't an error. `reviews.positivePercent` is `null` until there is at least one review, and `reviews.items` holds at most three, newest first.

## Real-Time Updates

The `/agent-profiles` Socket.IO namespace on `api.bankr.bot` pushes changes to approved projects:

- `AGENT_PROFILE_UPDATE` carries listing changes such as market cap and revenue.
- `AGENT_PROFILE_DETAIL_UPDATE` carries detail-page changes. Subscribe with `socket.emit("subscribe", key)`, where `key` is the project's **token address**, or its slug if it has no token. Leave with `unsubscribe`.
