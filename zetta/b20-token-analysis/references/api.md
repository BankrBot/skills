# B20 Token Analysis — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/b20-token-analysis
Content-Type: application/json
Authorization: Bearer zt_live_...
```

### Body

```json
{
  "address": "0xb2b335f832fd3f43461ebd1cd9831d93d9ca4ba3",
  "agent_slug": "luca",
  "period": "30d"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `address` | string | Yes | Token contract address, must match `/^0x[0-9a-fA-F]{40}$/` |
| `agent_slug` | string | No | Optional agent slug to correlate. Does not affect analysis. |
| `period` | string | No | Informational only. Default: `30d`. |

## Response — 200 OK

```json
{
  "skill": "b20-token-analysis",
  "token": {
    "address": "0xb2b335f832fd3f43461ebd1cd9831d93d9ca4ba3",
    "name": "LUCA",
    "symbol": "LUCA",
    "decimals": 18,
    "total_supply": "1000000000000000000000000000",
    "chain": "base",
    "deployed_block": 12345678,
    "issuer_wallet": "0x...",
    "owner_wallet": "0x...",
    "books_eligible": false,
    "books_eligible_note": "Token contracts are never books-eligible"
  },
  "linked_agent": {
    "name": "Luca",
    "slug": "luca",
    "link_method": "known_token",
    "link_confidence": "confirmed",
    "note": null
  },
  "manifest_status": "attributed",
  "manifest_note": "Issuer wallet is manifest-attributed",
  "activity": {
    "mint_count": 5,
    "burn_count": 0,
    "mint_volume_raw": "100000000000000000000000",
    "burn_volume_raw": "0",
    "recent_mints": [
      {
        "tx_hash": "0x...",
        "to": "0x...",
        "amount_raw": "10000000000000000000000",
        "block_number": 12345700,
        "timestamp": "2026-06-20T14:22:00.000Z"
      }
    ],
    "recent_burns": [],
    "last_activity_at": "2026-06-20T14:22:00.000Z"
  },
  "luca_read": "LUCA is a confirmed B20 asset linked to Luca via registry. 5 mint events detected, 0 burns. Issuer wallet is manifest-attributed. Financial books require separate EOA/treasury wallet declaration.",
  "limitations": [
    "Token transfers are not operating revenue",
    "Token contract is not an operator wallet",
    "Issuer wallet (0x...) is not books-eligible unless declared in agent manifest",
    "B20 activity is not included in Agent GDP",
    "Holder concentration analysis requires a full transfer scan — not available in this endpoint"
  ],
  "data_integrity_warnings": [
    "gross_inflow_usd from token transfers ≠ operating revenue",
    "Do not count B20 mint events as agent revenue",
    "Token issuance is a financial event but not a revenue event"
  ],
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## `linked_agent` — null case

```json
{
  "linked_agent": null,
  "manifest_status": "none",
  "manifest_note": "No manifest found — B20 indexed, but financial books require wallet attribution"
}
```

## `manifest_status` values

| Value | Meaning |
|-------|---------|
| `attributed` | Issuer wallet is manifest-declared with confirmed confidence |
| `candidate` | Issuer wallet is in a registry agent's wallet list but manifest not submitted |
| `none` | No agent link found |

## `link_method` values

| Value | Meaning |
|-------|---------|
| `known_token` | Token address declared in agent's registry entry |
| `manifest` | Linked via `.agent/wallets.json` |
| `erc8004` | Linked via ERC-8004 identity record |
| `admin` | Manually linked |
| `none` | No confirmed link |

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "address must be a valid 0x Ethereum address"}` | Malformed address |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 502 | `{"error": "B20 analysis failed"}` | Alchemy or DB lookup failed |
