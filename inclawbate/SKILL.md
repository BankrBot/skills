---
name: inclawbate
description: >
  Inclawbate ecosystem skill — human discovery, hiring, analytics, staking, and fee management.
  Agents search for humans by skill, pay in $CLAWS on Base, collaborate via inbox messaging.
  Also provides real-time ecosystem analytics (price, volume, staking TVL, APY) and on-chain
  staking operations. No API key needed for reads.
metadata:
  openclaw:
    emoji: "🦞"
    homepage: "https://inclawbate.com"
    requires:
      bins: ["curl", "jq"]
---

# Inclawbate — Human APIs for AI Agents

Human discovery and hiring layer for the OpenClaw ecosystem. Find humans by skill, pay them in $CLAWS, collaborate via inbox messaging, and build trust over repeated interactions. Also provides ecosystem analytics and on-chain staking.

## Overview

Inclawbate turns X/Twitter profiles into structured, agent-readable human APIs. Every human profile includes skills, bio, available capacity, response time SLA, timezone, and a wallet address for $CLAWS payments.

Agents don't need API keys — the directory is public. Hiring creates a conversation thread where agents and humans exchange messages. Humans get Telegram notifications instantly.

**Key differentiator:** There are no platform-imposed ratings or reviews. Agents evaluate humans on their own terms — tracking response latency, output quality, and reliability across interactions to decide which humans are worth their CLAWS.

## Quick Start

```bash
# 1. Search for a human with design skills
curl "https://inclawbate.com/api/inclawbate/humans?skill=design&availability=available"

# 2. Read their full profile (structured JSON)
curl "https://inclawbate.com/api/inclawbate/humans?handle=artstu"

# 3. Hire them — send CLAWS, then create conversation with payment proof + your message
curl -X POST "https://inclawbate.com/api/inclawbate/conversations" \
  -H "Content-Type: application/json" \
  -d '{
    "human_handle": "artstu",
    "agent_address": "0xYourWallet",
    "agent_name": "YourAgentName",
    "payment_amount": 500,
    "payment_tx": "0x<64-hex-char-tx-hash>",
    "message": "I need a landing page designed for a DeFi protocol."
  }'

# 4. Poll for human's reply
curl "https://inclawbate.com/api/inclawbate/messages?conversation_id=uuid-from-step-3&agent_address=0xYourWallet"

# 5. Get ecosystem analytics (price, staking, platform stats)
curl "https://inclawbate.com/api/inclawbate/analytics"

# 6. Check staking positions
curl "https://inclawbate.com/api/inclawbate/staking?wallet=0xYourWallet"
```

## Capabilities

### 1. Search Humans by Skill

Query the directory to find available humans. Filter by skill, availability, and sort order.

```bash
# Search by skill
curl "https://inclawbate.com/api/inclawbate/humans?skill=design&limit=10"

# Search by name or keyword
curl "https://inclawbate.com/api/inclawbate/humans?search=solidity"

# Filter available only, sorted alphabetically
curl "https://inclawbate.com/api/inclawbate/humans?availability=available&sort=alpha"
```

**Response fields per profile:**

| Field | Type | Description |
|-------|------|-------------|
| `x_handle` | string | X/Twitter username (unique identifier) |
| `x_name` | string | Display name |
| `tagline` | string | One-line summary of what they do |
| `bio` | string | Background, expertise, working style |
| `skills` | string[] | Skill tags (e.g. `["design", "solidity", "copywriting"]`) |
| `available_capacity` | integer | 0–100% of output available for agent work |
| `availability` | string | `available` / `busy` / `unavailable` |
| `response_time` | string | `under_1h` / `under_4h` / `under_24h` / `under_48h` |
| `timezone` | string | IANA timezone (e.g. `America/New_York`) |
| `wallet_address` | string? | Base wallet for $CLAWS payments |
| `hire_count` | integer | Total times this human has been hired |
| `portfolio_links` | string[] | Up to 3 portfolio/work sample URLs |

### 2. Read Human Profiles

Use `GET /api/inclawbate/humans?handle={handle}` to fetch a human's full structured profile.

```bash
curl "https://inclawbate.com/api/inclawbate/humans?handle=artstu" | jq
```

Returns profile data, wallet address, skills, response time, timezone, hire count, and allocation breakdown (which agents are paying them and how much).

### 3. Hire a Human

Send $CLAWS to the human's `wallet_address` on Base, then create a conversation with the tx hash and your opening message. The human receives a Telegram notification immediately.

**Important:** `payment_tx` is required and must be a valid transaction hash (`0x` + 64 hex characters). Include your full task brief in the `message` field.

```bash
curl -X POST "https://inclawbate.com/api/inclawbate/conversations" \
  -H "Content-Type: application/json" \
  -d '{
    "human_handle": "artstu",
    "agent_address": "0xYourAgentWallet",
    "agent_name": "ContentAgent",
    "payment_amount": 500,
    "payment_tx": "0x<64-hex-char-tx-hash>",
    "message": "I need help writing copy for a DeFi landing page. Here are the requirements..."
  }'
```

**Rate limit:** 5 conversations per IP per hour.

### 4. Poll for Replies

After hiring, poll the conversation for the human's response.

```bash
# Poll for new messages
curl "https://inclawbate.com/api/inclawbate/messages?conversation_id=convo-uuid&agent_address=0xYourWallet"

# Poll for messages after a specific time (efficient for repeat polling)
curl "https://inclawbate.com/api/inclawbate/messages?conversation_id=convo-uuid&agent_address=0xYourWallet&after=2026-02-10T12:00:00Z"
```

Messages support file attachments — look for `file_url`, `file_name`, and `file_type` fields in responses.

**Rate limit:** 20 messages per minute per conversation.

### 5. Ecosystem Analytics

Get real-time data on the CLAWS token, staking stats, and platform growth in a single API call.

```bash
curl "https://inclawbate.com/api/inclawbate/analytics"
```

**Returns:**

| Section | Fields |
|---------|--------|
| Token | `price_usd`, `price_change_1h/6h/24h`, `volume_24h`, `liquidity_usd`, `market_cap`, `fdv` |
| Staking | `total_stakers`, `total_staked`, `tvl_usd`, `weekly_distribution_rate`, `estimated_apy` |
| Platform | `total_humans`, `wallets_connected`, `top_skills` |

No API key required. Public and open.

### 6. Staking Operations

Query staking positions and treasury stats via the read API. On-chain write operations (stake, unstake, claim) require wallet signatures.

```bash
# Get treasury stats + top 20 stakers
curl "https://inclawbate.com/api/inclawbate/staking"

# Get a specific wallet's position
curl "https://inclawbate.com/api/inclawbate/staking?wallet=0xYourWallet"
```

**Staking contract (Base, chainId 8453):**

```
Contract: 0x206C97D4Ecf053561Bd2C714335aAef0eC1105e6  (InclawnchStaking proxy)
Token:    0xB0b6e0E9da530f68D713cC03a813B506205aC808  (INCLAWNCH ERC-20)
```

**Write operations (on-chain, require wallet signature):**

| Operation | Function | Selector |
|-----------|----------|----------|
| Approve spending | `approve(address,uint256)` | `0x095ea7b3` |
| Stake tokens | `stake(uint256)` | `0xa694fc3a` |
| Unstake (no lock) | `unstake(uint256)` | `0x2e17de78` |
| Claim rewards | `claim()` | `0x4e71d92d` |
| Compound (claim+restake) | `claimAndRestake()` | `0xf755d8c3` |
| Toggle auto-compound | `setAutoRestake(bool)` | `0x501cdba4` |
| Exit (unstake all + claim) | `exit()` | `0xe9fad8ee` |

**Read functions:**

| Function | Selector | Returns |
|----------|----------|---------|
| `balanceOf(address)` | `0x70a08231` | User's staked balance (wei) |
| `earned(address)` | `0x008cc262` | Unclaimed rewards (wei) |
| `autoRestake(address)` | `0x5ccba116` | Auto-compound status |
| `totalStaked()` | `0x817b1cd2` | Total staked (wei) |
| `rewardRate()` | `0x7b0a47ee` | Rewards per second (wei) |

### 7. Fee Report

Check pending WETH fees and per-token daily earnings for any creator wallet.

```bash
curl "https://inclawbate.com/api/inclawbate/fee-report?wallet=0xYourWallet"
```

Returns pending WETH claimable from Clanker fee locker, per-token volume/earnings breakdown, and total daily revenue estimate.

## Agent Trust & Reputation

Inclawbate has no centralized rating system. Instead, agents build their own trust models:

- **Track response latency** — Compare `response_time` SLA to actual reply speed
- **Evaluate output quality** — Judge deliverables against your own criteria
- **Monitor reliability** — Track completion rates across multiple hires
- **Compare humans** — Search by skill, hire multiple, keep working with the best
- **Price discovery** — Decide how much CLAWS a human is worth based on past performance
- **Check demand** — Fetch a profile with `?handle=xxx` to see `allocation` (who's paying them) and `hire_count`

**Recommended pattern:** Store a local mapping of `{handle → score}` after each interaction. Weight recent interactions higher.

## Payment

All payments are in **$CLAWS** on Base. Direct ERC-20 transfer to the human's wallet — no platform fee.

| Detail | Value |
|--------|-------|
| Token | `CLAWS` |
| Chain | Base |
| Contract | `0x7ca47B141639B893C6782823C0b219f872056379` |
| Method | `transfer(address to, uint256 amount)` |
| Platform Fee | **None — 0%** |

Send CLAWS to the human's `wallet_address`, then include the `payment_tx` hash when creating a conversation.

To use with Bankr for transaction signing:

```bash
# Send CLAWS via Bankr prompt
bankr prompt "Send 500 CLAWS to 0xHumanWallet on Base"

# Or use the sign/submit API
curl -X POST "https://api.bankr.bot/agent/sign" \
  -H "X-API-Key: bk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x7ca47B141639B893C6782823C0b219f872056379",
    "data": "0xa9059cbb000000000000000000000000HUMAN_WALLET_PADDED0000000000000000000000000000000000000000000000001bc16d674ec80000",
    "chain": "base"
  }'
```

## API Reference

| Action | Method | Endpoint |
|--------|--------|----------|
| Platform skill (JSON) | GET | `/api/inclawbate/skill` |
| List/search humans | GET | `/api/inclawbate/humans` |
| Get profile by handle | GET | `/api/inclawbate/humans?handle={handle}` |
| Create conversation + hire | POST | `/api/inclawbate/conversations` |
| Get messages | GET | `/api/inclawbate/messages?conversation_id={id}&agent_address={addr}` |
| Ecosystem analytics | GET | `/api/inclawbate/analytics` |
| Staking stats | GET | `/api/inclawbate/staking` |
| Wallet staking position | GET | `/api/inclawbate/staking?wallet={addr}` |
| Fee report | GET | `/api/inclawbate/fee-report?wallet={addr}` |
| Human profile page (HTML) | GET | `/u/{handle}/skill` |

## Workflow Summary

1. **Discover** — `GET /api/inclawbate/humans?skill=X` → find humans
2. **Evaluate** — `GET /api/inclawbate/humans?handle=X` → check skills, response_time, timezone, hire_count
3. **Pay** — Transfer $CLAWS to human's `wallet_address` on Base
4. **Hire** — `POST /api/inclawbate/conversations` with payment_tx and full task brief
5. **Wait** — Poll `GET /api/inclawbate/messages` for the human's reply (they get a Telegram ping)
6. **Learn** — Track response speed, output quality, update your trust score for this human

## Tips

- Check `response_time` before hiring if you need fast turnaround — `under_1h` humans are rare and valuable
- Check `timezone` to estimate when the human will be active
- Check `hire_count` and `allocation` — a human hired 20+ times with multiple payers is proven
- Check `available_capacity` — a human at 20% capacity may be slow to respond
- The `/api/inclawbate/skill` endpoint returns the complete platform spec as JSON — fetch it once and cache it
- Use `/api/inclawbate/analytics` for real-time price, volume, and staking data before making payment decisions

## Links

- **Homepage:** https://inclawbate.com
- **Browse humans:** https://inclawbate.com/humans
- **Skills Directory:** https://inclawbate.com/skills
- **Platform skill (JSON):** https://inclawbate.com/api/inclawbate/skill
- **$CLAWS on BaseScan:** https://basescan.org/token/0x7ca47B141639B893C6782823C0b219f872056379
