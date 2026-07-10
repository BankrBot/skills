# Trading safety

## Key custody

Robinhood keys live in **Bankr Agent tool environment**. Gateway signs in memory — does not store keys.

Never paste RH private keys into Bankr chat or X — only env settings.

## Confirmation policy

1. Restate: side, symbol, size, estimated impact.
2. Wait for clear approval (“yes”, “confirm”).
3. Only then POST with `"confirm": true`.

Do not set `confirm: true` on ambiguous prompts (“maybe buy some BTC”).

## Size limits

- Host ceiling: **$50/order** (`MAX_ORDER_USD` on gateway).
- Personal cap: `RH_MAX_ORDER_USD` in Bankr env (≤ host ceiling).
- Prefer `quote_amount` USD for buys.

## Privacy (public / X)

See [RESPONSE-SAFETY.md](RESPONSE-SAFETY.md). Never post account numbers or credentials.

## Wallet routing

See [WALLET-ROUTING.md](WALLET-ROUTING.md) before any buy/sell.

## What not to do

- No limit / stop orders (market only).
- No stocks via this skill (use Agentic MCP).
- No contract-address buys (`0x…`).
- No retry loops on failed orders.
- Do not invent balances or fill prices.

## Compliance

Robinhood Crypto Trading API: **United States only**.
