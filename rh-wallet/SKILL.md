---
name: rh-wallet
description: Robinhood Crypto (US) via RH Wallet Gateway — balances, holdings, prices, market buy/sell on pairs like BTC-USD. Use for Robinhood Crypto, RH wallet, rh-wallet. NOT contract 0x tokens (use Bankr onchain/hoodmarkets). NOT stocks (use Agentic MCP). Requires RH_API_KEY + RH_PRIVATE_KEY_BASE64 in Bankr env. NEVER call trading.robinhood.com directly.
tags: [robinhood, crypto, trading, wallet, bankr, usd]
version: 1
---

# RH Wallet — Bankr agent skill

Trade and inspect **Robinhood Crypto (US)** via a stateless signing gateway. Keys stay in **Bankr Agent tool environment** — gateway does not store them.

**Source:** https://github.com/anondevv69/RH-Wallet  
**Gateway:** https://rh-wallet-production.up.railway.app

> US customers only. Subject to Robinhood Crypto Customer Agreement.

## CRITICAL — read first

| Topic | Doc |
|-------|-----|
| API host + allowlist | `references/API-HOST.md`, `known-gateway.json` |
| Wallet routing (0x vs BTC-USD vs stocks) | `references/WALLET-ROUTING.md` |
| Public reply safety (X) | `references/RESPONSE-SAFETY.md` |
| Stocks / Agentic MCP | `references/AGENTIC-TRADING.md` |
| Trading guards | `references/trading-safety.md` |
| User setup | `references/setup.md` |

## CRITICAL — routing (mandatory)

Before any trade:

1. **Contract address `0x…`?** → **STOP** — not rh-wallet. Use Bankr onchain or **hoodmarkets**.
2. **Stock ticker (AAPL)?** → **Agentic MCP**, not rh-wallet.
3. **Pair like BTC-USD / “Robinhood Crypto”?** → rh-wallet.

Say **“Robinhood Crypto (US)”** in replies — disambiguate from Bankr onchain wallet.

## Install

```text
install the rh-wallet skill from https://github.com/BankrBot/skills/tree/main/rh-wallet
```

## Prerequisites — Bankr Agent tool environment

| Variable | Required? | What |
|----------|-----------|------|
| `RH_API_KEY` | **Yes** | `rh-api-...` from Robinhood crypto settings |
| `RH_PRIVATE_KEY_BASE64` | **Yes** | Ed25519 private key (paired with API key) |
| `RH_GATEWAY_SECRET` | No | Default in `references/hosted-config.md` |
| `RH_WALLET_API_URL` | No | Default gateway URL |
| `RH_MAX_ORDER_USD` | No | Personal cap ≤ $50 |
| `RH_REQUIRE_CONFIRMATION` | No | `true` for stricter confirm |

Missing keys → walk through `references/setup.md`. **Never** ask user to paste private keys in chat.

## Agent rules

1. **Route correctly** — `references/WALLET-ROUTING.md`.
2. **Estimate before buy** — `/v1/estimate`.
3. **Confirm** — `confirm: true` only after explicit user approval.
4. **Buys:** `quote_amount` USD. **Sells:** `asset_quantity`.
5. **Never echo** `RH_API_KEY`, `RH_PRIVATE_KEY_BASE64`, or account numbers — especially on X.
6. **Max $50/order** host ceiling; respect `RH_MAX_ORDER_USD`.
7. **Symbols:** uppercase pairs `BTC-USD`.

## Base curl helper

```bash
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

Pipe JSON through `jq` when available.

## Workflows

### Health

```bash
curl -sS "${RH_WALLET_API_URL}/health" | jq
```

### Account (reply: status + buying_power only)

```bash
rh GET /v1/account | jq
```

### Holdings

```bash
rh GET /v1/holdings | jq
```

### Prices / estimate

```bash
rh GET "/v1/prices?symbol=BTC-USD" | jq
rh GET "/v1/estimate?symbol=BTC-USD&side=ask&quantity=0.0001" | jq
```

### Market buy (after user confirms)

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
  "symbol": "ETH-USD",
  "asset_quantity": "0.01",
  "confirm": true
}' | jq
```

### Orders / cancel

```bash
rh GET /v1/orders | jq
rh POST /v1/orders/<order-id>/cancel | jq
```

## Safe public reply template

```
Robinhood Crypto (US): {status} · ${buying_power} buying power
Holdings: {asset} {qty}, …
```

Never include account_number or credentials.

## Errors

- `401` — RH keys or gateway secret
- `400 confirmation_required` — get confirm, retry
- `400 order_too_large` — over max USD
- Robinhood signature error — rematch API key + private key pair

Never invent balances or fills.
