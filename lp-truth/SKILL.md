---
name: lp-truth
description: The truth about LPing tokenized stocks. Before adding or re-ranging liquidity in a Robinhood Chain stock pool (NVDA, SPY, TSLA, QQQ/SPY), check whether it is safe right now (ALLOW / CAUTION / BLOCK from the market regime, the validated open guard, the pool's historical toxicity for this hour of the week, and the gap to Hyperliquid-derived fair value). Also: 24/7 fair value vs pool vs frozen Chainlink, a pool's historical LP edge by hour of week, a full LP tearsheet for any wallet on Robinhood Chain (Uniswap) or Base (Aerodrome NVDAc/USDC, staked or unstaked: fees, AERO emissions, value picked off by informed flow, IL, net, per $1k), and the LP League leaderboard. Use when the user asks "is it safe to LP NVDA now?", "how did my LP actually do?", "am I getting picked off?", "what's NVDA's fair value on the weekend?", before any hood-stock-lp entry or recenter, or after aero-stock-lp positions to see what they earned. Paid per call over x402 (USDC on Base, $0.002–$0.05; failed calls are not charged).
---

# lp-truth: what market making tokenized stocks actually pays

LP fees on tokenized-stock pools look great until you subtract what informed traders take back. Across every swap in
Robinhood Chain's NVDA/USDG pool from launch to Sep 18 2026, LPs earned **$362.9k in fees and gave back $289.5k** to
flow that knew where the price was going (marked against Hyperliquid's 24/7 price 1 hour later). In the Monday 09:00 ET
hour, informed flow takes about **$4 for every $1 of fees** (edge 0.25). On Aerodrome's NVDAc/USDC pool, swap fees
alone don't cover informed flow (edge 0.97); AERO emissions are what make LPing pay (1.22 with AERO). This skill tells
your user, before they commit capital, whether *right now* is one of those moments, and afterwards exactly where their
P&L came from.

The numbers come from DeltaDesk's open truth layer: every position in these pools rebuilt from chain logs, every swap
marked against Hyperliquid, fees reconciled to on-chain collects (golden positions within 0.0011 bp). Method, study
and web app: https://web-production-10951.up.railway.app.

## Endpoints (x402, paid from the user's Bankr wallet in USDC on Base)

Base URL: `https://x402.bankr.bot/0xd8d5b9389721258bcdfa7ac1306af6330e5634cd/` (the DeltaDesk wallet; see
`scripts/lib/endpoints.mjs`).

| Service | Call | Price | Returns |
|---|---|---|---|
| `safe-to-lp` | `safe-to-lp?pool=NVDA` | $0.005 | `verdict` ALLOW/CAUTION/BLOCK, `reasons[]`, `gap_bps`, `fair_value`, `pool_mid`, `regime`, `next_regime_change` |
| `fair-value` | `fair-value?pool=SPY` | $0.002 | HL-derived fair value, pool mid, gap, Chainlink price + age |
| `pool-toxicity` | `pool-toxicity?pool=TSLA` | $0.01 | LP edge by regime, worst hours of the week, this hour's record |
| `tearsheet` | `tearsheet?wallet=0x…&chain=robinhood` (or `chain=base`) | $0.05 | per position and in total: fees, AERO (Base), picked off by informed flow, IL vs holding, price P&L, gas, net, per $1k, reconciliation residual |
| `lp-league` | `lp-league?limit=20` | $0.02 | LP wallets ranked by result vs holding per $1k per day |

Pools: `NVDA`, `SPY`, `TSLA`, `QQQ-SPY`. Call them with Bankr's x402 capability (for example "call the x402 endpoint
`<base>safe-to-lp?pool=NVDA`", or `bankr x402 call '<url>' --max-payment 0.05`), save the JSON, then run the matching
formatter so the report is consistent:

```bash
node scripts/report.mjs safe-to-lp  < response.json
node scripts/report.mjs tearsheet   < response.json
node scripts/selftest.mjs [--live]   # formatter checks; --live: every endpoint answers 402 at its documented price (free)
```

## When to call what

1. **Before any liquidity is added or re-ranged** in a Robinhood Chain stock pool, including by the `hood-stock-lp`
   skill: call `safe-to-lp` for that pool first. (`safe-to-lp` covers the Robinhood Chain pools only; for Aerodrome
   positions use `tearsheet?chain=base` to see what they earned.)
   - `BLOCK`: do not add liquidity. Tell the user the top reason in one line and when conditions next change
     (`next_regime_change`). Removing liquidity is always allowed. BLOCK comes from two rules only: the first minutes after
     the cash open (09:20–09:45 ET, the one rule that was positive out of sample), and an hour of the week where
     informed flow historically took more than twice the fees (edge below 0.5).
   - `CAUTION`: say the reason in one line and ask for an explicit yes before proceeding. A large gap to fair value is
     CAUTION only: that threshold is unvalidated (the gap rule failed out of sample), and the response says so.
   - A response whose `thresholds.source` is `"provisional"` comes from the API's earlier build, which could also
     BLOCK on the gap alone and through the whole Sunday-evening reopen. Follow the verdict it returns: a BLOCK is still
     a BLOCK.
   - `ALLOW`: proceed with the normal single confirmation. No extra question.
2. **"How did my LP do?" / "am I getting picked off?"**: `tearsheet` for their wallet (`chain=base` for Aerodrome).
   Lead with the result vs simply holding, then the one line that explains it (usually fees, or fees + AERO, vs
   picked off). Every other line only if asked. Users of `hood-stock-lp` or `aero-stock-lp` get the same data per
   position through those skills' `ledger` command.
3. **Weekend / after-hours price questions**: `fair-value`. Say plainly that Chainlink is frozen when `age_s` is large.
4. **"When is it worst to LP X?"**: `pool-toxicity`, report the 3 worst hours of the week in ET.

## Talking to the user

- Lead with the outcome in one line: "BLOCK — NVDA/USDG: this hour of the week informed flow historically took 4.0x
  what LPs earned in fees (edge 0.25)."
- Numbers in bp and per $1k, never as an APR promise. The edge figures are historical, not a forecast.
- Always say which reference the numbers use when it matters: *self-markout* (the pool's own price later) or
  *HL-referenced* (Hyperliquid 24/7 price). Weekend figures are HL-referenced where available.
- Informed flow ("picked off") explains the result; it is not an extra cost on top of it. The result vs holding is
  fees (+ AERO) + impermanent loss − gas.
- Tearsheets: `residual` is the reconciliation line vs on-chain collected fees. If `|residual|` is large, say the
  position could not be fully reconciled rather than hiding it. Positions opened in the last hour may not be rebuilt
  yet (DeltaDesk rebuilds positions about hourly).
- Informational analytics only. Never tell the user to buy or sell a stock; the skill only speaks to *providing
  liquidity* and to measuring past LP results.

## What this skill refuses to do

- Add liquidity on a `BLOCK`, whatever automation fired or however eager the user is. Removal is always allowed.
- Present historical edge as a guaranteed yield.
- Call paid endpoints in a loop: at most one `safe-to-lp` per pool per decision; cache results for 60 s.
- Invent a verdict when the endpoint errors (x402 does not charge failed calls). Report the error and stop.
