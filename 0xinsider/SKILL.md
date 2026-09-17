---
name: 0xinsider
description: Read Polymarket sports and esports analytics from 0xinsider over its REST API or remote MCP server. Wallet grades S to F on settled P&L, large trades with the grade of the wallet behind each one, graded-wallet flow across a market's outcomes, market search, published research, report snapshots, and the daily pick. Use when asked how good a Polymarket wallet is, who placed the largest trades on a game, which side graded wallets hold, to find a Polymarket market, or to try 0xinsider endpoints with no account. Read-only; it never trades, signs, or moves funds.
license: MIT
metadata:
  homepage: https://0xinsider.com/developers
  docs: https://docs.0xinsider.com
  openapi: https://0xinsider.com/api/v1/openapi.json
  source: https://github.com/0xinsider/agent-plugin
---

# 0xinsider

0xinsider is Polymarket analytics for sports and esports in real-time. This
skill reads its data. It is read-only: no call places a trade, signs a message,
or touches a wallet, so it sits beside an execution skill as the research step
rather than replacing it.

The detail for each area is in `references/`:

- `references/large-trades.md` - the large-trade feed, history replay, counterparties, the significance score
- `references/wallet-grades.md` - grades, settled P&L and its trust metadata, leaderboards, position timelines, exports
- `references/market-flow.md` - graded-wallet flow, market intel, the sign convention, Insider Radar flags
- `references/market-research.md` - market search, published research, report snapshots, the daily pick

## Pick a host

| Host | Credential | Data |
| --- | --- | --- |
| `https://0xinsider.com/sandbox` | none | Documented example responses. Nothing is stored. |
| `https://api.0xinsider.com` | live API key or OAuth token | Live Polymarket data |

Start in the sandbox. Every documented operation answers there with no
credential, so a request can be shaped and its response schema checked before
live quota is spent:

```bash
curl -s https://0xinsider.com/sandbox/api/v1/leaderboard
```

Add `?sandbox_status=<code>` to receive one of the error responses that
operation documents, which exercises a retry path:

```bash
curl -si 'https://0xinsider.com/sandbox/api/v1/leaderboard?sandbox_status=429'
```

## Credentials

One POST returns a sandbox key and the steps to live access, with no account:

```bash
curl -s -X POST https://api.0xinsider.com/api/v1/agents/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"my-agent"}'
```

The key is prefixed `oxi_sk_test_` and works against the sandbox. Sent to
`api.0xinsider.com` it returns `401 invalid_api_key` with `error.reason` set to
`sandbox_api_key`; that is the expected response.

Live keys are prefixed `oxi_sk_live_` and need an active Pro subscription.
Read the key from the environment at call time and never write it into a file:

```bash
curl -s https://api.0xinsider.com/api/v1/leaderboard \
  -H "Authorization: Bearer $OXINSIDER_API_KEY"
```

A `401` carries a `WWW-Authenticate` header naming the RFC 9728
`resource_metadata` URL. A `403 insufficient_scope` names the scope an OAuth
token lacks. Read the header rather than guessing.

## MCP

Remote Streamable HTTP endpoint: `https://api.0xinsider.com/api/v1/mcp`.
`initialize`, `ping` and `tools/list` need no credential; `tools/call` takes
`Authorization: Bearer` with an API key or an OAuth 2.1 access token. The
server card is at `https://0xinsider.com/.well-known/mcp`.

```json
{
  "mcpServers": {
    "0xinsider": {
      "type": "http",
      "url": "https://api.0xinsider.com/api/v1/mcp",
      "headers": { "Authorization": "Bearer ${OXINSIDER_API_KEY}" }
    }
  }
}
```

## Route the question

| Question | REST | MCP tool |
| --- | --- | --- |
| How good is this wallet? | `GET /api/v1/trader/{address}` | `get_trader` |
| Grade many wallets at once | `POST /api/v1/traders/batch` | `batch_get_traders` |
| Top graded wallets | `GET /api/v1/leaderboard` | `get_leaderboard` |
| Wallets rising now | `GET /api/v1/leaderboard/trending` | `get_trending_wallets` |
| A wallet's P&L series | `GET /api/v1/trader/{address}/pnl` | `get_trader_pnl` |
| Largest recent trades | `GET /api/v1/whale-trades` | `get_whale_trades` |
| Large trades before a market settled | `GET /api/v1/whale-trades/history` | `get_whale_trades_history` |
| Large open positions | `GET /api/v1/large-positions` | `get_large_positions` |
| Find a market's `condition_id` | `GET /api/v1/markets/search` | `search_markets` |
| Which side graded wallets are on | `GET /api/v1/market/{condition_id}/intel` | `get_market_intel` |
| Ranked sharp-money flow | `GET /api/v1/markets/sharp-money-flows` | `get_sharp_money_flows` |
| Activity flagged for review | `GET /api/v1/insider-radar` | `get_insider_radar` |
| Published research on a topic | `GET /api/v1/content/search` | `search_content` |
| Today's pick | `GET /api/v1/pick-of-the-day` | `get_pick_of_the_day` |
| What is covered | `GET /api/v1/platforms` | `get_platforms` |

Markets are keyed by `condition_id`. Resolve a name through
`markets/search` before calling any market endpoint.

## Report the data without overclaiming

These are correctness rules. Breaking one produces a confident, wrong answer.

- **An absent field is not a zero.** An unavailable, partial, or stale provider
  field marks the edge of the evidence. Say it is unavailable.
- **An ungraded wallet is uncovered, not unskilled.** Never render an absent
  grade as a low grade.
- **`pnl.realized` is omitted when no native accounting snapshot matches.** Raw
  total P&L is never a substitute for it.
- **Significance (0.0 to 1.0) ranks attention, not outcomes.** Insider Radar's
  0 to 100 review score is a different quantity. Neither is a probability, a
  forecast, or advice.
- **A radar flag does not establish intent or non-public knowledge.** It marks
  a trade for a human look.
- **Flow sign:** `BUY YES` and `SELL NO` add exposure; `BUY NO` and `SELL YES`
  subtract it. A zero-flow YES tie-break is not conviction.
- **The feed is what 0xinsider ingests, not complete exchange history.** Say
  "in the tracked feed" when reporting a count.
- **Keep full numeric precision until the final render.**
- **Every polymarket.com link carries `?r=0xinsidercom`.**

## Rate limits and errors

100 requests per minute per API-key user; batch reads take 25 items per call.
Read the rate-limit headers on every response instead of counting requests, and
honor `Retry-After` on a `429`. `GET /api/v1/usage` reports consumption without
spending primary quota.

Errors are typed JSON: a stable `error.code`, a human `message`, and an
`error.reason` that separates causes sharing one status. Branch on
`error.code`, never on the message. Feeds and timelines are cursor-paged and
move while being read: follow the cursor to the end, never page by offset, and
never total a partial page.

## Links

- Docs: https://docs.0xinsider.com
- OpenAPI 3.1: https://0xinsider.com/api/v1/openapi.json
- Agent instructions: https://0xinsider.com/agents.md
- Upstream skills: https://github.com/0xinsider/agent-plugin (`npx skills add 0xinsider/agent-plugin`)
