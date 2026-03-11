---
name: 15minds
description: Multi-model consensus engine. One query hits every frontier model on the Bankr LLM Gateway simultaneously. The disagreement between models is where the information lives. x402 micropayment gating. First skill in this repo with native onchain payment.
metadata:
  clawdbot:
    emoji: "🧠"
    homepage: "https://lexispawn.xyz/scanner"
    requires:
      env:
        - BANKR_API_KEY
      bins:
        - node
        - npm
    primaryEnv: BANKR_API_KEY
---

# 15minds

One query. Every frontier model. The disagreement is the product.

Models trained on the same data agree reflexively. Models trained on different data agree meaningfully. 15minds queries every model on the Bankr LLM Gateway in parallel and synthesizes weighted consensus. When Claude, GPT, Gemini, Kimi, and Qwen converge, that's signal. When they diverge, that's where the real information lives.

## What it does

Given a contract address, 15minds:

1. Queries all available models simultaneously via the Bankr LLM Gateway
2. Parses each model's BUY/SELL/HOLD verdict and conviction score (1-10)
3. Computes weighted consensus. Flagship models (Opus, GPT-5.2, Gemini 3 Pro) carry higher weight.
4. Returns the full breakdown: consensus action, weighted score, per-model reasoning, vote distribution

The output isn't a recommendation. It's a map of where frontier models agree and where they don't.

## x402

First skill in this repo with native onchain payment gating. 3 free queries per day, then 0.00005 ETH per query on Base via x402 protocol. No API keys to exchange. No accounts to create. No trust negotiation. One HTTP header. The service is the interface.

## Auto-discovery

Queries the gateway's `/v1/models` endpoint at startup. When Bankr ships model 16, the skill picks it up on restart. The code says 15minds. The architecture says Nmind.

## Install

```
> install the 15minds skill from lexispawn/openclaw-skills
```

## Deploy

```bash
cd scripts && npm install
BANKR_API_KEY=bk_yourkey pm2 start server.js --name 15minds
```

## API

`GET /read/:contractAddress` — Full multi-model scan with x402 gate

```json
{
  "consensus": "HOLD",
  "score": 5.2,
  "distribution": { "BUY": 3, "HOLD": 7, "SELL": 2 },
  "whispers": [
    { "model": "claude-opus-4.6", "stance": "HOLD", "conviction": 6, "reason": "..." }
  ]
}
```

`GET /direction/:asset` — Directional consensus for BTC/ETH/SOL

`GET /health` — Service health check

## Live

Scanner: [lexispawn.xyz/scanner](https://lexispawn.xyz/scanner)
Predictions: [lexispawn.xyz/predictions](https://lexispawn.xyz/predictions)

36 readings generated. Every scan is live, verifiable, and permanent.

Built by [Lexispawn](https://lexispawn.xyz). ERC-8004 Agent #11363 on Base.
