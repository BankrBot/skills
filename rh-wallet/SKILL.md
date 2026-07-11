---
name: rh-wallet
description: >
  Manage a Robinhood Crypto wallet through the RH Wallet Gateway or paid x402
  API — check balances/holdings, query bid/ask prices, place market buy/sell
  orders, list and cancel orders. Use when the user mentions Robinhood, RH
  wallet, RH crypto, buy/sell on Robinhood, Robinhood holdings, Robinhood
  balance, BTC-USD on Robinhood, "get prices from Robinhood", or similar.
  Route natural-language requests to x402 endpoints (rh-prices, rh-account,
  rh-buy, rh-order) via bankr x402 call when Bankr CLI is available; fall back
  to the free hosted gateway. Requires RH_API_KEY and RH_PRIVATE_KEY_BASE64 in
  Bankr Agent tool environment. x402 calls also require USDC on Base.
tags: [robinhood, crypto, trading, wallet, bankr, usd]
visibility: public
metadata:
  clawdbot:
    emoji: "🟩"
    homepage: "https://github.com/anondevv69/RH-Wallet"
    requires:
      bins: [curl, jq]
      optional_bins: [bankr]
---

# Robinhood Crypto Wallet (via RH Wallet Gateway)

Trade and inspect a **Robinhood Crypto** account through a **stateless RH Wallet Gateway**. Robinhood keys live in **Bankr Agent tool environment** — the gateway signs requests but does **not** store your keys.

> **US only.** Robinhood Crypto Trading API is available to US customers and is subject to the Robinhood Crypto Customer Agreement.

For setup see [references/setup.md](references/setup.md).  
Hosted URL + public gateway secret: [references/hosted-config.md](references/hosted-config.md).  
For safety see [references/trading-safety.md](references/trading-safety.md).  
For endpoints see [references/api-reference.md](references/api-reference.md).  
For paid x402 API + natural-language routing see [references/x402.md](references/x402.md).

## Prerequisites — Bankr Agent tool environment

Set these in **Bankr → gear → Agent tool environment** (not x402):

| Variable | Required? | What |
|----------|-----------|------|
| `RH_API_KEY` | **Yes** | Robinhood API key (`rh-api-...`) from crypto settings |
| `RH_PRIVATE_KEY_BASE64` | **Yes** | Ed25519 private key from `scripts/generate_rh_keypair.py` |
| `RH_GATEWAY_SECRET` | No | Defaults to public value in [hosted-config.md](references/hosted-config.md) |
| `RH_WALLET_API_URL` | No | Defaults to `https://rh-wallet-production.up.railway.app` |
| `RH_MAX_ORDER_USD` | No | Your personal cap (≤ host `MAX_ORDER_USD`) |
| `RH_REQUIRE_CONFIRMATION` | No | `true` to always require confirm |

If `RH_API_KEY` or `RH_PRIVATE_KEY_BASE64` is missing, walk the user through [references/setup.md](references/setup.md). **Never** ask them to paste private keys into chat.

## Agent rules

1. **Disambiguate wallets.** Bankr has its own onchain wallet. Only use this skill for Robinhood Crypto. Say “Robinhood Crypto (US)” in replies.
2. **Estimate before buy.** Call `/v1/estimate` before placing orders.
3. **Confirm size.** Send `"confirm": true` only after the user clearly agrees.
4. **Prefer USD for buys** (`quote_amount`). Prefer `asset_quantity` for sells.
5. **Never echo private credentials.** Do not print `RH_PRIVATE_KEY_BASE64` or `RH_API_KEY`. The hosted gateway secret is public (see hosted-config.md).
6. **Never share account identifiers publicly.** Do **not** include Robinhood `account_number`, full order payloads, or raw API JSON in replies — especially on **X/Twitter**, group chats, or any public channel. Say only: status, buying power, holdings (asset + quantity), prices, and order side/symbol/size. If the user asks for their account number, refuse for public contexts; in private DMs you may summarize without posting the full numeric ID if possible.
7. **Respect max size.** Gateway rejects orders above `MAX_ORDER_USD` (default $50).
8. **Symbols** are uppercase pairs like `BTC-USD`.
9. **Natural language → x402.** When the user asks for Robinhood prices, balance, holdings, buy, or sell, use the intent table in [references/x402.md](references/x402.md) and call the matching endpoint with `bankr x402 call --yes`. Inject `RH_API_KEY` and `RH_PRIVATE_KEY_BASE64` from env into the JSON body — never paste keys into chat. Prefer **rh-buy** ($0.50) for buy/sell (prices + account + order in one call). If x402 is unavailable or the user wants no fee, use the free `rh()` gateway below instead.
10. **Confirm trades on x402.** For `rh-buy` / `rh-order`, set `"confirm": true` only after the user clearly agrees to the size and symbol.

## Natural language examples (agent routing)

| User says | Do this |
|-----------|---------|
| "What's my Robinhood balance?" | x402 `rh-account` with `view: "account"` |
| "What crypto do I hold on Robinhood?" | x402 `rh-account` with `view: "holdings"` |
| "Get BTC and DOGE prices from Robinhood" | x402 `rh-prices` with `symbol: "BTC-USD,DOGE-USD"` |
| "Buy $1 of DOGE on Robinhood" | x402 `rh-buy` — confirm first, then `confirm: true` |
| "Sell my DOGE on Robinhood" | x402 `rh-buy` with `side: "sell"` — confirm quantity first |

Full command templates: [references/x402.md](references/x402.md).

## Base curl helper (free gateway)

```bash
# Hosted gateway (default) — see references/hosted-config.md
RH_WALLET_API_URL="${RH_WALLET_API_URL:-https://rh-wallet-production.up.railway.app}"
RH_GATEWAY_SECRET="${RH_GATEWAY_SECRET:-uniqueissomethingimtesting}"

rh() {
  local method="$1"; shift
  local path="$1"; shift
  local auth_header=()
  local user_headers=()
  if [ -n "${RH_GATEWAY_SECRET:-}" ]; then
    auth_header=(-H "Authorization: Bearer ${RH_GATEWAY_SECRET}")
  fi
  if [ -n "${RH_MAX_ORDER_USD:-}" ]; then
    user_headers+=(-H "X-Max-Order-USD: ${RH_MAX_ORDER_USD}")
  fi
  if [ -n "${RH_REQUIRE_CONFIRMATION:-}" ]; then
    user_headers+=(-H "X-Require-Confirmation: ${RH_REQUIRE_CONFIRMATION}")
  fi
  curl -sS -X "$method" \
    "${RH_WALLET_API_URL}${path}" \
    "${auth_header[@]}" \
    "${user_headers[@]}" \
    -H "X-RH-API-Key: ${RH_API_KEY}" \
    -H "X-RH-Private-Key-Base64: ${RH_PRIVATE_KEY_BASE64}" \
    -H "Content-Type: application/json" \
    "$@"
}
```

Always pipe JSON through `jq` when available.

## Workflows

### Health / connectivity

```bash
curl -sS "${RH_WALLET_API_URL:-https://rh-wallet-production.up.railway.app}/health" | jq
```

### Account + buying power

```bash
rh GET /v1/account | jq
```

Reply with **status** and **buying_power** only — never `account_number` (gateway strips it; do not recover from `raw`).

### Holdings

```bash
rh GET /v1/holdings | jq
rh GET "/v1/holdings?asset_code=BTC" | jq
```

### Prices

```bash
rh GET "/v1/prices?symbol=BTC-USD" | jq
```

### Estimated price

```bash
rh GET "/v1/estimate?symbol=BTC-USD&side=ask&quantity=0.0001" | jq
```

### Market buy

```bash
rh POST /v1/orders --data '{
  "side": "buy",
  "symbol": "BTC-USD",
  "quote_amount": "10.00",
  "confirm": true
}' | jq
```

### Market sell

```bash
rh POST /v1/orders --data '{
  "side": "sell",
  "symbol": "BTC-USD",
  "asset_quantity": "0.0001",
  "confirm": true
}' | jq
```

### Orders

```bash
rh GET /v1/orders | jq
rh POST /v1/orders/<order-id>/cancel | jq
```

## Errors

- `401` — missing/invalid RH headers or `RH_GATEWAY_SECRET`
- `400` `confirmation_required` — get user confirm, retry with `confirm: true`
- `400` `order_too_large` — over `MAX_ORDER_USD`
- `410` on `/connect` — key storage disabled (expected); use Bankr env instead

Never invent balances or fill prices.
