---
name: base-sql
description: >-
  Query real-time and historical onchain data on Base using the Coinbase CDP
  SQL API. Use when you need to look up token transfer history for a wallet,
  check if a wallet has ever held a specific token, verify on-chain transaction
  or fill status, count unique token holders, find swap events, or run any
  custom SQL query against Base blockchain data. Triggers on: "query Base",
  "check on-chain history", "has wallet ever held", "verify on-chain",
  "how many holders", "token transfer history", "confirm fill on-chain",
  "Base SQL", "CDP SQL".
---

# CDP Base SQL API

Query Base blockchain data via Coinbase's CDP SQL API — <500ms latency, <250ms from chain tip, 1,000 free queries/month.

## Setup

Store your CDP Client API key in one of:
- Environment variable: `CDP_CLIENT_KEY`
- File: `~/.cdp/client-key.txt` (or set `CDP_KEY_FILE` env var to a custom path)

Get a free key at: https://portal.cdp.coinbase.com/projects/api-keys/client-key

## Running Queries

```bash
# Inline query
CDP_CLIENT_KEY=your_key python3 scripts/query.py "SELECT ..."

# From file
CDP_CLIENT_KEY=your_key python3 scripts/query.py --file query.sql

# Raw JSON response
CDP_CLIENT_KEY=your_key python3 scripts/query.py --raw "SELECT ..."
```

Output: row count + execution time header, then JSON array of results.

## Schema

See `references/schema.md` for full table/column reference and query patterns.

**Quick table guide:**
- Token transfers in/out of a wallet → `base.transfers`
- Swap events, approvals, decoded logs → `base.events`
- Raw transaction data → `base.transactions`
- Block metadata → `base.blocks`

## Common Queries

**Has a wallet ever held a token?**
```sql
SELECT count(*) AS in_count
FROM base.transfers
WHERE to_address = lower('0xWALLET')
  AND token_address = lower('0xTOKEN')
  AND block_timestamp >= now() - INTERVAL 90 DAY
  AND action = 1
```

**Recent token activity for a wallet:**
```sql
SELECT block_timestamp, token_address, from_address, to_address, value
FROM base.transfers
WHERE (from_address = lower('0xWALLET')
    OR to_address  = lower('0xWALLET'))
  AND block_timestamp >= now() - INTERVAL 7 DAY
  AND action = 1
ORDER BY block_timestamp DESC
LIMIT 25
```

**Unique buyers of a token in the last hour:**
```sql
SELECT count(DISTINCT to_address) AS unique_buyers
FROM base.transfers
WHERE token_address = lower('0xTOKEN')
  AND block_timestamp >= now() - INTERVAL 1 HOUR
  AND action = 1
```

**Verify a specific transaction:**
```sql
SELECT from_address, to_address, value, timestamp
FROM base.transactions
WHERE transaction_hash = lower('0xHASH')
  AND action = 1
```

**ERC-20 Transfer events for a token:**
```sql
SELECT parameters['from'] AS sender, parameters['to'] AS recipient,
       parameters['value'] AS amount, timestamp
FROM base.events
WHERE event_signature = 'Transfer(address,address,uint256)'
  AND address = lower('0xTOKEN')
  AND timestamp >= now() - INTERVAL 1 DAY
  AND action = 1
ORDER BY timestamp DESC
LIMIT 20
```

## Key Rules

- Always `lower('0x...')` addresses — DB stores lowercase
- Always `AND action = 1` to exclude reorg'd data
- ⚠️ **Always include `block_timestamp >= now() - INTERVAL X DAY`** — unbounded scans exceed the 93 GiB leaf node limit and return HTTP 400
- `value` is raw token units — divide by `1e18` (most tokens) or `1e6` (USDC)
- Rate limit: 5 req/s — add `LIMIT` when scanning large ranges
