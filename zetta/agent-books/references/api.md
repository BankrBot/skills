# Agent Books — API Reference

## Request

```
POST https://www.zettaai.co/api/luca/skills/agent-books
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
| `slug` | string | Yes | Lowercase agent slug |
| `period` | string | No | One of: `7d`, `14d`, `30d`, `90d`. Default: `30d` |

## Response — 200 OK (attributed)

```json
{
  "skill": "agent-books",
  "attributed": true,
  "agent": {
    "name": "AEON",
    "slug": "aeon",
    "ecosystem": "AEON"
  },
  "period": "30d",
  "wallets": {
    "eligible": 2,
    "analyzed": 2,
    "total": 5
  },
  "financials": {
    "revenue_usd": 12450.00,
    "expenses_usd": 3200.00,
    "net_income_usd": 9250.00,
    "gross_inflow_usd": 18000.00,
    "margin_pct": 74.3,
    "tx_count": 87,
    "internal_tx_count": 4
  },
  "confidence": "high",
  "breakdown": {
    "revenue_by_source": [
      { "source": "0x...", "label": "External", "amount_usd": 12450.00 }
    ],
    "expenses_by_category": [
      { "category": "inference", "amount_usd": 2100.00 },
      { "category": "gas", "amount_usd": 1100.00 }
    ]
  },
  "luca_summary": "AEON recorded $12,450.00 in operating revenue and $3,200.00 in expenses over 30d (87 transactions). Net income is positive at $9,250.00.",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Response — 200 OK (unattributed)

```json
{
  "skill": "agent-books",
  "attributed": false,
  "agent": { "name": "SomeAgent", "slug": "someagent" },
  "reason": "No manifest-declared wallets found. Only wallets declared via .agent/wallets.json produce attributed books."
}
```

## Error responses

| Status | Body | Cause |
|--------|------|-------|
| 400 | `{"error": "slug is required"}` | Missing slug |
| 400 | `{"error": "period must be 7d, 14d, 30d, or 90d"}` | Invalid period |
| 401 | `{"error": "Invalid API key."}` | Bad auth |
| 404 | `{"error": "Agent 'x' not found. Use registry-check skill to find the correct slug."}` | Agent not in registry |
| 429 | `{"error": "Rate limit reached..."}` | Rate limit |
| 500 | `{"error": "..."}` | Books computation failed |
