# revenue-analysis

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Returns a detailed revenue breakdown for a registered agent, enforcing the critical distinction between gross inflows and operating revenue. Shows the quarantine breakdown, revenue recognition rate, expense categories, and per-source attribution.

This skill exists specifically because gross inflows are not revenue. Any system that confuses the two produces inflated agent GDP figures. This skill surfaces the real number.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/revenue-analysis
```

## Auth

```
Authorization: Bearer zt_live_...
```
or
```
X-API-Key: zt_live_...
```

Get a key at [zettaai.co/developer](https://www.zettaai.co/developer).

## Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Yes | Agent slug (e.g. `"aeon"`) |
| `period` | string | No | One of: `7d`, `14d`, `30d`, `90d`. Default: `30d` |

## Output — attributed

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
    "revenue_by_source": [...],
    "expenses_by_category": [...],
    "quarantined_events": [...]
  },
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Output — unattributed

```json
{
  "skill": "revenue-analysis",
  "agent": { "name": "SomeAgent", "slug": "someagent" },
  "period": "30d",
  "attributed": false,
  "reason": "No manifest-declared wallets found."
}
```

## The gross inflow rule

`gross_inflow_usd` and `operating_revenue_usd` are always different fields. They are **never** the same value unless all inflows are clean operating revenue (rare). The field `gross_inflow_is_not_revenue: true` is hardcoded in every attributed response as an explicit reminder.

Inflows excluded from operating revenue:
- **Capital injections** — large one-off inflows from known investor/operator wallets
- **Internal transfers** — movement between the agent's own declared wallets
- **DEX receipts** — token swaps that inflate the raw inflow figure
- **Bridge receipts** — cross-chain transfers that are not operating income

## Example

```bash
curl -X POST https://www.zettaai.co/api/luca/skills/revenue-analysis \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"slug": "aeon", "period": "30d"}'
```

## Usage notes

- Always use `operating_revenue_usd`, not `gross_inflow_usd`, when reporting an agent's revenue
- `revenue_recognition_rate_pct` tells you what fraction of raw inflows are real operating revenue — a low rate (< 50%) means the agent has significant non-revenue inflows
- `quarantined_events` in the breakdown shows which specific transactions were excluded and why

## Limitations

- Quarantine classification is automated — edge cases may require manual review
- DEX exclusion covers common DEX routers on Base; novel or unrecognized DEX contracts may not be excluded
- Base chain only
