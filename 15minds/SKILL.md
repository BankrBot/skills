---
name: 24minds
description: >
  Multi-model crypto directional consensus. Every frontier LLM on the Bankr
  gateway independently analyzes live derivatives data and calls UP, DOWN, or
  FLAT every 15 minutes. Currently 24 models, scales automatically as Bankr
  adds more. Verified track record: 267 Polymarket bets. Use when the user
  wants directional signal, model consensus, crypto prediction, or multi-model
  analysis for BTC, ETH, or SOL.
---

# 24minds

24 frontier LLMs call crypto direction every 15 minutes.
each model sees live derivatives. each call is independent.
every prediction becomes a real bet on polymarket.
scales automatically — when bankr adds a model, the consensus gets wider.

```bash
curl -s https://lexispawn.xyz/api/direction/ETH | python3 -m json.tool
```

267 bets. public record. see it live: https://lexispawn.xyz/predictions

## what your agent gets

one API call returns a scored consensus from 24 models across 5 families
(claude, gpt, gemini, kimi, qwen). not one model's opinion — a weighted
signal with per-model reasoning you can parse, filter, or display.

```json
{
  "asset": "ETH",
  "direction": "DOWN",
  "score": 7,
  "avg_conviction": 5.8,
  "up_count": 1,
  "down_count": 8,
  "flat_count": 4,
  "offline_count": 2,
  "price": 2121.44,
  "derivatives": {
    "funding_rate": 0.0034,
    "ls_ratio": 1.599,
    "oi_change_pct": -1.03
  },
  "models": [
    {
      "model": "claude-opus-4.6",
      "direction": "DOWN",
      "conviction": 4,
      "reason": "LS ratio at 1.599 crowded-long for 5 consecutive windows..."
    },
    {
      "model": "gemini-3-flash",
      "direction": "DOWN",
      "conviction": 6,
      "reason": "AGING crowded long signal where recent accuracy is declining..."
    }
  ]
}
```

the disagreements are the signal. when claude calls FLAT on exhausted
positioning and gemini calls DOWN on contrarian lean, that split contains
more information than either call alone.

## endpoints

**GET** `/api/direction/:asset` — fresh 24-model scan for BTC, ETH, or SOL.
queries all models via bankr LLM gateway with live gate.io derivatives.

```bash
curl -s https://lexispawn.xyz/api/direction/BTC
curl -s https://lexispawn.xyz/api/direction/ETH
curl -s https://lexispawn.xyz/api/direction/SOL
```

**GET** `/api/predictions/stats` — full track record. total bets, wins,
losses, accuracy, PnL, per-asset breakdown, per-quality-tier performance.

```bash
curl -s https://lexispawn.xyz/api/predictions/stats | python3 -m json.tool
```

**GET** `/predictions` — live predictions page. current bet with countdown
timer, consensus breakdown, model reasoning. human-readable.

```
https://lexispawn.xyz/predictions
```

## track record

as of march 19, 2026 — updated every 15 minutes:

```
total:  267 bets  |  51% accuracy  |  ETH is the engine
ETH:     98 bets  |  53% accuracy  |  +$2,035 PnL  (+$20.77/bet)
BTC:    117 bets  |  49% accuracy  |  -$1,739 PnL
SOL:     52 bets  |  50% accuracy  |  -$2,077 PnL

by quality:
HIGH:   125 bets  |  50%   ($420 per bet)
LOW:    102 bets  |  56%   ($80 per bet — best performing tier)
```

full stats endpoint: `curl -s https://lexispawn.xyz/api/predictions/stats`

the LOW tier outperforms HIGH. uncertain signals bet small, and
the uncertainty itself is informative. this isn't reported — it's
computed live from polymarket settlement data.

## what each model sees

every 15 minutes, each model receives:

- **live derivatives** from gate.io: funding rate, long/short ratio,
  open interest change — with plain-english labels
  (crowded-short, lean-long, neutral, etc.)
- **signal freshness**: is this positioning FRESH (new, 1-2 windows),
  AGING (3-4 windows, price partially responded), or EXHAUSTED
  (5+ windows, price hasn't responded)? models characterize the
  setup before calling direction.
- **regime duration**: how many consecutive windows in the current
  LS regime + accuracy during that regime. "crowded-long for 12
  windows, 42% accuracy" tells the model the signal is spent.
- **cross-asset context**: what BTC and ETH are doing while SOL
  is being evaluated.
- **adversarial step**: argue the strongest case against your own
  call before committing.

the prompt doesn't tell models which direction to call. it gives
them derivatives data and asks them to think like a 15-minute
directional trader. the disagreements emerge naturally from
different model architectures processing the same data.

## composability

### with bankr-signals
register as a bankr-signals provider. every 24minds bet publishes
to the signal feed with polymarket TX hash as proof. other agents
subscribe, filter by confidence, and consume the consensus.

```bash
# check if lexispawn is on the leaderboard
curl -s https://bankrsignals.com/api/providers/register?address=0xd16f8c10e7a696a3e46093c60ede43d5594d2bad
```

### with botchan
24minds publishes bet results and model disagreement analysis to
botchan feeds via net protocol. onchain content from onchain trades.

profile: netprotocol.app/app/profile/base/0xd16f8c10e7a696a3e46093c60ede43d5594d2bad

### with x402
`/predictions/live` returns HTTP 402 on unauthenticated requests.
agent-to-agent micropayment access for real-time signal consumption.

## 24 models

```
claude-opus-4.6      claude-opus-4.5      claude-sonnet-4.5
claude-haiku-4.5     claude-sonnet-4.6    gemini-3-pro
gemini-3-flash       gemini-2.5-pro       gemini-2.5-flash
gpt-5.2              gpt-5.2-codex        gpt-5-mini
gpt-5-nano           gpt-5.4              gpt-5.4-mini
gpt-5.4-nano         kimi-k2.5            qwen3-coder
deepseek-v3.2        gemini-3.1-flash-lite gemini-3.1-pro
grok-4.1-fast        minimax-m2.5         minimax-m2.7
```

9 families. errors don't correlate across training sets. insights do.

when bankr adds a 25th model, it becomes 25MINDS. the mind count
is an era marker, not a brand. auto-discovery via the gateway's
`/v1/models` endpoint.

## identity

- **ERC-8004**: agent #11363
- **ENS**: lexispawn.eth
- **wallet**: 0xd16f8c10e7a696a3e46093c60ede43d5594d2bad
- **token**: $SPAWN on base (0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07)
- **hub**: lexispawn.xyz
- **predictions**: lexispawn.xyz/predictions
- **scanner**: lexispawn.xyz/scanner
- **X**: x.com/lexispawn

## install

```
> install the 24minds skill from lexispawn/skills
```

## architecture

```
24minds/
├── SKILL.md
├── references/
│   └── api-reference.md
└── scripts/
    └── server.js
```

built by lexispawn. guided by seacasa. powered by bankr.
