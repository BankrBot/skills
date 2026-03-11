---
name: 15minds
description: Queries 15 frontier AI models in parallel and returns consensus crypto verdicts with conviction scoring and per-model reasoning. Use when user asks for "multi-model consensus", "what do the models think about", "scan this token", "BTC direction", "should I buy", "15 minds", "second opinion from multiple models", or wants to compare predictions across Claude, GPT, Gemini, and other model families.
---

# 15minds

Multi-model consensus engine. Queries 15 frontier AI models on the Bankr LLM Gateway in parallel. Returns structured verdicts with conviction scoring, family agreement analysis, and per-model reasoning.

Live and betting real money since March 11, 2026: [lexispawn.xyz/predictions](https://lexispawn.xyz/predictions)

## What it does

Sends a structured analytical prompt to all 15 models simultaneously. Each model analyzes momentum, key levels, session context, volatility regime, and cross-asset patterns. Returns:

- **Consensus direction** (UP/DOWN) with score (1-10)
- **Conviction scoring** — average conviction across agreeing models (1-10)
- **Family agreement** — how many independent model families converge (Anthropic, Google, OpenAI, Other)
- **Quality rating** — HIGH / MEDIUM / LOW based on conviction + family agreement
- **Regime detection** — DEAD_FLAT / LOW_VOL / NORMAL / HIGH_VOL
- **Per-model whispers** — each model's direction, conviction, and one-sentence reasoning

## Models (15 configured, ~12 effective)

Claude Opus 4.6, Claude Opus 4.5, Claude Sonnet 4.5, Claude Haiku 4.5, Claude Sonnet 4.6, Gemini 3 Pro, Gemini 3 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash, GPT-5.2, GPT-5.2 Codex, GPT-5 Mini, GPT-5 Nano, Kimi K2.5, Qwen3 Coder

## Two endpoints

### Token scan — `GET /read/:contractAddress`

Scans any Base token by contract address. 15 models evaluate fundamentals, technicals, and sentiment. Returns BUY/HOLD/SELL consensus with per-model breakdown.

**x402 gated**: 3 free scans per day, then 0.00005 ETH per query on Base. No API keys, no accounts — payment via HTTP header.

```
curl https://lexispawn.xyz/api/read/0xContractAddress
```

### Directional prediction — `GET /direction/:asset`

15-minute price direction prediction for BTC, ETH, or SOL. Each model runs a 5-factor structured analysis:

1. Momentum — acceleration/deceleration of 1hr move
2. Key levels — proximity to round numbers and session highs/lows
3. Session context — NY/London/Asia liquidity patterns
4. Volatility regime — trending vs choppy environment
5. Cross-asset inference — historical patterns for this magnitude of move

Returns JSON with direction, conviction (1-10), and reasoning from each model.

```
curl https://lexispawn.xyz/api/direction/BTC
```

Response:
```json
{
  "asset": "BTC",
  "price": 70533,
  "consensus": {
    "direction": "UP",
    "score": 8,
    "avg_conviction": 7.3,
    "distribution": { "up": 10, "down": 2, "errors": 3 }
  },
  "context": {
    "regime": "NORMAL",
    "change1h": 0.52
  },
  "whispers": [
    {
      "model": "Claude Opus 4.6",
      "direction": "UP",
      "conviction": 8,
      "reasoning": "Strong bounce off $70K support with increasing volume into NY open"
    }
  ]
}
```

## Why it matters

Individual model predictions are noise. Consensus across 15 independently trained models from 5 different families is signal. When Claude, GPT, Gemini, and Qwen all independently converge on the same direction with high conviction, that's information no single model provides.

The disagreement is where the information lives. When Anthropic models say UP but OpenAI models say DOWN, the consensus score drops and bet sizing shrinks automatically. When all families agree, conviction is high, and the market is moving — that's the moment to act.

## Install

```
> install the 15minds skill from lexispawn/openclaw-skills
```

## Deploy

```
cd scripts && npm install
BANKR_API_KEY=bk_yourkey pm2 start server.js --name 15minds
```

## Links

- Live predictions: [lexispawn.xyz/predictions](https://lexispawn.xyz/predictions)
- Scanner: [lexispawn.xyz/scanner](https://lexispawn.xyz/scanner)
- GitHub: [github.com/lexispawn](https://github.com/lexispawn)
- X: [@lexispawn](https://x.com/lexispawn)
- Built by [Lexispawn](https://lexispawn.xyz) — ERC-8004 #11363 on Base
