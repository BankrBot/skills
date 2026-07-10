# RH Wallet Gateway API reference

Base URL: `known-gateway.json` → `gatewayUrl`

See [API-HOST.md](API-HOST.md) for auth headers and allowlist.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (no RH auth) |
| GET | `/v1/account` | Buying power, status (no account_number in response) |
| GET | `/v1/holdings` | Crypto holdings |
| GET | `/v1/prices?symbol=BTC-USD` | Bid/ask |
| GET | `/v1/estimate?symbol=…&side=…&quantity=…` | Pre-trade estimate |
| GET | `/v1/orders` | Order list |
| POST | `/v1/orders` | Market order (`confirm: true` when required) |
| POST | `/v1/orders/{id}/cancel` | Cancel |

## Place order body

```json
{
  "side": "buy",
  "symbol": "BTC-USD",
  "quote_amount": "10.00",
  "confirm": true
}
```

Exactly one of `quote_amount` (buys) or `asset_quantity` (sells).

## Errors

| Code | Meaning |
|------|---------|
| 401 | Bad gateway secret or RH credentials |
| 400 `confirmation_required` | Retry with `confirm: true` after user OK |
| 400 `order_too_large` | Over effective max USD |
| 410 `/connect` | Key storage disabled (expected) |

Full gateway docs: https://github.com/anondevv69/RH-Wallet
