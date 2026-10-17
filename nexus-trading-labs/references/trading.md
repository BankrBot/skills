# Trading Reference

## Registration Flow (runs once per wallet)

Trigger when `/trade` returns `{ error: "wallet_not_registered" }`.

(Full URL: `POST https://og.nexustradinglabs.com/trade`) `{ error: "wallet_not_registered" }`.

**Step R1 — Ask for Bankr API key**
> "Your wallet `<walletAddress>` isn't linked to a Nexus account yet. I need your Bankr API key for one-time setup — find it at bankr.bot/api-keys (enable 'Wallet & Agent API'). It's used only for registration and never stored."

**Step R2 — Register**
```
POST https://og.nexustradinglabs.com/proxy/bankr-register
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<user's key>",
  "depositAmount": 5
}
```
Server: checks Orderly account → EIP-712 registers if needed → derives ed25519 key → stores in KV.

If R2 returns EIP-712 blocked error:
> "Your Bankr API key has 'allowed recipients' restrictions blocking EIP-712 signing. Generate a new key at bankr.bot/api-keys without that restriction."

**Step R3 — Retry the original trade immediately.** No user action needed.

---

## Place a Trade

Always get walletSig first (see SKILL.md CRITICAL). Then:

```
POST https://og.nexustradinglabs.com/trade
{
  "symbol":        "PERP_BTC_USDC",   // shorthand "BTC" also works
  "side":          "BUY",             // "SELL" for short
  "notional":      50,                // USD notional
  "leverage":      5,
  "walletSig":     "<sig>",
  "walletAddress": "<wallet>"
}
```

Natural language mapping:
- "Long BTC $50 at 5x" → `{ symbol: "PERP_BTC_USDC", side: "BUY", notional: 50, leverage: 5 }`
- "Short HYPE $20 20x" → `{ symbol: "PERP_HYPE_USDC", side: "SELL", notional: 20, leverage: 20 }`
- "Short SOL $15 5x, SL 100, TP 80" → trade first, then `https://og.nexustradinglabs.com/set-sl-tp` separately

Supported symbols: `PERP_BTC_USDC`, `PERP_ETH_USDC`, `PERP_SOL_USDC`, `PERP_HYPE_USDC`, `PERP_ARB_USDC`, `PERP_XMR_USDC`, and more. Shorthand "BTC", "ETH", "SOL" etc. auto-normalized by the Worker.

Server flow: derive ed25519 key from walletSig → look up accountId from KV → fetch mark price → set leverage → fire market order → return fill.

---

## Attach SL/TP (ALWAYS after trade fills — never in the /trade body)

```
POST https://og.nexustradinglabs.com/set-sl-tp
{
  "symbol":        "PERP_SOL_USDC",
  "stopLoss":      100,    // optional
  "takeProfit":    80,     // optional (for short — TP is below entry)
  "walletSig":     "<sig>",
  "walletAddress": "<wallet>"
}
```

Server fetches current position size, places a `POSITIONAL_TP_SL` algo order. Returns `{ ok: true, quantity, stopLoss, takeProfit }`.

Full flow: sign_message → POST https://og.nexustradinglabs.com/trade → wait for fill → POST https://og.nexustradinglabs.com/set-sl-tp (same walletSig).

---

## Close a Position

**Preferred path — dedicated endpoint (auto-fetches qty, no margin required):**

```
POST https://og.nexustradinglabs.com/close-position
{
  "symbol":        "PERP_BTC_USDC",   // or shorthand "BTC"
  "walletSig":     "<sig>",
  "walletAddress": "<wallet>"
}
```

Server looks up your open position size and direction, fires a `reduce_only: true` market order for the full qty on the opposite side. Returns `{ ok, symbol, closeSide, quantity, markPrice, entryPrice, unrealizedPnl }`.

**Alternative — use `closePosition: true` flag on `/trade`:**

```
POST https://og.nexustradinglabs.com/trade
{
  "symbol":        "PERP_BTC_USDC",
  "side":          "SELL",          // opposite of your open LONG
  "notional":      50,              // approximate — server uses position qty
  "leverage":      5,
  "closePosition": true,            // skips margin check, sets reduce_only: true
  "walletSig":     "<sig>",
  "walletAddress": "<wallet>"
}
```

⚠️ Do NOT send a plain SELL without `closePosition: true` — Orderly will treat it as a new short and require full margin.

---

## Check Positions

```
POST https://og.nexustradinglabs.com/positions
{ "walletAddress": "<wallet>", "walletSig": "<sig>" }
```

**Always check positions before opening a new trade** — overlapping positions consume all margin. If `position_qty > 0`, account for it.

---

## Cancel an Order

Use when a limit order hasn't filled. Requires `order_id` from the `/trade` response (`raw.data.order_id`).

```
POST https://og.nexustradinglabs.com/cancel
{
  "walletAddress": "<wallet>",
  "walletSig":     "<sig>",
  "orderId":       123456789,
  "symbol":        "PERP_BTC_USDC"   // optional but recommended
}
```

Returns `{ ok: true, orderId }`.

---

## Check Order Fill Status

Poll before attaching SL/TP on limit orders (market orders fill instantly).

```
POST https://og.nexustradinglabs.com/order-status
{
  "walletAddress": "<wallet>",
  "walletSig":     "<sig>",
  "orderId":       123456789
}
```

Returns `{ orderId, symbol, status, filled, executedQty, avgPrice }`.

Status values: `NEW` (pending), `PARTIAL_FILLED`, `FILLED`, `CANCELLED`, `REJECTED`.

---

## Order History

```
POST https://og.nexustradinglabs.com/order-history
{
  "walletAddress": "<wallet>",
  "walletSig":     "<sig>",
  "symbol":        "BTC",   // optional
  "limit":         20       // max 100, default 20
}
```

Returns `{ ok: true, count, orders: [{ orderId, symbol, side, type, status, price, quantity, executedQty, avgPrice, fee, feeCurrency, createdAt, updatedAt }], fetchedAt }`.

If Orderly refuses the read (bad key, rate limit), the answer is HTTP 502:
`{ ok: false, error: "orderly_error", upstreamStatus, code, message }`. That means the orders were **not read**. It never
means the account has no orders. Don't tell the user they have no orders after a 502.

---

## Refresh the Nexus Trade Tracker

The Nexus Trade Tracker is a Bankr app page. It can't sign, so it never sees a signature or a key. It reads
positions itself, live, from the public `GET https://og.nexustradinglabs.com/smart/xray?address=<wallet>` (the
`nexus_trading` venue). Orders and liquidation prices come from a snapshot you write for it, only when the user asks.

**Only when the user asks** ("refresh my tracker", "update my trade tracker"). Never on a schedule, never in a background
script: a refresh signs, and a scheduled script would have to hold the signature.

### First time only: the opt-in

Before the first snapshot, read the user this, word for word, and wait for a yes. Write nothing without one.

> This saves a copy of your open and recent Nexus orders, and your liquidation prices, into the tracker. Nexus, the
> tracker's owner, and Bankr's logs can see that copy. It can't trade or withdraw. It updates only when you ask. Say yes
> to turn it on.

### Each refresh

1. Sign `nexus-trading-key-v1` (personal_sign), the same signature as a trade.
2. Call both, with the signature in the JSON body only:
   - `POST https://og.nexustradinglabs.com/order-history` `{ walletAddress, walletSig, limit: 50 }`
   - `POST https://og.nexustradinglabs.com/positions` `{ walletAddress, walletSig }`
3. **Write only if both succeeded:** `/order-history` answered HTTP 200 with `ok: true`, and `/positions` answered HTTP
   200 with `success: true`. If either failed, write nothing, keep the last snapshot, and tell the user which read
   failed.
4. Build the snapshot below **field by field** and write only that object to the user's own record in Bankr's app
   storage (`appkv`, record-scoped to the viewer, not the app's shared file bucket), key `nexus-tracker-snapshot`.

```json
{
  "v": 1,
  "wallet": "0x…",
  "asOf": 1792000000000,
  "orders": [
    { "symbol": "PERP_BTC_USDC", "side": "BUY", "type": "LIMIT", "status": "NEW",
      "price": 60000, "quantity": 0.01, "executedQty": 0, "avgPrice": null, "createdAt": 1791990000000 }
  ],
  "positions": [
    { "symbol": "PERP_BTC_USDC", "qty": 0.01, "entry": 61000, "estLiqPrice": 48000 }
  ]
}
```

- `asOf` = `fetchedAt` from `/order-history`.
- `orders[]` = each `/order-history` order with exactly these 9 fields: `symbol, side, type, status, price, quantity,
  executedQty, avgPrice, createdAt`.
- `positions[]` = each row in `/positions` `data.rows` with `position_qty` not 0: `symbol`, `qty` = `position_qty`,
  `entry` = `average_open_price`, `estLiqPrice` = `est_liq_price`.

**Never write `walletSig`, the request, the tool call, or a whole response to `appkv`.** It is not private: the
tracker's owner and Bankr's logs can read it. The request carries the signature, so build the object from the named
fields and nothing else.

### Turn it off

"Turn off my tracker": write an empty value to `nexus-tracker-snapshot` and stop refreshing. The last copy goes away,
not just future refreshes.

---

## Set Account Leverage

Applies to all new positions. Default is 10x.

```
POST https://og.nexustradinglabs.com/set-leverage
{
  "walletAddress": "<wallet>",
  "walletSig":     "<sig>",
  "leverage":      10        // 1–100
}
```

Returns `{ ok: true, leverage: 10 }`.
