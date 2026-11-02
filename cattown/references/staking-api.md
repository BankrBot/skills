# Cat Town Staking API

Two public JSON endpoints served from `https://api.cat.town`. **No authentication** — plain GET, no headers required.

Use these when you need leaderboard or historical-deposit data without paying RPC costs. For live position reads (current stake, pending rewards, unlock state), go onchain — see [staking.md](staking.md).

**Units: every KIBBLE amount in these responses is a whole-KIBBLE decimal string, not wei.** `"10000000"` means 10,000,000 KIBBLE. Parse with BigInt / big-number and display as-is; do not divide by 1e18.

---

## `GET /v2/revenue/staking/leaderboard`

The **top 100** stakers by stake amount, plus pool totals computed across all stakers.

### Response

```json
{
  "success": true,
  "leaderboard": [
    {
      "user_address": "0x8ff7acccf73c515c1f62fc7b64a63f17ce99659e",
      "staked_amount": "10000000",
      "share_percentage": "13.58",
      "active": true,
      "rank": 1,
      "basename": "baronbot.base.eth",
      "equipment": { "cat": "black-and-white", "hat": "graduation-cap" }
    }
  ],
  "summary": {
    "total_stakers": 100,
    "total_staked": "73860099",
    "total_active_staked": "73591781"
  }
}
```

### Field meanings

| Field                            | Type    | Notes                                                          |
|----------------------------------|---------|----------------------------------------------------------------|
| `leaderboard[].user_address`     | hex     | Staker's wallet, lowercased.                                   |
| `leaderboard[].staked_amount`    | string  | Whole KIBBLE.                                                  |
| `leaderboard[].share_percentage` | string  | Percentage of the active pool, as a decimal string (e.g. `"12.34"` = 12.34%). `"0.00"` for unlocking users. |
| `leaderboard[].active`           | bool    | `false` if the user is currently in an `unlock()` window (not earning). |
| `leaderboard[].rank`             | number  | 1-indexed rank. Sort by this.                                  |
| `leaderboard[].basename`         | string? | Basename (human-readable handle), or `null`.                   |
| `leaderboard[].equipment`        | object  | The player's cat cosmetics (slot → sprite). Ignore unless rendering avatars. |
| `summary.total_stakers`          | number  | **Number of rows returned, capped at 100** — not the real staker count. |
| `summary.total_staked`           | string  | All staked KIBBLE across every staker, whole KIBBLE (includes unlocking users). |
| `summary.total_active_staked`    | string  | KIBBLE currently earning rewards across every staker, whole KIBBLE. |

A wallet outside the top 100 will not appear. Read its position onchain (`getUserStaked`, `isUnlocking`) instead of reporting "not staked".

### Caching

Cat Town's frontend requests with `Cache-Control: no-cache, no-store, must-revalidate`. Treat this as near-live but not instant. For a second-accurate balance, use the onchain `getUserStaked` / `getTotalActiveStaked` reads.

---

## `GET /v2/revenue/deposits/{address}`

Every fishing / gacha deposit, newest first, with this user's share of each, plus a summary.

### Response

```json
{
  "success": true,
  "deposits": [
    {
      "transaction_hash": "0xd07e7bab042d3cc622e4893d88c059c6a019af796659abca91bac34d2fad987e",
      "block_number": 53409630,
      "source": "Fishing",
      "deposit_timestamp": "2026-11-02T08:36:45+00:00",
      "deposit_amount": "69542",
      "new_acc_reward_per_share": 473005933824,
      "total_active_staked": "73627835",
      "user_share_amount": "9445",
      "user_share_percentage": "13.58"
    }
  ],
  "summary": {
    "total_revenue": "29266382",
    "total_user_share": "2382641",
    "user_wallet": "0x8ff7acccf73c515c1f62fc7b64a63f17ce99659e",
    "current_total_staked": "41861971",
    "current_total_active_staked": "41656278"
  }
}
```

### Field meanings

| Field                                     | Type    | Notes                                                          |
|-------------------------------------------|---------|----------------------------------------------------------------|
| `deposits[].transaction_hash`             | hex     | The `depositRevenue` tx hash — use as a stable key.            |
| `deposits[].block_number`                 | number  | Block the deposit landed in.                                   |
| `deposits[].source`                       | string  | `"Fishing"` or `"Gacha"` today (`"daycare"` reserved, not yet active). **Compare case-insensitively.** |
| `deposits[].deposit_timestamp`            | ISO8601 | When the `RevenueDeposited` event fired.                       |
| `deposits[].deposit_amount`               | string  | Total KIBBLE added to the pool for this deposit, whole KIBBLE. |
| `deposits[].new_acc_reward_per_share`     | number  | Value of `accRewardPerShare` (scaled 1e12) right after this deposit. |
| `deposits[].total_active_staked`          | string  | Active pool size at the moment of deposit, whole KIBBLE — lets you verify `user_share_amount` math. |
| `deposits[].user_share_amount`            | string? | This user's share of the deposit, whole KIBBLE. **Omitted** (not `"0"`) if the user was unlocking or not staked at the time. |
| `deposits[].user_share_percentage`        | string? | This user's share of the active pool at that deposit, e.g. `"13.58"`. Omitted with `user_share_amount`. |
| `summary.total_revenue`                   | string  | Sum of `deposit_amount` across all returned deposits, whole KIBBLE. |
| `summary.total_user_share`                | string  | Sum of `user_share_amount` across all returned deposits, whole KIBBLE. This is the user's all-time earnings from staking. |
| `summary.current_total_staked`            | string  | **Unreliable — undercounts.** Computed from a query without a row limit, so it stops at the first 1,000 stakers. Use the leaderboard summary or the onchain read. |
| `summary.current_total_active_staked`     | string  | **Unreliable — undercounts**, same reason.                     |

### Deduplication

If the same `transaction_hash` appears twice (can happen due to backend replays), prefer the row that has a `user_share_amount`.

### Sources

- `Fishing` — weekly, deposited by 12:00 UTC Monday. 10% of the KIBBLE spent identifying fish during the weekend competition.
- `Gacha` — weekly, deposited by 12:00 UTC Wednesday.
- `daycare` — not yet implemented; may appear in future responses.

---

## Typical agent use cases

- **"Where do I rank?"** → `GET /v2/revenue/staking/leaderboard`, find the user by `user_address` (lowercase compare), report `rank` and `share_percentage`. Not in the list → they're outside the top 100; read their stake onchain.
- **"How much have I earned?"** → `GET /v2/revenue/deposits/{address}`, return `summary.total_user_share` (already whole KIBBLE).
- **"When was the last drop?"** → `GET /v2/revenue/deposits/{address}`, take `deposits[0].deposit_timestamp` (newest first).
- **"Show me last month's fishing vs gacha split."** → filter `deposits` by `source` (case-insensitive) and sum `user_share_amount`, treating a missing value as 0.
