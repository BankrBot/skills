---
name: venice
description: Complete Venice Protocol operations on Base — VVV liquid staking, 1-click reward compounding (claimAndStake), bonding curve DIEM minting and burning, unstaking cooldown queue management, compute credit tracking, and web3 headless inference key provisioning.
tags: [venice, vvv, svvv, diem, staking, compounding, inference, ai, base]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🎭"
    homepage: https://venice.ai
  venice:
    api_base: https://api.venice.ai/api/v1
    vvv_token: "0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf"
    svvv_staking_contract: "0x321b7ff75154472B18EDb199033fF4D116F340Ff"
    diem_token: "0xF4d97F2da56e8c3098f3a8D538DB630A2606a024"
    chain: base
---

# Venice Protocol

Complete suite for Venice Protocol staking, bonding-curve issuance, and compute credit management on Base.

## Contract Architecture (Base)

All contracts verified on Basescan:

- **VVV Token: `0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf`**
  Standard ERC-20 utility token for the Venice ecosystem.
- **sVVV Staking Contract: `0x321b7ff75154472B18EDb199033fF4D116F340Ff`**
  Handles VVV staking, reward emissions, auto-compounding, DIEM minting (backing locks), and sVVV redemption.
- **DIEM Token Contract: `0xF4d97F2da56e8c3098f3a8D538DB630A2606a024`**
  Inference credit token. Staking lives directly on the token contract: `stake(uint256)`, `initiateUnstake(uint256)`, `unstake()`.

---

## Key Workflows

### 1. VVV Liquid Staking & 1-Click Auto-Compounding
- **Stake VVV:** Approve `sVVV` contract for VVV amount, then call `stake(address recipient, uint256 amount)`. Minted `sVVV` receipt tokens earn 100% of staking emissions.
- **Auto-Compound:** Call `claimAndStake()` on `sVVV` contract. Compounds accumulated VVV rewards directly back into sVVV in a single transaction without double gas or manual re-approval.
- **Harvest Only:** Call `claim()` to withdraw accumulated VVV rewards to wallet.

### 2. DIEM Bonding Curve Mint & Burn
- **Quote Output:** Call `getDiemAmountOut(uint256 sVVVAmount)` to query the exact DIEM received from the bonding curve.
- **Mint DIEM:** Call `mintDiem(uint256 sVVVAmount, uint256 minDiemOut)`. Locks your sVVV into the contract. Locked sVVV continues earning **80% of staking emissions** while backing DIEM.
- **Burn DIEM:** Call `burnDiem(uint256 diemAmount)` on the sVVV contract. Destroys liquid DIEM and unlocks your backed sVVV.

### 3. Cooldowns & Unstaking Queues
Unstaking involves hard cooldown periods on Base:
- **sVVV -> VVV:**
  1. `initiateUnstake(uint256 amount)` begins the 7-day cooldown timer.
  2. After 7 days, call `finalizeUnstake()` to redeem liquid VVV.
- **Staked DIEM -> Liquid DIEM:**
  1. `initiateUnstake(uint256 amount)` on the DIEM token contract begins the 1-day cooldown timer.
  2. After 24 hours, call `unstake()` to claim liquid DIEM.

### 4. Pricing & Acquisition Rule (No False Arbitrage)
- Secondary DEX price (e.g. Aerodrome) can diverge substantially from on-chain bonding curve mint rate.
- **Do NOT treat price divergence as an executable arbitrage:**
  - Minting requires locking sVVV into the contract; you cannot mint at bonding cost to dump on DEX without a steep net loss.
  - Burning DIEM only frees the caller's own locked sVVV; buying cheap DEX DIEM does not unlock anyone else's tokens.
  - When acquiring DIEM for compute, check both routes and buy directly on Aerodrome when at a discount.

### 5. Web3 Headless API Key Provisioning
Venice allows web3 agents holding sVVV/DIEM to mint inference keys without passwords:
1. Fetch challenge: `GET https://api.venice.ai/api/v1/api_keys/generate_web3_key`
2. Sign challenge token with wallet via `personal_sign`.
3. Submit signature:
```bash
curl -sS -X POST "https://api.venice.ai/api/v1/api_keys/generate_web3_key" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "<wallet>",
    "signature": "<sig>",
    "token": "'"$TOKEN"'",
    "apiKeyType": "INFERENCE",
    "description": "bankr agent key",
    "limitPeriod": "EPOCH"
  }'
```
4. 1 staked DIEM provides $1/day of perpetual inference allowance refreshing every 24h at 00:00 UTC. Check balance via `GET https://api.venice.ai/api/v1/billing/balance`.
