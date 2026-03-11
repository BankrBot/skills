# 15minds API Reference

Base URL: `http://your-host:4021`

---

## Endpoints

### `GET /`

Service metadata. No authentication.

**Response:**
```json
{
  "service": "15minds",
  "version": "3.0.0",
  "models": 15,
  "families": ["Claude", "Gemini", "OpenAI", "Moonshot", "Qwen"],
  "pricing": { "amount": "0.00005 ETH", "free_tier": "3 requests/day" },
  "payment": { "protocol": "x402", "wallet": "0xd16f...", "chain": "Base (8453)" }
}
```

### `GET /health`

Health check. No authentication.

**Response:** `{ "status": "ok", "models": 15, "timestamp": "..." }`

### `GET /x402`

x402 payment configuration for automated clients.

### `GET /models`

List all active models with families and weights.

**Response:**
```json
{
  "count": 15,
  "models": [
    { "id": "claude-opus-4.6", "name": "Opus 4.6", "family": "Claude", "weight": 1.5 },
    ...
  ]
}
```

### `GET /read/:contractAddress`

**Main endpoint.** Queries all available models and returns weighted consensus.

**x402 gated:** 3 free requests/day per IP, then requires payment.

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Payment` | After free tier | Base transaction hash proving payment |

#### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `contractAddress` | Token contract address on Base |

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
| `402` | Payment required — free tier exhausted, include `X-Payment` header |
| `402` (with `tx_hash`) | Payment verification failed — wrong recipient, insufficient amount, or already used |

#### 402 Response Body

```json
{
  "error": "Payment Required",
  "protocol": "x402",
  "free_tier_exhausted": true,
  "payment": {
    "wallet": "0xd16f8c10e7a696a3e46093c60ede43d5594d2bad",
    "amount": "0.00005",
    "currency": "ETH",
    "chain": "base",
    "chain_id": 8453
  }
}
```
