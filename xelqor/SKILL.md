---
name: xelqor
description: >
  Interact with Xelqor Protocol on Base — $XELQ staking vault,
  wETH reward distribution, fee sweeping, and treasury management.
  Use this skill whenever you need to: check XELQ staking state,
  distribute wETH rewards to stakers, sweep protocol fee tokens to wETH,
  or query vault TVL/APY. All operations are on Base mainnet.
version: 1.2.0
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

## Transaction Rules — CRITICAL

> The Bankr wallet is a **smart contract account**. All write transactions MUST be submitted via `write_contract` (the smart account / UserOperation path). Never use raw `eth_sendTransaction`. Never batch approve + distributeRewards into a single multicall or atomic bundle — they must be two separate `write_contract` calls with on-chain confirmation between them.

## Standard Operations

### Fee Sweep + Reward Distribution (run every 6 hours)

1. **Check wETH balance**: Read the Bankr wallet's wETH balance on Base. Record this as `wethBalance`.
2. **Swap only if wETH balance is zero**: If `wethBalance` > 0, skip straight to step 3 — do NOT look at other tokens or attempt any swap. Only if `wethBalance` = 0: check for non-XELQ tokens above $5 USD, swap them to wETH, then re-read `wethBalance`.
3. **Check threshold**: if `wethBalance` < 0.005 ETH (5000000000000000 wei), stop — do not approve or distribute. Report the balance and exit.
4. **Approve** — submit as a standalone `write_contract` call. Do NOT bundle with step 5.
   - Contract: wETH (`0x4200000000000000000000000000000000000006`)
   - Function: `approve(address spender, uint256 amount)`
   - `spender` = `0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe`
   - `amount` = `wethBalance` in wei
   - **Wait for this tx to be confirmed on-chain before proceeding. Do not submit step 5 until this tx has a receipt.**
5. **Distribute** — submit as a separate standalone `write_contract` call only after step 4 is confirmed.
   - Contract: V6 staking (`0x19ECafb17DeA9Dc13d7709f29d180C06743333Fe`)
   - Function: `distributeRewards(uint256 amount)`
   - `amount` = same `wethBalance` in wei used in step 4
6. Report both tx hashes and the amount distributed in ETH

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
- **Always use `write_contract`** — never raw `eth_sendTransaction`
- **Never batch approve + distributeRewards** — two separate transactions, confirmation required between them
- **Gas is sponsored on Base** — don't skip small operations over gas fear

## Example Prompts

```
"Check the current XELQ staking stats — TVL, reward pool, APY"
"Sweep all fee tokens to wETH and distribute to XELQ stakers"
"How much wETH is streaming to stakers right now?"
"What is the current APY for XELQ staking?"
"Is the reward pool running low? Do we need an emergency sweep?"
```
