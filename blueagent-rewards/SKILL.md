---
name: blueagent-rewards
description: Plug-and-play $BLUEAGENT token rewards for any Telegram bot on Base. Use when you want to add onchain rewards to your agent — award points for check-ins, trivia wins, referrals, and project submissions, then let users claim $BLUEAGENT tokens directly to their wallet. Built on Bankr stack with automatic 95/5 fee split to treasury.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🟦",
        "homepage": "https://github.com/madebyshun/blue-agent-rewards-skill",
      },
  }
---

# Blue Agent Rewards Skill

Add $BLUEAGENT onchain rewards to any Telegram bot in minutes. Users earn points for activity and claim real tokens — no custom token system needed.

## Install

```bash
npm install github:madebyshun/blue-agent-rewards-skill
```

## Quick Start

```typescript
import { BlueAgentRewards } from 'blueagent-rewards-skill'

const rewards = new BlueAgentRewards({
  rewardWalletPrivateKey: process.env.REWARD_WALLET_KEY!,
  rewardWalletAddress: process.env.REWARD_WALLET_ADDRESS!,
  agentId: 'my-bot',
})

// Award points for activity
const result = await rewards.award(userId, 'checkin')    // +5 pts
const result = await rewards.award(userId, 'trivia_win') // +25 pts
const result = await rewards.award(userId, 'referral')   // +50 pts
const result = await rewards.award(userId, 'submit')     // +20 pts
const result = await rewards.award(userId, 'weekly_top') // +100 pts

// Claim $BLUEAGENT onchain
const claim = await rewards.claim(userId, walletAddress)
// → 95% to user, 5% to Blue Agent treasury (auto onchain)
```

## API

### Constructor Config

| Option | Type | Default | Description |
|---|---|---|---|
| `rewardWalletPrivateKey` | string | required | Wallet holding $BLUEAGENT to distribute |
| `rewardWalletAddress` | string | required | Address of reward wallet |
| `agentId` | string | required | Unique identifier for your agent |
| `feePercent` | number | `5` | % sent to Blue Agent treasury |
| `dataDir` | string | `./data` | Directory for user data (JSON) |

### Methods

| Method | Returns | Description |
|---|---|---|
| `award(userId, activity, customPts?)` | `AwardResult` | Award points to user |
| `getPoints(userId)` | `number` | Get user points balance |
| `getStreak(userId)` | `number` | Get user streak days |
| `hasCheckedInToday(userId)` | `boolean` | Check if already checked in |
| `getLeaderboard(limit?)` | `LeaderboardEntry[]` | Top users by points |
| `claim(userId, walletAddress)` | `ClaimResult` | Transfer $BLUEAGENT onchain |

## Multipliers

| Condition | Effect |
|---|---|
| OG Builder (first 100 users) | ×2 claim multiplier forever |
| 7-day streak | ×1.5 claim multiplier |
| 14-day streak | ×2.0 claim multiplier |
| Streak ≥ 3 days | +3 pts bonus per check-in |
| Claim 500+ pts | +10% token bonus |
| Claim 1000+ pts | +20% token bonus |

## $BLUEAGENT Token

- **Contract:** `0xf895783b2931c919955e18b5e3343e7c7c456ba3`
- **Chain:** Base · Uniswap v4
- **Rate:** 1 pt = 1,000 $BLUEAGENT
- **Min claim:** 100 pts = 100,000 $BLUEAGENT
- **Cooldown:** 7 days between claims

## Fee Model

Every claim is split automatically onchain:

**Without `creatorAddress`:**
- **95%** → user wallet
- **5%** → Blue Agent treasury

**With `creatorAddress`:**
- **92%** → user wallet
- **3%** → agent creator (you earn this)
- **5%** → Blue Agent treasury

## Links

- GitHub: [madebyshun/blue-agent-rewards-skill](https://github.com/madebyshun/blue-agent-rewards-skill)
- Bot: [@Blockyagent_beta_bot](https://t.me/Blockyagent_beta_bot)
- Community: [t.me/blueagent_hub](https://t.me/blueagent_hub)
- Token: [Basescan](https://basescan.org/token/0xf895783b2931c919955e18b5e3343e7c7c456ba3)
