# Trading Reference

## Key Registration (once per wallet, then every 30 days)

Trigger when any trading call returns `409 key_required` (no key yet) or `409 key_expired` (30 days up).

**Step R1 — Ask for the Bankr API key**
> "Your wallet `<walletAddress>` needs a Nexus trading key. I need your Bankr API key once to register it — find it at bankr.bot/api-keys (enable 'Wallet & Agent API'). It's used for this call only and never stored."

**Step R2 — Register**
```
POST https://og.nexustradinglabs.com/v2/key/bankr-register
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<user's key>"
}
```
Server: makes sure the Orderly account exists (Bankr signs the registration the first time) → makes a
RANDOM ed25519 key → Bankr signs Orderly's AddOrderlyKey as the wallet (scope `read,trading`, 30 days)
→ stores the key sealed. Returns `{ ok, active, orderlyKey, accountId, scope, expiresAt, expiresInDays }`.
Running it again while a key is live rotates it (the old key is removed at Orderly).

The key can place and cancel orders. It can't withdraw: every withdrawal needs the wallet's own signature.

If R2 returns an EIP-712 blocked error:
> "Your Bankr API key has 'allowed recipients' restrictions blocking EIP-712 signing. Generate a new key at bankr.bot/api-keys without that restriction."

**Step R3 — Retry the original call immediately.** No user action needed. To fund the account, see
references/deposit-withdraw.md (registration no longer deposits).

---

## Place a Trade

Always start a session first (see SKILL.md CRITICAL). Then:

```
POST https://og.nexustradinglabs.com/trade
{
  "symbol":        "PERP_BTC_USDC",   // shorthand "BTC" also works
  "side":          "BUY",             // "SELL" for short
  "notional":      50,                // USD notional
  "leverage":      5,
  "walletAddress": "<wallet>",
  "session":       { "session": "…", "issued": 0, "expires": 0, "sig": "0x…" }
}
```

Natural language mapping:
- "Long BTC $50 at 5x" → `{ symbol: "PERP_BTC_USDC", side: "BUY", notional: 50, leverage: 5 }`
- "Short HYPE $20 20x" → `{ symbol: "PERP_HYPE_USDC", side: "SELL", notional: 20, leverage: 20 }`
- "Short SOL $15 5x, SL 100, TP 80" → trade first, then `https://og.nexustradinglabs.com/set-sl-tp` separately

Supported symbols: `PERP_BTC_USDC`, `PERP_ETH_USDC`, `PERP_SOL_USDC`, `PERP_HYPE_USDC`, `PERP_ARB_USDC`, `PERP_XMR_USDC`, and more. Shorthand "BTC", "ETH", "SOL" etc. auto-normalized by the Worker.

Server flow: check the session → load the wallet's registered key → fetch mark price → set leverage → fire market order → return fill.

---

## Attach SL/TP (ALWAYS after trade fills — never in the /trade body)

```
POST https://og.nexustradinglabs.com/set-sl-tp
{
  "symbol":        "PERP_SOL_USDC",
  "stopLoss":      100,    // optional
  "takeProfit":    80,     // optional (for short — TP is below entry)
  "walletAddress": "<wallet>",
  "session":       { … }
}
```

Server fetches current position size, places a `POSITIONAL_TP_SL` algo order. Returns `{ ok: true, quantity, stopLoss, takeProfit }`.

Full flow: session → POST https://og.nexustradinglabs.com/trade → wait for fill → POST https://og.nexustradinglabs.com/set-sl-tp (same session).

---

## Close a Position

**Preferred path — dedicated endpoint (auto-fetches qty, no margin required):**

```
POST https://og.nexustradinglabs.com/close-position
{
  "symbol":        "PERP_BTC_USDC",   // or shorthand "BTC"
  "walletAddress": "<wallet>",
  "session":       { … }
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
  "walletAddress": "<wallet>",
  "session":       { … }
}
```

⚠️ Do NOT send a plain SELL without `closePosition: true` — Orderly will treat it as a new short and require full margin.

---

## Check Positions

```
POST https://og.nexustradinglabs.com/positions
{ "walletAddress": "<wallet>", "session": { … } }
```

**Always check positions before opening a new trade** — overlapping positions consume all margin. If `position_qty > 0`, account for it.

---

## Cancel an Order

Use when a limit order hasn't filled. Requires `order_id` from the `/trade` response (`raw.data.order_id`).

```
POST https://og.nexustradinglabs.com/cancel
{
  "walletAddress": "<wallet>",
  "session":       { … },
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
  "session":       { … },
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
  "session":       { … },
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

The Nexus Trade Tracker is a Bankr app (`nexus-trade-tracker`). It shows **public data only**: positions read live
from the public `GET https://og.nexustradinglabs.com/smart/xray?address=<wallet>` (the `nexus_trading` venue), market
data and the graded caller board. It stores nothing per user, and it never sees a signature or a key.

Open orders and liquidation prices are private. They stay in chat and in the user's **own** Bankr drive, never in the
tracker app's storage.

**Only when the user asks** ("refresh my tracker", "show my orders"). Never on a schedule, never in a background
script: a refresh needs the trading session, and a scheduled script would have to hold it.

### First time only: the opt-in

Before the first save, read the user this, word for word, and wait for a yes. Save nothing without one.

> This saves a copy of your open and recent Nexus orders, and your liquidation prices, to your own Bankr drive at
> /nexus/tracker-snapshot.json. Your agent and Bankr can see it. The Nexus tracker page and other users can't. It can't
> trade or withdraw. It updates only when you ask. Say yes to turn it on.

### Each refresh

1. Use the trading session you already hold (SKILL.md CRITICAL: `GET /v2/session/new`, sign its `message`, good
   24 hours). Start one only if you have none or it expired. Never sign `nexus-trading-key-v1` for this.
2. Call both, with the session in the JSON body only:
   - `POST https://og.nexustradinglabs.com/order-history` `{ walletAddress, session, limit: 50 }`
   - `POST https://og.nexustradinglabs.com/positions` `{ walletAddress, session }`
3. **Save only if both succeeded:** `/order-history` answered HTTP 200 with `ok: true`, and `/positions` answered HTTP
   200 with `success: true`. If either failed, save nothing, keep the last snapshot, and tell the user which read
   failed.
4. Build the snapshot below **field by field**. Write only that object to the user's own drive: write the file
   `/nexus/tracker-snapshot.json`, replacing the previous one. Then show the user the orders and liquidation prices in
   chat.

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

**Never write the `session` (or its `sig`), the request, the tool call, or a whole response anywhere.** Build the object from the named
fields and nothing else.

**Never write to the tracker app's storage**: not `/apps/nexus-trade-tracker/…`, not its appKV, not a `record:` key.
App storage is shared by everyone who opens the app, so one user's orders would be readable by another. A chat agent
can't write another user's app storage anyway (Bankr answers 400).

### Show my orders

"Show my orders" / "what's on my tracker": read `/nexus/tracker-snapshot.json` from the user's own drive and show it,
with its `asOf` time. If it's missing, offer a refresh. Don't call `/order-history` without being asked to refresh.

### Turn it off

"Turn off my tracker": **delete** `/nexus/tracker-snapshot.json` from the user's drive and stop refreshing. Delete,
not an empty write: an empty file would still be there. The public tracker page is unaffected.

### Check (two wallets)

Before relying on this, run it once with two wallets, A and B:
1. Refresh as A, then refresh as B. Each snapshot lands in its own wallet's drive.
2. Refresh A again. B's file is unchanged.
3. Turn off as A. A's file is gone; B's is still there.
4. Open the tracker page as A and as B. Both show the same public data, and neither shows the other's orders.

---

## Set Account Leverage

Applies to all new positions. Default is 10x.

```
POST https://og.nexustradinglabs.com/set-leverage
{
  "walletAddress": "<wallet>",
  "session":       { … },
  "leverage":      10        // 1–100
}
```

Returns `{ ok: true, leverage: 10 }`.
