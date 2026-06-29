# Wallet Audit — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/wallet-audit
Content-Type: application/json
Authorization: Bearer zt_live_...
```

### Body

```json
{
  "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "chain": "base"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `address` | string | Yes | Must match `/^0x[0-9a-fA-F]{40}$/` |
| `chain` | string | No | Default: `"base"`. Only `"base"` is supported. |

## Response — 200 OK

```json
{
  "skill": "wallet-audit",
  "address": "0xd8da6bf26964af9d7eed9e03e53415d37aa96045",
  "chain": "base",
  "address_type": "eoa",
  "books_compatible": true,
  "books_compatible_note": "This address type is eligible for books attribution when declared in the agent manifest",
  "stable_balance_usd": 4250.00,
  "notes": [
    "eoa wallets are books-compatible — declare this address in your agent manifest (evidenceSource: manifest) to enable financial attribution"
  ],
  "classified_at": "2026-06-23T00:00:00.000Z"
}
```

### `books_compatible: false` example

```json
{
  "skill": "wallet-audit",
  "address": "0xb2b335f832fd3f43461ebd1cd9831d93d9ca4ba3",
  "chain": "base",
  "address_type": "token_contract",
  "books_compatible": false,
  "books_compatible_note": "This address type is excluded from books regardless of manifest declaration",
  "stable_balance_usd": null,
  "notes": [
    "token_contract wallets are excluded from books regardless of manifest declaration",
    "Token contracts are excluded to prevent inflating revenue figures with token issuance events"
  ],
  "classified_at": "2026-06-23T00:00:00.000Z"
}
```

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "address must be a valid 0x Ethereum address (42 chars)"}` | Malformed address |
| 401 | `{"error": "Missing API key. Pass it as Authorization: Bearer <key> or X-API-Key header."}` | No auth |
| 401 | `{"error": "Invalid API key."}` | Bad key |
| 429 | `{"error": "Rate limit reached (100 requests/day). Resets at midnight UTC. Hold ≥1,000 $LUCA..."}` | Rate limit |
| 502 | `{"error": "Address classification failed"}` | Alchemy lookup failed |

## Rate limits

| Tier | Requirement | Requests/day |
|------|-------------|--------------|
| Free | Any key | 100 |
| Developer | ≥ 1,000 $LUCA | 500 |
| Enterprise | ≥ 10,000 $LUCA | 2,000 |

Resets midnight UTC. Link your wallet at [zettaai.co/developer](https://www.zettaai.co/developer) to upgrade.
