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

Returns `{"total": "5", "totalRaw": "5000000", "registrationFee": "5", "lineItems": [...]}`. A `totalRaw` of `"0"` means the name is free for this wallet. Amounts in `total` and `registrationFee` are human-readable USD; `totalRaw` is USDC with 6 decimals.

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
    "network": "base"
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

After registration, the user can set text records via the manage page at `https://hazza.name/manage` (connect wallet, select name, edit records, sign transaction).

The write API requires an API key and returns unsigned transactions:

```bash
curl -s -X POST https://hazza.name/api/text/brian \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer API_KEY" \
  -d '{"key": "description", "value": "Builder on Base"}'
```

Returns `{name, key, value, tx}` — the `tx` object must be signed and submitted by the name owner.

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

## Marketplace — Buy & Sell Names

hazza names trade on the Seaport protocol (same as OpenSea) via the Net Protocol Bazaar. The hazza API handles all Seaport complexity — you never need to decode raw order parameters yourself.

### Browse Listings

```bash
curl -s https://hazza.name/api/marketplace/listings
```

Returns:

```json
{
  "listings": [
    {
      "name": "example",
      "tokenId": "42",
      "seller": "0x...",
      "price": 0.01,
      "priceRaw": "10000000000000000",
      "currency": "ETH",
      "listingExpiry": "2026-04-01T00:00:00Z",
      "orderHash": "0xabc123...",
      "isNamespace": false,
      "avatar": "https://...",
      "profileUrl": "https://example.hazza.name",
      "orderComponents": { ... }
    }
  ],
  "total": 1
}
```

Listings include `orderComponents` (the full Seaport order) but you do NOT need to use them directly. Use the fulfill endpoint instead.

### Buy a Listed Name (2-Step)

**Step 1 — Get the transaction data:**

```bash
curl -s -X POST https://hazza.name/api/marketplace/fulfill \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0xabc123...", "buyerAddress": "BUYER_WALLET"}'
```

Returns the exact transactions to execute:

```json
{
  "approvals": [
    {
      "to": "0x...",
      "data": "0x095ea7b3...",
      "value": "0",
      "spender": "0x...",
      "amount": "10000000000000000"
    }
  ],
  "fulfillment": {
    "to": "0x0000000000000068F116a894984e2DB1123eB395",
    "data": "0xb3a34c4c...",
    "value": "10000000000000000"
  }
}
```

**Step 2 — Execute the transactions:**

1. If `approvals` is non-empty, send each approval transaction first (these approve token spending)
2. Send the `fulfillment` transaction — this is the actual Seaport purchase

The `fulfillment.to` is the Seaport contract (`0x0000000000000068F116a894984e2DB1123eB395`). The `data` is the complete Seaport calldata. The `value` is the ETH amount to send (for ETH-priced listings).

**Important:** The fulfillment data is ready to use as-is. Do NOT try to decode or reconstruct Seaport orders. The API does all the heavy lifting.

### Browse Collection Offers

```bash
curl -s https://hazza.name/api/marketplace/offers
```

Returns active offers on any hazza name.

### Accept an Offer (Seller Flow)

```bash
curl -s -X POST https://hazza.name/api/marketplace/fulfill-offer \
  -H "Content-Type: application/json" \
  -d '{"orderHash": "0x...", "tokenId": "42", "sellerAddress": "SELLER_WALLET"}'
```

Returns the same `{approvals, fulfillment}` format. The seller executes these transactions to accept the offer and transfer their name.

### Marketplace Fees

- 2% marketplace fee on all sales
- Seaport contract: `0x0000000000000068F116a894984e2DB1123eB395` (Base)
- Treasury: `0x62B7399B2ac7e938Efad06EF8746fDBA3B351900`

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
| `/api/marketplace/listings` | GET | Browse active listings |
| `/api/marketplace/offers` | GET | Browse collection offers |
| `/api/marketplace/fulfill` | POST | Get buy transaction data |
| `/api/marketplace/fulfill-offer` | POST | Get offer acceptance tx data |

## Key Addresses (Base Mainnet)

| Item | Address |
|------|---------|
| Registry | `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E` |
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
- **Set up profile:** Visit `https://hazza.name/manage` to set text records
- **Dashboard:** `https://hazza.name/dashboard` to see all your names

## Guidelines

- It's "hazza" or "hazza.name" — never "HAZZA" or "Hazza Names"
- Names are "immediately useful" — they come with a working profile page from day one
- Powered by x402, XMTP and Net Protocol
- Never promise price appreciation or investment value
- If a name is taken, suggest alternatives (add numbers, try different names)
