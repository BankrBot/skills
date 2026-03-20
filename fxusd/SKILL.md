---
name: fxusd
description: Use when the user wants to deploy, unwind, or compare fxUSD-related yield strategies on Base. Covers minting and redeeming fxSAVE, discovering and managing Hydrex single-sided liquidity vaults, and planning Morpho supply or borrow workflows with protocol-specific risk controls. Uses the local fxSAVE app backend for shortcut bundles and emits Bankr-ready transaction steps for Hydrex.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💵",
        "homepage": "https://fxsave.up.railway.app/",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# fxusd

Version: `v0.9.0`

Use this skill when the user wants a simpler way to put `fxUSD` to work on Base.

The job of this skill is to hide unnecessary DeFi complexity. Instead of asking the user to think in terms of bridging, approvals, vault mechanics, borrow limits, or withdrawal edge cases, this skill turns a simple outcome into a protocol-specific execution plan.

## Quick Start

### Mint fxSAVE

```text
Deposit 10 fxUSD to fxSAVE
```

```text
Deposit all my idle USDC to fxSAVE
```

### Redeem fxSAVE

```text
Redeem 50% of my fxSAVE to fxUSD
```

```text
Redeem all my fxSAVE to USDC on Base
```

### Hydrex Single-Sided Liquidity

```text
Find the best Hydrex single-sided vault for fxUSD
```

```text
Deposit 500 fxUSD into the safest Hydrex vault
```

```text
Withdraw my fxUSD/BNKR Hydrex vault position
```

### Morpho Supply / Borrow

```text
Supply 5000 fxUSD on Morpho
```

```text
Borrow fxUSD against my collateral on Morpho
```

## Core Capabilities

### fxSAVE Shortcut

- Mint Base `fxSAVE` from Base assets such as `fxUSD`, `USDC`, and `WETH`
- Redeem Base `fxSAVE` back into Base assets
- Hide the manual `Base -> Ethereum mainnet -> bridge back` flow behind one Base-side action
- Use the local app backend to build the executable route

**Reference**: [references/api.md](references/api.md)

### Hydrex Single-Sided Liquidity

- Discover live Hydrex vaults that accept `fxUSD` or other supported deposit tokens
- Distinguish `stablecoin-farming` from `crypto-farming`
- Rank vaults with a conservative heuristic that considers APR, TVL, and risk class
- Produce execution-ready deposit and withdraw plans
- Emit Bankr-ready `/agent/submit` steps for Hydrex approval and main transactions

**Reference**: [references/hydrex.md](references/hydrex.md)

### Morpho Supply / Borrow Planning

- Discover live Base Morpho Blue markets for `fxUSD`
- Produce execution-ready supply and withdraw plans for `fxUSD`
- Produce manual-decision borrow plans with projected LTV checks
- Provide quick risk-check outputs for agents to monitor current LTV and liquidation distance
- Provide alert-only monitoring outputs with `ok / warning / critical` levels for repeated position checks
- Produce execution-ready `repay-plan` and `add-collateral-plan` outputs for risk reduction
- Suggest safer maximum borrow sizes from the current collateral position
- Compare Morpho lending with simpler `fxSAVE` or Hydrex routes
- Treat borrow as a separate, higher-risk class from pure supply
- Require explicit collateral, buffer, and market-availability checks before borrow planning

**Reference**: [references/morpho.md](references/morpho.md)

Common Morpho user use cases:
- Monitor current `fxUSD` borrow positions and alert when they drift into warning or critical territory
- Check whether a wallet can safely borrow more `fxUSD` against collateral such as `BNKR` or `wstETH`
- Reduce risk with a `repay-plan` when the user wants the most direct way to lower LTV
- Keep a borrow position open with `add-collateral-plan` when the user has spare collateral and wants a wider liquidation buffer

## Execution Model

### 1. fxSAVE

Use when the user wants:
- `fxUSD / USDC / WETH -> fxSAVE`
- `fxSAVE -> Base assets`
- the simplest Base-side UX for a cross-chain yield route

Execution path:
1. Read [references/api.md](references/api.md).
2. Use `scripts/fxusd_cli.py` or the local app backend to build the bundle.
3. Build approval for the current source token.
4. Execute approval only if allowance is insufficient.
5. Execute the main transaction.
6. Explain that settlement is asynchronous because the route crosses Base and Ethereum mainnet.

### 2. Hydrex

Use when the user wants:
- a single-sided liquidity vault for `fxUSD`
- to deposit idle `fxUSD` into an auto-managed vault
- to withdraw from a Hydrex vault
- to inspect current Hydrex vault exposure

Execution path:
1. Read [references/hydrex.md](references/hydrex.md).
2. Use `scripts/fxusd_hydrex.py` to discover, rank, and plan the vault action.
3. Distinguish `stablecoin-farming` from `crypto-farming` before comparing APR.
4. Read live Base balance, allowance, or LP share state.
5. Emit execution-ready transactions and Bankr-ready submit steps.
6. Only proceed when the wallet actually has balance or LP shares for the chosen action.

### 3. Morpho

Use when the user wants:
- to supply `fxUSD`
- to withdraw supplied `fxUSD`
- to borrow using collateral
- to repay borrowed `fxUSD`
- to compare lending yield versus `fxSAVE`

Execution path:
1. Read [references/morpho.md](references/morpho.md).
2. Use `scripts/fxusd_morpho.py` to discover live markets and wallet positions.
3. Distinguish conservative supply routes from higher-risk borrow routes.
4. Use execution-ready supply and withdraw plans for simpler flows.
5. Use `alert-check` for recurring monitoring before considering any automated response.
6. Use `repay-plan` or `add-collateral-plan` as the first response when a borrow position moves into warning or critical territory.
7. Only plan borrow actions when collateral assumptions, liquidation buffer, and oracle risk are explicit.

## Common Workflows

### Simplest Stable Yield Route

When the user wants the lowest operational complexity:

1. Prefer `fxSAVE`.
2. Use the local app backend.
3. Make the bridge latency explicit.
4. Do not describe settlement as instant.

### Stablecoin Liquidity Route

When the user explicitly wants liquidity provision rather than a simpler yield wrapper:

1. Use Hydrex discovery.
2. Prefer `stablecoin-farming` vaults such as `fxUSD/USDC` when the user wants lower pair volatility.
3. Explain that single-sided deposit does not guarantee single-token withdrawal.
4. Use Bankr-ready steps only after live balance and allowance checks pass.

### Crypto Pair Farming Route

When the vault pairs `fxUSD` with a volatile asset such as `BNKR`:

1. Label it `crypto-farming`.
2. Do not compare it to `fxUSD/USDC` as if they have the same risk class.
3. Make pair volatility and withdrawal-shape risk explicit before execution.

### Lending or Leverage Route

When the user wants capital efficiency or borrowing:

1. Use Morpho planning.
2. Prefer supply over borrow when the user has not explicitly asked for leverage.
3. If borrow is requested, preserve a conservative liquidation buffer.
4. For ongoing borrow positions, use `alert-check` to surface warning or critical states before acting.
5. Prefer `repay-plan` first, and use `add-collateral-plan` when the user has spare collateral inventory and wants to keep the debt open.

## Decision Guide

Prefer `fxSAVE` when:
- the user wants the simplest Base-side flow
- the user does not want to manage vaults
- the user values lower operational complexity over optional extra yield

Prefer Hydrex when:
- the user explicitly wants single-sided liquidity
- a live vault exists for the desired asset
- the user accepts that withdrawals may return a mixed token composition

Prefer Morpho supply when:
- the user wants a more direct lending route
- the user does not need liquidity pool exposure

Prefer Morpho borrow only when:
- the user explicitly wants leverage or capital efficiency
- collateral, liquidation buffer, and market risk are understood

## Risk Controls

These are mandatory guardrails.

- Use a dedicated hot wallet or dedicated Bankr agent wallet for repeated execution.
- Verify chain and token addresses before every write action.
- Do not describe `fxSAVE` as a same-chain or instant route.
- On Hydrex, always explain withdrawal composition risk.
- On Hydrex, always distinguish `stablecoin-farming` from `crypto-farming`.
- On Morpho, stay well below maximum borrow limits and preserve a clear liquidation buffer.
- Do not rely blindly on third-party assembled transactions from aggregators or reward routers.
- For auto-compounding or repeated execution, require explicit user confirmation before widening blast radius.

## Vulnerabilities and Failure Modes

### fxSAVE

- Bridge latency: source-chain success is not final settlement
- Quote drift: the final amount can move while the route is in flight
- Intermediate-chain residue: favorable execution can leave small balances on intermediate chains

### Hydrex

- Vault strategy risk: a managed vault can rebalance in ways the user does not expect
- Withdrawal composition risk: the exit can come back split across assets
- Pair-risk confusion: `fxUSD/USDC` and `fxUSD/BNKR` do not belong to the same risk class
- Incentive drift: APR can move quickly as emissions and TVL change

### Morpho

- Liquidation risk: borrowing is not the same as supplying to a conservative vault
- Market availability risk: a route that exists for `USDC` may not exist for `fxUSD`
- Oracle and curator risk: safety depends on the specific market and collateral design
- Automation risk: external transaction assembly must be treated as sensitive

## Example Prompts

### fxSAVE

- `Deposit 10 fxUSD to fxSAVE`
- `Redeem 50% of my fxSAVE to fxUSD`
- `Compare fxSAVE and Morpho yield options for my fxUSD`
- `Monitor my Morpho fxUSD positions and alert me if they become risky`
- `Run an alert-only Morpho risk check on my BNKR-backed fxUSD borrow`
- `Build a repay plan to lower risk on my BNKR-backed fxUSD borrow`
- `Build an add-collateral plan for my BNKR-backed fxUSD borrow`
- `Use my Bankr wallet to mint fxSAVE from 100 fxUSD`
- `Use Bankr to redeem all my fxSAVE to USDC on Base`

### Hydrex

- `Find the best Hydrex single-sided vault for fxUSD`
- `Show me stablecoin-farming vaults for fxUSD on Hydrex`
- `Deposit all my idle fxUSD into Hydrex`
- `Withdraw my fxUSD/BNKR Hydrex vault position`
- `Use my Bankr wallet to withdraw my Hydrex vault shares`
- `Use Bankr to deposit 100 fxUSD into the safest Hydrex vault`
- `Use Bankr to withdraw 50% of my BNKR/fxUSD Hydrex position`

### Morpho

- `Supply 5,000 fxUSD on Morpho`
- `Find the safest Morpho market for supplying fxUSD`
- `Withdraw 50% of my supplied fxUSD from Morpho`
- `Borrow fxUSD against my collateral on Morpho`
- `Check my Morpho LTV before borrowing more fxUSD`
- `Suggest a safe fxUSD borrow size using my BNKR collateral`
- `Compare Morpho supply with fxSAVE for my idle fxUSD`
- `Use Bankr to supply my idle fxUSD on Morpho`
- `Use Bankr to compare Morpho and fxSAVE for my Bankr wallet`

## Resources

- **fxSAVE app**: https://fxsave.up.railway.app/
- **Hydrex Platform**: https://hydrex.fi
- **Morpho**: https://morpho.org/

## Natural Language Guidance for Bankr

When the user wants execution through Bankr:

1. Resolve which module the request belongs to: `fxSAVE`, `Hydrex`, or `Morpho`.
2. Prefer wallet-aware language such as `Use my Bankr wallet...` when the user explicitly wants Bankr execution.
3. For `fxSAVE`, use the local app backend to build approval and main transaction plans first.
4. For `Hydrex`, use `scripts/fxusd_hydrex.py` and prefer the emitted `bankrReady.steps`.
5. For conservative Morpho lending, use `scripts/fxusd_morpho.py` and prefer supply or withdraw over borrow by default.
6. For Morpho borrow, use `risk-check` and `borrow-plan`, but keep the final borrow decision with the user.
7. Execute steps in order and wait for confirmation before moving to the next step.
8. If live balance, allowance, LP shares, supply shares, or collateral headroom are insufficient, stop and explain the blocker instead of forcing execution.

Useful natural-language styles:

- `Use my Bankr wallet to mint fxSAVE from 25 fxUSD`
- `Use Bankr to deposit all my idle fxUSD into the safest Hydrex stablecoin vault`
- `Use Bankr to withdraw my Hydrex fxUSD/BNKR position`
- `Use Bankr to supply 100 fxUSD to the safest Morpho market`
- `Use Bankr to withdraw all my supplied fxUSD from Morpho`
- `Check my Morpho LTV and tell me if borrowing 200 more fxUSD is still safe`
- `Tell me the safest additional fxUSD I can borrow against my BNKR collateral`
- `Use Bankr to compare Morpho supply with fxSAVE for my idle fxUSD`

## Detailed References

- **[fxSAVE Shortcut API](references/api.md)** — Bundle building, approval flow, and app backend usage
- **[Hydrex Single-Sided Liquidity](references/hydrex.md)** — Discovery, ranking, deposits, withdrawals, and Bankr-ready steps
- **[Morpho Planning](references/morpho.md)** — Supply, withdraw, borrow, repay, and risk controls
  plus execution-ready supply/withdraw planning and quick LTV checks

## Local Scripts

- `scripts/fxusd_cli.py` — Preview `fxSAVE` mint, redeem, and approval plans
- `scripts/fxusd_hydrex.py` — Discover Hydrex vaults, classify risk, and emit execution-ready plus Bankr-ready Hydrex transactions
- `scripts/fxusd_morpho.py` — Discover Morpho Blue markets, inspect positions, emit execution-ready plus Bankr-ready supply/withdraw plans, and compute LTV-aware borrow plans
  including safer maximum borrow-size suggestions
