# Morpho Lend / Borrow

Use this module when the user wants to supply `fxUSD`, withdraw it later, or evaluate higher-risk borrow paths through Morpho Blue on Base.

Reference patterns:
- Morpho Earn example: https://clawhub.ai/lyoungblood/morpho-earn
- Morpho official GraphQL API: https://docs.morpho.org/tools/offchain/api/graphql/
- Morpho Blue contract interface: https://github.com/morpho-org/morpho-blue/blob/main/src/interfaces/IMorpho.sol

## Important framing

The referenced Morpho skill is a conservative earnings workflow example, not a blanket guarantee that every `fxUSD` market you might want is live.

Treat `Morpho supply` and `Morpho borrow` as two different risk levels:

- `supply`: generally simpler and closer to passive yield
- `borrow`: leverage and liquidation risk

In this skill, `supply` and `withdraw` are execution-ready planning flows.
`borrow` remains planning-only unless explicit collateral and liquidation assumptions are surfaced.

## What to support

- discover live `fxUSD` Morpho Blue markets on Base
- classify collateral quality so supply markets are not compared as if they have the same risk
- recommend safer supply markets with a conservative heuristic
- build a `supply fxUSD` execution plan
- build a `withdraw supplied fxUSD` execution plan
- plan a `borrow fxUSD` action only after validating market and collateral conditions
- compare Morpho supply versus `fxSAVE` or Hydrex

## Current local script

`scripts/fxusd_morpho.py`

Supported commands:

- `discover`
- `recommend`
- `position-reads`
- `risk-check`
- `alert-check`
- `supply-plan`
- `withdraw-plan`
- `repay-plan`
- `add-collateral-plan`
- `borrow-plan`
- `suggest-borrow-size`

The current Morpho module emits:

- live market discovery from Morpho GraphQL
- live Base token balance and allowance checks
- live onchain Morpho position reads
- Bankr-ready `/agent/submit` steps for `supply` and `withdraw`
- Bankr-ready `/agent/submit` steps for `repay` and `add-collateral`
- manual-decision `borrow-plan` output with projected LTV checks
- alert-only monitoring output with `ok / warning / critical` severity for repeated position checks

## Quick LTV checks for agents

When an agent wants to avoid liquidation risk, it should check these fields before designing or suggesting a borrow:

- `currentLtvPercent`
- `maxLtvPercent`
- `recommendedMaxLtvPercent`
- `healthFactor`
- `priceVariationToLiquidationPrice`

Fast heuristic:

1. treat `maxLtvPercent` as the hard protocol edge
2. treat `recommendedMaxLtvPercent` as the practical operating ceiling
3. if `currentLtvPercent` or `projectedLtvPercent` rises above `recommendedMaxLtvPercent`, do not auto-borrow
4. if `healthFactor` trends toward `1`, or `priceVariationToLiquidationPrice` becomes small, repay or add collateral

Helpful commands:

```bash
python3 scripts/fxusd_morpho.py risk-check --from-address 0x... --loan-token fxUSD
```

```bash
python3 scripts/fxusd_morpho.py alert-check --from-address 0x... --collateral-token BNKR --fail-on warning
```

```bash
python3 scripts/fxusd_morpho.py borrow-plan --from-address 0x... --collateral-token wstETH --amount 100
```

```bash
python3 scripts/fxusd_morpho.py suggest-borrow-size --from-address 0x... --collateral-token BNKR
```

```bash
python3 scripts/fxusd_morpho.py repay-plan --from-address 0x... --collateral-token BNKR --fraction 1
```

```bash
python3 scripts/fxusd_morpho.py add-collateral-plan --from-address 0x... --collateral-token BNKR --amount 10
```

For `BNKR` or other altcoin collateral, the skill uses a tighter `riskAdjustedMaxLtvPercent` than the generic recommendation.
That output is meant to be the practical ceiling for agent suggestions.

## Alert-only monitoring

`alert-check` is the safer monitoring entrypoint for agents and automations.

It does not change the position. Instead, it returns:

- `summary.highestLevel`
- per-position `alert.level`
- `alert.reasons`
- `alert.recommendedAction`
- `alert.recommendedRecheckIn`

Default severity model:

- `ok`: no immediate alert
- `warning`: position is approaching a practical ceiling
- `critical`: position needs active intervention, not passive monitoring

Default checks include:

- health factor
- distance to liquidation
- current buffer to LLTV
- current LTV versus the practical warning ceiling

Helpful pattern for agents:

1. run `alert-check`
2. if `highestLevel == ok`, continue monitoring
3. if `highestLevel == warning`, prepare a `repay-plan` or `add-collateral-plan`
4. if `highestLevel == critical`, stop any new borrow action and escalate immediately
5. after the risk-reducing action confirms, re-run `alert-check`

This is especially important for `BNKR` or other altcoin collateral. Those positions should be monitored actively, not just at open.

## Recommended user intents

- `Supply 5,000 fxUSD on Morpho`
- `Show me the safest Morpho market for supplying fxUSD`
- `Withdraw my supplied fxUSD from Morpho`
- `Borrow fxUSD against my collateral on Morpho`
- `Repay my Morpho fxUSD debt`
- `Compare Morpho supply yield with fxSAVE`
- `Check my Morpho LTV before borrowing more fxUSD`
- `Suggest a safe fxUSD borrow size using my BNKR collateral`
- `Repay 50% of my Morpho fxUSD debt`
- `Add 10 BNKR collateral to my Morpho fxUSD position`

## Best execution strategy

For normal yield-seeking users:
1. start with supply-only analysis
2. discover live `fxUSD` markets first
3. prefer listed markets with stronger collateral quality and deeper liquidity
4. compare net yield with `fxSAVE`
5. only recommend borrow flows if the user explicitly wants leverage

For borrow flows:
1. verify live market availability first
2. verify the collateral asset and liquidation thresholds
3. recommend a conservative borrow size, not the protocol maximum
4. make liquidation risk explicit before execution
5. leave the final borrow decision to the user
6. for existing borrow positions, run `alert-check` on a timer before discussing any new borrow or withdrawal

For risk reduction flows:
1. if the position is in `warning`, prefer `repay-plan` first
2. use `add-collateral-plan` when the user wants to keep the debt open and actually holds spare collateral
3. for full debt reduction, prefer share-based `repay-plan --fraction 1`
4. after execution, run `alert-check` again instead of assuming the position is safe

For withdraw flows:
1. prefer share-based withdrawal planning instead of asset-based max guesses
2. check whether the wallet also has active borrow shares or posted collateral
3. if the position is no longer supply-only, stop and require manual review before execution

## Risk controls

- Do not assume a specific `fxUSD` market exists without current verification.
- Do not compare markets with blue-chip collateral and tail-risk collateral as if they belong to the same safety tier.
- Stay well below max LTV. A safer planning posture is to keep meaningful headroom instead of optimizing for maximum borrow.
- Treat oracle, curator, and market-parameter changes as live risks.
- If rewards are routed through third-party claim-and-swap paths, review that transaction path carefully.
- Do not auto-execute a withdraw from a position that also has active borrow shares or collateral without explicit review.
- Do not auto-execute a borrow plan just because the protocol would allow it; use the recommended LTV buffer as the operational ceiling.
- Do not assume an add-collateral plan is feasible without checking actual collateral token balance and allowance.
- For full repay, prefer share-based repayment planning to reduce borrow-share rounding risk.

## Vulnerabilities and failure modes

- Liquidation risk: borrowing is the sharpest edge in this skill set.
- Market availability risk: `USDC` examples do not automatically map to `fxUSD`.
- Collateral-quality confusion: `fxUSD/wstETH` and `fxUSD/BNKR` should not be treated like equivalent supply routes.
- Parameter drift: borrow caps, collateral factors, and rewards can change.
- Oracle dependency: bad or lagging oracle conditions can damage otherwise reasonable leverage.
- Share-vs-asset rounding: for withdraws, a full-position action is safer when based on shares, not guessed asset amounts.

## Decision rule

Prefer Morpho supply when:
- the user wants simpler yield
- a live `fxUSD` market is confirmed
- the route is operationally simpler than Hydrex for the same capital
- the collateral side of the market is acceptable for the user's risk tolerance

Prefer Morpho borrow only when:
- the user explicitly wants leverage or capital efficiency
- collateral assumptions are explicit
- the user accepts liquidation risk
- the projected LTV remains below the recommended safety buffer, not just below protocol max

Do not recommend a borrow plan when:
- current market support is unclear
- there is no explicit liquidation buffer
- the user has not asked for leverage
