---
name: xelqor
description: >
  Interact with Xelqor Protocol on Base — $XELQ staking vault,
  wETH reward distribution, fee sweeping, and treasury management.
  Use this skill whenever you need to: check XELQ staking state,
  distribute wETH rewards to stakers, sweep protocol fee tokens to wETH,
  or query vault TVL/APY. All operations are on Base mainnet.
version: 1.0.0
author: Xelqor
chains:
  - base
tags:
  - defi
  - staking
  - yield
  - erc4626
  - revenue
---

# Xelqor Protocol Skill

Xelqor is an agentic DeFi platform on Base. Users stake $XELQ to receive sXELQ vault shares and earn wETH streamed from protocol revenue over rolling 7-day windows.

## Contract Addresses (Base Mainnet, chain ID 8453)

| Contract | Address | Notes |
|----------|---------|-------|
| $XELQ Token | `0x052AdDc637c97650aCfE43781e75a01bdF8C7bA3` | ERC-20 staked asset |
| Staking V6 (active) | `0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe` | ERC-4626 vault — use for all new operations |
| Staking V3 (legacy) | `0xA0F09a836b10B3029eF5F632a200616B4d426470` | Old contract — read-only, do not write |
| wETH on Base | `0x4200000000000000000000000000000000000006` | Reward token |

## Key Contract Functions

### distributeRewards(uint256 amount)
- Contract: V6 staking (`0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe`)
- Caller must be set as `rewardDistributor` on the contract
- Streams `amount` wETH to all $XELQ stakers over 7 days
- **Always approve wETH to the staking contract before calling this**

### Read functions useful for monitoring
- `totalAssets()` — total XELQ staked in V6
- `rewardPoolBalance()` — wETH currently streaming
- `rewardRate()` — wETH per block streaming rate
- `blocksUntilVestingEnd()` — blocks until current stream ends
- `legacyTotalAssets()` — XELQ in the legacy V3 contract

## Standard Operations

### Fee Sweep + Reward Distribution (run every 6 hours)
1. Check Bankr wallet balances on Base
2. Swap all non-wETH, non-XELQ tokens to wETH (keep XELQ untouched)
3. Skip swap if any token is below $5 USD value (gas not worth it)
4. Approve full wETH balance to V6 staking contract: `0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe`
5. Call `distributeRewards(amount)` with the full wETH amount
6. Only distribute if wETH >= 0.005 ETH (minimum threshold)
7. Report tx hash and amount distributed

### Monitor Reward Pool (run daily)
- Read `rewardPoolBalance()` from V6 contract
- Read `blocksUntilVestingEnd()` — if 0, next sweep is critical
- Read combined TVL: `totalAssets()` + `legacyTotalAssets()`
- Report: TVL, reward pool, blocks remaining, estimated APY

### Emergency Sweep (run when reward pool < 0.1 wETH)
Same as fee sweep but prioritize immediately — stakers are running dry.

## Rules
- **Never swap XELQ** — it is the staked asset
- **Minimum distribution**: 0.005 wETH
- **Always V6 for writes** — V3 is read-only legacy
- **All operations on Base** (chain ID 8453)
- **Gas is sponsored on Base** — don't skip small operations over gas fear

## Example Prompts

```
"Check the current XELQ staking stats — TVL, reward pool, APY"
"Sweep all fee tokens to wETH and distribute to XELQ stakers"
"How much wETH is streaming to stakers right now?"
"What is the current APY for XELQ staking?"
"Is the reward pool running low? Do we need an emergency sweep?"
```
