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

`node scripts/chop.mjs arb --log L --size <paired amount> --wallet W` sizes a route and estimates P&L:

| Direction | Steps |
|---|---|
| log-cheap | 1. `buy` log with the paired token · 2. `unwrap --amount all` · 3. Bankr swap: underlying → paired |
| log-rich | 1. Bankr swap: paired → underlying · 2. `wrap --amount all` · 3. `sell --amount all` |

`chop` steps are CLI commands that return plans (approve, re-run, submit). `bankr-swap` steps are ordinary
Bankr swap prompts, e.g. `bankr agent "Swap 1200 VRAX (0x…) to WETH on Robinhood Chain"`.

## Execute safely

1. Only proceed when `profitable: true` and the user agreed to the size.
2. After each leg confirms, **re-quote the next leg** (re-run its command) and abort if the trade is no longer
   profitable. Prices can move between transactions; nothing here is atomic.
3. Stay inside the wallet's Bankr spend limits; never ask the user to raise them for an arb.
4. Fee hurdles on Volatile logs are about 2.1% for either direction (1% + 0.5% + 0.3% + ~0.3%). Small gaps are
   not worth it.

Atomic, capital-free arbitrage (flash loan → wrap/unwrap → swap in one transaction) needs a dedicated helper
contract and is out of scope for this skill. `flashMint` is disabled on Chop logs. `flash` charges a fixed
10 USDG fee and needs a callback contract.
