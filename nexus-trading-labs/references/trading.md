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

Returns `{ count, orders: [{ orderId, symbol, side, type, status, price, quantity, executedQty, avgPrice, fee, createdAt }] }`.

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
