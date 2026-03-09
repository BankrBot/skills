# BNKR Staking Reference

Stake BNKR tokens on Base to earn inference credit rewards and discounted AI usage through the LLM Gateway.

## Overview

The BNKR Staking program lets users stake BNKR tokens on Base to unlock staker benefits:
- **Inference credit rewards** allocated monthly from a subsidy pool
- **20% discounted LLM Gateway usage** for all stakers
- Credits are applied automatically when using the LLM Gateway

Staking is done on-chain via a smart contract on Base. The Bankr platform indexes staking events and manages credit distribution and discount application automatically.

## Staking Requirements

- **Minimum stake:** 100,000 BNKR
- **Discount:** 20% on all LLM Gateway usage
- **Monthly credits:** Sqrt-weighted allocation from subsidy pool (10% cap per wallet)

Thresholds may change over time. Use `bankr staking tiers` or `GET /staking/tiers` for current values.

## CLI Commands

```bash
# View your staking position and discount
bankr staking

# View your inference credit balance and allocations
bankr staking credits

# View staking program details (public, no auth needed)
bankr staking tiers

# View global staking statistics (public)
bankr staking stats

# JSON output for any command
bankr staking --json
bankr staking credits --json
```

## REST API Endpoints

### GET /staking/info (authenticated)

Returns your staking position and discount status.

```bash
curl -H "X-API-Key: $API_KEY" https://api.bankr.bot/staking/info
```

Response:
```json
{
  "stakedAmount": 150000,
  "tier": "staker",
  "discountPct": 20,
  "minimumStake": 100000,
  "cooldown": null
}
```

### GET /staking/credits (authenticated)

Returns your credit balance and monthly allocations.

```bash
curl -H "X-API-Key: $API_KEY" https://api.bankr.bot/staking/credits
```

Response:
```json
{
  "balanceUsd": 2.45,
  "allocations": [
    {
      "amountUsd": 5.00,
      "remainingUsd": 2.45,
      "month": "2026-03",
      "expiresAt": "2026-04-30T23:59:59Z",
      "allocatedAt": "2026-03-01T00:00:00Z"
    }
  ]
}
```

### GET /staking/tiers (public)

Returns staking program details.

```bash
curl https://api.bankr.bot/staking/tiers
```

Response:
```json
{
  "minimumStake": 100000,
  "discountPct": 20,
  "benefits": [
    "Access to LLM Gateway",
    "20% inference discount",
    "Monthly credit allocation (sqrt-weighted)"
  ]
}
```

### GET /staking/stats (public)

Returns global staking statistics.

```bash
curl https://api.bankr.bot/staking/stats
```

Response:
```json
{
  "totalStaked": 25000000,
  "stakerCount": 142
}
```

### GET /staking/usage-history (authenticated)

Returns recent LLM usage with discount breakdown.

```bash
curl -H "X-API-Key: $API_KEY" "https://api.bankr.bot/staking/usage-history?limit=20"
```

## How It Works

### Staking
Stake at least 100,000 BNKR tokens on Base via the staking contract to become a staker and unlock all benefits.

### Unstaking
1. **Initiate cooldown** — starts a 7-day cooldown period
2. **Wait** — cooldown must complete before withdrawal
3. **Complete unstake** — withdraw BNKR after cooldown ends
4. **Cancel** — cancel the cooldown to keep staking (optional)

### Credits
- Credits are distributed monthly from a subsidy pool
- Distribution is sqrt-weighted (favors smaller stakers) with a 10% hard cap per wallet
- Credits are applied automatically via FIFO (oldest first) when using the LLM Gateway
- Unused credits expire after their allocation period

### Discounts
- All stakers receive 20% discount on LLM Gateway usage
- Discounts only apply while you have active credits remaining
- Once credits are exhausted, the discount resets to 0% until the next allocation

## Credit Delegation

Stakers can delegate their monthly inference credits to another registered Bankr user. This lets BNKR holders who don't run agents support agent operators while still benefiting from staking.

### How Delegation Works
- A staker sets a delegate via the API, CLI, or web UI
- The delegate must be a registered Bankr user (has a wallet on Bankr)
- Credits are routed to the delegate starting at the next daily distribution
- Only one delegate at a time per staker (can be changed any time)
- Delegation can be revoked at any time, effective at next distribution
- Credits already delivered to a delegate are NOT recalled on revocation
- If the staker unstakes below the minimum tier, delegation is auto-revoked

### CLI Commands

```bash
# Delegate your credits to another user
bankr staking delegate 0x1234...abcd

# View your delegation status
bankr staking delegation

# View who has delegated credits to you
bankr staking delegators

# Revoke your delegation
bankr staking revoke-delegation

# JSON output
bankr staking delegation --json
bankr staking delegators --json
```

### REST API Endpoints

#### POST /staking/delegate (authenticated)

Set or update credit delegation target.

```bash
curl -X POST -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"delegateTo": "0x1234...abcd"}' \
  https://api.bankr.bot/staking/delegate
```

Response:
```json
{
  "status": "delegated",
  "delegateTo": "0x1234...abcd",
  "effectiveFrom": "next daily credit distribution",
  "stakedAmount": 150000,
  "tier": "staker"
}
```

#### POST /staking/revoke-delegation (authenticated)

Remove delegation. Credits go back to staker starting next distribution.

```bash
curl -X POST -H "X-API-Key: $API_KEY" https://api.bankr.bot/staking/revoke-delegation
```

Response:
```json
{
  "status": "revoked",
  "effectiveFrom": "next daily credit distribution",
  "note": "Credits already delivered to delegate are not recalled"
}
```

#### GET /staking/delegation (authenticated)

Get current delegation status.

```bash
curl -H "X-API-Key: $API_KEY" https://api.bankr.bot/staking/delegation
```

Response:
```json
{
  "active": true,
  "delegateTo": "0x1234...abcd",
  "delegatedAt": "2026-03-01T00:00:00Z",
  "creditsDelivered": { "thisMonth": 2.50, "lifetime": 15.00 }
}
```

#### GET /staking/delegators (authenticated)

See who is delegating credits to you.

```bash
curl -H "X-API-Key: $API_KEY" https://api.bankr.bot/staking/delegators
```

Response:
```json
{
  "delegators": [
    {
      "stakerWallet": "0xabcd...",
      "stakedAmount": 200000,
      "tier": "staker",
      "delegatedAt": "2026-02-15T00:00:00Z",
      "creditsDeliveredThisMonth": 3.25
    }
  ],
  "totalDelegatedStake": 200000,
  "totalCreditsThisMonth": 3.25
}
```

## Prompt Examples

**Check staking:**
- "What's my BNKR staking position?"
- "How much BNKR do I have staked?"
- "Am I a staker?"
- "Show my staking credits"

**Staking actions (via agent prompt):**
- "Stake 100000 BNKR"
- "Unstake my BNKR"
- "Start cooldown for my BNKR stake"

**Delegation:**
- "Delegate my staking credits to 0x1234...abcd"
- "Who am I delegating my credits to?"
- "Show my delegation status"
- "Show my delegators"
- "Revoke my credit delegation"

**Information:**
- "What are the staking requirements?"
- "How much do I need to stake?"
- "Show staking stats"

## Legacy Security Module

The original Bankr Security Module (vault-based staking) is now in withdraw-only mode. If you have funds in the legacy module, you can still withdraw via the agent:
- "View my legacy Bankr staking position"
- "Initiate cooldown for legacy staking"
- "Redeem my legacy staking shares"

The legacy module is separate from the new BNKR Staking program.

## Common Issues

| Issue | Resolution |
|-------|------------|
| Credits showing $0 | Credits are distributed monthly. New stakers receive credits at the next distribution cycle. |
| Discount not applying | Discounts require active credits. Check your credit balance with `bankr staking credits`. |
| Cooldown still active | Wait for the cooldown period to complete before attempting to withdraw. |
| Not showing as staker | Ensure you staked at least 100,000 BNKR on Base. Updates may take a few minutes after the transaction confirms. |
| Delegate not found | The delegate must be a registered Bankr user. They need a wallet on the Bankr platform. |
| Delegation revoked unexpectedly | Unstaking below the minimum tier auto-revokes delegation. |
| Credits not reaching delegate | Delegation takes effect at the next daily credit distribution, not immediately. |

## Best Practices

1. Stake on Base for the lowest gas costs
2. Check your position and credits regularly with `bankr staking`
3. Credits expire — use them before the allocation period ends
4. Monitor your discount savings in usage history
5. Consider the cooldown period before unstaking
6. Verify your delegate is a registered Bankr user before delegating
7. Delegation is one-way — credits already delivered cannot be recalled
