---
name: 22minds
description: >
  22 frontier LLMs from 7 labs independently analyze live derivatives data
  and call UP, DOWN, or FLAT for BTC, ETH, or SOL every 15 minutes.
  Every prediction becomes a real Polymarket bet. verified bets and
  counting. Use when the user wants directional signal, model consensus,
  crypto prediction, or multi-model analysis.
---

# 22MINDS

22 AI minds. every 15 minutes. real money.

Claude, Gemini, GPT, DeepSeek, Grok, MiniMax, Qwen — built by
different labs, trained on different data, shaped by different
architectures. each one sees the same live derivatives. each
calls independently. when 20 of them reach the same conclusion
about market positioning, that's not groupthink. that's
independent convergence.

polymarket bets. every one public. every one settled.
https://lexispawn.xyz/predictions

```bash
curl -s https://lexispawn.xyz/api/direction/ETH | python3 -m json.tool
```

## two products, one engine

**the trading system** bets when minds converge. high agreement
across multiple labs = real money on polymarket. the track
record is the proof.

**the content layer** publishes when minds diverge. claude calls
FLAT on exhausted positioning while gemini calls DOWN on
contrarian lean — that split is the story. divergence is
information. convergence is action.

your agent can consume either signal. the `/direction` endpoint
returns both: consensus for trading, per-model whispers for
divergence analysis.

## what one API call returns

a scored consensus from 22 models across 7 labs. not one model's
opinion — a weighted signal with per-model reasoning you can
parse, filter, or route.

```json
{
  "asset": "ETH",
  "price": 2150.28,
  "derivatives": {
    "funding_rate": 0.0051,
    "ls_ratio": 1.387,
    "oi_change": 0.16
  },
  "consensus": {
    "direction": "DOWN",
    "score": 7,
    "consensus_percent": 82,
    "avg_conviction": 5.8,
    "minds_responded": 22,
    "distribution": { "up": 2, "down": 18, "flat": 1, "errors": 1 }
  },
  "whispers": [
    {
      "model": "claude-opus-4.6",
      "family": "Claude",
      "direction": "DOWN",
      "conviction": 6,
      "setup": "BREAKING — longs unwinding, LS 1.664→1.447",
      "reasoning": "OI drain with persistent crowded longs indicates exits..."
    }
  ]
}
```

each model returns a SETUP assessment before calling direction.
the setup field tells you WHY, not just WHAT.

## three-state framework

every model classifies the market before calling direction:

- **BUILDING** — crowd accumulating. positions growing. directional
  pressure forming. ask: will they be proven wrong?
- **BREAKING** — crowd unwinding. positions closing. mechanical
  pressure in the direction of the exit flow.
- **EMPTY** — no significant positioning. no crowd to exploit.
  the only state where FLAT is correct.

when 18/22 models say BREAKING and 4 say BUILDING, the split
tells you the market is at an inflection point. that's signal.

## endpoints

| endpoint | what it returns |
|----------|-----------------|
| `GET /api/direction/:asset` | fresh 22-model scan. BTC, ETH, or SOL. 2-5 min. |
| `GET /api/predictions/stats` | full track record — bets, accuracy, PnL, per-asset |
| `GET /api/predictions/history` | complete bet history as JSON |
| `GET /api/predictions/live` | current active bet. x402-gated (402 on unauth) |
| `GET /predictions` | live predictions page with countdown timer |

full API docs: [references/api-reference.md](references/api-reference.md)

## track record

verified track record at lexispawn.xyz/predictions. updated every 15 minutes.

live polymarket odds integration — models see where real money is
positioned on the exact market they predict. verified track record
and per-asset breakdown at lexispawn.xyz/predictions.

live numbers:
```bash
curl -s https://lexispawn.xyz/api/predictions/stats
```

## quality tiers

```
HIGHEST:  $690  (90%+ consensus, 60%+ cross-lab agreement)
HIGH:     $420  (69%+ consensus, 60%+ cross-lab agreement)
LOW:      $80   (everything else that passes gates)
```

sizing reflects conviction. when 20+ of 22 models from 7 different
labs call the same direction, the bet is larger. when the signal is
ambiguous, it bets small and lets the uncertainty speak.

## what each model sees

every 15 minutes, each of 22 models receives:

- **live derivatives** from gate.io — funding rate, long/short
  ratio, open interest change. raw trajectory data across
  multiple time windows.
- **positioning trajectory** — how many consecutive windows in the
  current LS regime + accuracy during that regime. "crowded-long
  for 12 windows, 42% accuracy" tells the model the signal is spent.
- **cross-asset context** — what BTC is doing while ETH is being
  evaluated. correlated moves matter.
- **adversarial step** — argue the strongest case against your own
  call before committing.

the prompt maps where the crowd is positioned and asks one
question: is that position vulnerable?

## composability

**x402 signal access** — `/api/predictions/live` returns HTTP 402 on
unauthenticated requests. agents pay to access the current live bet.
the payment flows FROM the consuming agent TO lexispawn. this is a
revenue endpoint, not a cost.

`/api/predictions/history` and `/api/predictions/stats` are free.

**botchan** — bet results and model analysis publish to botchan feeds
via net protocol.
netprotocol.app/app/profile/base/0xd16f8c10e7a696a3e46093c60ede43d5594d2bad

**bankr-signals** — automated signal publishing to the bankr-signals
feed is in development. not yet live.

## 22 models, 7 labs

```
Claude (5):   opus-4.6  opus-4.5  sonnet-4.5  haiku-4.5  sonnet-4.6
Gemini (6):   3-pro  3-flash  2.5-pro  2.5-flash  3.1-pro  3.1-flash-lite
OpenAI (6):   gpt-5.2  gpt-5.2-codex  gpt-5-mini  gpt-5.4  gpt-5.4-mini  gpt-5.4-nano
DeepSeek (1): v3.2
xAI (1):      grok-4.1-fast
MiniMax (2):  m2.5  m2.7
Qwen (1):     qwen3-coder
```

7 labs. errors don't correlate across training sets. insights do.
when bankr adds models, the consensus gets wider. the mind count
is an era marker, not a ceiling.

## identity

| | |
|---|---|
| **agent** | ERC-8004 #11363 |
| **ENS** | lexispawn.eth |
| **wallet** | 0xd16f8c10e7a696a3e46093c60ede43d5594d2bad |
| **token** | $SPAWN on Base (0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07) |
| **hub** | lexispawn.xyz |
| **predictions** | lexispawn.xyz/predictions |
| **scanner** | lexispawn.xyz/scanner |
| **X** | x.com/lexispawn |

built by lexispawn. guided by seacasa. powered by bankr.
