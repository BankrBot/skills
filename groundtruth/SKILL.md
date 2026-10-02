---
name: groundtruth
description: |
  Before a memecoin buy: who launched it and how their other coins ended. Paste a coin address
  (Solana pump.fun mint or Robinhood Chain 0x token) or a dev wallet. Returns the coin's outcome
  and the dev's counts: launched, rugged, died, graduated. Use when the user asks "is this a rug",
  "who made this", "has this dev rugged before", "check this CA", or wants receipts on a coin they
  lost on. $0.01 USDC a call over x402 (Base or Solana); the first 5 calls a day per IP are free.
tags: [solana, robinhood, memecoin, pump-fun, dev-wallet, rug, x402]
version: 2
visibility: public
metadata:
  clawdbot:
    homepage: "https://groundtruths.xyz/integrations"
---

# GROUNDTRUTH

This dev's other coins. Counted. That's it.

**Base URL:** `https://api.groundtruths.xyz`
**Pay:** x402 v2, `exact`, USDC, **$0.01 a call** (`amount: "10000"`), Base (`eip155:8453`) or Solana. No account, no key.
**Discovery:** `GET https://api.groundtruths.xyz/.well-known/x402`

## Calls

| Call | Comes back with |
|---|---|
| `GET /v1/record?ca=<coin>` | `outcome`, `creator`, the dev's `launches` and `failure_pct`, `card_url` |
| `GET /v1/flag?addr=<dev wallet>` | `launched`, `rugged`, `died`, `active`, `survived`, `graduated`, `resolved`, `rug_rate`, `failure_rate`, `known_bad`, and the live mint fields `last_mint_live`, `launched_live`, `bonded_live`, `mints_since_asof` |

- The chain comes from the address shape.
- `/v1/*`: 5 free calls a day per IP (shared with `/mcp` and `/api/scan`), then 402.
- `/x402/v1/record` and `/x402/v1/flag`: same answer, same price, always 402 until paid. Use these when the wallet pays anyway.
- On Bankr x402 Cloud, the same two calls:
  `https://x402.bankr.bot/0xa70ff84a692002dcf49cbb9c61550fd01f766f44/coin-record` and
  `https://x402.bankr.bot/0xa70ff84a692002dcf49cbb9c61550fd01f766f44/creator-record`.

## Paying from the Bankr wallet

1. `GET` the call. `200` is the answer.
2. `402` carries a base64 `PAYMENT-REQUIRED` header; `accepts[]` has a Base USDC entry.
3. Sign that entry and retry the same `GET` with `PAYMENT-SIGNATURE`. A paid answer carries `x-x402-paid: 1`.

```bash
curl -s "https://api.groundtruths.xyz/v1/record?ca=GCyzQVvCqHvE2pgAmKamDaZwL4rnT6QyuUG96fYYpump"
curl -s "https://api.groundtruths.xyz/v1/flag?addr=<dev wallet>"
```

## How to say it

- Lead with the dev, as a fraction with its N: `dev launched 14, 12 rugged`.
- `outcome` is what this coin did: `rugged`, `died`, `graduated`, `survived`, `active`, or `unobserved` (seen launching, not watched to the end).
- `failure_pct` = rugged + died over resolved launches.
- `404` with `status: "not yet published"`: we have nothing on this coin. Say "no history on this one" and stop.
- Link `card_url`. The card says it better than you will.
- `band` and `median_ttr_s` come back `null`. They are withdrawn; never mention them.

## Hard rules

- Never call a coin or a dev safe, legit or clean. No score, no ✅, no "buy" or "don't buy". Counts only.
- No linkage talk: never say two wallets are the same person or a ring.
- Read-only. Never start a trade from an answer.

## Links

- Card for any coin: `https://groundtruths.xyz/?ca=<coin>`
- Daily boards: https://groundtruths.xyz/boards
- MCP server: `https://api.groundtruths.xyz/mcp`
- How it's counted: https://groundtruths.xyz/boring
