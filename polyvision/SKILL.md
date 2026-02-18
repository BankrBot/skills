---
name: polyvision
description: Analyze Polymarket prediction market wallets — get copy trading scores (1-10), P&L, win rate, risk metrics (Sharpe ratio, Sortino ratio, max drawdown), red flags, position sizing, market category performance, recent performance (7d/30d/90d), and streak analysis. Connects via MCP server or REST API. Use when evaluating whether to copy trade a Polymarket trader, comparing multiple wallets side-by-side, screening for elite prediction market performers, checking if a wallet has bot-like trading patterns or hidden losses, or researching a trader's risk profile before following their positions. Free API key, no daily limits, 6-hour result caching.
homepage: https://polyvisionx.com
license: MIT
disable-model-invocation: true
metadata: {"clawdbot":{"emoji":"📊","homepage":"https://polyvisionx.com","requires":{"env":["POLYVISION_API_KEY"]}}}
---

# PolyVision — Polymarket Wallet Analyzer

PolyVision analyzes Polymarket prediction market wallets and returns a comprehensive trading profile: copy trading score (1-10), P&L breakdown, win rate, risk metrics (Sharpe ratio, Sortino ratio, max drawdown), position sizing consistency, market category performance, recent performance windows (7d/30d/90d), streak analysis, and red flags. Use it to evaluate whether a trader is worth copy trading, compare multiple wallets, or screen for elite performers.

## When to Use
- User mentions a Polymarket wallet address (0x...)
- User asks about copy trading, trader evaluation, or wallet scoring
- User wants to compare prediction market traders or screen for elite performers
- User asks about a trader's risk profile, red flags, or trading patterns

## When NOT to Use
- General crypto price queries (not Polymarket-specific)
- Placing trades or executing orders (PolyVision is read-only analysis)
- Non-Polymarket wallet lookups (Ethereum DeFi, NFTs, etc.)

## Setup: MCP Server (Recommended)

Add to your MCP client configuration (e.g. `claude_desktop_config.json`, Cursor, Windsurf):

```json
{
  "mcpServers": {
    "polyvision": {
      "type": "streamable-http",
      "url": "https://api.polyvisionx.com/mcp",
      "headers": {
        "Authorization": "Bearer ${POLYVISION_API_KEY}"
      }
    }
  }
}
```

## Setup: Get an API Key

Register for a free API key (no daily limits):

```bash
curl -X POST https://api.polyvisionx.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "name": "My App"}'
```

Response:

```json
{
  "api_key": "pv_live_abc123...",
  "key_prefix": "pv_live_abc12345",
  "tier": "api"
}
```

Store the key — it is shown only once and cannot be retrieved later. Set it as an environment variable:

```bash
export POLYVISION_API_KEY="pv_live_abc123..."
```

## MCP Tools Reference

### `analyze_wallet`

Run a comprehensive Polymarket wallet analysis.

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `wallet_address` | string | Yes | — | Ethereum address (42 chars, starts with `0x`) |
| `mode` | string | No | `"quick"` | `"quick"` (~5s) or `"full"` (~30-60s with timing data) |

**Returns:** Full analysis dict with P&L, win rate, risk metrics, categories, copy trading score (1-10), red flags, and usage info. Results are cached for 6 hours — cache hits are instant. See `references/response-schemas.md` for the complete field reference.

**Timing:** Quick mode ~5s, full mode ~30-60s. Cached responses are instant.

### `get_score`

Get a compact copy-trading score for a wallet. Shares the same cache as `analyze_wallet`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `wallet_address` | string | Yes | Ethereum address (42 chars, starts with `0x`) |

**Returns:** Score (1-10), recommendation, tier (green/yellow/orange/red), total P&L, win rate, trade count, Sharpe ratio, red flags, cache status, and usage info.

**Timing:** ~5s fresh, instant if cached.

### `check_quota`

Check your usage statistics. Does not consume quota.

**Parameters:** None

**Returns:** `{ "used_today": <int>, "tier": "api" }`

API/MCP access has no daily limits — usage is tracked for analytics only.

### `health`

Check system health.

**Parameters:** None

**Returns:** `{ "status": "ok" }` or `{ "status": "degraded" }`

### `regenerate_key`

Regenerate your API key. The old key is immediately invalidated.

**Parameters:** None

**Returns:** `{ "api_key": "pv_live_...", "key_prefix": "pv_live_...", "message": "..." }`

The new key is shown only once. Update your configuration immediately.

### `deactivate_key`

Permanently deactivate your API key. This is irreversible — use `regenerate_key` instead if you need a replacement.

**Parameters:** None

**Returns:** `{ "success": true, "message": "API key deactivated. All future requests with this key will be rejected." }`

## Score Tiers

| Tier | Score Range | Recommendation | Meaning |
|------|------------|----------------|---------|
| Green | 8.0 – 10.0 | Strong Copy | Consistently profitable, good risk management, strong track record |
| Yellow | 6.0 – 7.9 | Moderate Copy | Decent performance with some concerns, proceed with caution |
| Orange | 4.0 – 5.9 | Risky Copy | Mixed results, significant red flags, high risk |
| Red | 0.0 – 3.9 | Don't Copy | Poor performance, major red flags, likely to lose money |

## Decision Table

| User Intent | Tool | Mode | Why |
|-------------|------|------|-----|
| "Should I copy this trader?" | `get_score` | — | Quick yes/no with score + red flags |
| "Deep dive on this wallet" | `analyze_wallet` | `full` | Complete analysis with timing data |
| "Quick check on a wallet" | `analyze_wallet` | `quick` | Full analysis without activity timing |
| "Compare two traders" | `get_score` x2 | — | Side-by-side scores for fast comparison |
| "What categories does this trader focus on?" | `analyze_wallet` | `quick` | Category breakdown in analysis |
| "Is the system up?" | `health` | — | System status check |
| "How many analyses have I run?" | `check_quota` | — | Usage stats (no limits enforced) |

## Red Flag Reference

Red flags are returned as a list of strings. Here's what each one means:

| Red Flag | Trigger | Severity |
|----------|---------|----------|
| Low win rate | Win rate below 40% | High |
| Large single loss | Single worst trade exceeds 50% of total P&L | Medium |
| Overall unprofitable | Net P&L is negative | High |
| Limited track record | Fewer than 10 closed positions | Medium |
| Inactive | No trades in 30+ days | Low |
| BOT ALERT | Median trade duration under 5 minutes | High |
| Very fast trading | Median trade duration under 30 minutes | Medium |
| LOSS HIDING | 70%+ of open positions underwater (5+ open) | High |
| Open positions losing | 50%+ of open positions underwater (3+ open) | Medium |
| No major red flags detected | No concerning patterns found | None |

## REST API (Alternative)

For agents that cannot use MCP, all tools are available as REST endpoints at `https://api.polyvisionx.com`. Most endpoints require Bearer token authentication (exceptions noted below).

Interactive docs and the OpenAPI spec are available at:
- **Swagger UI:** `https://api.polyvisionx.com/docs`
- **OpenAPI JSON:** `https://api.polyvisionx.com/openapi.json`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `POST /v1/auth/register` | POST | Register and get an API key (no auth required) |
| `GET /v1/auth/me` | GET | Get current user info and usage stats |
| `POST /v1/auth/regenerate` | POST | Regenerate API key |
| `POST /v1/auth/deactivate` | POST | Deactivate API key |
| `GET /v1/analyze/{wallet_address}?mode=quick` | GET | Full wallet analysis |
| `GET /v1/score/{wallet_address}` | GET | Compact copy-trading score |
| `GET /health` | GET | Health check (no auth required) |

### Example: Analyze a wallet

```bash
curl -s https://api.polyvisionx.com/v1/analyze/0x1234...abcd?mode=quick \
  -H "Authorization: Bearer $POLYVISION_API_KEY" | jq .
```

### Example: Get a score

```bash
curl -s https://api.polyvisionx.com/v1/score/0x1234...abcd \
  -H "Authorization: Bearer $POLYVISION_API_KEY" | jq .
```

## Error Codes

| Code | Meaning | Recovery |
|------|---------|----------|
| 400 | Invalid wallet address (must be 42-char hex starting with `0x`) | Fix the address format |
| 401 | Invalid or inactive API key | Check your `POLYVISION_API_KEY` or register a new one |
| 409 | Email already registered (registration only) | Use existing key or register with a different email |
| 429 | Rate limited | Wait and retry — Polymarket API has upstream limits |
| 503 | System at capacity (all analysis slots in use) | Retry in 30-60 seconds |
| 504 | Analysis timed out | Retry — the wallet may have extensive history |
