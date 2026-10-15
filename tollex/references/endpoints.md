# Tollex endpoints used by this skill

All paid routes: `POST https://api.tollex.org/tools/{id}` with a JSON body, except `GET /v1/agent-check`. An unpaid request returns `402` with x402 v2 terms in the `PAYMENT-REQUIRED` header: one `exact` option in USDC on Base (`eip155:8453`) and one in USDG on Robinhood Chain (`eip155:4663`), same amount (atomic units, 6 decimals). Prices follow Robinhood Chain gas and are about 0.008 USD today. The live `402` is authoritative.

Response body: `{ "tool": { "id", "version", "provider" }, "result": { ... }, "evidence": [ ... ], "untrustedOutput": false }`.

## stock_token_halt_status

Input: `{ "symbol": "TSLA" }` (pattern `^[A-Z][A-Z0-9.]{0,9}$`)

`result`: `{ "symbol": "TSLA", "isTradingHalt": false, "generatedAt": "2026-10-11T08:00:00.000Z" }`

## stock_token_quote

Input: `{ "symbol": "AAPL" }`

`result`: `{ "symbol": "AAPL", "price": "227.43", "currentMultiplier": "1", "generatedAt": "…", "source": "api.robinhood.com/rhj/prices" }`

`price` is the multiplier-adjusted mid in USD. The receipt binds an input hash of the exact price input.

## stock_tokens_list

Input: `{ "limit": 50 }` (optional)

`result`: `{ "count": 1, "tokens": [ { "symbol": "AAPL", … } ] }`

## chain_simulate

Input: `{ "to": "0x…", "data": "0x…", "from": "0x…" (optional), "value": "0" (optional, wei) }`

`result`: `{ "ok": true, "returnData": "0x…" }` or `{ "ok": false, "revertSelector": "0x…", "error": "…" }`

`eth_call` against current Robinhood Chain state at a pinned block. Never broadcasts.

## x402_inspect_endpoint

Input: `{ "url": "https://…" }`

`result`: `{ "payable": true, "httpStatus": 402, "latencyMs": 180, "accepts": [ { "scheme", "network", "amount", "asset", "payTo", "maxTimeoutSeconds" } ], "extensions": ["bazaar"], "acceptsHash": "0x…" }`

Fetches the URL unpaid and decodes its v2 challenge.

## GET /v1/agent-check

No input. `result` holds `paidWith` (network, asset, amount), `rails[]` (each rail's live state), `chains{}` (latest block per network) and `verify{}` (operation and receipt-key URLs).

## Free routes

- `GET /v1/catalog`: every capability with input schema and price
- `POST /v1/resolve` `{"need": "..."}`: which capability fits, and why; never spends
- `GET /tollex/operations/{operationId}`: payment and settlement state; use this instead of paying again after a timeout
- `GET /.well-known/tollex-receipt-keys`: receipt signing keys
