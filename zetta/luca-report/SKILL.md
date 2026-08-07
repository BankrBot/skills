# luca-report

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

The single-call complete picture of an agent's financial identity. Combines registry identity, attribution tier, full financial statement, treasury balances, and a narrative summary into one response. This is the skill to use when you want everything about an agent in a single request.

Internally it runs `agent-books` and treasury balance lookups in parallel, then assembles the composite.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/luca-report
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

## Output

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
    "confidence": "high"
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

## Output — agent not attributed

When `attribution.tier` is `discovered` or `unattributed`:
- `books` will have `attributed: false` with a `reason` field
- `treasury.wallets` will be empty
- `summary` will be `null`

## Integrity rules

- ERC-8004 fields (`erc8004_agent_id`, `erc8004_did`) are identity only — they do not affect financial attribution
- `books` is null or unattributed unless the agent has manifest-declared `eoa` or `treasury_contract` wallets
- `treasury.wallets` includes only manifest-declared, books-eligible wallets — not all wallets in the registry
- Treasury health thresholds: `healthy` ≥ $10K, `low` ≥ $1K, `critical` < $1K, `unknown` = no manifest

## Example

```bash
curl -X POST https://www.zettaai.co/api/luca/skills/luca-report \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"slug": "aeon", "period": "30d"}'
```

## Usage notes

- This is the highest-latency skill — it runs books + treasury balance lookups in parallel. Typical response time: 1–3 seconds.
- `summary` is a data-derived narrative generated from financial figures — not a generative AI response
- For a breakdown of revenue quarantine logic, use `revenue-analysis` separately
- For per-wallet books-eligibility detail, use `registry-check` separately

## Limitations

- One agent per call
- Books and treasury are Base chain only
- `summary` is template-generated from financial data — not a Claude-written analysis
