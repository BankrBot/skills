# Registry Check — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/registry-check
Content-Type: application/json
Authorization: Bearer zt_live_...
```

### Body

```json
{ "query": "aeon" }
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `query` | string | Yes | Agent slug, name fragment, or 0x address |

## Match priority

1. Exact slug match (`"aeon"` → slug `aeon`)
2. Exact wallet address match (any wallet in the agent's wallet list)
3. Name substring match (case-insensitive)

## Response — 200 OK (found)

```json
{
  "skill": "registry-check",
  "found": true,
  "query": "aeon",
  "match_type": "slug",
  "agent": {
    "name": "AEON",
    "slug": "aeon",
    "ecosystem": "AEON",
    "verification_status": "verified",
    "evidence_sources": ["manifest", "x_handle"],
    "erc8004_agent_id": "0x...",
    "erc8004_did": "did:ethr:base:0x...",
    "attribution_tier": "manifest_attributed",
    "books_eligible_wallets": 2,
    "total_wallets": 5,
    "wallets": [
      {
        "address": "0x...",
        "label": "Treasury",
        "role": "treasury",
        "address_type": "treasury_contract",
        "evidence_source": "manifest",
        "books_eligible": true,
        "books_ineligibility_reason": null,
        "chain": "base"
      },
      {
        "address": "0x...",
        "label": "Token",
        "role": "token_contract",
        "address_type": "token_contract",
        "evidence_source": "manifest",
        "books_eligible": false,
        "books_ineligibility_reason": "address_type=token_contract is not books-eligible",
        "chain": "base"
      }
    ]
  },
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Response — 200 OK (not found)

```json
{
  "skill": "registry-check",
  "found": false,
  "query": "unknownagent",
  "agent": null,
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Attribution tiers

| Tier | Meaning |
|------|---------|
| `manifest_attributed` | ≥ 1 manifest-declared, books-eligible wallet |
| `discovered` | Wallets in registry, none manifest-declared |
| `unattributed` | No wallets at all |

## `match_type` values

| Value | Meaning |
|-------|---------|
| `slug` | Matched on exact slug |
| `wallet_address` | Query was a 0x address found in the agent's wallet list |
| `name` | Matched on name substring |

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "query is required (agent slug, name, or 0x wallet address)"}` | Empty query |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 502 | `{"error": "Registry check failed"}` | DB lookup failed |
