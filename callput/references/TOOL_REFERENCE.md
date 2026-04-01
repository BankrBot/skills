# Callput Lite MCP Tool Reference

Complete reference for all 10 Callput trading tools. Each tool serves a specific role in the spread trading workflow: scanning markets, executing trades, tracking P&L, and managing positions.

---

## 1. callput_scan_spreads

**Purpose** — Scan the options market and return pre-ranked spread candidates ready for execution, filtered by underlying asset and directional bias.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| underlying_asset | string | Yes | `"ETH"` | Asset symbol (ETH, BTC, etc.) |
| bias | enum | Yes | `"bullish"` | Options: bullish, bearish, neutral-bearish, neutral-bullish |
| max_results | number | No | `3` | Return top N results (1–5, default auto) |

**Strategy Mapping**
- `bullish` → BuyCallSpread (pay debit, profit if spot rises)
- `bearish` → BuyPutSpread (pay debit, profit if spot falls)
- `neutral-bearish` → SellCallSpread (collect premium)
- `neutral-bullish` → SellPutSpread (collect premium)

**Example Input**
```json
{
  "underlying_asset": "ETH",
  "bias": "bullish",
  "max_results": 3
}
```

**Example Output**
```json
{
  "underlying_asset": "ETH",
  "atm_iv": 0.65,
  "spreads": [
    {
      "rank": 1,
      "spread_id": "spread_0x123abc",
      "strategy": "BuyCallSpread",
      "long_leg_id": "opt_long_0x456def",
      "short_leg_id": "opt_short_0x789ghi",
      "long_strike": 2100,
      "short_strike": 2200,
      "expiry_date": "2026-04-30",
      "days_to_expiry": 38,
      "width": 100,
      "entry_debit_usd": 45.50,
      "max_profit_usd": 54.50,
      "win_probability": 0.62,
      "long_iv": 0.64,
      "short_iv": 0.62
    }
  ]
}
```

**Key Output Fields**
- `atm_iv` — At-the-money implied volatility; high IV favors sell spreads (more premium)
- `long_leg_id`, `short_leg_id` — Pass directly to `execute_spread`
- `entry_debit_usd` — Net cost (buy spreads); negative = credit received (sell spreads)
- `max_profit_usd` — Maximum risk/reward for the spread
- `days_to_expiry` — Time to expiration; <1 day signals close opportunity
- `rank` — Quality ranking by Callput engine

**When to Use** — Call this first to discover available spread opportunities. Use ATM IV to decide: high IV (>0.6) favors selling spreads for premium collection; low IV favors buying cheap spreads. Pass the returned `long_leg_id` and `short_leg_id` directly to `callput_execute_spread`.

---

## 2. callput_execute_spread

**Purpose** — Build an unsigned transaction to open a new spread position on-chain.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| strategy | enum | Yes | `"BuyCallSpread"` | BuyCallSpread, SellCallSpread, BuyPutSpread, SellPutSpread |
| from_address | string | Yes | `"0x742d..."` | Your wallet address (checksummed) |
| long_leg_id | string | Yes | `"opt_long_0x456def"` | From scan_spreads result |
| short_leg_id | string | Yes | `"opt_short_0x789ghi"` | From scan_spreads result |
| size | number | Yes | `10` | Position size (contracts or units) |
| min_fill_ratio | number | No | `0.95` | Acceptable slippage (0.01–1.0, default 0.9) |

**Example Input**
```json
{
  "strategy": "BuyCallSpread",
  "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "long_leg_id": "opt_long_0x456def",
  "short_leg_id": "opt_short_0x789ghi",
  "size": 10,
  "min_fill_ratio": 0.95
}
```

**Example Output**
```json
{
  "unsigned_tx": {
    "to": "0xCallputRouterAddress",
    "data": "0xa1b2c3d4...",
    "value": "0",
    "chain_id": 8453
  },
  "usdc_approval": {
    "sufficient": false,
    "approve_tx": {
      "to": "0xUSDCTokenAddress",
      "data": "0xapprovedata...",
      "value": "0",
      "chain_id": 8453
    },
    "needed_amount_usd": 455.50
  },
  "request_key_preview": "req_0x999..."
}
```

**Key Output Fields**
- `unsigned_tx` — Sign and broadcast this to open the position; contains encoded spread parameters
- `usdc_approval.sufficient` — If false, must sign and broadcast `approve_tx` first (ERC-20 approve)
- `approve_tx` — USDC approval transaction; send before `unsigned_tx` if `sufficient=false`
- `needed_amount_usd` — Total USDC required (entry debit or initial credit margin)

**When to Use** — After selecting a spread from `scan_spreads`. The function returns an unsigned transaction; you must sign it and broadcast to Base. If `usdc_approval.sufficient=false`, first send the USDC approval, then send the main spread transaction. After broadcasting the spread tx, extract the `request_key` using `callput_get_request_key_from_tx`.

---

## 3. callput_get_request_key_from_tx

**Purpose** — Extract and return the request_key from a spread or close transaction receipt; critical for P&L tracking.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| tx_hash | string | Yes | `"0x123abc..."` | Transaction hash from broadcasted tx |

**Example Input**
```json
{
  "tx_hash": "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f"
}
```

**Example Output**
```json
{
  "request_key": "req_0x999aaabbbcccdddeeefff",
  "is_open": true
}
```

**Key Output Fields**
- `request_key` — Unique identifier for this position; **save immediately** for P&L tracking
- `is_open` — true for open requests, false for close/settle requests; required for `check_request_status`

**When to Use** — Call immediately after broadcasting `execute_spread` or `close_position` transactions. **Critical**: Losing the request_key means losing P&L tracking for that position. Store it in your session state or database right away. Pass both `request_key` and `is_open` to `callput_check_request_status` to poll execution status.

---

## 4. callput_check_request_status

**Purpose** — Poll the keeper's execution status for a pending spread or close request.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| request_key | string | Yes | `"req_0x999..."` | From `get_request_key_from_tx` |
| is_open | boolean | Yes | `true` | true for open requests, false for close/settle |

**Example Input**
```json
{
  "request_key": "req_0x999aaabbbcccdddeeefff",
  "is_open": true
}
```

**Example Output**
```json
{
  "request_key": "req_0x999aaabbbcccdddeeefff",
  "status": "executed",
  "is_open": true,
  "execution_details": {
    "filled_size": 10,
    "filled_price_usd": 45.50,
    "timestamp": 1711270800
  }
}
```

**Key Output Fields**
- `status` — One of: `pending`, `executed`, `cancelled`
- `filled_size` — Actual size filled at execution
- `filled_price_usd` — Actual entry price (execution_details present only when status=executed)

**Polling Guide** — Poll every 30 seconds, max 6 attempts (3 minutes). After 3 minutes with no update, assume the request failed or was cancelled. When status changes to `executed` or `cancelled`, stop polling and proceed with portfolio updates or error handling.

**When to Use** — After extracting a request_key, poll this endpoint to wait for the keeper to execute the on-chain transaction. Once status reaches `executed`, the position is live; you can then call `portfolio_summary` with the request_key to see current mark value and P&L.

---

## 5. callput_portfolio_summary

**Purpose** — Get current USDC balance, active positions with mark-to-market values, and optional P&L when request_keys are provided.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| address | string | Yes | `"0x742d..."` | Your wallet address |
| request_keys | array[string] | No | `["req_0x999...", "req_0xaaa..."]` | Saved request_keys for cost-basis & P&L; optional |

**Example Input**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "request_keys": ["req_0x999aaabbbcccdddeeefff"]
}
```

**Example Output**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "usdc_balance": 5000.00,
  "positions": [
    {
      "option_token_id": "opt_0xabc123",
      "underlying_asset": "ETH",
      "side": "long",
      "option_type": "Call",
      "strike": 2100,
      "expiry_date": "2026-04-30",
      "size": 10,
      "days_to_expiry": 38,
      "current_mark_usd": 52.00,
      "entry_cost_usd": 45.50,
      "unrealized_pnl_usd": 65.00,
      "unrealized_pnl_pct": 14.3,
      "close_pnl_est_pct": 14.3
    }
  ],
  "urgent_count": 0
}
```

**Key Output Fields**
- `usdc_balance` — Available USDC in your wallet
- `current_mark_usd` — Current mid-price for the option (Greeks-based or market mid)
- `unrealized_pnl_usd`, `unrealized_pnl_pct` — Only present if request_keys provided (enables cost-basis lookup)
- `close_pnl_est_pct` — Estimated P&L if closed now; >50% signals strong close opportunity
- `urgent_count` — Number of positions expiring within 24h; >0 = manage expiries first
- `days_to_expiry` — Time remaining; <1 day means close/settle soon

**When to Use** — Call frequently (every 5–10 min) to monitor positions. Without `request_keys`, you get balance + positions only. Pass saved `request_keys` to unlock cost-basis and P&L fields. If `urgent_count > 0`, prioritize closing or settling expiring positions with `callput_close_position` or `callput_settle_position`.

---

## 6. callput_close_position

**Purpose** — Build an unsigned transaction to close an open position before expiration.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| underlying_asset | string | Yes | `"ETH"` | Asset of the position |
| from_address | string | Yes | `"0x742d..."` | Your wallet address |
| option_token_id | string | Yes | `"opt_0xabc123"` | Token ID from portfolio_summary |
| size | number | Yes | `10` | Size to close (≤ current position size) |

**Example Input**
```json
{
  "underlying_asset": "ETH",
  "from_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "option_token_id": "opt_0xabc123",
  "size": 10
}
```

**Example Output**
```json
{
  "unsigned_tx": {
    "to": "0xCallputRouterAddress",
    "data": "0xe5f3d2c1...",
    "value": "0",
    "chain_id": 8453
  },
  "realized_pnl_estimate_usd": 65.00,
  "request_key_preview": "req_close_0x555..."
}
```

**Key Output Fields**
- `unsigned_tx` — Sign and broadcast to close the position
- `realized_pnl_estimate_usd` — Estimated profit/loss at current mark

**When to Use** — Close a position when: (1) `days_to_expiry < 1` (avoid expiration risk), or (2) `close_pnl_est_pct > 50%` (take profit). Sign and broadcast the tx, then call `get_request_key_from_tx` with the close tx hash to get the close request_key (pass `is_open=false` to `check_request_status`).

---

## 7. callput_settle_position

**Purpose** — Build an unsigned transaction to settle an expired position and collect the payout.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| underlying_asset | string | Yes | `"ETH"` | Asset of the position |
| option_token_id | string | Yes | `"opt_0xabc123"` | Token ID from portfolio_summary |

**Example Input**
```json
{
  "underlying_asset": "ETH",
  "option_token_id": "opt_0xabc123"
}
```

**Example Output**
```json
{
  "unsigned_tx": {
    "to": "0xCallputSettlerAddress",
    "data": "0xf2e1d3c4...",
    "value": "0",
    "chain_id": 8453
  },
  "payout_estimate_usd": 100.00,
  "request_key_preview": "req_settle_0x666..."
}
```

**Key Output Fields**
- `unsigned_tx` — Sign and broadcast to settle the position
- `payout_estimate_usd` — Estimated USDC received at settlement (intrinsic value)

**When to Use** — Only for expired positions (`days_to_expiry ≤ 0`). Once expiry is reached, the position must be settled to collect the final payout. Sign and broadcast the tx, then track with `get_request_key_from_tx` (is_open=false).

---

## 8. callput_list_positions_by_wallet

**Purpose** — Recover all request_keys from on-chain GenerateRequestKey events; essential for session recovery and P&L restoration.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| address | string | Yes | `"0x742d..."` | Your wallet address |
| from_block | number | No | `100000` | Start block for event lookup; default ~50k blocks back (~1 day on Base) |

**Example Input**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "from_block": 15000000
}
```

**Example Output**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "open_request_keys": [
    "req_0x999aaabbbcccdddeeefff",
    "req_0xaaa111bbb222ccc333ddd"
  ],
  "close_request_keys": [
    "req_close_0x555eeeffggg666"
  ],
  "total_open": 2,
  "total_closed": 1
}
```

**Key Output Fields**
- `open_request_keys` — Request keys for open positions; pass to `portfolio_summary` for P&L
- `close_request_keys` — Request keys for closed positions; can verify with `check_request_status(is_open=false)`
- `total_open`, `total_closed` — Counts of open and closed positions

**When to Use** — Use after session loss or restart to restore all request_keys. Lower `from_block` to search further back in history (useful for older positions). Pass the returned `open_request_keys` to `portfolio_summary` to restore full P&L tracking.

---

## 9. callput_get_settled_pnl

**Purpose** — Query SettlePosition events to retrieve realized P&L from settled positions.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| address | string | Yes | `"0x742d..."` | Your wallet address |
| from_block | number | No | `100000` | Start block for event lookup; default ~50k blocks back (~1 day on Base) |

**Example Input**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "from_block": 15000000
}
```

**Example Output**
```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f9bEb",
  "settled_positions": [
    {
      "option_token_id": "opt_0xabc123",
      "underlying_asset": "ETH",
      "option_type": "Call",
      "strike": 2100,
      "expiry_date": "2026-03-28",
      "amount_out_usd": 100.00,
      "settlement_timestamp": 1711270800
    }
  ]
}
```

**Key Output Fields**
- `amount_out_usd` — Gross USDC received at settlement (intrinsic value)
- `option_token_id`, `underlying_asset`, `option_type`, `strike` — Position details
- `settlement_timestamp` — When the position settled

**Realized P&L Calculation** — Realized P&L = `amount_out_usd` - `entry_cost_usd` (from portfolio_summary). For a sold spread, subtract the credit received. Track over time to monitor total realized gains/losses.

**When to Use** — Call after settling positions to verify payouts and compute realized P&L. Combine with `portfolio_summary` entry_cost to calculate net profit/loss per settled position. Lower `from_block` to look further back in settlement history.

---

## 10. callput_get_option_chains

**Purpose** — Fetch raw tradable options from the Callput market feed; use only when you need detailed chain data or IV inspection.

**Input Parameters**

| Param | Type | Required | Example | Notes |
|-------|------|----------|---------|-------|
| underlying_asset | string | Yes | `"ETH"` | Asset symbol |
| option_type | enum | No | `"Call"` | Call or Put; if omitted, returns both |
| expiry_date | string | No | `"2026-04-30"` | Specific expiry (YYYY-MM-DD); if omitted, returns all |
| max_expiries | number | No | `3` | Limit expiries returned (1–5) |
| max_strikes | number | No | `10` | Limit strikes per expiry (2–30) |

**Example Input**
```json
{
  "underlying_asset": "ETH",
  "option_type": "Call",
  "expiry_date": "2026-04-30",
  "max_strikes": 10
}
```

**Example Output**
```json
{
  "underlying_asset": "ETH",
  "spot_price_usd": 2050.00,
  "chains": [
    {
      "expiry_date": "2026-04-30",
      "days_to_expiry": 38,
      "options": [
        {
          "option_id": "opt_0x123abc",
          "option_type": "Call",
          "strike": 2000,
          "bid_usd": 68.50,
          "ask_usd": 70.00,
          "mark_usd": 69.25,
          "iv": 0.62,
          "delta": 0.68,
          "gamma": 0.0015,
          "vega": 0.45,
          "theta": -0.12
        }
      ]
    }
  ]
}
```

**Key Output Fields**
- `spot_price_usd` — Current underlying asset price
- `iv` — Implied volatility; high IV (>0.6) favors selling, low IV favors buying
- `delta`, `gamma`, `vega`, `theta` — Greeks for Greeks-based analysis
- `bid_usd`, `ask_usd`, `mark_usd` — Pricing; bid-ask spread indicates liquidity

**When to Use** — Prefer `callput_scan_spreads` for normal trading (it returns pre-ranked spreads). Use `get_option_chains` only when you need raw IV data, delta, gamma analysis, or want to manually construct spreads outside the scan recommendations.

---

## Workflow Summary

1. **Discover** → `callput_scan_spreads` (by bias and asset)
2. **Execute** → `callput_execute_spread` (sign + broadcast tx)
3. **Track** → `callput_get_request_key_from_tx` (extract request_key)
4. **Poll** → `callput_check_request_status` (wait for execution)
5. **Monitor** → `callput_portfolio_summary` (view P&L, mark values)
6. **Close** → `callput_close_position` (before expiry or at +50% P&L)
7. **Settle** → `callput_settle_position` (after expiry)
8. **Recover** → `callput_list_positions_by_wallet` (after session loss)
9. **Verify** → `callput_get_settled_pnl` (confirm realized P&L)
10. **Debug** → `callput_get_option_chains` (raw chain data)

---

## Error Handling & Recovery

- **Lost request_key?** → Call `callput_list_positions_by_wallet` to recover all keys, then pass them to `portfolio_summary`.
- **Approval failed?** → If `usdc_approval.sufficient=false`, send the `approve_tx` first, then retry `execute_spread`.
- **Position not closed after 3 min?** → Stop polling; check transaction status on-chain (may have failed), retry manually.
- **Expired position stranded?** → Call `settle_position` to collect final payout.

---

**Version**: 0.2.0
**Network**: Base (Chain ID 8453)
**Last Updated**: March 2026
