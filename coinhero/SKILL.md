---
name: coinhero
description: List tokens on CoinHero via consignment deals on Base — deposit ERC-20 inventory, earn USDC when the protocol buys your token for CoinHero card games. Use when a wallet-enabled agent wants to consign a Base ERC-20 token, check deal performance, or withdraw earnings. Requires a CoinHero dashboard API key and a wallet (EOA) on Base mainnet with at least $50 USD worth of the token to deposit.
metadata: {"clawdbot":{"emoji":"🃏","homepage":"https://my.coinhero.fun","requires":{"bins":["curl"]}}}
---

# Agent Consignment Deals (CoinHero)

List a token on CoinHero via **consignment**: deposit inventory, earn USDC when
the protocol buys your token for CoinHero games. For **wallet-enabled Bankr agents**
that can sign Base transactions from their own wallet.

**API base:** `https://my.coinhero.fun`  
**Chain:** Base mainnet (`chainId: 8453`)

## Quick Start

### Setup

1. Get an API key: the human logs in at [my.coinhero.fun](https://my.coinhero.fun) and uses the **BANKR Agent Quick Start** wizard (Step 2) to create a key. Keys begin with `chk_` and are shown **once**. Existing keys are under **My Agents** on the same page.
2. Add it to your environment as `COINHERO_API_KEY`
3. Ensure your bot wallet (EOA) holds the ERC-20 token you want to consign on Base mainnet

> **Inventory requirement:** To activate a deal you must deposit at least **$50 USD worth of the token you are consigning**. This is your own token inventory — the assumption is you already hold it. The protocol purchases from that deposited balance; you are not buying anything upfront.

## Architecture

```
Human owner (my.coinhero.fun)
  → creates dashboard API key (chk_…) at https://my.coinhero.fun
Bot (Bankr / agent runtime)
  → Bearer auth + signs txs from managerAddress
CoinHero API
  → registers deal + signed authorization for proposeDeal
ConsignmentManager (Base)
  → holds your deposited inventory; protocol purchases from it for packs
```

## How consignment works

**Consignment-only sourcing.** Your token appears in game packs only from inventory
you deposited into the deal. The protocol buys from your deal balance — not from
open-market supply of the same token.

**Daily cap is in token units, not USDC.** At authorize you pass `dailyPurchaseUsd`
(a USD *planning* target, default ~$10/day). When you first fund the deal, that
target is converted to a fixed on-chain **`dailyLimit`** in **raw token units**
using the token price at funding time:

```
dailyLimit (raw) = round((dailyPurchaseUsd / currentPrice) × 10^tokenDecimals)
```

After `setDailyLimit` runs, the cap is **token-denominated**. If the token price
moves later, the daily spend in USD will drift — the on-chain limit does **not**
auto-update. Use `dailyLimit`, `dailyUsed`, and `dailyRemaining` on
`GET /api/agent/deals` (human-readable token amounts) as the source of truth.

**Spend never exceeds the daily cap.** Purchases are capped at `dailyRemaining`
each UTC day. Pack allocation may use slightly less than the cap if the remaining
amount does not fit in a pack — this is normal. Unused tokens stay in
`availableBalance`; withdraw them anytime (Step 6).

**Adjust the cap.** `PATCH /api/agent/deals/:id` with `{ "dailyLimit": "<raw>" }`
returns a `setDailyLimit` transaction to sign. Pass **raw token units**, not USD.

## Preconditions

1. **Dashboard API key** — human logs in at [my.coinhero.fun](https://my.coinhero.fun).
   The **BANKR Agent Quick Start** wizard on the landing page walks through key creation
   (Step 2). Keys begin with `chk_` and are shown **once** — copy immediately.
   Existing keys are managed under **My Agents** on the same page.
2. **Manager wallet** — EOA the bot controls (`managerAddress`). Holds the ERC-20
   inventory and signs on-chain txs. Must have Base ETH for gas.
3. **ERC-20 on Base** — the token you are consigning (`tokenAddress`).
4. **Minimum deposit** — $50 USD worth of your token before the deal activates.

## API key

When your human pastes a `chk_…` key, permanently save it to your secrets store (e.g. as env variable `COINHERO_API_KEY`) before calling the API — not chat history alone.

## Authentication

Every request:

```http
Authorization: Bearer chk_<your_key>
Content-Type: application/json
```

## End-to-end flow

```
0. persist key   save chk_… to secrets (see above)
1. authorize     POST /api/agent/deals/authorize
2. propose       broadcast transaction.data to ConsignmentManager (from managerAddress)
3. deposit       POST /api/agent/deals/:id/deposit → sign+broadcast transactions[]
4. wait          poll GET /api/agent/deals until status === "active"
5. monitor       GET /api/agent/deals or GET /api/agent/deals/:id (consignment sales + inventory)
6. withdraw      POST /api/agent/deals/:id/withdraw (optional; USDC auto-withdraws daily by default)
```

Agent deals have **auto-withdraw** enabled — USDC earnings go to `managerAddress` once per day. Disable with `PATCH { "autoWithdraw": false }`.

### Step 1 — Authorize (create pending deal + signature)

```http
POST https://my.coinhero.fun/api/agent/deals/authorize
```

```json
{
  "tokenAddress": "0x…",
  "managerAddress": "0x…",
  "tokenName": "My Token",
  "tokenSymbol": "MTK",
  "tokenDecimals": 18,
  "dailyPurchaseUsd": 10
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `tokenAddress` | yes | ERC-20 on Base |
| `managerAddress` | yes | Bot signing wallet (deal manager) |
| `tokenName`, `tokenSymbol`, `tokenDecimals` | recommended | Stored on deal; used if coin not in catalog yet |
| `dailyPurchaseUsd` | optional | USD planning target for daily cap (**$5–$50**, default $10). Converted to a fixed **token** `dailyLimit` when you first fund the deal |

**201 response** (abbreviated; **200** with `refreshed: true` when re-authorizing the same pending deal):

```json
{
  "dealId": "uuid",
  "refreshed": false,
  "proposeDealOnChain": false,
  "authorization": {
    "deadline": 1720000000,
    "ttlSeconds": 300
  },
  "transaction": {
    "chainId": 8453,
    "to": "0x…ConsignmentManager",
    "data": "0x…",
    "value": "0",
    "from": "0x…managerAddress",
    "functionName": "proposeDeal"
  },
  "limits": {
    "minInitialDepositUsd": 50,
    "requestedDailyPurchaseUsd": 10
  },
  "nextSteps": [ "…" ]
}
```

### Step 2 — Broadcast `proposeDeal`

Broadcast `transaction` (pre-encoded calldata in `transaction.data`) from
**`managerAddress`** before `authorization.deadline` (Unix timestamp, typically
`authorization.ttlSeconds` seconds from now). Deal is created on-chain in **paused** state.

If the signature expires before broadcast, call **authorize again** with the same
`tokenAddress` and `managerAddress`. You get the **same `dealId`** with a new
`deadline` and `signature` (`refreshed: true`). If `proposeDealOnChain` is already
`true`, skip propose and go to deposit.


### Step 3 — Deposit tokens (while pending or active)

**Goal:** cumulative on-chain deposit must reach **$50 USD** (valued at `currentPrice`)
before activation (~5 days of inventory at the default ~$10/day purchase target).

#### How to compute `amount`

`amount` is **not** USD. It is the deposit size in **smallest token units** (like
ERC-20 wei): an integer string with no decimals.

1. After `proposeDeal`, fetch the deal:
   ```http
   GET https://my.coinhero.fun/api/agent/deals/{dealId}
   ```
2. Read `currentPrice` (USD per whole token) and `tokenDecimals` from the response.
3. Compute how many **whole tokens** you still need (first deposit: full $50; later
   deposits: subtract what is already on-chain):
   ```
   tokensNeeded = (50 - priorDepositUsd) / currentPrice
   priorDepositUsd = deposited × currentPrice   // deposited is human token units from GET
   ```
4. Convert to raw units for the request body:
   ```
   amount = floor(tokensNeeded × 10^tokenDecimals)   // decimal string, no 0x prefix
   ```

| Token price | Decimals | Tokens for $50 | `amount` (raw string) |
|-------------|----------|----------------|------------------------|
| $10.00 | 18 | 5 | `"5000000000000000000"` |
| $0.50 | 18 | 100 | `"100000000000000000000"` |
| $1.00 | 6 | 50 | `"50000000"` |

If `currentPrice` is `0` or missing, deposit returns **400** — the token must be
priced in catalog before funding.

#### Request

```http
POST https://my.coinhero.fun/api/agent/deals/{dealId}/deposit
```

```json
{ "amount": "5000000000000000000" }
```

Response `transactions[]` is ordered:

1. `addManager` (if needed)
2. `setDailyLimit` (if not set yet — converts your `dailyPurchaseUsd` target to token units at current price)
3. `ERC20.approve` (if allowance low)
4. `deposit`

Sign and broadcast each step from `managerAddress`. You may split across multiple
deposits, but **each request** must leave cumulative on-chain value at or above $50,
or the API returns **400** with `shortfallUsd`, `depositUsd`, and `minDepositUsd`.

### Step 4 — Wait for activation

`status` stays `pending` until CoinHero activates your consignment (after verifying
~$50 on-chain deposit and token liquidity). Activation is a manual review step —
expect up to 1–2 business days, though it may be only a few hours. Poll at most
once per hour:

```http
GET https://my.coinhero.fun/api/agent/deals
GET https://my.coinhero.fun/api/agent/deals/{dealId}
```

When `status === "active"` and `onChainPaused === false`, purchases from your deal
can begin. Listing your token in games may take additional time after activation.

### Step 5 — Monitor performance

`GET /api/agent/deals` returns each deal merged with **on-chain inventory** and
**`consignmentStats`** (tokens sold from this deal only).

#### On-chain deal fields

| Field | Meaning |
|-------|---------|
| `deposited` / `availableBalance` | Your unsold inventory in the deal (token units) |
| `purchased` | Tokens bought from **this deal** |
| `totalUsdPaid` | USDC received for all consignment sales |
| `pendingEarnings` | USDC earned but not yet withdrawn |
| `dailyLimit` | Max tokens purchasable per UTC day (0 = unlimited). **Token units**, fixed at funding |
| `dailyUsed` | Tokens already purchased today |
| `dailyRemaining` | Tokens still purchasable today (`dailyLimit − dailyUsed`, resets each UTC day) |

#### `consignmentStats` (deal-scoped sales only)

```json
{
  "consignmentStats": {
    "tokensSold": 1250.5,
    "tokensSoldUsd": 312.62,
    "usdcEarned": 218.83,
    "usdcPendingWithdrawal": 12.50,
    "tokenHolders": 1234
  }
}
```

| Field | Notes |
|-------|-------|
| `tokensSold` | On-chain `purchased` for this deal |
| `usdcEarned` | USDC received (on-chain `totalUsdPaid`) |
| `usdcPendingWithdrawal` | Withdrawable USDC (`pendingEarnings`) |

### Step 6 — Withdraw (optional)

Withdraw **unsold deposited tokens** or **USDC earnings** at any time.

```http
POST https://my.coinhero.fun/api/agent/deals/{dealId}/withdraw
```

```json
{ "type": "tokens", "amount": "1000000000000000000" }
```

or `{ "type": "earnings" }` for USDC.

Returns a prepared transaction to sign from `managerAddress`.

### Pause / resume / daily limit

```http
PATCH https://my.coinhero.fun/api/agent/deals/{dealId}
```

```json
{ "pause": true }
```

```json
{ "autoWithdraw": true }
```

```json
{ "dailyLimit": "5000000000000000000" }
```

`dailyLimit` must be **raw token units**, not USD. On-chain ops return `transactions[]`
to sign and broadcast.

## Other endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agent/me` | Agent id, wallet, status |
| GET | `/api/agent/deals` | List deals + stats |
| GET | `/api/agent/deals/:id` | Single deal + `onChainStatus` |

## Bot implementation checklist

- [ ] Persist `chk_…` to secrets when the human provides it
- [ ] Use `managerAddress` consistently for all signed txs
- [ ] Handle `transaction.deadline` on authorize — re-call authorize with same manager+token for a fresh signature
- [ ] Compute deposit `amount` from `currentPrice` and `tokenDecimals` (see Step 3)
- [ ] Loop deposit until on-chain `deposited × currentPrice >= 50`
- [ ] Poll deal status every few minutes while `pending`
- [ ] After `active`, poll `consignmentStats.tokensSold`, `dailyRemaining`, and `availableBalance`
- [ ] Withdraw unused inventory if `dailyRemaining` or pack rounding leaves tokens idle
- [ ] Monitor `pendingEarnings` and trigger withdraw when it exceeds a threshold

## Limits

| Limit | Value |
|-------|-------|
| Min cumulative deposit before activation | **$50** USD (at funding-time price) |
| `dailyPurchaseUsd` at authorize | **$5–$50**/day planning target (default **$10**) |
| On-chain `dailyLimit` | **Token units**, set at first deposit from `dailyPurchaseUsd ÷ price`; change via `PATCH` |

## Errors

| HTTP | Meaning |
|------|---------|
| 401 | Missing/invalid API key, or legacy key on authorize |
| 403 | Deal not owned by this agent |
| 409 | Deal already exists for manager+token |
| 400 | Deposit too small, deal not on-chain yet, invalid amount |
| 503 | Signing/contract issue — contact support |
