---
name: traderouter
description: >
  Solana swap execution, MEV-protected transaction submission, wallet scanning, and market-cap-based
  limit/trailing orders via the TradeRouter API. Use when the user wants to: swap SPL tokens on Solana
  (buy or sell), check wallet token holdings, submit signed transactions through an MEV-protected
  priority lane, place limit orders (buy/sell at a target market cap), set trailing stop orders
  (trailing_sell/trailing_buy), manage existing orders (check, list, cancel, extend), or implement
  DCA strategies. No API key required — wallet address is the only identity. Supports REST endpoints
  POST /swap, POST /holdings, POST /protect, and WebSocket wss://api.traderouter.ai/ws for limit orders.
---

# TradeRouter

Solana swap builder and limit-order engine.

**Base URL:** `https://api.traderouter.ai`
**WebSocket:** `wss://api.traderouter.ai/ws`
**Auth:** None. No API key. Wallet address is the only identity.
**Content-Type:** All REST requests require `Content-Type: application/json`.

---

## When to use which endpoint

| User intent | Endpoint | Method |
|-------------|----------|--------|
| Instant buy or sell of a token | `POST /swap` → sign → `POST /protect` | REST |
| Check wallet token balances | `POST /holdings` | REST |
| Submit an already-signed transaction with MEV protection | `POST /protect` | REST |
| Limit order (take-profit, stop-loss, dip buy, breakout) | WebSocket `sell` or `buy` action | WS |
| Trailing stop (auto-adjust with market) | WebSocket `trailing_sell` or `trailing_buy` | WS |
| Manage orders (check, list, cancel, extend) | WebSocket actions | WS |
| DCA (recurring small buys) | WebSocket `buy` orders — see DCA section below | WS |

---

## POST /swap — Build unsigned swap transaction

Returns an **unsigned** transaction (base58). Client must sign it, then submit via `POST /protect`.

**Sell uses `holdings_percentage` (bps). Buy uses `amount` (lamports). Never mix them.**

### Request

```json
{
  "wallet_address": "SOLANA_PUBKEY",
  "token_address": "SPL_TOKEN_MINT",
  "action": "buy",
  "amount": 100000000,
  "slippage": 1500
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| wallet_address | string | yes | Solana pubkey |
| token_address | string | yes | SPL token mint address |
| action | string | yes | `"buy"` or `"sell"` |
| amount | integer | buy only | Lamports. **Only for buy.** |
| holdings_percentage | integer | sell only | Bps (10000 = 100%). **Only for sell.** |
| slippage | integer | no | Bps, default 500 (5%). **For low-liquidity or newly launched tokens, use 1500-2500 bps.** 500 bps will often fail on memecoins. |

If both `amount` and `holdings_percentage` are sent, treat the request as invalid. The reference client blocks this locally via schema validation before network calls, and the API should return 422 for malformed payloads.

### Success response

```json
{
  "status": "success",
  "data": {
    "swap_tx": "<base58_unsigned_transaction>",
    "token_address": "SPL_TOKEN_MINT",
    "pool_type": "raydium",
    "pool_address": "POOL_PUBKEY",
    "amount_in": 100000000,
    "min_amount_out": 950000,
    "price_impact": 0.5,
    "slippage": 1500,
    "decimals": 6
  }
}
```

`pool_type` tells you which DEX the swap routes through (e.g. `raydium`, `pumpswap`, `orca`, `meteora`). Treat this field as an open enum and handle unknown values gracefully.

### Error response

```json
{
  "status": "error",
  "error": "Insufficient balance",
  "code": 400
}
```

`code` is optional. Common: 422 (validation), 400 (bad request).

**"Error running simulation"** is usually an unsellable route at that moment (dead/rugged pool, zero effective balance, or no valid route). Do not loop retries — place the token on cooldown and retry later only if strategy requires.

---

## POST /protect — Submit signed transaction (MEV protected)

Submit a **signed** transaction (**base64**). Blocks until confirmed on-chain. Returns signature and balance changes.

**⚠️ Set a 30-second timeout on /protect calls.** This endpoint blocks until on-chain confirmation and can hang during network congestion.

**⚠️ Encoding mismatch:** `/swap` returns `swap_tx` as **base58**. `/protect` expects **base64**. You must convert — see the workflow section.

### Request

```json
{
  "signed_tx_base64": "<base64_signed_transaction>"
}
```

### Success response

```json
{
  "status": "success",
  "signature": "5kyc5dMF1tybDcj8sVMZz3fCLbHYDczZ7A4mMu5JMPz1...",
  "sol_balance_pre": 10399668919,
  "sol_balance_post": 10399538835,
  "token_balances": [
    {
      "mint": "FFKwi6dzaDmkGhtMDGKbt3HAyEYWk2BgwN4AwcWbbonk",
      "balance": 25952334242,
      "decimals": 6,
      "balance_change": 2032594114,
      "ui_amount_string": "25952.334242"
    }
  ]
}
```

Use `sol_balance_post` and `token_balances` to update holdings after the swap.

### Error handling

- `{"status":"error","error":"message"}` — general error.
- **503** — protect endpoint not configured on server. `submitTx()` handles this automatically — falls back to direct RPC. You lose MEV protection but the transaction still goes through.
- **Timeout** — the tx may have landed on-chain. Check tx status via RPC before retrying.

---

## POST /holdings — Scan wallet token balances

Returns token holdings with liquid DEX pool info. **Set HTTP timeout to at least 100 seconds** — this endpoint scans all token accounts and can be slow.

### Request

```json
{
  "wallet_address": "SOLANA_PUBKEY"
}
```

### Response

Empty wallet: `{}`

Wallet with holdings:

```json
{
  "data": [
    {
      "address": "SPL_TOKEN_MINT",
      "valueNative": 1500000000,
      "amount": 25952334242,
      "decimals": 6
    }
  ]
}
```

`/holdings` is intended to return sellable tokens, but keep a defensive `valueNative > MIN_VALUE_NATIVE` filter (default `0`, i.e. `valueNative > 0`) in case stale or edge-case entries appear. The reference client's `getHoldings()` applies this filter automatically.

---

## Instant swap workflow (step by step)

**The encoding changes: /swap returns base58, /protect expects base64.** Do not send base58 to /protect.

1. `POST /swap` with wallet_address, token_address, action, amount or holdings_percentage, slippage
2. Read `data.swap_tx` from response — this is **base58** encoded
3. **Decode** from base58 into raw bytes
4. **Deserialize** as VersionedTransaction
5. **Sign** with wallet private key
6. **Re-serialize** the signed transaction into bytes
7. **Encode** as **base64**
8. Submit via `submitTx(signedBase64)` — this calls `/protect` first (30s timeout), auto-falls back to RPC on 503
9. On success: `signature` = tx hash, use `sol_balance_post` and `token_balances` to update state
10. On timeout: `submitTx` checks if tx landed via RPC before falling back — no manual handling needed

---

## WebSocket — Limit and trailing orders

**URL:** `wss://api.traderouter.ai/ws`

Server monitors market cap every ~5 seconds. When target is crossed, server pushes `order_filled` with an unsigned swap transaction to sign and submit.

### Connection sequence (MUST follow this exact order)

```
1. Connect to wss://api.traderouter.ai/ws
2. Server sends:    {"type": "subscribed"}
3. Client sends:    {"action": "register", "wallet_address": "SOLANA_PUBKEY"}
4. Server sends:    {"type": "registered", "wallet_address": "SOLANA_PUBKEY"}
5. ONLY NOW send order actions
```

**Do NOT send any order actions before receiving `{"type": "registered"}`.**

### Reconnection

On WebSocket disconnect:
1. Reconnect to `wss://api.traderouter.ai/ws`
2. Re-register with `{"action": "register", "wallet_address": "..."}`
3. Wait for `{"type": "registered"}`
4. Check for any pending `order_filled` messages
5. Use the staleness check (`triggered_mcap / filled_mcap < 0.85`) to skip stale fills

Active orders persist server-side — you do **not** need to re-place them after reconnect.

### Limit sell (take-profit or stop-loss)

```json
{
  "action": "sell",
  "token_address": "SPL_TOKEN_MINT",
  "holdings_percentage": 10000,
  "target": 20000,
  "slippage": 1500,
  "expiry_hours": 144
}
```

`target` (often named `targetMcapBps` in client code) is bps vs **current mcap at order placement time** (not your wallet entry price). Any value > 0. **Sell target > 10000** = take-profit (e.g. 20000 = mcap doubles). **Sell target < 10000** = stop-loss (e.g. 5000 = mcap halves).

### Limit buy (dip buy or breakout entry)

```json
{
  "action": "buy",
  "token_address": "SPL_TOKEN_MINT",
  "amount": 100000000,
  "target": 5000,
  "slippage": 1500,
  "expiry_hours": 144
}
```

`target` (often named `targetMcapBps` in client code) is bps vs **current mcap at order placement time** (not your wallet entry price). Any value > 0. **Buy target < 10000** = dip buy (e.g. 5000 = mcap halves). **Buy target > 10000** = breakout entry (e.g. 20000 = mcap doubles).

### Trailing sell / Trailing buy

```json
{
  "action": "trailing_sell",
  "token_address": "SPL_TOKEN_MINT",
  "holdings_percentage": 10000,
  "trail": 1000,
  "slippage": 1500,
  "expiry_hours": 144
}
```

`trail` is bps — percentage callback from peak before triggering.

**Example:** `trail: 1000` (10%). Token mcap peaks at $100k. Sell triggers when mcap drops to $90k (10% below peak). If mcap later peaks at $150k, the trigger moves up to $135k.

Replace `trailing_sell` with `trailing_buy` and `holdings_percentage` with `amount` for trailing buy. For trailing buy, the trigger works in reverse: if mcap bottoms at $50k, a 10% trail triggers when mcap rises to $55k.

### Order management actions

```json
{"action": "check_order", "order_id": "ORDER_ID"}
{"action": "list_orders"}
{"action": "cancel_order", "order_id": "ORDER_ID"}
{"action": "extend_order", "order_id": "ORDER_ID", "expiry_hours": 336}
```

### Order expiry

Orders silently expire when `expiry_hours` is reached — **the server does not send an expiry event.** To detect expired orders, periodically call `check_order` or `list_orders`. Expired orders will no longer appear in results.

### All WebSocket actions reference

| Action | Required fields | Optional |
|--------|----------------|----------|
| register | wallet_address | — |
| sell | token_address, holdings_percentage (bps), target, slippage | expiry_hours (default 144), wallet_address |
| buy | token_address, amount (lamports), target, slippage | expiry_hours, wallet_address |
| trailing_sell | token_address, holdings_percentage, trail (bps), slippage | expiry_hours |
| trailing_buy | token_address, amount, trail (bps), slippage | expiry_hours |
| check_order | order_id | — |
| list_orders | — | wallet_address |
| cancel_order | order_id | — |
| extend_order | order_id, expiry_hours (max 336) | — |

**expiry_hours:** default 144, max 336.

### Server → client message types

| type | Payload fields | Description |
|------|---------------|-------------|
| subscribed | — | Initial message after connect |
| registered | wallet_address | Registration confirmed |
| order_created | order_id, order_type, entry_mcap, target_mcap | Order accepted |
| order_filled | order_id, order_type, status, entry_mcap, triggered_mcap, filled_mcap, target_mcap, triggered_at, filled_at, token_address, data.swap_tx (base58 unsigned) | Target hit — sign data.swap_tx and submit via submitTx() |
| order_status | order_id, status | Response to check_order |
| order_list | orders[] | Response to list_orders |
| order_cancelled | order_id | Order cancelled |
| order_extended | order_id | TTL extended |
| error | message | Error description |
| heartbeat | — | Keepalive, ignore |

### Handling order_filled

When `order_filled` arrives:
1. Read `order_id` from the message — use for logging and correlation throughout
2. Read `data.swap_tx` — this is **base58** unsigned
3. **Decode** from base58 into raw bytes
4. **Deserialize** as VersionedTransaction
5. **Sign** with client wallet
6. **Re-serialize** signed transaction into bytes
7. **Encode** as **base64**
8. Submit via `submitTx(signedBase64)` — handles /protect + fallback internally
9. Log `order_id` + `signature` together for audit trail
10. Use response to update holdings

**⚠️ `filled_mcap` can be 0 or null.** If `triggered_mcap` exists but `filled_mcap` is 0/null, the fill is still valid — the transaction will work, but mcap data at fill time is unreliable. Don't reject fills based on `filled_mcap` alone.

**Staleness check:** After reconnect, if `triggered_mcap / filled_mcap < 0.85`, the fill is stale — consider skipping.

### `holdings_percentage` resolves at execution time

For limit sell and trailing sell orders, `holdings_percentage` is calculated **when the order triggers**, not when placed. If you sell 50% of a token via instant swap, a pending order with `holdings_percentage: 10000` (100%) will sell 100% of the *remaining* balance, not the original amount. This is a feature — it accounts for partial sells between placement and execution.

---

## DCA (Dollar-Cost Averaging)

DCA is implemented as repeated limit buy orders. It is **not automatic chaining** — each fill requires agent action:

1. Place a `buy` order via WebSocket with the desired `amount` and `target`
2. When `order_filled` arrives, sign the `swap_tx` and submit via `submitTx()` (follow the base58→base64 steps above)
3. After successful submission, place the **next** `buy` order
4. Repeat for as many intervals as desired

The server does not auto-chain orders. Each fill triggers `order_filled`, the agent must sign + submit, then explicitly place the next order.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| /holdings times out | Set HTTP timeout to at least 100 seconds. |
| /protect hangs | Set a 30s timeout. On timeout, check tx status via RPC before retrying — tx may have landed. |
| /protect returns 503 | `submitTx()` auto-falls back to RPC. No manual action needed. |
| 422 from /swap | Invalid payload (missing fields or mixed buy/sell params). Sell needs: wallet_address, token_address, action, holdings_percentage. Buy needs: wallet_address, token_address, action, amount. |
| "Error running simulation" from /swap | Route is unsellable now (dead/rugged pool, zero effective balance, or route failure). Put token on cooldown; avoid tight retry loops. |
| Swap fails on-chain | Increase slippage (1500-2500 bps for memecoins), check SOL balance for fees, verify token/pool exists. |
| No order_filled received | Verify register was sent and `{"type":"registered"}` received. Wallet must match. |
| WebSocket disconnects | Reconnect, re-register, check for pending fills. Active orders persist server-side. |
| Sell fails on token from /holdings | Keep defensive filter `valueNative > MIN_VALUE_NATIVE` (`> 0` by default) and verify balance/pool just before sell. |
| filled_mcap is 0 or null | Fill is still valid. Execute normally — mcap data is unreliable but tx works. |
| Order seems to have disappeared | Orders silently expire at `expiry_hours`. Use `list_orders` to check. |

---

## Request pacing / rate limits

No hard limits are documented in this skill. Use conservative client pacing defaults unless the API owner gives stricter numbers:

- REST (`/swap`, `/protect`, `/holdings`): target <= 2 requests/sec sustained per wallet (short bursts <= 5).
- WebSocket mutating actions (`buy`, `sell`, `trailing_*`, `cancel_order`, `extend_order`): target <= 5 messages/sec per wallet.
- On 429 or repeated 5xx: exponential backoff with jitter (1s, 2s, 4s, cap 30s).
- Never tight-loop retries on the same token after `"Error running simulation"`; honor cooldown first.

---

## Important rules

- **No API key needed.** Wallet address is the only identity.
- **Never expose private keys.** Sign only in a secure client environment.
- **Register first on WebSocket.** No orders before `{"type":"registered"}` is received.
- **Sell = holdings_percentage. Buy = amount.** Do not mix these parameters.
- **Target basis:** WS `target` is relative to **current mcap at order placement**, not to your wallet entry price.
- **Encoding: /swap returns base58, /protect expects base64.** Decode → deserialize → sign → serialize → encode base64.
- **Slippage:** Default 500 (5%). **Use 1500-2500 bps for low-liquidity or newly launched tokens.** 500 bps will fail on most memecoins.
- **Set timeouts:** 30s on /protect, 100s on /holdings.
- **All transactions from the API are unsigned.** Client always signs.
- **Always submit via `submitTx()`.** This function enforces /protect first for MEV protection. RPC fallback is internal and only fires on 503 or timeout. **Never call `connection.sendRawTransaction()` directly.**
- **Unsellable routes:** "Error running simulation" should trigger cooldown, not spam retries.
- **Holdings filtering:** Keep `valueNative > MIN_VALUE_NATIVE` (`> 0` by default) as a defensive guard before sells. The reference client's `getHoldings()` does this automatically.
- **Order expiry is silent.** Server does not notify. Poll `list_orders` to detect.

---

## Definition of Done

An agent is production-ready only when it can execute all of the following with **zero manual steps**:

- [ ] **Instant buy:** `POST /swap` (buy) → decode base58 → sign → encode base64 → `submitTx()` → verify signature
- [ ] **Instant sell:** `POST /holdings` → defensive filter `valueNative > MIN_VALUE_NATIVE` (`> 0` by default) → `POST /swap` (sell) → sign → `submitTx()`
- [ ] **WebSocket limit order:** connect → register → place sell order → receive `order_filled` → sign → `submitTx()`
- [ ] **WebSocket trailing order:** connect → register → place `trailing_sell` → receive `order_filled` → sign → `submitTx()`
- [ ] **DCA cycle:** place buy order → handle fill → `submitTx()` → place next buy order
- [ ] **Reconnection:** disconnect → reconnect → re-register → handle pending fills with staleness check
- [ ] **Error handling:** gracefully handle unsellable routes, 503, timeouts, stale fills, expired orders
- [ ] **Preflight checks pass:** env loaded, wallet accessible, RPC reachable, WS registration succeeds

---

## Canonical Stack

Pin these exact versions. Do not use alternatives unless explicitly tested.

```
Runtime:    Node.js 20 LTS
web3.js:    @solana/web3.js@1.95.8
bs58:       bs58@6.0.0
ws:         ws@8.18.0
ajv:        ajv@8.17.1
```

```bash
npm init -y
npm pkg set type=module
npm install @solana/web3.js@1.95.8 bs58@6.0.0 ws@8.18.0 ajv@8.17.1
```

**The `type=module` line is required.** All code below uses ESM imports and top-level await, which fail under CommonJS.

All code examples below use this stack. If using a different runtime (Python, Rust), the encoding logic is identical — the library names change but the byte-level operations are the same.

---

## Reference Client

Minimal copy-paste implementation. **Everything is in this one code block** — safety guards, logging, kill switch, dry-run gating. There are no separate code blocks to wire in. The reference client uses `ajv` to validate requests before sending them. The inline schemas enforce the minimum required fields for each call; the Request/Response Schemas section below has the full payload definitions.

**One submission function:** All transactions go through `submitTx()`. This function tries `/protect` first (MEV-protected), and only falls back to direct RPC on 503 or timeout. There is no separate RPC submission function — the fallback is internal. **Never call `connection.sendRawTransaction()` directly.**

```javascript
import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import WebSocket from 'ws';
import Ajv from 'ajv';

const API = 'https://api.traderouter.ai';
const WS_URL = 'wss://api.traderouter.ai/ws';
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

const connection = new Connection(RPC_URL, 'confirmed');

// SAFE-BY-DEFAULT: DRY_RUN is true unless you explicitly set DRY_RUN=false to go live.
const DRY_RUN = process.env.DRY_RUN !== 'false';

// ---------- Schema Validation (AJV, enforced at runtime) ----------

const ajv = new Ajv({ allErrors: true, strict: false });

const swapRequestSchema = {
  type: 'object',
  required: ['wallet_address', 'token_address', 'action'],
  properties: {
    wallet_address: { type: 'string', minLength: 32, maxLength: 44 },
    token_address: { type: 'string', minLength: 32, maxLength: 44 },
    action: { type: 'string', enum: ['buy', 'sell'] },
    amount: { type: 'integer', minimum: 1 },
    holdings_percentage: { type: 'integer', minimum: 1, maximum: 10000 },
    slippage: { type: 'integer', minimum: 100, maximum: 2500 },
  },
  if: { properties: { action: { const: 'buy' } } },
  then: { required: ['amount'], not: { required: ['holdings_percentage'] } },
  else: { required: ['holdings_percentage'], not: { required: ['amount'] } },
};

const protectRequestSchema = {
  type: 'object',
  required: ['signed_tx_base64'],
  properties: {
    signed_tx_base64: { type: 'string', minLength: 100, pattern: '^[A-Za-z0-9+/]+=*$' },
  },
};

const orderFilledSchema = {
  type: 'object',
  required: ['type', 'order_id', 'order_type', 'status', 'data'],
  properties: {
    type: { const: 'order_filled' },
    order_id: { type: 'string' },
    order_type: { type: 'string', enum: ['sell', 'buy', 'trailing_sell', 'trailing_buy'] },
    status: { type: 'string', enum: ['success'] },
    data: {
      type: 'object',
      required: ['swap_tx', 'token_address', 'pool_type'],
      properties: {
        swap_tx: { type: 'string', minLength: 100 },
        token_address: { type: 'string' },
        pool_type: { type: 'string' },
      },
    },
  },
};

const validateSwapRequest = ajv.compile(swapRequestSchema);
const validateProtectRequest = ajv.compile(protectRequestSchema);
const validateOrderFilled = ajv.compile(orderFilledSchema);

function assertSchema(validateFn, payload, label) {
  if (validateFn(payload)) return;
  const detail = ajv.errorsText(validateFn.errors || [], { separator: '; ' });
  throw new Error(`${label} validation failed: ${detail}`);
}

// ---------- Logging (JSON lines, one line per event) ----------

function log(fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), wallet: _wallet?.publicKey?.toBase58() || 'unknown', ...fields }));
}

// ---------- Safety Guards (enforced in buildSwap + submitTx) ----------

const SAFETY = {
  MAX_BUY_LAMPORTS: 500_000_000,        // 0.5 SOL max per buy (conservative starter)
  MAX_SLIPPAGE_BPS: 2500,               // 25% absolute ceiling
  MIN_SLIPPAGE_BPS: 100,                // 1% floor
  MIN_VALUE_NATIVE: 0,                  // defensive min valueNative to attempt sell (> 0)
  MAX_RETRIES_PER_TOKEN: 2,             // don't hammer unsellable routes
  UNSWAPPABLE_COOLDOWN_MS: 15 * 60 * 1000, // 15m cooldown for transient unsellable routes
  MAX_DAILY_LOSS_LAMPORTS: 2_000_000_000, // 2 SOL daily loss limit
  DENYLIST: new Map(),                   // token mint -> retry_after_epoch_ms (session-scoped)
  dailyLoss: 0,                          // tracked across swaps
};

let KILL_SWITCH = false;   // set true to halt all execution immediately

function isTokenOnCooldown(tokenAddress) {
  const retryAfter = SAFETY.DENYLIST.get(tokenAddress);
  if (!retryAfter) return false;
  if (Date.now() >= retryAfter) {
    SAFETY.DENYLIST.delete(tokenAddress);
    return false;
  }
  return true;
}

function enforceSafety(action, tokenAddress, amount, slippage) {
  if (KILL_SWITCH) throw new Error('KILL_SWITCH is active — all execution halted');
  if (isTokenOnCooldown(tokenAddress)) {
    const retryAfter = SAFETY.DENYLIST.get(tokenAddress);
    log({ step: 'safety_blocked', token: tokenAddress, reason: 'cooldown_active', retry_after_ms: retryAfter });
    throw new Error(`${tokenAddress} is on cooldown until ${new Date(retryAfter).toISOString()}`);
  }
  if (slippage > SAFETY.MAX_SLIPPAGE_BPS) throw new Error(`slippage ${slippage} exceeds max ${SAFETY.MAX_SLIPPAGE_BPS}`);
  if (slippage < SAFETY.MIN_SLIPPAGE_BPS) throw new Error(`slippage ${slippage} below min ${SAFETY.MIN_SLIPPAGE_BPS}`);
  if (action === 'buy' && amount > SAFETY.MAX_BUY_LAMPORTS) throw new Error(`amount ${amount} exceeds max ${SAFETY.MAX_BUY_LAMPORTS}`);
  if (SAFETY.dailyLoss > SAFETY.MAX_DAILY_LOSS_LAMPORTS) {
    KILL_SWITCH = true;
    throw new Error('daily loss limit reached — KILL_SWITCH activated');
  }
}

function markUnswappable(tokenAddress, errorMessage) {
  const retryAfter = Date.now() + SAFETY.UNSWAPPABLE_COOLDOWN_MS;
  SAFETY.DENYLIST.set(tokenAddress, retryAfter);
  log({ step: 'safety_blocked', token: tokenAddress, reason: 'cooldown_set', retry_after_ms: retryAfter, source_error: errorMessage });
}

// ---------- Wallet (lazy init) ----------

let _wallet = null;
function getWallet() {
  if (!_wallet) {
    if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY env var not set');
    try {
      _wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY));
    } catch (e) {
      throw new Error(`Invalid PRIVATE_KEY: ${e.message}`);
    }
  }
  return _wallet;
}

// ---------- REST ----------

async function buildSwap({ tokenAddress, action, amount, holdingsPercentage, slippage = 1500 }) {
  // Safety check BEFORE network call
  enforceSafety(action, tokenAddress, amount, slippage);

  const body = {
    wallet_address: getWallet().publicKey.toBase58(),
    token_address: tokenAddress,
    action,
    slippage,
  };
  if (action === 'buy') body.amount = amount;
  if (action === 'sell') body.holdings_percentage = holdingsPercentage;
  assertSchema(validateSwapRequest, body, 'swap request');

  log({ step: 'swap_request', token: tokenAddress, action, amount: amount || holdingsPercentage, slippage });

  const res = await fetch(`${API}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const json = await res.json();

  if (json.status !== 'success') {
    // Session cooldown for unsellable routes (avoid retry loops, allow later retry).
    if (json.error?.includes('Error running simulation')) {
      markUnswappable(tokenAddress, json.error);
    }
    log({ step: 'swap_error', token: tokenAddress, error: json.error });
    throw new Error(json.error || 'swap failed');
  }

  log({ step: 'swap_response', token: tokenAddress, pool_type: json.data.pool_type, amount_in: json.data.amount_in });
  return json.data;
}

function signVersionedTx(swapTxBase58) {
  const txBytes = bs58.decode(swapTxBase58);
  const tx = VersionedTransaction.deserialize(txBytes);
  tx.sign([getWallet()]);
  const signedBytes = tx.serialize();
  return Buffer.from(signedBytes).toString('base64');
}

// ⚠️ THIS IS THE ONLY FUNCTION THAT SUBMITS TRANSACTIONS.
// /protect is ALWAYS tried first. RPC fallback is internal and fires on 503,
// or after timeout only if RPC status check shows the tx did not land.
// Do NOT call connection.sendRawTransaction() directly anywhere else.
async function submitTx(signedTxBase64, { token, action } = {}) {
  if (KILL_SWITCH) throw new Error('KILL_SWITCH is active — all execution halted');
  if (DRY_RUN) {
    log({ step: 'dry_run_skip', token, action, message: 'would submit but DRY_RUN=true' });
    return { signature: null, dry_run: true };
  }

  try {
    const protectBody = { signed_tx_base64: signedTxBase64 };
    assertSchema(validateProtectRequest, protectBody, 'protect request');

    const res = await fetch(`${API}/protect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(protectBody),
      signal: AbortSignal.timeout(30000),
    });

    if (res.status === 503) {
      log({ step: 'protect_503', message: 'falling back to RPC' });
      return await _rpcFallback(signedTxBase64);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `protect failed with HTTP ${res.status}`);
    }

    const json = await res.json();
    if (json.status !== 'success') throw new Error(json.error || 'protect failed');

    // Track loss for daily limit
    if (action === 'buy' && json.sol_balance_pre && json.sol_balance_post) {
      SAFETY.dailyLoss += (json.sol_balance_pre - json.sol_balance_post);
    }

    log({ step: 'protect_success', token, signature: json.signature });
    return json;

  } catch (err) {
    if (err.name === 'TimeoutError') {
      log({ step: 'protect_timeout', token, message: 'checking if tx landed' });
      const check = await checkTxLanded(signedTxBase64);

      if (check.status === 'failed') {
        log({ step: 'protect_timeout_failed', signature: check.sig, message: 'tx failed on-chain' });
        throw new Error(`transaction ${check.sig} failed on-chain`);
      }
      if (check.status === 'confirmed' || check.status === 'finalized') {
        log({ step: 'protect_timeout_landed', signature: check.sig, status: check.status });
        return { signature: check.sig, status: check.status, via: 'timeout_recovery' };
      }
      if (check.status === 'processed') {
        log({ step: 'protect_timeout_processed', signature: check.sig, message: 'waiting for confirmation' });
        await new Promise(r => setTimeout(r, 2000));
        const recheck = await checkTxLanded(signedTxBase64);
        if (recheck.status === 'failed') throw new Error(`transaction ${recheck.sig} failed on-chain`);
        if (recheck.landed) {
          log({ step: 'protect_timeout_landed', signature: recheck.sig, status: recheck.status });
          return { signature: recheck.sig, status: recheck.status, via: 'timeout_recovery' };
        }
      }
      if (check.landed) {
        log({ step: 'protect_timeout_landed', signature: check.sig, status: check.status || 'unknown' });
        return { signature: check.sig, status: check.status || 'unknown', via: 'timeout_recovery' };
      }
      log({ step: 'protect_timeout_not_landed', message: 'falling back to RPC' });
      return await _rpcFallback(signedTxBase64);
    }
    throw err;
  }
}

// INTERNAL ONLY — never call directly.
async function _rpcFallback(signedTxBase64) {
  const txBytes = Buffer.from(signedTxBase64, 'base64');
  const sig = await connection.sendRawTransaction(txBytes, { skipPreflight: false });
  await connection.confirmTransaction(sig, 'confirmed');
  log({ step: 'rpc_fallback_success', signature: sig });
  return { signature: sig, via: 'rpc_fallback' };
}

async function checkTxLanded(signedBase64) {
  // TradeRouter /swap and order_filled payloads are expected to be VersionedTransaction bytes.
  // If your upstream ever returns legacy tx bytes, switch this decode path accordingly.
  const txBytes = Buffer.from(signedBase64, 'base64');
  const tx = VersionedTransaction.deserialize(txBytes);
  const sig = bs58.encode(tx.signatures[0]);
  const status = await connection.getSignatureStatuses([sig]);
  const result = status.value[0];
  if (!result) return { landed: false, sig, status: 'not_found' };
  if (result.err) return { landed: true, sig, status: 'failed', err: result.err };
  return { landed: true, sig, status: result.confirmationStatus || 'unknown' };
}

async function getHoldings() {
  const res = await fetch(`${API}/holdings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: getWallet().publicKey.toBase58() }),
    signal: AbortSignal.timeout(100000),
  });
  const json = await res.json();
  return (json.data || []).filter(t => t.valueNative > SAFETY.MIN_VALUE_NATIVE);
}

// ---------- WebSocket ----------

function connectWsAndRegister(onOrderFilled) {
  const client = { ws: null, registered: false, pendingQueue: [] };

  function connect() {
    const ws = new WebSocket(WS_URL);
    client.ws = ws;
    client.registered = false;

    ws.on('open', () => log({ step: 'ws_connected' }));

    ws.on('message', async (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'subscribed') {
        ws.send(JSON.stringify({ action: 'register', wallet_address: getWallet().publicKey.toBase58() }));
      }
      if (msg.type === 'registered') {
        client.registered = true;
        log({ step: 'ws_registered' });
        while (client.pendingQueue.length > 0) {
          ws.send(JSON.stringify(client.pendingQueue.shift()));
        }
      }
      if (msg.type === 'order_filled') {
        await onOrderFilled(msg);
      }
      if (msg.type === 'order_created') {
        log({ step: 'order_placed', order_id: msg.order_id, token: msg.token_address, action: msg.order_type, target_mcap: msg.target_mcap });
      }
      if (msg.type === 'heartbeat') return;
      if (msg.type === 'error') log({ step: 'ws_error', error: msg.message });
    });

    ws.on('close', () => {
      log({ step: 'ws_disconnected', message: 'reconnecting in 3s' });
      client.registered = false;
      setTimeout(connect, 3000);
    });

    ws.on('error', (err) => log({ step: 'ws_error', error: err.message }));
  }

  connect();

  return {
    send: (payload) => {
      // Safety: kill switch halts everything
      if (KILL_SWITCH) {
        log({ step: 'safety_blocked', action: payload.action, reason: 'KILL_SWITCH active' });
        return;
      }
      // DRY_RUN: only read-only actions pass through
      const readOnlyActions = ['register', 'list_orders', 'check_order'];
      if (DRY_RUN && !readOnlyActions.includes(payload.action)) {
        log({ step: 'dry_run_skip', action: payload.action, token: payload.token_address, message: `would send ${payload.action} but DRY_RUN=true` });
        return;
      }
      // Safety: check denylist for order placement
      if (['sell', 'buy', 'trailing_sell', 'trailing_buy'].includes(payload.action)) {
        if (isTokenOnCooldown(payload.token_address)) {
          const retryAfter = SAFETY.DENYLIST.get(payload.token_address);
          log({ step: 'safety_blocked', token: payload.token_address, reason: 'cooldown_active', retry_after_ms: retryAfter });
          return;
        }
      }
      if (!client.registered) {
        client.pendingQueue.push(payload);
        log({ step: 'ws_queued', action: payload.action, message: 'not yet registered' });
        return;
      }
      client.ws.send(JSON.stringify(payload));
    },
    close: () => client.ws.close(),
  };
}

async function handleOrderFilled(msg) {
  try {
    assertSchema(validateOrderFilled, msg, 'order_filled message');
  } catch (e) {
    log({ step: 'order_fill_error', order_id: msg.order_id || 'unknown', error: e.message });
    return;
  }

  const { order_id, order_type, triggered_mcap, filled_mcap, token_address } = msg;
  const swap_tx = msg.data?.swap_tx;

  log({ step: 'order_filled', order_id, order_type, token: token_address, triggered_mcap, filled_mcap });

  if (!swap_tx) {
    log({ step: 'order_fill_error', order_id, error: 'missing swap_tx' });
    return;
  }

  // Staleness check
  if (filled_mcap && triggered_mcap && triggered_mcap / filled_mcap < 0.85) {
    log({ step: 'order_fill_skipped', order_id, reason: 'stale', triggered_mcap, filled_mcap });
    return;
  }

  const signedBase64 = signVersionedTx(swap_tx);
  const result = await submitTx(signedBase64, { token: token_address, action: order_type });
  log({ step: 'order_fill_submitted', order_id, signature: result.signature });
}

// ---------- Preflight ----------

async function preflight() {
  const checks = [];

  checks.push({ name: 'PRIVATE_KEY loaded', pass: !!process.env.PRIVATE_KEY });
  if (!process.env.RPC_URL) {
    console.log('⚠ RPC_URL not set — using default public RPC (rate-limited, not recommended for production)');
  }
  checks.push({ name: 'RPC_URL configured', pass: true, url: process.env.RPC_URL ? '(custom)' : '(default public)' });

  try {
    const pubkey = getWallet().publicKey.toBase58();
    checks.push({ name: 'Wallet loads', pass: true, pubkey });
  } catch (e) {
    checks.push({ name: 'Wallet loads', pass: false, error: e.message });
  }

  try {
    const slot = await connection.getSlot();
    checks.push({ name: 'RPC reachable', pass: true, slot });
  } catch (e) {
    checks.push({ name: 'RPC reachable', pass: false, error: e.message });
  }

  try {
    const balance = await connection.getBalance(getWallet().publicKey);
    checks.push({ name: 'SOL balance > 0.01', pass: balance > 10_000_000, balance });
  } catch (e) {
    checks.push({ name: 'SOL balance', pass: false, error: e.message });
  }

  try {
    const holdings = await getHoldings();
    checks.push({ name: '/holdings responds', pass: true, token_count: holdings.length });
  } catch (e) {
    checks.push({ name: '/holdings responds', pass: false, error: e.message });
  }

  try {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_URL);
      const timeout = setTimeout(() => { ws.close(); reject(new Error('ws timeout')); }, 10000);
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw);
        if (msg.type === 'subscribed') {
          ws.send(JSON.stringify({ action: 'register', wallet_address: getWallet().publicKey.toBase58() }));
        }
        if (msg.type === 'registered') {
          clearTimeout(timeout);
          ws.close();
          resolve();
        }
      });
      ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
    });
    checks.push({ name: 'WS register', pass: true });
  } catch (e) {
    checks.push({ name: 'WS register', pass: false, error: e.message });
  }

  console.log('\n=== PREFLIGHT ===');
  checks.forEach(c => console.log(`${c.pass ? '✓' : '✗'} ${c.name}`, c.pass ? '' : `— ${c.error || ''}`));
  const allPass = checks.every(c => c.pass);
  console.log(`\n${allPass ? '🟢 ALL CHECKS PASSED — ready to go live' : '🔴 CHECKS FAILED — fix before going live'}\n`);
  console.log(`Mode: ${DRY_RUN ? '📋 DRY RUN (set DRY_RUN=false to go live)' : '🔴 LIVE TRADING'}\n`);
  return allPass;
}

// ---------- Usage (call from main, never at module load) ----------

async function main() {
  const ready = await preflight();
  if (!ready) process.exit(1);

  const demoTokenMint = process.env.DEMO_TOKEN_MINT;
  if (!demoTokenMint) {
    log({ step: 'demo_skipped', message: 'set DEMO_TOKEN_MINT to run write-path examples in main()' });
    return;
  }
  const demoBuyAmountLamports = Number(process.env.DEMO_BUY_AMOUNT_LAMPORTS || 100_000_000);
  if (!Number.isFinite(demoBuyAmountLamports) || demoBuyAmountLamports <= 0) {
    throw new Error('DEMO_BUY_AMOUNT_LAMPORTS must be a positive integer');
  }

  // Instant buy
  const swap = await buildSwap({ tokenAddress: demoTokenMint, action: 'buy', amount: demoBuyAmountLamports });
  const signed = signVersionedTx(swap.swap_tx);
  const result = await submitTx(signed, { token: demoTokenMint, action: 'buy' });

  // Instant sell (only if wallet has sellable tokens)
  const holdings = await getHoldings();
  if (holdings.length === 0) {
    log({ step: 'sell_skipped', message: 'no sellable tokens in wallet' });
  } else {
    const token = holdings[0];
    const swap2 = await buildSwap({ tokenAddress: token.address, action: 'sell', holdingsPercentage: 10000 });
    const signed2 = signVersionedTx(swap2.swap_tx);
    const result2 = await submitTx(signed2, { token: token.address, action: 'sell' });
  }

  // Limit order via WS
  const ws = connectWsAndRegister(handleOrderFilled);
  // Silent expiry guard: poll open orders periodically (expiry has no server event).
  setInterval(() => ws.send({ action: 'list_orders' }), 60000);
  // after registered:
  ws.send({ action: 'sell', token_address: demoTokenMint, holdings_percentage: 10000, target: 20000, slippage: 1500, expiry_hours: 144 });
}

main().catch(console.error);
```
---

## Signing / Encoding Test Vectors

Use these to verify your signing pipeline produces valid output.

### Test: base58 decode → sign → base64 encode

```
Input swap_tx (base58):
  (any valid base58 string from /swap response)

Expected pipeline:
  bs58.decode(swap_tx)           → Uint8Array (raw bytes)
  VersionedTransaction.deserialize(bytes)  → tx object (check: tx.message exists)
  tx.sign([wallet])              → void (modifies tx in place, fills signature slots)
  tx.serialize()                 → Uint8Array (same length — signature slots are pre-allocated)
  Buffer.from(bytes).toString('base64') → string (starts with alphanumeric, contains +/=)

Self-check assertions:
  1. Decoded bytes length > 0
  2. tx.message exists (versioned tx from TradeRouter)
  3. After sign: tx.signatures[0] is not all zeros (signature was written)
  4. Signed bytes length === decoded bytes length (slots pre-allocated, signing fills them)
  5. Base64 output does NOT start with a bracket or brace (not JSON)
  6. Base64 output is NOT the same as the base58 input (different encoding)
```

### Quick validation function

```javascript
function validateSignedTx(swapTxBase58, signedBase64) {
  const unsignedBytes = bs58.decode(swapTxBase58);
  const signedBytes = Buffer.from(signedBase64, 'base64');
  console.assert(unsignedBytes.length > 0, 'decoded bytes empty');
  console.assert(signedBytes.length === unsignedBytes.length, 'signed and unsigned should be same length (signature slots pre-allocated)');
  console.assert(signedBase64 !== swapTxBase58, 'output must differ from input (different encoding)');
  console.assert(!/^[{[]/.test(signedBase64), 'base64 should not look like JSON');
  // Deserialize signed to verify it's valid
  const tx = VersionedTransaction.deserialize(signedBytes);
  console.assert(tx.signatures[0].some(b => b !== 0), 'signature should not be zeros');
  console.log('✓ signing pipeline valid');
}
```

---

## Request / Response Schemas

Machine-readable schemas for pre-validation. The reference client compiles and enforces these required fields with `ajv` before network calls.

### POST /swap — request

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["wallet_address", "token_address", "action"],
  "properties": {
    "wallet_address": { "type": "string", "minLength": 32, "maxLength": 44 },
    "token_address": { "type": "string", "minLength": 32, "maxLength": 44 },
    "action": { "type": "string", "enum": ["buy", "sell"] },
    "amount": { "type": "integer", "minimum": 1 },
    "holdings_percentage": { "type": "integer", "minimum": 1, "maximum": 10000 },
    "slippage": { "type": "integer", "minimum": 100, "maximum": 2500, "default": 500 }
  },
  "if": { "properties": { "action": { "const": "buy" } } },
  "then": { "required": ["amount"], "not": { "required": ["holdings_percentage"] } },
  "else": { "required": ["holdings_percentage"], "not": { "required": ["amount"] } }
}
```

### POST /swap — success response

```json
{
  "type": "object",
  "required": ["status", "data"],
  "properties": {
    "status": { "const": "success" },
    "data": {
      "type": "object",
      "required": ["swap_tx"],
      "properties": {
        "swap_tx": { "type": "string", "minLength": 100 },
        "pool_type": { "type": "string" },
        "pool_address": { "type": "string" },
        "amount_in": { "type": "integer" },
        "min_amount_out": { "type": "integer" },
        "price_impact": { "type": "number" },
        "slippage": { "type": "integer" },
        "decimals": { "type": "integer" }
      }
    }
  }
}
```

### POST /protect — request

```json
{
  "type": "object",
  "required": ["signed_tx_base64"],
  "properties": {
    "signed_tx_base64": { "type": "string", "minLength": 100, "pattern": "^[A-Za-z0-9+/]+=*$" }
  }
}
```

### POST /holdings — response (non-empty)

```json
{
  "type": "object",
  "properties": {
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["address", "amount", "decimals"],
        "properties": {
          "address": { "type": "string" },
          "valueNative": { "type": ["integer", "null"] },
          "amount": { "type": "integer" },
          "decimals": { "type": "integer" }
        }
      }
    }
  }
}
```

### WebSocket order_filled

```json
{
  "type": "object",
  "required": ["type", "order_id", "order_type", "status", "data"],
  "properties": {
    "type": { "const": "order_filled" },
    "order_id": { "type": "string", "format": "uuid" },
    "order_type": { "type": "string", "enum": ["sell", "buy", "trailing_sell", "trailing_buy"] },
    "status": { "type": "string", "enum": ["success"] },
    "entry_mcap": { "type": "number" },
    "triggered_mcap": { "type": "number" },
    "filled_mcap": { "type": ["number", "null"] },
    "target_mcap": { "type": "number" },
    "triggered_at": { "type": "number" },
    "filled_at": { "type": "number" },
    "token_address": { "type": "string" },
    "data": {
      "type": "object",
      "required": ["swap_tx", "token_address", "pool_type"],
      "properties": {
        "swap_tx": { "type": "string", "minLength": 100 },
        "token_address": { "type": "string" },
        "pool_type": { "type": "string" },
        "pool_address": { "type": "string" },
        "amount_in": { "type": "integer" },
        "min_amount_out": { "type": "integer" },
        "price_impact": { "type": "number" },
        "slippage": { "type": "integer" },
        "decimals": { "type": "integer" }
      }
    }
  }
}
```

---

## Retry / Idempotency Policy

| Error class | Retry? | Max attempts | Backoff | Notes |
|-------------|--------|-------------|---------|-------|
| 400 from /swap | **No** | 0 | — | Bad request. Fix payload. |
| 422 from /swap | **No** | 0 | — | Missing fields. Fix payload. |
| "Error running simulation" | **Cooldown** | 0 immediate | 15m | Mark token unswappable for the session and retry later only if needed. |
| 503 from /protect | **Auto-fallback** | 1 | — | `submitTx()` falls back to RPC internally. No manual action. |
| /protect timeout (30s) | **Check first** | 1 | — | Check tx status via `connection.getSignatureStatuses([sig])`. Only retry if `value[0]` is null (not found). |
| /holdings timeout | **Yes** | 2 | 5s | Endpoint is slow, not broken. |
| /swap 5xx | **Yes** | 2 | 3s | Server issue, may resolve. |
| WS disconnect | **Reconnect** | ∞ | 3s fixed | Re-register. Orders persist. |
| WS error message | **No** | 0 | — | Log and surface to user. |
| On-chain swap failure | **Maybe** | 1 | — | Increase slippage to 2500, retry once. If fails again, skip. |

**Idempotency:** Solana transactions include a recent blockhash. A signed tx can only land once. If /protect times out, the tx may have landed — always check via RPC before re-signing a new tx.

---

## Timeout and Confirmation Contracts

| Endpoint | Timeout | On timeout |
|----------|---------|------------|
| `POST /swap` | 15s | Retry once with 3s backoff |
| `POST /protect` | 30s | Call `connection.getSignatureStatuses([sig])`. If `value[0]` is null → tx didn't land, safe to retry. If `value[0].err` → tx failed on-chain, do not retry. If `confirmationStatus` is `'processed'` → transitional, wait 2s and re-check. If `'confirmed'` or `'finalized'` → landed, do not retry. `submitTx()` handles all this internally. |
| `POST /holdings` | 100s | Retry once with 5s backoff |
| WebSocket connect | 10s | Retry with 3s backoff |

### Post-timeout /protect check

`checkTxLanded()` is defined in the Reference Client above. Returns `{ landed, sig, status }`:
- `{ landed: false, sig, status: 'not_found' }` — safe to retry via RPC fallback
- `{ landed: true, sig, status: 'failed', err }` — tx errored on-chain, do not retry
- `{ landed: true, sig, status: 'processed' }` — transitional, wait 2s and re-check
- `{ landed: true, sig, status: 'confirmed' }` — tx landed, do not retry
- `{ landed: true, sig, status: 'finalized' }` — tx landed and finalized, do not retry

`sig` is the real base58 transaction signature for reconciliation. `submitTx()` handles all of this internally.

---

## WebSocket Lifecycle State Machine

```
 ┌──────────────┐
 │ DISCONNECTED │ ←── ws.close / error / timeout
 └──────┬───────┘
        │ connect
        ▼
 ┌──────────────┐
 │  SUBSCRIBED  │ ←── server sends {"type":"subscribed"}
 └──────┬───────┘
        │ send register
        ▼
 ┌──────────────┐
 │  REGISTERED  │ ←── server sends {"type":"registered"}
 └──────┬───────┘
        │ (can now send orders)
        ▼
 ┌──────────────┐
 │    ACTIVE    │ ←── orders placed, listening for fills
 └──────────────┘
```

**Rules:**
- **DISCONNECTED:** no sends allowed. Reconnect immediately.
- **SUBSCRIBED:** only `register` action allowed. All other sends rejected.
- **REGISTERED / ACTIVE:** all actions allowed.
- On any disconnect, state resets to DISCONNECTED. Orders persist server-side.
- Queue any order sends that arrive during DISCONNECTED/SUBSCRIBED and flush after REGISTERED.

---


## Execution Safety Guards

All safety enforcement is **built into the reference client** — `enforceSafety()` is called inside `buildSwap()`, `KILL_SWITCH` is checked in `submitTx()` and `ws.send()`, `markUnswappable()` is called on "Error running simulation" responses, and token cooldown is checked before WS order placement.

**Defaults (adjust per deployment):**

`MAX_BUY_LAMPORTS = 0.5 SOL` is intentionally conservative for first deploys. Increase only after risk limits, kill switch, and monitoring are verified.

| Guard | Default | Enforced in |
|-------|---------|-------------|
| MAX_BUY_LAMPORTS | 500,000,000 (0.5 SOL, conservative starter value) | `buildSwap()` via `enforceSafety()` |
| MAX_SLIPPAGE_BPS | 2500 (25%) | `buildSwap()` via `enforceSafety()` |
| MIN_SLIPPAGE_BPS | 100 (1%) | `buildSwap()` via `enforceSafety()` |
| MIN_VALUE_NATIVE | 0 (`valueNative > 0`, defensive) | `getHoldings()` filter |
| UNSWAPPABLE_COOLDOWN_MS | 900,000 (15 minutes) | `markUnswappable()` |
| MAX_DAILY_LOSS_LAMPORTS | 2,000,000,000 (2 SOL) | `enforceSafety()` → activates KILL_SWITCH |
| DENYLIST | empty Map (session-scoped cooldown) | `buildSwap()`, `ws.send()`, auto-populated by `markUnswappable()` |
| KILL_SWITCH | false | `submitTx()`, `ws.send()`, auto-activated on daily loss limit |

**Unswappable token cooldown:** When `/swap` returns "Error running simulation", `buildSwap()` calls `markUnswappable(tokenAddress)`, placing that token on a 15-minute session cooldown. This avoids retry loops while allowing future retries later.

**Emergency kill:** Set `KILL_SWITCH = true` to halt all execution. Also auto-activates when `dailyLoss > MAX_DAILY_LOSS_LAMPORTS`.

---

## Logging Format

All logging is through the `log()` function in the reference client, which outputs JSON lines with automatic timestamp and wallet fields.

**Every step emitted by the reference client:**

| Step | Emitted by | Required fields |
|------|-----------|----------------|
| swap_request | `buildSwap()` | token, action, amount/holdings_percentage, slippage |
| swap_response | `buildSwap()` | token, pool_type, amount_in |
| swap_error | `buildSwap()` | token, error |
| safety_blocked | `enforceSafety()`, `markUnswappable()`, `ws.send()` | token, reason |
| dry_run_skip | `submitTx()`, `ws.send()` | token, action, message |
| protect_success | `submitTx()` | token, signature |
| protect_503 | `submitTx()` | message |
| protect_timeout | `submitTx()` | token, message |
| protect_timeout_landed | `submitTx()` | signature, status |
| protect_timeout_processed | `submitTx()` | signature, message |
| protect_timeout_failed | `submitTx()` | signature, message |
| protect_timeout_not_landed | `submitTx()` | message |
| rpc_fallback_success | `_rpcFallback()` | signature |
| sell_skipped | `main()` | message |
| ws_connected | WS `open` handler | — |
| ws_registered | WS `registered` handler | — |
| ws_disconnected | WS `close` handler | message |
| ws_error | WS `error` handler | error |
| ws_queued | `ws.send()` | action, message |
| order_placed | WS `order_created` handler | order_id, token, action, target_mcap |
| order_filled | `handleOrderFilled()` | order_id, order_type, token, triggered_mcap, filled_mcap |
| order_fill_error | `handleOrderFilled()` | order_id, error |
| order_fill_skipped | `handleOrderFilled()` | order_id, reason, triggered_mcap, filled_mcap |
| order_fill_submitted | `handleOrderFilled()` | order_id, signature |

This table matches every `log()` call in the reference client 1:1. No steps are defined that aren't emitted and no steps are emitted that aren't defined.

---

## Dry-Run / Paper Mode

**Safe-by-default:** `DRY_RUN` is **true** unless you explicitly set `DRY_RUN=false`. A fresh agent runs paper mode automatically — no accidental live trades on first run.

Dry-run is enforced at the two chokepoints in the reference client — `submitTx()` and `ws.send()`. The agent runs the full pipeline (fetches swap quotes, enforces safety guards, logs everything) but:

- **`submitTx()`** short-circuits before submission and returns `{ signature: null, dry_run: true }`
- **`ws.send()`** blocks all mutating actions (`sell`, `buy`, `trailing_sell`, `trailing_buy`, `cancel_order`, `extend_order`) and logs intent
- Only read-only operations pass through: `register`, `list_orders`, `check_order`

There is no separate "paper mode function." The same `main()` code path runs in both modes — `DRY_RUN` just gates the irreversible actions.

```bash
# Paper mode (default — no DRY_RUN env needed)
PRIVATE_KEY=... node agent.js

# Live mode — must explicitly opt in
DRY_RUN=false PRIVATE_KEY=... node agent.js
```

---

## Preflight Startup Checklist

The `preflight()` function is built into the reference client. It runs automatically at the start of `main()` and exits the process if any check fails.

**Checks performed:**

| Check | Fails if |
|-------|----------|
| PRIVATE_KEY loaded | env var missing |
| RPC_URL configured | always passes (warns if using default public RPC) |
| Wallet loads | key is invalid/undecodable |
| RPC reachable | `getSlot()` fails |
| SOL balance > 0.01 | balance < 10,000,000 lamports |
| /holdings responds | endpoint unreachable or times out |
| WS register | WebSocket connect or register fails within 10s |

After all checks, preflight reports mode (`DRY RUN` or `LIVE TRADING`).
