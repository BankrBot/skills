---
name: hazza
description: Register and manage hazza.name — immediately useful onchain names on Base. Check availability, register names, set profile records.
---

# hazza — Onchain Names on Base

Register immediately useful names on Base for your users. Each name is an ERC-721 NFT at `name.hazza.name` with a profile page, text records, and multi-chain addresses. Powered by x402, XMTP and Net Protocol.

## Command Format

Users request names using the full domain:

```
register brian.hazza.name
```

Parse the name by stripping `.hazza.name` from the end. The registerable name is the part before the first dot. Names must be lowercase ASCII: a-z, 0-9, hyphens. 3-63 characters. No leading/trailing hyphens, no consecutive hyphens. No spaces, no emojis, no uppercase.

## Quick Start

### 1. Check Availability

```bash
curl -s https://hazza.name/api/available/brian
```

Returns `{"available": true}` or `{"available": false, "owner": "0x..."}`.

### 2. Check Price

```bash
curl -s "https://hazza.name/api/quote/brian?wallet=USER_WALLET_ADDRESS"
```

Returns `{"totalCost": "5000000", "registrationFee": "5000000"}` (USDC, 6 decimals). A `totalCost` of `"0"` means the name is free for this wallet.

### 3. Check Free Claim Eligibility

```bash
curl -s https://hazza.name/api/free-claim/USER_WALLET_ADDRESS
```

Returns whether the user qualifies for a free registration (first name per wallet, or Unlimited Pass holder's bonus free name).

### 4. Register via x402

```bash
curl -s -X POST https://hazza.name/x402/register \
  -H "Content-Type: application/json" \
  -d '{"name": "brian", "owner": "USER_WALLET_ADDRESS"}'
```

**If the name is free** for this wallet → returns success immediately with `{name, owner, tokenId, registrationTx, profileUrl}`.

**If payment is required** → returns HTTP 402 with payment details:

```json
{
  "accepts": [{
    "scheme": "exact",
    "maxAmountRequired": "5000000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "RELAYER_ADDRESS",
    "network": "base-mainnet"
  }]
}
```

To complete payment:

1. Transfer the exact USDC amount to the `payTo` address on Base
2. Retry the same POST with the payment header:

```bash
curl -s -X POST https://hazza.name/x402/register \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: BASE64_ENCODED_PAYMENT" \
  -d '{"name": "brian", "owner": "USER_WALLET_ADDRESS"}'
```

The `X-PAYMENT` header is Base64-encoded JSON: `{"scheme":"exact","txHash":"0x...","from":"USER_WALLET_ADDRESS"}`

### 5. Set Profile Records (Optional)

After registration, help the user set up their profile:

```bash
curl -s -X POST https://hazza.name/api/text/brian \
  -H "Content-Type: application/json" \
  -d '{"key": "description", "value": "Builder on Base", "signature": "SIGNED_MESSAGE"}'
```

The signature is an EIP-191 personal sign of `setText:brian:description:Builder on Base` by the name owner.

## Pricing

| Situation | Cost |
|-----------|------|
| First name per wallet | **FREE** (gas only) |
| Unlimited Pass holder — 2nd name | **FREE** (gas only) |
| Paid names 1-3 (per wallet, 90-day window) | $5 USDC |
| Paid names 4-5 | $12.50 USDC |
| Paid names 6-7 | $25 USDC |
| Paid names 8+ | $50 USDC |
| Unlimited Pass discount | 20% off all paid tiers |

Free registrations do not count toward the progressive pricing tiers. If a user gets 2 free names, their next 3 paid names are still at the $5 tier.

Names are permanent — no renewals, no expiry. Pay once, own forever.

## API Reference

Base URL: `https://hazza.name`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/available/:name` | GET | Check name availability |
| `/api/quote/:name?wallet=ADDR` | GET | Get exact price for this wallet |
| `/api/free-claim/:address` | GET | Free claim eligibility |
| `/api/profile/:name` | GET | Full profile with text records |
| `/api/names/:address` | GET | All names owned by a wallet |
| `/api/resolve/:name` | GET | Resolve name to owner |
| `/api/reverse/:address` | GET | Reverse resolve address to name |
| `/api/stats` | GET | Registry stats (total names) |
| `/x402/register` | POST | Register a name (x402 flow) |
| `/api/text/:name` | POST | Set a text record |

## Key Addresses (Base Mainnet)

| Item | Address |
|------|---------|
| Registry | `0xaA27d926F057B72D006883785FC03DB1d9d6E3AC` |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Chain ID | 8453 |

## Name Rules

- Lowercase only: a-z, 0-9, hyphens
- 3 to 63 characters
- No leading or trailing hyphens
- No consecutive hyphens (--)
- No spaces, emojis, or special characters
- Each name becomes a real web page — names must work as DNS labels

If a user requests a name with invalid characters, explain that names need to work as web addresses, so only letters, numbers, and hyphens are allowed.

## Profile Records

After registration, users can set these text records on their name:

| Key | Purpose | Example |
|-----|---------|---------|
| `avatar` | Profile image URL | `https://example.com/pfp.png` |
| `description` | Bio | `Builder on Base` |
| `url` | Website | `https://alice.dev` |
| `com.twitter` | Twitter/X handle | `alice` |
| `com.github` | GitHub username | `alice` |
| `org.telegram` | Telegram handle | `alice` |
| `com.discord` | Discord username | `alice#1234` |
| `xmtp` | XMTP address | `0x...` |

## Post-Registration

After a successful registration, share these with the user:

- **Profile page:** `https://brian.hazza.name`
- **Marketplace:** `https://hazza.name/marketplace`
- **Set up profile:** Visit `https://hazza.name/dashboard` to manage records

## Guidelines

- It's "hazza" or "hazza.name" — never "HAZZA" or "Hazza Names"
- Names are "immediately useful" — they come with a working profile page from day one
- Powered by x402, XMTP and Net Protocol
- Never promise price appreciation or investment value
- If a name is taken, suggest alternatives (add numbers, try different names)
