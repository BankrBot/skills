---
name: aurex
description: Issue virtual crypto-funded cards and manage payments with the Aurex API. Use when users want to create virtual Visa/Mastercard cards, handle crypto deposits in SOL/USDT/USDC, manage user accounts, top up cards, retrieve transaction history, or get card details including CVV and OTP codes. Supports full card lifecycle management and partner markup/commission tracking.
---

# Aurex

Issue virtual crypto-funded cards and manage payments programmatically using the Aurex API.

## Overview

Aurex provides a REST API for issuing virtual cards funded with crypto. It handles user management, crypto deposits (SOL, USDT, USDC), card issuance, top-ups, and transaction history. No KYC friction for developers — get an API key and start issuing cards in minutes.

**Base URL:** `https://aurex.cash/api/dashboard`
**Auth:** `Authorization: Bearer YOUR_API_KEY`
**Rate limit:** 60 requests/minute per API key

## Quick Start

```bash
# Set your API key
export AUREX_API_KEY="your-api-key"

# Create a user and issue a card
scripts/create-user-and-card.sh
```

Or install the TypeScript SDK:

```bash
npm install @aurexcash/agent
```

## Core Capabilities

### 1. User Management

Create and manage users who hold wallets and cards:

```typescript
// Create a user
const response = await fetch('https://aurex.cash/api/dashboard/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'John Doe', email: 'john@example.com' })
});
const { userId } = await response.json();
```

**Use cases:**
- Onboard new users
- Retrieve user profiles
- List all users

**Reference:** [references/users.md](references/users.md)

### 2. Crypto Deposits

Fund user wallets with SOL, USDT, or USDC:

```typescript
// Get deposit address for a user
const response = await fetch(`https://aurex.cash/api/dashboard/users/${userId}/wallet`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const { address, currency } = await response.json();
// Send crypto to this address to fund the wallet
```

**Supported currencies:** SOL, USDT, USDC
**Reference:** [references/users.md](references/users.md)

### 3. Virtual Card Issuance

Issue virtual Visa/Mastercard cards for users:

```typescript
// Issue a card
const response = await fetch('https://aurex.cash/api/dashboard/cards', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId,
    name: 'Shopping Card',
    amount: 50 // initial balance in USD
  })
});
const { cardId } = await response.json();
```

**Reference:** [references/cards.md](references/cards.md)

### 4. Card Top-Up

Add funds to an existing card:

```typescript
// Top up a card
const response = await fetch(`https://aurex.cash/api/dashboard/cards/${cardId}/topup`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ amount: 25 })
});
```

**Reference:** [references/cards.md](references/cards.md)

### 5. Card Details & OTP

Retrieve full card details including card number, CVV, and OTP:

```typescript
// Get card details
const response = await fetch(`https://aurex.cash/api/dashboard/cards/${cardId}`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const { number, cvv, expiry, otp } = await response.json();
```

**Reference:** [references/cards.md](references/cards.md)

### 6. Transaction History

Retrieve full transaction history for a card:

```typescript
// Get transactions
const response = await fetch(`https://aurex.cash/api/dashboard/cards/${cardId}/transactions`, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
const { transactions } = await response.json();
```

**Reference:** [references/cards.md](references/cards.md)

### 7. Partner Markup & Commission

Apply markup to card top-ups and track your earnings:

```typescript
// Set partner markup (e.g. 5%)
const response = await fetch('https://aurex.cash/api/dashboard/partner/markup', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ markup: 5 })
});
```

**Reference:** [references/commission.md](references/commission.md)

## Common Workflows

### Issue a Card End-to-End

1. Create a user with `POST /users`
2. Get their deposit wallet address with `GET /users/:id/wallet`
3. User sends crypto to the deposit address
4. Issue a card with `POST /cards`
5. Retrieve card details with `GET /cards/:id`

### Top Up an Existing Card

1. Verify user wallet balance with `GET /users/:id/wallet`
2. Top up the card with `POST /cards/:id/topup`
3. Confirm new balance with `GET /cards/:id`

### Track Commission Earnings

1. Set your markup with `POST /partner/markup`
2. All top-ups will include your markup
3. Track earnings with `GET /partner/commission`

## Configuration

```bash
# Required
AUREX_API_KEY="your-api-key"

# Optional
AUREX_BASE_URL="https://aurex.cash/api/dashboard" # default
```

## TypeScript SDK

For TypeScript projects, use the official SDK instead of raw HTTP:

```typescript
import { createAurexTools } from '@aurexcash/agent';

const tools = createAurexTools({ apiKey: process.env.AUREX_API_KEY });

// Works with Claude, OpenAI, Vercel AI SDK
```

**npm:** [@aurexcash/agent](https://www.npmjs.com/package/@aurexcash/agent)
**GitHub:** [aurexcards/aurex-agent](https://github.com/aurexcards/aurex-agent)

## Error Handling

| Status | Meaning |
|--------|---------|
| 401 | Invalid or missing API key |
| 404 | User or card not found |
| 422 | Insufficient wallet balance |
| 429 | Rate limit exceeded (60 req/min) |

## Resources

- Website: [aurex.cash](https://aurex.cash)
- API Docs: [docs.aurex.cash](https://docs.aurex.cash)
- SDK: [github.com/aurexcards/aurex-agent](https://github.com/aurexcards/aurex-agent)
- Support: [support@aurex.cash](mailto:support@aurex.cash)
