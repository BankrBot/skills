# 22MINDS API Reference

Base URL: `https://lexispawn.xyz/api` (public) or `http://localhost:4021` (VPS direct)

---

## Endpoints

### `GET /`

Service metadata. No authentication.

**Response:**
```json
{
  "service": "22minds",
  "version": "3.0.0",
  "models": 22,
  "families": ["Claude", "Gemini", "OpenAI", "DeepSeek", "xAI", "MiniMax", "Qwen"],
  "pricing": { "amount": "0.00005 ETH", "free_tier": "3 requests/day" },
  "payment": { "protocol": "x402", "wallet": "0xd16f...", "chain": "Base (8453)" }
}
```

### `GET /health`

Health check. No authentication.

**Response:** `{ "status": "ok", "models": 22, "timestamp": "..." }`

### `GET /x402`

x402 payment configuration for automated clients.

### `GET /models`

List all 22 active models with families and weights.

**Response:**
```json
{
  "count": 22,
  "models": [
    { "id": "claude-opus-4.6", "name": "Opus 4.6", "family": "Claude", "weight": 1.5 },
    { "id": "gemini-3-pro", "name": "3 Pro", "family": "Gemini", "weight": 1.3 },
    { "id": "gpt-5.4", "name": "5.4", "family": "OpenAI", "weight": 1.4 },
    "...19 more"
  ]
}
```

### `GET /direction/:asset`

**Main endpoint.** Queries all 22 models via Bankr LLM Gateway with live
gate.io derivatives and returns scored consensus. Takes 2-5 minutes
(not cached — each call is a fresh 22-model scan).

Supported assets: `BTC`, `ETH`, `SOL`

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `asset` | string | BTC, ETH, or SOL |
| `consensus.direction` | string | `UP`, `DOWN`, `FLAT`, or `SPLIT` |
| `consensus.score` | number | Weighted consensus score 0-10 |
| `consensus.consensus_percent` | number | Percentage of responding models in the majority direction. 22/22 = 100%, 15/22 = 68% |
| `consensus.avg_conviction` | number | Average conviction across responding models (1-10 scale) |
| `consensus.minds_responded` | number | Models that returned valid responses (max 22) |
| `consensus.distribution` | object | `{ up, down, flat, errors }` vote counts |
| `price` | number | Current asset price at query time |
| `derivatives` | object | Raw derivatives data: funding_rate, ls_ratio, oi_change_pct |
| `whispers` | array | Per-model breakdown (see below) |
| `context` | object | Regime info, cross-asset context |

#### Whisper Object

| Field | Type | Description |
|-------|------|-------------|
| `model` | string | Model ID (e.g. `claude-opus-4.6`) |
| `family` | string | Lab family (Claude, Gemini, OpenAI, DeepSeek, xAI, MiniMax, Qwen) |
| `direction` | string | `UP`, `DOWN`, or `FLAT` |
| `conviction` | number | Model's self-rated conviction 1-10 |
| `setup` | string | Market state: `BUILDING`, `BREAKING`, or `EMPTY` |
| `reason` | string | Model's reasoning for the call |

### `GET /read/:contractAddress`

Token analysis endpoint. Queries all models for BUY/SELL/HOLD consensus
on any Base token by contract address.

**x402 gated:** 3 free requests/day per IP, then requires payment.

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Payment` | After free tier | Base transaction hash proving payment |

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `token` | object | DexScreener market data snapshot |
| `consensus.action` | string | `BUY`, `SELL`, or `HOLD` — plurality across all models |
| `consensus.score` | string | Weighted average confidence 1-10 |
| `consensus.distribution` | object | `{ buy, sell, hold }` vote counts |
| `whispers` | array | Per-model breakdown: name, family, raw response, parsed action/score |
| `models_queried` | number | Total models that responded |
| `x402.paid` | boolean | Whether request used a payment |
| `x402.free_remaining` | number | Free tier requests remaining today |

#### Error Responses

| Status | Meaning |
|--------|---------|
| `402` | Payment required — free tier exhausted |
| `402` (with `tx_hash`) | Payment verification failed |

### `GET /predictions/live`

Current active Polymarket bet. **x402 gated** (returns 402 without payment).

### `GET /predictions/history`

Full bet history as JSON array. **Free, no authentication.**

### `GET /predictions/stats`

Aggregate statistics: total bets, wins, losses, accuracy, PnL,
per-asset and per-quality-tier breakdowns. **Free, no authentication.**

```bash
curl -s https://lexispawn.xyz/api/predictions/stats | python3 -m json.tool
```
