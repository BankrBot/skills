# Treasury Monitor — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/treasury-monitor
Content-Type: application/json
Authorization: Bearer zt_live_...
```

### Body — by slug

```json
{ "slug": "aeon" }
```

### Body — by address

```json
{ "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `slug` | string | Conditional | Agent slug. Required if `address` not provided. |
| `address` | string | Conditional | 0x address. Required if `slug` not provided. |

## Response — 200 OK (by slug, with wallets)

```json
{
  "skill": "treasury-monitor",
  "source": "slug",
  "agent": { "name": "AEON", "slug": "aeon", "ecosystem": "AEON" },
  "wallets": [
    {
      "address": "0x...",
      "label": "Treasury",
      "role": "treasury",
      "address_type": "treasury_contract",
      "evidence_source": "manifest",
      "books_eligible": true,
      "books_ineligibility_reason": null,
      "stable_balance_usd": 42500.00,
      "health": "healthy",
      "chain": "base"
    }
  ],
  "total_stable_balance_usd": 42500.00,
  "health": "healthy",
  "note": null,
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Response — 200 OK (no manifest)

```json
{
  "skill": "treasury-monitor",
  "source": "slug",
  "agent": { "name": "SomeAgent", "slug": "someagent", "ecosystem": null },
  "wallets": [],
  "total_stable_balance_usd": 0,
  "health": "unknown",
  "note": "No wallets found for this agent. Submit a wallet manifest to enable treasury monitoring.",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Response — 200 OK (by address)

```json
{
  "skill": "treasury-monitor",
  "source": "address",
  "agent": null,
  "wallets": [
    {
      "address": "0x...",
      "address_type": "eoa",
      "stable_balance_usd": 1200.00,
      "health": "low",
      "chain": "base"
    }
  ],
  "total_stable_balance_usd": 1200.00,
  "health": "low",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Health thresholds

| Signal | Balance |
|--------|---------|
| `healthy` | ≥ $10,000 |
| `low` | ≥ $1,000, < $10,000 |
| `critical` | < $1,000 |
| `unknown` | No manifest wallets |

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "slug or address is required"}` | Both missing |
| 400 | `{"error": "address must be a valid 0x Ethereum address"}` | Malformed address |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 404 | `{"error": "Agent 'x' not found"}` | Slug not in registry |
| 502 | `{"error": "Treasury monitor failed"}` | Alchemy lookup failed |
