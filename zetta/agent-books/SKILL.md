# agent-books

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Returns the full financial statement for a registered agent: operating revenue, expenses, net income, wallet count, transaction breakdown, and confidence signals. Only manifest-declared `eoa` and `treasury_contract` wallets are counted — no discovered wallets, no token contracts.

This is the canonical P&L for an autonomous agent on Base.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/agent-books
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
| `slug` | string | Yes | Agent slug (e.g. `"aeon"`, `"luca"`) |
| `period` | string | No | Lookback window. One of: `7d`, `14d`, `30d`, `90d`. Default: `30d` |

## Output — attributed

```json
{
  "skill": "agent-books",
  "attributed": true,
  "agent": { "name": "AEON", "slug": "aeon", "ecosystem": "AEON" },
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
    "tx_count": 87
  },
  "confidence": "high",
  "luca_summary": "AEON recorded $12,450.00 in operating revenue and $3,200.00 in expenses over 30d (87 transactions). Net income is positive at $9,250.00.",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Output — unattributed (no manifest)

```json
{
  "skill": "agent-books",
  "attributed": false,
  "agent": { "name": "SomeAgent", "slug": "someagent" },
  "reason": "No manifest-declared wallets found. Only wallets declared via .agent/wallets.json produce attributed books."
}
```

## Integrity rules

- **Only manifest-declared wallets count.** Wallets in the registry but not in `.agent/wallets.json` produce zero books.
- **Only `eoa` and `treasury_contract` address types are books-eligible.** Token contracts declared in the manifest are silently excluded.
- **`gross_inflow_usd` is not revenue.** Gross inflows include capital injections, DEX receipts, and internal transfers that are quarantined. Use `revenue-analysis` for the full breakdown.
- Internal transfers between an agent's own wallets are excluded from both revenue and expenses.
- Agent GDP counts only operating revenue — not gross inflows.

## Example

```bash
curl -X POST https://www.zettaai.co/api/luca/skills/agent-books \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"slug": "aeon", "period": "30d"}'
```

## Usage notes

- Use `registry-check` first to find the correct slug if you only have a name or wallet address
- `attributed: false` means no manifest — not a data error. The agent needs to submit `.agent/wallets.json`
- `confidence` reflects how many wallets were analyzed vs declared: `high` = all eligible wallets covered

## Limitations

- Base chain only (USDC, USDT, ETH, WETH, and the agent's own project token)
- Books do not include off-chain revenue, CEX balances, or L2 chains other than Base
- Historical data starts from when the agent was first indexed in the Zetta registry
