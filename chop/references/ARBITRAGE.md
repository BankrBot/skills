# Arbitrage on logs

A log token should trade near **backing × market price of the underlying**. When the pool price drifts away,
an arbitrageur can close the gap. Every leg pays Chop fees, which feed farmers and $CHOP burns.

## Detect

`node scripts/chop.mjs gaps` reports, per log:

- `logPriceInPaired`: mid price in the log's V2 pool.
- `fairValueInPaired`: backing per log token × the underlying's market price in the paired token. Market price
  comes from the deepest Uniswap V3 pool, a known V4 pool, or V2, directly or via WETH.
- `gapPct`, `direction`: `log-cheap` (pool below fair) or `log-rich` (pool above fair).
- `roundTripCostPct`: log fees for the route + 0.3% log pool fee + 0.3% assumed for the external swap.
- `estEdgeBeforeImpactPct`, `actionable`.

These are spot mid prices for **detection only**. Price impact, gas, the real external route fee and moves
between legs decide the actual result.

## Plan

`node scripts/chop.mjs arb --log L --size <paired amount> --wallet W` sizes a route, records the wallet's current
balances (`baseline`) and estimates P&L:

| Direction | Steps |
|---|---|
| log-cheap | 1. `buy --amount <size>` · 2. `arb --leg unwrap --since <log baseline>` · 3. `arb --leg swap-out --since <underlying baseline>` → exact Bankr swap prompt |
| log-rich | 1. Bankr swap of exactly `<size>` paired → underlying · 2. `arb --leg wrap --since <underlying baseline>` · 3. `arb --leg sell --since <log baseline>` |

**An arb only ever spends what its own legs acquired.** Each follow-up leg reads the wallet balance now, subtracts
the baseline recorded in the plan, and builds the transaction for exactly that delta (capped at the plan's
expected amount + 2%). Tokens the wallet held before the arb are never wrapped, unwrapped, sold or swapped.
Never replace a leg with `--amount all`.

Each `arb --leg` call also re-quotes the rest of the route from the acquired amount:

- `status: "ready"` or `"approval-required"`: submit as usual (approvals, then re-run the same `arb --leg` command).
- `status: "abort"`: the route is no longer profitable. Stop and tell the user what the wallet now holds.
- `code: "NOTHING_ACQUIRED"`: the previous leg has not confirmed yet (or this leg already ran). Do not retry blindly.

`bankr-swap` steps are ordinary Bankr swap prompts with an exact amount, e.g.
`bankr agent "Swap 965.06 VRAX (0x…) to WETH on Robinhood Chain"`. Submit them as given; never round up or swap
the whole balance.

## Execute safely

1. Only proceed when `profitable: true` and the user agreed to the size.
2. Run the steps in order, each only after the previous one confirms. Steps 2 and 3 re-quote themselves.
   Prices can move between transactions; nothing here is atomic.
3. Stay inside the wallet's Bankr spend limits; never ask the user to raise them for an arb.
4. Fee hurdles on Volatile logs are about 2.1% for either direction (1% + 0.5% + 0.3% + ~0.3%). Small gaps are
   not worth it.

Atomic, capital-free arbitrage (flash loan → wrap/unwrap → swap in one transaction) needs a dedicated helper
contract and is out of scope for this skill. `flashMint` is disabled on Chop logs. `flash` charges a fixed
10 USDG fee and needs a callback contract.
