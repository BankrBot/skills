# $VIGIL Tokenomics

## Overview

$VIGIL is the utility and governance token for the VIGIL onchain security scanner protocol. It powers access control, incentivizes community security contributions, and aligns stakeholders through staking and fee sharing.

## Token Details

| Property | Value |
|----------|-------|
| Name | VIGIL |
| Symbol | $VIGIL |
| Decimals | 18 |
| Max Supply | 100,000,000 |
| Chain | Base (primary), with bridging to Ethereum, Arbitrum |
| Standard | ERC-20 with Permit (EIP-2612) |

## Supply Distribution

| Allocation | % | Tokens | Vesting |
|------------|---|--------|---------|
| Ecosystem & Community | 35% | 35,000,000 | 48 months linear, 6-month cliff |
| Treasury | 20% | 20,000,000 | Governance-controlled release |
| Team & Contributors | 15% | 15,000,000 | 12-month cliff, 36-month linear |
| Initial Liquidity | 10% | 10,000,000 | Locked at launch (12-month minimum) |
| Staking Rewards | 10% | 10,000,000 | Released over 48 months via reward pool |
| Scam Bounties | 5% | 5,000,000 | Released on verified scam reports |
| Partnerships | 5% | 5,000,000 | Milestone-based release |

## Token Utilities

### 1. Access Tiers (Stake-to-Unlock)

| Tier | Stake Required | Premium Scans | Batch Revokes | Reward Rate |
|------|---------------|---------------|---------------|-------------|
| Free | 0 | 5/day | 1/day | — |
| Scout | 100 $VIGIL | 50/day | 10/day | 2% APY |
| Guardian | 500 $VIGIL | 200/day | 50/day | 5% APY |
| Sentinel | 1,000 $VIGIL | Unlimited | Unlimited | 8% APY |
| Archon | 5,000 $VIGIL | Unlimited | Unlimited | 12% APY |

### 2. Scam Report Bounties

Community members stake $VIGIL to become verified reporters:

- Submit scam token reports with evidence
- If verified by community consensus → earn **50 $VIGIL bounty**
- Top reporters earn leaderboard status and bonus rewards
- False reports result in temporary reporting cooldown

### 3. Governance

Stake 1,000+ $VIGIL to vote on:
- New chain deployments
- Security parameter updates (risk thresholds, scoring weights)
- Fee structure changes
- Partnership approvals
- Treasury fund allocation

### 4. Fee Revenue Sharing

Protocol revenue sources:
- Premium API access subscriptions
- Batch revocation fees
- Enterprise security reports
- White-label integrations

Revenue distribution:
- 40% → Staking reward pool (distributed to stakers)
- 30% → Treasury (development, operations)
- 20% → Scam bounty pool
- 10% → Team (operational costs)

### 5. Fee Discounts

| Hold Tier | API Cost | Revocation Fee |
|-----------|----------|----------------|
| Free | Full price | Full price |
| Scout | -20% | -10% |
| Guardian | -40% | -25% |
| Sentinel | -60% | -50% |
| Archon | -80% | Free |

## Revenue Model

| Source | Price | Frequency |
|--------|-------|-----------|
| Basic API (free tier) | $0 | — |
| Premium API | $49/month | Monthly |
| Enterprise API | $299/month | Monthly |
| Single revoke | $0.10 | Per tx |
| Batch revoke (premium) | $0.05/tx | Per tx |
| Full security report | $2.00 | Per report |
| White-label integration | Custom | Contract |

## Deflationary Mechanisms

1. **Burn on premium usage** — 5% of all premium fees are burned
2. **Burn on scam report** — 10% of each bounty payout is burned
3. **Governance burn votes** — Community can vote to increase burn rate

Target: Reach 50% supply reduction (50M remaining) within 5 years.

## Launch Strategy

### Phase 1: Pre-Token (Current)
- Ship VIGIL skill with free tier
- Build user base through Bankr integration
- Validate product-market fit

### Phase 2: Token Launch
- Deploy $VIGIL on Base via Aerodrome/Uniswap V3
- Initial liquidity: 10M $VIGIL + $100K USDC
- Airdrop to early Bankr users and security reporters

### Phase 3: Staking & Governance
- Launch staking contract
- Enable governance voting
- Begin reward distribution

### Phase 4: Expansion
- Multi-chain deployment (Ethereum, Arbitrum, Solana)
- Enterprise partnerships
- DAO treasury management

## Contract Addresses (Base Mainnet)

| Contract | Address | Status |
|----------|---------|--------|
| $VIGIL Token | `0xPENDING` | Not deployed |
| Staking | `0xPENDING` | Not deployed |
| Governance | `0xPENDING` | Planned |
| Treasury | `0xPENDING` | Planned |
