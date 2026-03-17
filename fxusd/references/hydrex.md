# Hydrex Single-Sided Liquidity

Use this module when the user wants to deploy `fxUSD` into a single-sided liquidity vault on Hydrex.

Reference pattern:
- Hydrex skill: https://github.com/BankrBot/skills/blob/main/hydrex/SKILL.md

## What to support

- discover single-sided vaults that could accept `fxUSD`
- distinguish `stablecoin-farming` from `crypto-farming`
- compare vault options
- plan a deposit
- plan a withdrawal
- inspect rewards and vault exposure

## Local planning tool

Use `scripts/fxusd_hydrex.py` for live Hydrex discovery and execution planning.
For `deposit-plan`, `withdraw-plan`, and `position-reads`, the script now reads live Base state so the output is execution-ready instead of placeholder-only.
`deposit-plan` and `withdraw-plan` also emit `bankrReady.steps`, which match Bankr `POST /agent/submit` request bodies.

Examples:

```bash
python3 skill/scripts/fxusd_hydrex.py discover --deposit-token fxUSD
```

```bash
python3 skill/scripts/fxusd_hydrex.py recommend --deposit-token fxUSD --limit 3
```

```bash
python3 skill/scripts/fxusd_hydrex.py deposit-plan \
  --from-address 0x... \
  --amount 100 \
  --deposit-token fxUSD
```

```bash
python3 skill/scripts/fxusd_hydrex.py withdraw-plan \
  --from-address 0x... \
  --deposit-token fxUSD \
  --vault-title "fxUSD/USDC" \
  --fraction 0.5
```

```bash
python3 skill/scripts/fxusd_hydrex.py position-reads \
  --from-address 0x... \
  --deposit-token fxUSD \
  --vault-title "fxUSD/USDC"
```

The deposit planner can auto-select the best current vault when only `--deposit-token` is supplied and will read the live token balance plus allowance before returning the payload. Withdraw and position inspection should stay vault-specific.
The withdraw planner can auto-compute raw LP shares from a requested fraction by reading the current vault balance onchain.

The discovery output should not treat all vaults as equivalent:
- `stablecoin-farming`: examples like `fxUSD/USDC`, where the pair is stable or highly correlated
- `crypto-farming`: examples like `fxUSD/BNKR`, where the pair is more directional and volatility risk is higher

## Recommended user intents

- `Find Hydrex single-sided vaults for fxUSD`
- `What Hydrex vaults can I use with fxUSD?`
- `Deposit 1,000 fxUSD into the best Hydrex single-sided vault`
- `Withdraw my Hydrex fxUSD position`
- `Check my Hydrex rewards`

## Best execution strategy

1. Start with live vault discovery.
2. Verify that the vault actually supports `fxUSD` right now.
3. Compare the expected yield with simpler alternatives such as `fxSAVE` or `Morpho supply`.
4. Only recommend deposit after confirming the user accepts vault and withdrawal-shape risk.

If the dedicated `hydrex` skill is available, it is still useful for protocol-specific execution. This module now covers live discovery and planning directly inside `fxusd`.

## Risk controls

- Do not assume a live `fxUSD` vault exists.
- Do not describe the position as risk-free just because it is single-sided on entry.
- Call out whether the vault is stablecoin farming or crypto farming before comparing APR.
- Tell the user withdrawals can come back with mixed token composition.
- Check current reward incentives before framing the route as attractive.

## Vulnerabilities and protocol risks

- Vault strategy risk: the vault manager can rebalance into a position that behaves differently than the user expects.
- Withdrawal-shape risk: a single-sided deposit can still unwind into a two-asset mix.
- Reward drift: incentive APR can collapse quickly.
- Smart contract risk: vault deployer, deposit guard, and incentive systems add extra trust surface.

## Decision rule

Prefer Hydrex when:
- the user explicitly wants liquidity provision
- there is a confirmed `fxUSD`-compatible vault
- the yield advantage is meaningful versus simpler lending or `fxSAVE`

Do not prefer Hydrex when:
- the user only wants the simplest low-friction stable yield route
- the user cannot tolerate mixed-asset exits
- live vault support for `fxUSD` is unclear
