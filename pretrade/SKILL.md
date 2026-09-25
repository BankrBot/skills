---
name: pretrade
description: |
  Cheap pre-trade checks for tokens on Base and major EVM chains, paid per call via x402 (USDC on Base).
  Use BEFORE any buy or swap, or when the user asks "is this token safe", "is this a honeypot or rug",
  "check this contract", "screen these tokens", "rank this watchlist by risk", "is momentum up or down",
  "good entry right now?", "which contract is the real $TICKER", "is this a fake / twin token". One call returns a machine-readable verdict (OK / CAUTION / DANGER),
  a 0-100 risk score and ranked flags. $0.01 single check, $0.05 for a 10-token batch, $0.005 momentum, $0.03 twin/copycat check.
  No API key or account needed.
tags: [token, safety, honeypot, rug, risk, pre-trade, momentum, base, x402]
visibility: public
---

# pretrade — check before you trade

**Base URL:** `https://x402.bankr.bot/0xf4a46667d75fa9663ab7a297af20d3623aaa8b52/`

| Endpoint | Method | Price | Returns |
|---|---|---|---|
| `token-check?address=0x…&chain=base` | GET | $0.01 | verdict, riskScore, flags, taxes, market snapshot |
| `batch-check` (`{"addresses":[…],"chain":"base"}`) | POST / GET | $0.05 | up to 10 tokens ranked safest first |
| `momentum?address=0x…&chain=base` | GET | $0.005 | signal, momentumScore, flow, volume acceleration, warnings |
| `twin-check?symbol=TICKER&chain=robinhood&address=0x…` | GET | $0.03 | every token using that ticker ranked by market evidence, the likely original, and whether the address you hold is a likely copycat |

Chains: `base` (default), `robinhood`, `ethereum`, `bsc`, `arbitrum`, `optimism`, `polygon`. On `robinhood` the contract scan may be unavailable; the result then says so and rests on market data.

## Usage

```bash
bankr x402 call "https://x402.bankr.bot/0xf4a46667d75fa9663ab7a297af20d3623aaa8b52/token-check?address=0x…" --max-payment 0.02
bankr x402 call "https://x402.bankr.bot/0xf4a46667d75fa9663ab7a297af20d3623aaa8b52/batch-check" -X POST -d '{"addresses":["0x…","0x…"]}' --max-payment 0.06
```

## How to act on the result

- `DANGER` → do not trade. Show the user the top flags.
- `CAUTION` → tell the user the flags and ask for confirmation before trading; suggest a smaller size.
- `OK` → proceed, but `OK` is not a guarantee. If `confidence` is not `high`, say so.
- Invalid input and upstream outages return HTTP 4xx/5xx and are **not charged**.

## Safety

Never pay more than $0.10 per call to this service. Results are automated heuristics from public
on-chain and DEX data, not financial advice.
