# Trading Reference

## Registration Flow (once per wallet, then every 30 days)

Trigger when any authenticated call returns `409 key_required` or `409 key_expired` (older builds answered
`wallet_not_registered`), or when a response's `keyExpiresInDays` is ≤ 3 and the user wants to keep trading.
Check any time with `GET https://og.nexustradinglabs.com/v2/key/<wallet>` (public: `active`, `expiresInDays`,
`scope`; never the key).

**Step R1 — Ask for Bankr API key**
> "Your wallet `<walletAddress>` needs a Nexus trading key (it can trade, it can never withdraw, and it expires in 30 days). I need your Bankr API key to sign its registration — find it at bankr.bot/api-keys (enable 'Wallet & Agent API'). It's used only for this call and never stored."

**Step R2 — Register (or renew)**
```
POST https://og.nexustradinglabs.com/v2/key/bankr-register
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<user's key>"
}
```
Server: makes sure the Orderly account exists (Bankr signs its registration if needed) → generates a random
trading key → Bankr signs Orderly's `AddOrderlyKey` (scope `read,trading`, expires in 30 days) → stores it
encrypted. Nothing is derived from a signature. Renewing replaces the old key and removes it at Orderly. To fund
the account afterwards, use the deposit flow (references/deposit-withdraw.md).

If R2 returns EIP-712 blocked error:
> "Your Bankr API key has 'allowed recipients' restrictions blocking EIP-712 signing. Generate a new key at bankr.bot/api-keys without that restriction."

**Step R3 — Retry the original trade immediately.** No user action needed.

---

## Place a Trade

Always have a trading session first (see SKILL.md CRITICAL). Then:

```
POST https://og.nexustradinglabs.com/trade
{
  "symbol":        "PERP_BTC_USDC",   // shorthand "BTC" also works
  "side":          "BUY",             // "SELL" for short
  "notional":      50,                // USD notional
  "leverage":      5,
  "session":       { … },
  "walletAddress": "<wallet>"
}
```

Natural language mapping:
- "Long BTC $50 at 5x" → `{ symbol: "PERP_BTC_USDC", side: "BUY", notional: 50, leverage: 5 }`
- "Short HYPE $20 20x" → `{ symbol: "PERP_HYPE_USDC", side: "SELL", notional: 20, leverage: 20 }`
- "Short SOL $15 5x, SL 100, TP 80" → trade first, then `https://og.nexustradinglabs.com/set-sl-tp` separately

Supported symbols: `PERP_BTC_USDC`, `PERP_ETH_USDC`, `PERP_SOL_USDC`, `PERP_HYPE_USDC`, `PERP_ARB_USDC`, `PERP_XMR_USDC`, and more. Shorthand "BTC", "ETH", "SOL" etc. auto-normalized by the Worker.

Server flow: check the session → load the wallet's registered trading key (no key → `409 key_required`) → look up accountId → fetch mark price → set leverage → fire market order → return fill.

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

Full flow: session (SKILL.md) → POST https://og.nexustradinglabs.com/trade → wait for fill → POST https://og.nexustradinglabs.com/set-sl-tp (same session).

---

## Close a Position

**Preferred path — dedicated endpoint (auto-fetches qty, no margin required):**

```
POST https://og.nexustradinglabs.com/close-position
{
  "symbol":        "PERP_BTC_USDC",   // or shorthand "BTC"
  "session":       { … },
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
  "session":       { … },
  "walletAddress": "<wallet>"
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
