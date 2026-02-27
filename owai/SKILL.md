---
name: owai
description: Analyze any EVM smart contract — auto-fetches ABI, discovers usage patterns, decodes function calls via Dune, generates AI-driven analytics (charts, stats, time series), and returns structured results. Supports Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche.
---

# On-Chain Analysis Skill

Analyze any verified EVM smart contract by pasting its address. The skill runs a full analysis pipeline:

1. **ABI Fetching** — Retrieves the verified ABI from Etherscan (or accepts a manual ABI)
2. **Usage Discovery** — Queries Dune to find which methods are most called, by whom, and with what value
3. **Decoded Data Tables** — AI generates DuneSQL queries using `decode_evm_function_call()` to build raw decoded data tables on Dune
4. **Analytics Generation** — A second AI pass generates 6-10 visualization queries (stats, time series, bar charts, pie charts) from the decoded tables
5. **Execution** — All queries are executed on Dune and results returned as structured JSON

## When to Use

- User asks "analyze this contract" or "what does this contract do"
- User wants on-chain analytics, usage stats, or dashboards for a smart contract
- User provides a contract address and wants to understand its activity
- User asks about transaction patterns, caller behavior, or function usage
- User wants to compare function usage or identify top callers
- User asks "who uses this contract" or "how popular is this contract"

## How to Call

**POST** `https://onchainwizard.ai/functions/v1/onchain-analysis`

### Request Body

```json
{
  "contractAddress": "0x00000000009726632680FB29d3F7A9734E3010E2",
  "chain": "base",
  "abi": "(optional — raw ABI JSON string if contract is unverified)"
}
```

### Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `contractAddress` | string | Yes | The EVM contract address (0x-prefixed, 42 chars including 0x) |
| `chain` | string | Yes | One of: `ethereum`, `polygon`, `bsc`, `arbitrum`, `optimism`, `base`, `avalanche` |
| `abi` | string/array | No | Manual ABI if contract is not verified on Etherscan |

### Supported Chains

| Chain | Example Explorer |
|-------|-----------------|
| `ethereum` | etherscan.io |
| `polygon` | polygonscan.com |
| `bsc` | bscscan.com |
| `arbitrum` | arbiscan.io |
| `optimism` | optimistic.etherscan.io |
| `base` | basescan.org |
| `avalanche` | snowtrace.io |

### Response

```json
{
  "contractAddress": "0x...",
  "chain": "base",
  "tldr": "## TLDR\n\n- **Key insight 1** ...\n- **Key insight 2** ...",
  "abiSummary": "Events (5):\n  - Transfer(...)\nWrite Functions (8):\n  - swap(...)",
  "dashboardUrl": "https://onchainwizard.ai/shared/abc123-uuid",
  "topMethods": [
    {
      "function_name": "swap",
      "call_count": 142000,
      "unique_callers": 5200,
      "total_eth": 1234.5678
    }
  ],
  "rawTables": [
    {
      "function_name": "swap",
      "query_id": 12345,
      "dune_url": "https://dune.com/queries/12345",
      "execution_state": "QUERY_STATE_COMPLETED"
    }
  ],
  "queryResults": [
    {
      "id": "total_swaps",
      "title": "Total Swaps",
      "type": "stat",
      "sql": "SELECT COUNT(*) AS value FROM query_12345",
      "rows": [{ "value": 142000 }]
    },
    {
      "id": "daily_swaps",
      "title": "Daily Swap Volume",
      "type": "timeseries",
      "sql": "SELECT DATE_TRUNC('day', block_time) AS date, COUNT(*) AS value FROM query_12345 GROUP BY 1 ORDER BY 1",
      "rows": [
        { "date": "2026-01-01", "value": 500 },
        { "date": "2026-01-02", "value": 620 }
      ]
    }
  ]
}
```

### Query Result Types

| Type | Description | Key Fields |
|------|-------------|------------|
| `stat` | Single metric | `rows[0].value` — the headline number |
| `timeseries` | Data over time | `rows[].date`, `rows[].value` |
| `bar` | Category comparison | `rows[].label`, `rows[].value` |
| `pie` | Distribution | `rows[].label`, `rows[].value` |
| `scatter` | Correlation | `rows[].x`, `rows[].y` |

## How to Present Results

1. **Start with the TLDR** — display it as markdown to give the user a quick overview
2. **Dashboard link** — always include the `dashboardUrl` so the user can view the full interactive dashboard: "📊 [View full dashboard](dashboardUrl)"
3. **Stat queries** (`type: "stat"`) — show as headline metrics (e.g., "Total Swaps: 142,000")
4. **Time series** (`type: "timeseries"`) — describe trends ("Daily swaps peaked at X on date Y")
5. **Bar/Pie charts** (`type: "bar"` / `type: "pie"`) — summarize distributions ("Top 5 callers account for 60% of swaps")
6. **Link to Dune** — provide `dune_url` links for raw tables so users can explore further
7. **Failed queries** — if a query has `error` instead of `rows`, mention it briefly but don't block the rest

## Example Conversations

### Basic: "Analyze this contract"
**User:** Analyze 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D on ethereum  
**Action:** Call the skill with `{ "contractAddress": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", "chain": "ethereum" }`  
**Present:** TLDR → Stats → Trends → Distributions → Dune links

### Missing chain
**User:** What does 0xABC...DEF do?  
**Action:** Ask which chain before calling. "Which chain is this contract on? I support Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, and Avalanche."

### Unverified contract
**User:** Analyze 0xABC...DEF on base  
**API returns:** `"Could not fetch ABI"`  
**Action:** Ask user for the ABI JSON, then retry with `{ "contractAddress": "...", "chain": "base", "abi": "<user-provided ABI>" }`

### Follow-ups after analysis
- "Tell me more about the top callers" → Expand on bar/pie data from `queryResults`
- "What does the swap function do?" → Use `abiSummary` to explain
- "Can I see the raw data?" → Link to `rawTables[].dune_url`

## Important Notes

- The analysis takes **2-5 minutes** due to Dune query execution and materialization — set user expectations
- Only works for contracts with verified ABIs (unless a manual ABI is provided)
- The AI selects the most interesting functions automatically based on usage data
- Raw decoded tables are saved as named queries on Dune for future reference
- Query results may be empty if the contract has very little on-chain activity

## Error Handling

| Error | Meaning | Recommended Action |
|-------|---------|-------------------|
| `"Could not fetch ABI"` | Contract is not verified | Ask user for the ABI |
| `"No write functions found"` | No state-changing functions | Inform user; contract may be read-only or a proxy |
| `"Unsupported chain"` | Chain not in supported list | List supported chains and ask again |
| `"Missing required API keys"` | Server-side config issue | Report as a service error |
| Timeout / no response | Analysis exceeded time limit | Suggest retrying; Dune may be under load |
