# Launching a log

## `launch` (recommended: create and seed in one transaction)

```bash
node scripts/chop.mjs launch --token 0xUnderlying --paired CHOP --amount 1000000 --paired-amount 2500 --wallet 0xYou
```

- `--paired`: `CHOP` (default), `WETH` or `USDG`. Pairs other than $CHOP need a reviewed V4 reward route,
  so fees can be converted to $CHOP. The CLI checks `V4RewardRouter.hasRoute(paired)` and that the
  router is approved in the IndexManager. Other tokens are refused (`NO_REWARD_ROUTE`).
- `--amount`: underlying to seed. `--paired-amount`: paired tokens to seed with it. Their ratio sets the
  **starting price** (paired per underlying). The CLI compares it with the market and warns when it is more than
  3% off. A mispriced seed is free money for arbitrageurs, taken from the seeder.
- Fee set: **Volatile** only in this release (wrap 1%, unwrap 1%, buy 0.5%, sell 0.5%, 15% burn), partner 0.
  Name `Chop SYMBOL`, symbol `chSYMBOL`, rewards in $CHOP.
- One log per underlying + paired pair. Duplicates are refused (`DUPLICATE_LOG`).
- Approvals: exact underlying amount and `maxPaired` (paired amount + slippage) to ChopLogSeeder.
- Final call: `ChopLogSeeder.createAndSeed(name, symbol, baseConfig, immutables, (underlyingAmount, pairedPerToken,
  maxPaired, minLog, minStakedLp, deadline))`. It is simulated twice, once to read the expected staked LP and once
  with the protected minimum. The seeded LP is **staked to the launching wallet**, which farms it from block one.
- Tokens with more than 18 decimals or a transfer tax are not supported.

**New logs start pending.** They appear in `logs --all` but are not public, and this skill refuses deposits
(wrap, buy, farm) into them until the Chop team verifies and publishes them. The creator can still exit their own position.

## `create` + `seed` (two steps)

`create --token T --paired P` deploys the log with no liquidity (`IndexManager.deployNewIndex`). Nobody can
trade or farm it until `seed --log L --amount N --paired-amount M` adds the first liquidity through ChopLogSeeder.
The seeder enforces who may fund it (the creator). Prefer `launch`: an unfunded log is easy to mis-seed.

## Admin actions are out of scope

Verifying a log, publishing it (`updateMakePublic`), reward routes and partner fees are owner-only actions taken
by the Chop team through the IndexManager. This skill never builds them.
