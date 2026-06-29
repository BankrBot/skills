# Luca Report — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/luca-report
Content-Type: application/json
Authorization: Bearer zt_live_...
```

### Body

```json
{
  "slug": "aeon",
  "period": "30d"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `slug` | string | Yes | Agent slug |
| `period` | string | No | One of: `7d`, `14d`, `30d`, `90d`. Default: `30d` |

## Response — 200 OK

```json
{
  "skill": "luca-report",
  "agent": {
    "name": "AEON",
    "slug": "aeon",
    "ecosystem": "AEON",
    "verification_status": "verified",
    "evidence_sources": ["manifest", "x_handle"],
    "erc8004_agent_id": "0x...",
    "erc8004_did": "did:ethr:base:0x...",
    "website": "https://aeon.xyz",
    "x_handle": "@aeon"
  },
  "attribution": {
    "tier": "manifest_attributed",
    "books_eligible_wallets": 2,
    "total_wallets": 5,
    "source": "manifest"
  },
  "books": {
    "attributed": true,
    "period": "30d",
    "wallets": { "eligible": 2, "analyzed": 2, "total": 5 },
    "financials": {
      "revenue_usd": 12450.00,
      "expenses_usd": 3200.00,
      "net_income_usd": 9250.00,
      "gross_inflow_usd": 18000.00,
      "margin_pct": 74.3,
      "tx_count": 87
    },
    "confidence": "high",
    "luca_summary": "AEON recorded $12,450.00 in operating revenue..."
  },
  "treasury": {
    "wallets": [
      {
        "address": "0x...",
        "label": "Treasury",
        "role": "treasury",
        "address_type": "treasury_contract",
        "stable_balance_usd": 42500.00,
        "chain": "base"
      }
    ],
    "total_stable_balance_usd": 42500.00,
    "health": "healthy"
  },
  "summary": "AEON recorded $12,450.00 in operating revenue and $3,200.00 in expenses over 30d (87 transactions). Net income is positive at $9,250.00.",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Unattributed response shape

When `attribution.tier` is not `manifest_attributed`:

```json
{
  "attribution": {
    "tier": "unattributed",
    "books_eligible_wallets": 0,
    "total_wallets": 0,
    "source": null
  },
  "books": {
    "attributed": false,
    "reason": "No manifest-declared wallets found."
  },
  "treasury": {
    "wallets": [],
    "total_stable_balance_usd": 0,
    "health": "unknown"
  },
  "summary": null
}
```

## Field notes

| Field | Notes |
|-------|-------|
| `agent.erc8004_agent_id` | Identity only — not used for financial attribution |
| `agent.erc8004_did` | Identity only — not used for financial attribution |
| `attribution.source` | `"manifest"` when attributed, `null` otherwise |
| `treasury.health` | Based on manifest-eligible wallets only |
| `summary` | Template-generated from financial data, not a generative AI response |

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "slug is required"}` | Missing slug |
| 400 | `{"error": "period must be 7d, 14d, 30d, or 90d"}` | Invalid period |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 404 | `{"error": "Agent 'x' not found"}` | Not in registry |
| 500 | `{"error": "..."}` | Computation failed |
