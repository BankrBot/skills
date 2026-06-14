---
name: agent-kickbacks
description: Crypto-native ad marketplace for AI agents. Use when an agent needs to monetize idle/thinking time by serving sponsored content, or when a user wants to earn USDC from ad impressions. Supports ad requesting, impression tracking, earnings management, and USDC payouts on Base via x402 micropayments. Use for ad serving, campaign management, user earnings, and payouts.
metadata:
  bankr:
    category: marketplace
    chains: [base]
    homepage: https://agent-kickbacks.io
    apiBase: https://agent-kickbacks-production.up.railway.app
    payment: x402-usdc-base
  openclaw:
    emoji: "💰"
---

# Agent Kickbacks

Crypto-native ad marketplace for AI agents. Monetize idle/thinking time by serving sponsored content and earn USDC on Base.

## When To Use

Use this skill for:

- Requesting ads during agent idle/thinking time
- Tracking ad impressions and clicks
- Checking user earnings balance
- Requesting USDC payouts
- Managing ad campaigns (advertisers)
- Viewing active ad blocks on the marketplace

Do not use this skill for:
- Displaying ads without user consent
- Click fraud or impression inflation
- Bypassing rate limits

## API Base

```
https://agent-kickbacks-production.up.railway.app
```

## Access Model

### Free Access

Basic ad serving is free. Users earn USDC from impressions and clicks.

### x402 Paid Access (Campaign Funding)

Advertisers fund campaigns via x402 USDC payments on Base:

- Minimum campaign budget: `$10 USDC`
- Block purchase: `$5 USDC` per 1,000 impressions
- Payment method: x402 exact-EVM on Base

## Endpoints

### Health Check

```http
GET /health
```

Returns server status, network, and facilitator info.

### Request Ad

```http
POST /ad/request
Content-Type: application/json

{
  "user_wallet": "0x...",
  "agent": "hermes",
  "context": "defi staking",
  "surface": "response_footer"
}
```

Returns best matching ad with impression token. Returns 204 if no ads available.

### Track Impression

```http
POST /ad/impression
Content-Type: application/json

{
  "ad_id": "...",
  "user_wallet": "0x...",
  "token": "impression_token_from_ad_request"
}
```

Tracks confirmed ad display. User earns `$0.0025` per impression (50% of $0.005 bid).

### Track Click

```http
POST /ad/click
Content-Type: application/json

{
  "ad_id": "...",
  "user_wallet": "0x..."
}
```

Tracks ad click. User earns `$0.125` per click (50% of $0.005 × 50 multiplier).

### Check Earnings

```http
GET /earnings/{wallet_address}
```

Returns balance, total earned, impressions, and clicks.

### Request Payout

```http
POST /payout/request
Content-Type: application/json

{
  "wallet_address": "0x..."
}
```

Request USDC payout. Minimum `$5 USDC`. Transfers via EIP-3009 gasless transfer on Base.

### Create Campaign (Advertiser)

```http
POST /campaign/create
Content-Type: application/json

{
  "advertiser_wallet": "0x...",
  "name": "My Campaign",
  "total_budget": 10.0
}
```

Creates a campaign with minimum `$10 USDC` budget.

### Add Ad to Campaign

```http
POST /campaign/{campaign_id}/ad
Content-Type: application/json

{
  "title": "Earn 12% APY",
  "body": "Stake ETH, earn yields.",
  "cta_text": "Learn more",
  "cta_url": "https://example.com",
  "category": "defi",
  "tags": ["eth", "staking"],
  "bid_per_impression": 0.005
}
```

### Buy Impression Blocks

```http
POST /campaign/{campaign_id}/buy
Content-Type: application/json

{
  "blocks": 5
}
```

Buy 5 blocks × 1,000 impressions = 5,000 impressions. Cost: `$25 USDC`.

### Get Campaign Stats

```http
GET /campaign/{campaign_id}
```

Returns impressions, clicks, CTR, and budget remaining.

### List Campaigns

```http
GET /campaign/?wallet=0x...
```

List all campaigns for an advertiser wallet.

## Revenue Split

| Recipient | Share | Description |
|-----------|-------|-------------|
| User | 50% | Paid out in USDC on Base |
| Operator | 30% | Who runs the agent surface |
| Protocol | 20% | Treasury for marketplace |

## Pricing

| Action | Advertiser Pays | User Gets |
|--------|----------------|-----------|
| Impression | $0.005 | $0.0025 |
| Premium | $0.010 | $0.0050 |
| Click | $0.150 | $0.0750 |

## Agent Integration

### Hermes Plugin

```python
from agent_kickbacks.adapters.hermes import register

# In your Hermes plugin
register(ctx)
```

### MCP Server

```bash
pip install agent-kickbacks[mcp]
agent-kickbacks-mcp serve
```

### Direct API

```python
import httpx

# Request an ad
resp = httpx.post("https://agent-kickbacks-production.up.railway.app/ad/request", json={
    "user_wallet": "0x...",
    "agent": "hermes",
    "context": "defi",
    "surface": "response_footer"
})
ad = resp.json()
```

## Safety Features

- **Kill switch**: `AD_KILL_SWITCH=true` disables all ad serving
- **Rate limiting**: 10 requests/min per user, 30/min per IP
- **Content moderation**: Blocklist for scam/phishing keywords
- **Frequency caps**: 100 impressions/day, 20/session
- **HMAC tokens**: Signed impression tokens prevent forgery

## Chain Info

- **Network**: Base (eip155:8453)
- **USDC**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Gas**: ~$0.0001 per transaction
- **Finality**: ~2 seconds

## Example: Agent Earning Flow

```python
import httpx

API = "https://agent-kickbacks-production.up.railway.app"
WALLET = "0xYourAgentWallet"

# 1. Request ad during thinking time
ad = httpx.post(f"{API}/ad/request", json={
    "user_wallet": WALLET,
    "agent": "hermes",
    "context": "thinking",
    "surface": "thinking_state"
}).json()

# 2. Display ad to user
print(f"Sponsored: {ad['title']} - {ad['body']}")

# 3. Track impression (when displayed)
httpx.post(f"{API}/ad/impression", json={
    "ad_id": ad["ad_id"],
    "user_wallet": WALLET,
    "token": ad["impression_token"]
})

# 4. Check earnings
earnings = httpx.get(f"{API}/earnings/{WALLET}").json()
print(f"Balance: ${earnings['balance']:.4f}")
```

## Links

- GitHub: https://github.com/enzoonchain/agent-kickbacks
- API: https://agent-kickbacks-production.up.railway.app
- Docs: https://github.com/enzoonchain/agent-kickbacks/blob/main/docs/PLUGIN.md
