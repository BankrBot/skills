# Morpho Lend / Borrow

Use this module when the user wants to supply `fxUSD`, withdraw it later, or borrow against collateral through Morpho-style workflows.

Reference pattern:
- Morpho Earn example: https://clawhub.ai/lyoungblood/morpho-earn

## Important framing

The referenced Morpho skill is a conservative earnings workflow example, not a blanket guarantee that every `fxUSD` market you might want is live.

Treat `Morpho supply` and `Morpho borrow` as two different risk levels:

- `supply`: generally simpler and closer to passive yield
- `borrow`: leverage and liquidation risk

## What to support

- compare Morpho supply versus `fxSAVE` or Hydrex
- plan a `supply fxUSD` action
- plan a `withdraw supplied fxUSD` action
- plan a `borrow fxUSD` action only after validating market and collateral conditions
- plan a `repay fxUSD` action

## Recommended user intents

- `Supply 5,000 fxUSD on Morpho`
- `Withdraw my supplied fxUSD from Morpho`
- `Borrow fxUSD against my collateral on Morpho`
- `Repay my Morpho fxUSD debt`
- `Compare Morpho supply yield with fxSAVE`

## Best execution strategy

For normal yield-seeking users:
1. start with supply-only analysis
2. compare net yield with `fxSAVE`
3. only recommend borrow flows if the user explicitly wants leverage

For borrow flows:
1. verify live market availability first
2. verify the collateral asset and liquidation thresholds
3. recommend a conservative borrow size, not the protocol maximum
4. make liquidation risk explicit before execution

## Risk controls

- Do not assume a specific `fxUSD` market exists without current verification.
- Stay well below max LTV. A safer planning posture is to keep meaningful headroom instead of optimizing for maximum borrow.
- Treat oracle, curator, and market-parameter changes as live risks.
- If rewards are routed through third-party claim-and-swap paths, review that transaction path carefully.

## Vulnerabilities and failure modes

- Liquidation risk: borrowing is the sharpest edge in this skill set.
- Market availability risk: `USDC` examples do not automatically map to `fxUSD`.
- Parameter drift: borrow caps, collateral factors, and rewards can change.
- Oracle dependency: bad or lagging oracle conditions can damage otherwise reasonable leverage.

## Decision rule

Prefer Morpho supply when:
- the user wants simpler yield
- a live `fxUSD` market is confirmed
- the route is operationally simpler than Hydrex for the same capital

Prefer Morpho borrow only when:
- the user explicitly wants leverage or capital efficiency
- collateral assumptions are explicit
- the user accepts liquidation risk

Do not recommend a borrow plan when:
- current market support is unclear
- there is no explicit liquidation buffer
- the user has not asked for leverage
