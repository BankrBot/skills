# CDP Base SQL API — Schema Reference

## Tables

| Table | Description |
|---|---|
| `base.transfers` | Token transfer events (ERC-20, native ETH) |
| `base.events` | Decoded contract event logs |
| `base.transactions` | Raw transactions |
| `base.blocks` | Block metadata |
| `base.encoded_logs` | Undecoded logs (log0 opcode etc.) |

---

## base.transfers

Best table for tracking token movements into/out of a wallet.

| Field | Type | Notes |
|---|---|---|
| `block_number` | uint64 | |
| `block_timestamp` | DateTime64 | UTC |
| `transaction_hash` | String | |
| `transaction_from` | String | tx signer |
| `transaction_to` | String | tx recipient (may differ from token recipient) |
| `log_index` | uint32 | |
| `token_address` | String | contract address of the token |
| `from_address` | String | sender of the tokens |
| `to_address` | String | receiver of the tokens |
| `value` | uint256 | raw token units (divide by 10^decimals) |
| `action` | Enum8 | 1=added, -1=reorg removed |

**Pattern — wallet token history:**
```sql
SELECT block_timestamp, token_address, from_address, to_address, value
FROM base.transfers
WHERE (from_address = lower('0xWALLET') OR to_address = lower('0xWALLET'))
  AND block_timestamp >= now() - INTERVAL 7 DAY
  AND action = 1
ORDER BY block_timestamp DESC
LIMIT 50
```

**Pattern — unique tokens ever held (90 day window):**
```sql
SELECT DISTINCT token_address
FROM base.transfers
WHERE to_address = lower('0xWALLET')
  AND block_timestamp >= now() - INTERVAL 90 DAY
  AND action = 1
```

**Pattern — did wallet ever hold this token?**
```sql
SELECT count(*) AS transfers_in
FROM base.transfers
WHERE to_address = lower('0xWALLET')
  AND token_address = lower('0xTOKEN')
  AND block_timestamp >= now() - INTERVAL 90 DAY
  AND action = 1
```

**Pattern — batch check multiple tokens held by wallet:**
```sql
SELECT DISTINCT token_address
FROM base.transfers
WHERE to_address = lower('0xWALLET')
  AND token_address IN ('0xtok1', '0xtok2', '0xtok3')
  AND block_timestamp >= now() - INTERVAL 90 DAY
  AND action = 1
```

---

## base.events

Decoded event logs. Best for ERC-20 Transfer confirmation, swap events, approvals.

| Field | Type | Notes |
|---|---|---|
| `block_number` | uint64 | |
| `timestamp` | DateTime64 | UTC |
| `transaction_hash` | String | |
| `transaction_from` | String | |
| `transaction_to` | String | |
| `address` | String | contract that emitted the event |
| `event_name` | String | e.g. `Transfer`, `Swap`, `Approval` |
| `event_signature` | String | e.g. `Transfer(address,address,uint256)` |
| `parameters` | Map(String, Variant) | decoded params — access via `parameters['key']` |
| `parameter_types` | Map(String, String) | ABI types |
| `action` | Int8 | 1=added, -1=reorg |

**Pattern — ERC-20 Transfer events for a token:**
```sql
SELECT parameters['from'] AS sender, parameters['to'] AS recipient,
       parameters['value'] AS amount, timestamp
FROM base.events
WHERE event_signature = 'Transfer(address,address,uint256)'
  AND address = lower('0xTOKEN_ADDRESS')
  AND timestamp >= now() - INTERVAL 1 DAY
  AND action = 1
ORDER BY timestamp DESC
LIMIT 20
```

**Pattern — swaps from a specific wallet:**
```sql
SELECT timestamp, transaction_hash, address, parameters
FROM base.events
WHERE event_name = 'Swap'
  AND transaction_from = lower('0xWALLET')
  AND timestamp >= now() - INTERVAL 7 DAY
  AND action = 1
ORDER BY timestamp DESC
LIMIT 20
```

---

## base.transactions

| Field | Type | Notes |
|---|---|---|
| `transaction_hash` | String | |
| `from_address` | String | |
| `to_address` | String | |
| `value` | String | native ETH value in wei |
| `timestamp` | DateTime64 | |
| `action` | Int8 | 1=added |

**Pattern — verify a transaction:**
```sql
SELECT from_address, to_address, value, timestamp
FROM base.transactions
WHERE transaction_hash = lower('0xHASH')
  AND action = 1
```

---

## base.blocks

| Field | Type | Notes |
|---|---|---|
| `block_number` | uint64 | |
| `timestamp` | DateTime | |
| `transaction_count` | uint64 | |
| `gas_used` | uint64 | |
| `base_fee_per_gas` | uint64 | |

---

## Important Notes

- **Addresses are lowercase** in the DB — always `lower('0x...')` when filtering
- **`action = 1`** filters out reorg'd data — always include this
- **`value` is raw units** — divide by `1e18` for ETH/18-decimal tokens, `1e6` for USDC
- **Rate limit:** 5 queries/second, 1,000 free/month then $0.0083/query
- **Latency:** <500ms query, <250ms from chain tip
- ⚠️ **Always add a `block_timestamp` filter** on `base.transfers` and `base.events` — unbounded scans exceed the 93 GiB leaf node limit and return HTTP 400. Minimum: `AND block_timestamp >= now() - INTERVAL 30 DAY`
