---
name: 15minds
description: >
  Multi-model consensus engine for token analysis. Queries every frontier AI model
  available on Bankr's LLM Gateway in parallel, synthesizes weighted verdicts with
  cross-family agreement scoring. First skill with native x402 micropayment gating.
  Auto-discovers models at runtime — never goes stale when new models ship.
  Triggers on: "15minds", "scan token", "multi-model analysis", "consensus scan",
  "what do the models think", "run 15minds", "token consensus", "multi-model scan",
  "frontier consensus", "ai consensus on".
---

# 15minds

Multi-model consensus engine. Queries every frontier AI model available through
Bankr's LLM Gateway in parallel, then synthesizes a weighted verdict from the
disagreement. One API call, 15+ model responses, one consensus.

**API:** `GET /read/:contractAddress`
**Source:** [github.com/lexispawn/openclaw-skills/tree/main/15minds](https://github.com/lexispawn/openclaw-skills/tree/main/15minds)
**Operator:** Lexispawn
**Protocol:** x402 (3 free scans/day, then 0.00005 ETH per query on Base)

---

## Install

```
> install the 15minds skill from lexispawn/openclaw-skills
```

---

## Why Multi-Model Consensus

Asking one model about a token gives you one opinion shaped by one training set,
one RLHF process, one set of blind spots. Asking fifteen models from five families
gives you something qualitatively different: consensus from independent reasoning.

When Claude, GPT, Gemini, Kimi, and Qwen all independently say BUY, that signal
is stronger than any single model's conviction. When they disagree, the
disagreement itself is information — it means the setup is ambiguous and caution
is warranted.

15minds exploits the fact that frontier models fail in uncorrelated ways. Their
errors don't stack. Their insights do.

---

## Architecture

```
                    ┌─────────────────────┐
                    │   /read/:address    │
                    │   x402 gate layer   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  DexScreener fetch   │
                    │  (token data)        │
                    └─────────┬───────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
     ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
     │ Claude (4)   │  │ Gemini (4)  │  │ OpenAI (4)  │  ...
     │ opus-4.6     │  │ 3-pro       │  │ gpt-5.2     │
     │ opus-4.5     │  │ 3-flash     │  │ 5.2-codex   │
     │ sonnet-4.6   │  │ 2.5-pro     │  │ 5-mini      │
     │ sonnet-4.5   │  │ 2.5-flash   │  │ 5-nano      │
     │ haiku-4.5    │  │             │  │             │
     └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Weighted scoring    │
                    │  + consensus logic   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  JSON response with  │
                    │  verdict + whispers  │
                    └─────────────────────┘
```

**Flow:**
1. Token data fetched from DexScreener (price, volume, liquidity, buy/sell ratio)
2. All available models queried in parallel via Bankr LLM Gateway
3. Each response parsed for action (BUY/SELL/HOLD) and confidence score (1-10)
4. Weighted consensus computed — flagship models carry more weight than lightweight ones
5. Full breakdown returned: consensus verdict, individual whispers, distribution

**Model auto-discovery:** On startup, the server queries `GET /v1/models` on the
Bankr LLM Gateway. If the gateway adds a 16th model tomorrow, 15minds picks it
up automatically on next restart. The hardcoded fallback list is only used if
discovery fails.

---

## Model Lineup

Models are auto-discovered from the gateway at runtime. Current roster (fallback):

| Model | Family | Weight | Role |
|-------|--------|--------|------|
| claude-opus-4.6 | Claude | 1.5 | Flagship reasoning — highest weight |
| claude-opus-4.5 | Claude | 1.4 | Deep analysis, strong on nuance |
| claude-sonnet-4.6 | Claude | 1.3 | Fast flagship, strong code reasoning |
| claude-sonnet-4.5 | Claude | 1.2 | Balanced analysis |
| claude-haiku-4.5 | Claude | 0.8 | Fast heuristic, gut-check signal |
| gemini-3-pro | Gemini | 1.3 | Strong quantitative reasoning |
| gemini-3-flash | Gemini | 0.9 | Fast Gemini signal |
| gemini-2.5-pro | Gemini | 1.1 | Established reasoning baseline |
| gemini-2.5-flash | Gemini | 0.8 | Lightweight Gemini check |
| gpt-5.2 | OpenAI | 1.3 | Flagship GPT, strong on markets |
| gpt-5.2-codex | OpenAI | 1.0 | Technical/code analysis angle |
| gpt-5-mini | OpenAI | 0.8 | Fast OpenAI heuristic |
| gpt-5-nano | OpenAI | 0.6 | Minimum viable signal |
| kimi-k2.5 | Moonshot | 1.0 | Independent reasoning, non-Western training |
| qwen3-coder | Qwen | 0.9 | Technical analysis, Alibaba family |

**Weighting logic:** Flagship models (opus-4.6, gpt-5.2, gemini-3-pro) carry
1.3-1.5x weight. Lightweight models (haiku, nano, flash) carry 0.6-0.9x.
This means a unanimous lightweight verdict can be overridden by flagship
disagreement — the models that think harder matter more.

---

## API Reference

### `GET /`
Service info. No auth required.

### `GET /health`
Returns `{ "status": "ok" }`. No auth required.

### `GET /x402`
Payment configuration for x402 clients.

### `GET /read/:contractAddress`
**Main endpoint.** x402 gated.

Queries all available models against the target token and returns weighted
consensus.

**Free tier:** 3 requests/day per IP. No headers needed.

**Paid tier:** After free tier, include payment proof:
```
X-Payment: <base_tx_hash>
```
Send 0.00005 ETH (~$0.12) to `0xd16f8c10e7a696a3e46093c60ede43d5594d2bad` on
Base, then pass the transaction hash in the header.

#### Example Request

```bash
# Free tier (first 3/day)
curl https://your-host:4021/read/0xYourTokenAddress

# Paid tier
curl -H "X-Payment: 0xabc123..." https://your-host:4021/read/0xYourTokenAddress
```

#### Example Response

```json
{
  "token": {
    "contract": "0x...",
    "symbol": "EXAMPLE",
    "name": "Example Token",
    "price": "0.00234",
    "change24h": 12.5,
    "volume24h": 150000,
    "liquidity": 85000,
    "buySell": "342/198"
  },
  "consensus": {
    "action": "BUY",
    "score": "7.3",
    "distribution": { "buy": 10, "sell": 2, "hold": 3 }
  },
  "whispers": [
    {
      "model": "Opus 4.6",
      "family": "Claude",
      "says": "BUY 8/10 - Volume spike with accumulation pattern",
      "action": "BUY",
      "score": 8
    },
    {
      "model": "5.2",
      "family": "OpenAI",
      "says": "BUY 7/10 - Liquidity healthy relative to volume",
      "action": "BUY",
      "score": 7
    },
    {
      "model": "K2.5",
      "family": "Moonshot",
      "says": "HOLD 5/10 - Insufficient history for conviction",
      "action": "HOLD",
      "score": 5
    }
  ],
  "ritual": "complete",
  "models_queried": 15,
  "timestamp": "2026-03-04T00:00:00.000Z",
  "x402": {
    "paid": false,
    "free_remaining": 2,
    "payment": null
  }
}
```

**Response fields:**

| Field | Description |
|-------|-------------|
| `consensus.action` | `BUY`, `SELL`, or `HOLD` — plurality vote across all models |
| `consensus.score` | Weighted average confidence (1-10), flagship models weighted higher |
| `consensus.distribution` | Raw vote counts by action |
| `whispers[]` | Individual model responses with parsed action and score |
| `models_queried` | Number of models that responded (may exceed 15 as gateway adds models) |
| `x402.paid` | Whether this request was paid or free tier |
| `x402.free_remaining` | Free requests remaining today |

---

## x402 Payment Layer

15minds implements the [x402 protocol](https://www.x402.org/) for micropayment
gating — the first skill in this repo to do so.

**How it works:**

1. First 3 requests per day per IP are free. No headers, no wallet, no friction.
2. After free tier, the server returns HTTP `402 Payment Required` with payment
   instructions in the response body.
3. Client sends 0.00005 ETH to the payment wallet on Base.
4. Client retries the request with `X-Payment: <tx_hash>` header.
5. Server verifies the transaction on-chain (correct recipient, sufficient amount,
   confirmed) and serves the response.

**Why x402:** Agents need to pay for compute. API keys create accounts. x402
creates transactions — one HTTP header, one onchain payment, no signup. Any agent
with a Base wallet can use 15minds without registration.

```
Payment wallet: 0xd16f8c10e7a696a3e46093c60ede43d5594d2bad
Price:          0.00005 ETH (~$0.12)
Chain:          Base (8453)
Free tier:      3 requests/day per IP
```

---

## Deployment

### Requirements

- Node.js 18+
- Bankr API key (`bk_` prefix) — get one at [bankr.bot/api](https://bankr.bot/api)

### Setup

```bash
cd scripts/
npm install
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BANKR_API_KEY` | Yes | — | Bankr LLM Gateway API key |
| `PORT` | No | `4021` | Server port |

### Run

```bash
# Direct
BANKR_API_KEY=bk_yourkey node server.js

# PM2 (recommended for production)
BANKR_API_KEY=bk_yourkey pm2 start server.js --name 15minds
pm2 save
```

### Verify

```bash
curl http://localhost:4021/
curl http://localhost:4021/health
curl http://localhost:4021/read/0xYourTokenAddress
```

---

## Reading the Output

**Strong consensus (act on it):**
- Score > 7 with 12+ models agreeing on BUY → strong bullish signal
- Score < 3 with 12+ models agreeing on SELL → strong bearish signal
- Cross-family agreement (Claude + GPT + Gemini all align) → highest conviction

**Weak consensus (proceed with caution):**
- Score 4-6 → models are split, setup is ambiguous
- High disagreement across families → the token's situation is genuinely unclear
- One family bullish while others bearish → investigate what that family is seeing

**The disagreement is the signal.** When 15 models trained on different data by
different teams all converge, that's meaningful. When they diverge, that's
meaningful too — it means the trade is not obvious, which is itself useful
information.

---

## Resources

- [Bankr LLM Gateway](https://bankr.bot) — model access
- [x402 Protocol](https://www.x402.org/) — payment standard
- [DexScreener](https://dexscreener.com/) — token data source
- [Lexispawn](https://lexispawn.xyz) — operator
