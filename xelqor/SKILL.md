---
name: xelqor
description: >
  Interact with Xelqor Protocol on Base — $XELQ staking vault,
  wETH reward distribution, fee sweeping, and treasury management.
  Use this skill whenever you need to: check XELQ staking state,
  distribute wETH rewards to stakers, sweep protocol fee tokens to wETH,
  or query vault TVL/APY. All operations are on Base mainnet.
version: 1.1.0
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

## ABIs

### wETH — approve
```json
{
  "name": "approve",
  "type": "function",
  "inputs": [
    { "name": "spender", "type": "address" },
    { "name": "amount",  "type": "uint256" }
  ],
  "outputs": [{ "type": "bool" }],
  "stateMutability": "nonpayable"
}
```

### V6 Staking — distributeRewards
```json
{
  "name": "distributeRewards",
  "type": "function",
  "inputs": [
    { "name": "amount", "type": "uint256" }
  ],
  "outputs": [],
  "stateMutability": "nonpayable"
}
```

### V6 Staking — read functions
```json
[
  { "name": "totalAssets",           "type": "function", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "name": "rewardPoolBalance",     "type": "function", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "name": "rewardRate",            "type": "function", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "name": "blocksUntilVestingEnd", "type": "function", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" },
  { "name": "legacyTotalAssets",     "type": "function", "inputs": [], "outputs": [{ "type": "uint256" }], "stateMutability": "view" }
]
```

## Standard Operations

### Fee Sweep + Reward Distribution (run every 6 hours)

1. **Check wETH balance**: Read the Bankr wallet's wETH balance on Base. Record this as `wethBalance`.
2. **Swap**: Swap all non-wETH, non-XELQ tokens to wETH. Skip any individual token below $5 USD value.
3. **Re-read wETH balance** after swaps complete. Update `wethBalance` to the current wallet balance. Always use the wallet balance — never use "wETH received from swap" as a substitute.
4. **Check threshold**: if `wethBalance` < 0.005 ETH (5000000000000000 wei), stop — do not approve or distribute. Report the balance and exit.
5. **Approve** — REQUIRED regardless of whether a swap occurred. Call `approve` on the **wETH contract** (`0x4200000000000000000000000000000000000006`):
   - `spender` = `0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe` (V6 staking)
   - `amount` = `wethBalance` in wei
   - **Wait for this tx to confirm on-chain. Do not proceed to step 6 until confirmed.**
6. **Distribute**: call `distributeRewards(amount)` on the **V6 staking contract** (`0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe`)
   - `amount` = same `wethBalance` in wei used in step 5
7. Report both tx hashes and the amount distributed in ETH

### Monitor Reward Pool (run daily)
- Read `rewardPoolBalance()` from V6 contract
- Read `blocksUntilVestingEnd()` — if 0, next sweep is critical
- Read combined TVL: `totalAssets()` + `legacyTotalAssets()`
- Report: TVL, reward pool, blocks remaining, estimated APY

### Emergency Sweep (run when reward pool < 0.1 wETH)
Same as fee sweep but prioritize immediately — stakers are running dry.

## Rules
- **Never swap XELQ** — it is the staked asset
- **Minimum distribution**: 0.005 wETH — do not approve or call distributeRewards below this
- **Always V6 for writes** — V3 is read-only legacy
- **All operations on Base** (chain ID 8453)
- **Approve must confirm before distributeRewards** — never fire both in the same block or without waiting
- **Gas is sponsored on Base** — don't skip small operations over gas fear

## Example Prompts

```
"Check the current XELQ staking stats — TVL, reward pool, APY"
"Sweep all fee tokens to wETH and distribute to XELQ stakers"
"How much wETH is streaming to stakers right now?"
"What is the current APY for XELQ staking?"
"Is the reward pool running low? Do we need an emergency sweep?"
```
