# Revenue Analysis — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/revenue-analysis
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

## Response — 200 OK (attributed)

```json
{
  "skill": "revenue-analysis",
  "agent": { "name": "AEON", "slug": "aeon", "ecosystem": "AEON" },
  "period": "30d",
  "attributed": true,
  "wallets": { "eligible": 2, "analyzed": 2, "total": 5 },
  "revenue": {
    "gross_inflow_usd": 18000.00,
    "operating_revenue_usd": 12450.00,
    "quarantined_inflows_usd": 5550.00,
    "dex_excluded_usd": 800.00,
    "revenue_recognition_rate_pct": 69,
    "gross_inflow_is_not_revenue": true,
    "note": "31% of gross inflows excluded (capital injections, DEX activity, or internal transfers)"
  },
  "expenses": {
    "total_usd": 3200.00,
    "bridge_excluded_usd": 0.00,
    "dex_excluded_usd": 800.00,
    "net_income_usd": 9250.00,
    "margin_pct": 74.3
  },
  "confidence": "high",
  "breakdown": {
    "revenue_by_source": [
      { "source": "0x...", "label": "Inference payer", "amount_usd": 12450.00 }
    ],
    "expenses_by_category": [
      { "category": "inference", "amount_usd": 2100.00 },
      { "category": "gas", "amount_usd": 1100.00 }
    ],
    "quarantined_events": [
      {
        "tx_hash": "0x...",
        "amount_usd": 5000.00,
        "reason": "capital_injection",
        "timestamp": "2026-06-01T00:00:00.000Z"
      }
    ]
  },
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Response — 200 OK (unattributed)

```json
{
  "skill": "revenue-analysis",
  "agent": { "name": "SomeAgent", "slug": "someagent" },
  "period": "30d",
  "attributed": false,
  "reason": "No manifest-declared wallets found.",
  "message": null
}
```

## Key fields

| Field | Always use this | Never use this |
|-------|----------------|----------------|
| Revenue | `operating_revenue_usd` | `gross_inflow_usd` as revenue |
| Excluded | `quarantined_inflows_usd` shows what was removed | — |
| Integrity | `gross_inflow_is_not_revenue: true` hardcoded | — |

## Quarantine reasons

| Reason | Meaning |
|--------|---------|
| `capital_injection` | Large one-off inflow from known operator wallet |
| `internal_transfer` | Movement between the agent's own manifest wallets |
| `dex_receipt` | Token swap output — not operating income |
| `bridge_receipt` | Cross-chain bridge transfer |

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "slug is required"}` | Missing slug |
| 400 | `{"error": "period must be 7d, 14d, 30d, or 90d"}` | Invalid period |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 404 | `{"error": "Agent 'x' not found"}` | Not in registry |
| 500 | `{"error": "..."}` | Computation failed |
