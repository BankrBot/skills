---
name: groundtruth
description: |
  Before a memecoin buy: who launched it and how their other coins ended. Paste a coin address
  (Solana pump.fun mint or Robinhood Chain 0x token) or a dev wallet. Returns the coin's outcome
  and the dev's counts: launched, rugged, faded, bonded. Use when the user asks "is this a rug",
  "who made this", "has this dev rugged before", "check this CA", or wants receipts on a coin they
  lost on. Up to 10 coins in one basket call. $0.01 USDC a coin over x402 (Base or Solana); the first 5
  calls a day per IP are free.
tags: [solana, robinhood, memecoin, pump-fun, dev-wallet, rug, x402]
version: 6
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
| `GET /v1/record?ca=<coin>` | `outcome`, `paired_with`, `creator`, the dev's `launches` and `failure_pct`, `card_url` |
| `GET /v1/basket?ca=<coin>,<coin>,...` | 1 to 10 coins, Solana and Robinhood mixed: `rows[]`, one per coin, each the `/v1/record` answer plus `dev_named`; `n`, `price_usd` |
| `GET /v1/flag?addr=<dev wallet>` | `launched`, `rugged`, `died`, `active`, `survived`, `resolved`, `rug_rate`, `failure_rate`, `bonded_live`, `known_bad`, `last_mint_live` (unix seconds), `asof`, `card_url` |

- The chain comes from the address shape.
- `/v1/*`: 5 free calls a day per IP (shared with `/mcp` and `/api/scan`), then 402.
- `/x402/v1/record`, `/x402/v1/flag` and `/x402/v1/basket`: same answer, same price, always 402 until paid. Use these when the wallet pays anyway.
- `/v1/basket` is $0.01 a coin: its 402 states the amount for the coins you asked (3 coins, `amount: "30000"`).
- On Bankr x402 Cloud, the same three calls:
  `https://x402.bankr.bot/0xa70ff84a692002dcf49cbb9c61550fd01f766f44/coin-record`,
  `https://x402.bankr.bot/0xa70ff84a692002dcf49cbb9c61550fd01f766f44/creator-record` and
  `https://x402.bankr.bot/0xa70ff84a692002dcf49cbb9c61550fd01f766f44/coin-basket` (`upto` $0.10: settles $0.01 a coin asked).

## Paying from the Bankr wallet

1. `GET` the call. `200` is the answer.
2. `402` carries a base64 `PAYMENT-REQUIRED` header; `accepts[]` has a Base USDC entry.
3. Sign that entry and retry the same `GET` with `PAYMENT-SIGNATURE`. A paid answer carries `x-x402-paid: 1`.

```bash
curl -s "https://api.groundtruths.xyz/v1/record?ca=GCyzQVvCqHvE2pgAmKamDaZwL4rnT6QyuUG96fYYpump"
curl -s "https://api.groundtruths.xyz/v1/flag?addr=<dev wallet>"
```

## How to say it

- Call again for every question. Never answer from an earlier call in the thread: the counts move every few seconds.
- Lead with the dev, one launch count: `launched`, with `rugged` over it: `dev launched 312, 228 rugged`. Never `launched_live`: it is a different count.
- Last mint: turn `last_mint_live` (unix seconds) into a UTC time and say that: `last mint 00:18 UTC`. Never an age like `11m ago`, and never the `v2_lines` text: an age is stale the moment you repeat it.
- Say `faded`, never `died`. The `died` count and `faded_resolved` are the same coins.
- Say `bonded N` from `bonded_live`: coins whose bonding curve completed on chain. Never print `graduated`: that is an outcome label count, and it includes curves the chain says never completed.
- One fraction per dev: `rugged`/`resolved` from `/v1/flag`, the same count the card and the extension print, counted to `asof`.
- `outcome` is what this coin did: `rugged`, `faded` (the body says `died`), `graduated`, `survived`, `active`, or `unobserved` (seen launching, not watched to the end).
- `failure_pct` = rugged + faded over resolved launches.
- `paired_with` (Robinhood Chain): the Robinhood stock tokens the coin's pools trade against, most liquid first. Say `paired NVDA`, or `paired NVDA +1` when there are more. `null` = none.
- A basket row with `dev_named: false` says why in `note`. Say it plainly for that coin; the other rows stand.
- `404` with `status: "not yet published"`: we have nothing on this coin. Say "no history on this one" and stop.
- Links go last. First `card_url` (coin or wallet): the card says it better than you will. Then, if you want, the GMGN entry in `dev_links` (it carries GT's ref). No other site, ever.
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
