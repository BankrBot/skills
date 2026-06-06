# Definitive Flash API Reference

**Base URL:** `https://ddp.definitive.fi/v2/flash`

**Auth header:** `x-definitive-api-key: <DEFINITIVE_API_KEY>`

All requests and responses are JSON. All token quantities are decimal strings (not wei).

---

## Place an Order

Three sequential calls: quote → (optional approval) → submit.

### 1. POST /quote

Get a quote and receive the typed data to sign.

**Request body:**
```json
{
  "targetChain":    "base",
  "contraChain":    "base",
  "targetAsset":    "0xTOKEN_ADDRESS",
  "contraAsset":    "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "side":           "sell",
  "qty":            "1000000.000000",
  "orderType":      "stop-loss",
  "triggers": [
    {
      "notionalPrice": "0.000250000000000000",
      "triggerType":   "lower"
    }
  ],
  "funderAddress":  "0xYOUR_WALLET",
  "recipient":      "0xYOUR_WALLET"
}
```

`triggerType`: `"lower"` for stop-loss (fires when price falls to trigger), `"upper"` for take-profit (fires when price rises to trigger).

**Price format:** Plain decimal string with up to 18 decimal places. Scientific notation (e.g. `"1.8e-06"`) is rejected — use `f"{price:.18f}".rstrip("0").rstrip(".")`.

**Response fields:**
```json
{
  "quoteId": "uuid",
  "evm": {
    "orderTypedData":  "<JSON string>",
    "permitTypedData": "<JSON string or null>",
    "approveTx":       { "to": "0x...", "data": "0x..." }
  }
}
```

- `orderTypedData`: always present — sign this with the Kernel wrapper
- `permitTypedData`: present when a permit2 signature is needed (sign with same Kernel wrapper)
- `approveTx`: present when an on-chain ERC-20 approval is needed before submitting

### 2. (If approveTx) Submit the approval transaction

If `approveTx` is present, submit it via bankr before calling `/order`:
```bash
bankr wallet submit tx --to <approveTx.to> --chain-id 8453 --data <approveTx.data> \
  -d "Approve Definitive for <SYMBOL>"
```
Wait ~5 seconds for the approval to confirm on-chain before submitting the order.

### 3. POST /order

Submit the signed order.

**Request body:**
```json
{
  "targetChain":       "base",
  "contraChain":       "base",
  "targetAsset":       "0xTOKEN_ADDRESS",
  "contraAsset":       "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  "side":              "sell",
  "qty":               "1000000.000000",
  "orderType":         "stop-loss",
  "triggers": [
    {
      "notionalPrice": "0.000250000000000000",
      "triggerType":   "lower"
    }
  ],
  "funderAddress":     "0xYOUR_WALLET",
  "recipient":         "0xYOUR_WALLET",
  "quoteId":           "<quoteId from step 1>",
  "userSignature":     "0x00<130-char-sig>",
  "evmOrderTypedData": "<same JSON string from quote response>",

  "evmPermitTypedData": "<same JSON string from quote, if present>",
  "evmPermitSignature": "0x00<130-char-sig>"
}
```

**Response:**
```json
{ "orderId": "uuid" }
```

---

## List Orders

### GET /orders

```
GET /orders?funderAddress=0xYOUR_WALLET&pageSize=50
```

**Response:**
```json
{
  "orders": [
    {
      "orderId":    "uuid",
      "orderType":  "stop-loss",
      "status":     "ORDER_STATUS_ACCEPTED",
      "targetAsset": { "address": "0x...", "ticker": "TOKEN" },
      "qty":        "1000000.000000",
      "trigger":    { "notionalPrice": "0.000250000000000000", "triggerType": "lower" },
      "placedAt":   "2026-06-06T12:00:00Z"
    }
  ],
  "nextPageToken": "..."
}
```

Active statuses: `ORDER_STATUS_PENDING`, `ORDER_STATUS_ACCEPTED`, `ORDER_STATUS_PARTIALLY_FILLED`

Paginate by passing `pageToken=<nextPageToken>` until `nextPageToken` is absent.

---

## Cancel an Order

### POST /orders/{orderId}/cancel

```json
{
  "cancelMessage": "Definitive Flash v1 — Cancel Order\nOrder: {orderId}",
  "userSignature": "0x00<130-char-sig>"
}
```

The cancel message is a fixed string — compute `personal_sign` hash of that exact string, wrap in Kernel typed data, sign with bankr, prepend `0x00`. See `references/kernel-signing.md`.

**Returns:** 200 on success. `404 NOT_FOUND` if the order doesn't exist **or** if signature verification fails (Definitive returns 404 for auth failures as a security measure).

---

## Error Codes

| HTTP | code | Meaning |
|------|------|---------|
| 403 | – | Signature verification failed (wrong format for smart wallet) |
| 422 | `FAILED_PRECONDITION` | Insufficient token balance — reduce qty slightly (floor to 6 dp) |
| 422 | `RESOURCE_EXHAUSTED` | 100-order cap hit. Cancels active orders to free slots, then retry. |
| 422 | Other | Order rejected — inspect `error.message` |
| 404 | `NOT_FOUND` | Order not found or auth failed (cancel endpoint) |

---

## Useful Constants (Base)

| Item | Value |
|------|-------|
| USDC (contraAsset) | `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913` |
| Chain ID | `8453` |
| Chain name | `"base"` |
