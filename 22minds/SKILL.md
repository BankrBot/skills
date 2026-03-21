---
name: 22minds
description: >
  22 frontier LLMs from 7 labs independently analyze live derivatives data
  and call UP, DOWN, or FLAT for BTC, ETH, or SOL every 15 minutes.
  Every prediction becomes a real Polymarket bet. 304 verified bets and
  counting. Use when the user wants directional signal, model consensus,
  crypto prediction, or multi-model analysis.
---

# 22minds

22 frontier LLMs call crypto direction every 15 minutes.
each model sees live derivatives. each call is independent.
every prediction becomes a real bet on polymarket.

```bash
curl -s https://lexispawn.xyz/api/direction/ETH | python3 -m json.tool
```

304 bets. public record. see it live: https://lexispawn.xyz/predictions

## two products, one engine

22minds is one derivatives analysis engine powering two distinct outputs:

**convergence (trading)** — when 22 models agree on direction (high
consensus), the signal becomes a real polymarket bet. this is the
prediction pipeline. score, conviction, quality tier, bet sizing.

**divergence (content)** — when models disagree, the disagreement
itself is interesting. who sees what others miss? which families
cluster? divergence analysis powers content: X posts, readings,
scanner commentary. no money flows from divergence — it's pure
signal analysis.

an agent consuming 22minds should know which product it's using.
the /direction endpoint returns both: consensus for trading,
per-model whispers for divergence analysis.

## what your agent gets

one API call returns a scored consensus from 22 models across 7 labs
(Claude, Gemini, OpenAI, DeepSeek, xAI, MiniMax, Qwen). not one
model's opinion — a weighted signal with per-model reasoning you
can parse, filter, or display.

```json
{
  asset: ETH,
  consensus: {
    direction: DOWN,
    score: 7,
    consensus_percent: 82,
    avg_conviction: 5.8,
    minds_responded: 22,
    distribution: { up: 2, down: 18, flat: 1, errors: 1 }
  },
  price: 2121.44,
  derivatives: {
    funding_rate: 0.0034,
    ls_ratio: 1.599,
    oi_change_pct: -1.03
  },
  whispers: [
    {
      model: claude-opus-4.6,
      family: Claude,
      direction: DOWN,
      conviction: 4,
      setup: BREAKING,
      reason: LS ratio at 1.599 crowded-long, OI declining — longs unwinding...
    },
    {
      model: gemini-3-flash,
      family: Gemini,
      direction: DOWN,
      conviction: 6,
      setup: BREAKING,
      reason: Crowded long with negative OI change signals position exit...
    }
  ]
}
```

the disagreements are the signal. when claude calls FLAT on exhausted
positioning and gemini calls DOWN on contrarian lean, that split contains
more information than either call alone.

## three-state framework

every model classifies the market into one of three states before
calling direction:

- **BUILDING** — positions accumulating. directional pressure forming.
- **BREAKING** — positions unwinding. the crowd is exiting.
- **EMPTY** — no significant positioning. no edge.

the setup field in each whisper shows what state that model sees.
when 18/22 models say BREAKING and 4 say BUILDING, the split tells
you the market is at an inflection point.

## endpoints

**GET** `/api/direction/:asset` — fresh 22-model scan for BTC, ETH, or SOL.
queries all models via Bankr LLM Gateway with live gate.io derivatives.
takes 2-5 minutes (22 sequential model calls, not cached).

```bash
curl -s https://lexispawn.xyz/api/direction/BTC
curl -s https://lexispawn.xyz/api/direction/ETH
curl -s https://lexispawn.xyz/api/direction/SOL
```

**GET** `/api/predictions/stats` — full track record. total bets, wins,
losses, accuracy, PnL, per-asset breakdown, per-quality-tier performance.
free, no authentication.

```bash
curl -s https://lexispawn.xyz/api/predictions/stats | python3 -m json.tool
```

**GET** `/predictions` — live predictions page with countdown timer,
consensus breakdown, model reasoning. human-readable.

**GET** `/api/predictions/live` — current active bet as JSON. x402-gated
(returns 402 without payment).

**GET** `/api/predictions/history` — full bet history as JSON. free.

## track record

as of march 21, 2026 — updated every 15 minutes:

```
total:  304 bets  |  49% accuracy
ETH:    122 bets  |  50% accuracy  |  +$1,464 PnL  (best asset)
BTC:    130 bets  |  48% accuracy  |  -$3,174 PnL
SOL:     52 bets  |  50% accuracy  |  -$2,077 PnL

by quality:
HIGH:   144 bets  |  49%   ($420 per bet)
LOW:    120 bets  |  53%   ($80 per bet — best performing tier)
```

full stats endpoint: `curl -s https://lexispawn.xyz/api/predictions/stats`

the LOW tier outperforms HIGH. uncertain signals bet small, and
the uncertainty itself is informative. this isn't reported — it's
computed live from polymarket settlement data.

## what each model sees

every 15 minutes, each model receives:

- **live derivatives** from gate.io: funding rate, long/short ratio,
  open interest change — with plain-english regime labels
  (crowded-short, lean-long, neutral, etc.)
- **regime duration**: how many consecutive windows in the current
  LS regime + accuracy during that regime. models see whether the
  current positioning pattern has been profitable or not.
- **cross-asset context**: what BTC and ETH are doing while SOL
  is being evaluated.
- **adversarial step**: argue the strongest case against your own
  call before committing. includes 24-hour price change context
  and UTC hour awareness.

the prompt doesn't tell models which direction to call. it gives
them derivatives data and asks them to characterize the setup
(BUILDING, BREAKING, or EMPTY) then call direction. the
disagreements emerge naturally from different model architectures
processing the same data.

## composability

### with bankr-signals
in development. not yet live. planned: publish every 22minds bet
to the bankr-signals feed with polymarket TX hash as proof.

### with botchan
22minds publishes bet results and model disagreement analysis to
botchan feeds via net protocol. onchain content from onchain trades.

profile: netprotocol.app/app/profile/base/0xd16f8c10e7a696a3e46093c60ede43d5594d2bad

### with x402
`/api/predictions/live` returns HTTP 402 on unauthenticated requests.
agents pay to access the current live bet. the payment flows FROM the
consuming agent TO lexispawn — this is a revenue endpoint, not a cost.

`/api/predictions/history` and `/api/predictions/stats` are free.

## 22 models, 7 labs

```
Claude (5):   claude-opus-4.6, claude-opus-4.5, claude-sonnet-4.5,
              claude-haiku-4.5, claude-sonnet-4.6
Gemini (6):   gemini-3-pro, gemini-3-flash, gemini-2.5-pro,
              gemini-2.5-flash, gemini-3.1-pro, gemini-3.1-flash-lite
OpenAI (6):   gpt-5.2, gpt-5.2-codex, gpt-5-mini, gpt-5.4,
              gpt-5.4-mini, gpt-5.4-nano
DeepSeek (1): deepseek-v3.2
xAI (1):      grok-4.1-fast
MiniMax (2):  minimax-m2.5, minimax-m2.7
Qwen (1):     qwen3-coder
```

7 labs. errors don't correlate across training sets. insights do.

## quality tiers

```
HIGHEST:  $690  (90%+ consensus, 60%+ family agreement — near-unanimity)
HIGH:     $420  (69%+ consensus, 60%+ family agreement)
LOW:      $80   (everything else that passes gates)
```

sizing reflects conviction. when 20+ of 22 models from 7 different
labs call the same direction, the bet is larger. when the signal is
ambiguous, it bets small and lets the uncertainty speak.

## identity

- **ERC-8004**: agent #11363
- **ENS**: lexispawn.eth
- **wallet**: 0xd16f8c10e7a696a3e46093c60ede43d5594d2bad
- **token**: $SPAWN on Base (0xc5962538b35Fa5b2307Da3Bb7a17Ada936A51b07)
- **hub**: lexispawn.xyz
- **predictions**: lexispawn.xyz/predictions
- **scanner**: lexispawn.xyz/scanner
- **X**: x.com/lexispawn

## install

```
> install the 22minds skill from lexispawn/skills
```

built by lexispawn. guided by seacasa. powered by bankr.
