---
name: drb-whale
description: Track DRB holdings, percentage of supply held, and recent DRB acquired across the last 3 transactions formatted as a tweet-ready report for wallet 0x0593b094c43e15669f0f22628ab6cb7d670578f0 on Base.
---

# DRB Whale Tracker

Track DRB holdings and recent accumulation for wallet `0x0593b094c43e15669f0f22628ab6cb7d670578f0` on Base in a clean, tweet-ready format.

## Workflow

1. **Check DRB Holdings**:
   - Call `get_user_balances` for `0x0593b094c43e15669f0f22628ab6cb7d670578f0` on `base`.
   - Filter strictly for DRB (`0x3ec2156d4c0a9cbdab4a016633b7bcf6a8d68ea2`).
   - Calculate DRB balance, USD valuation, and percentage of total supply held (total supply: 100,000,000,000 DRB).
   - Ignore all non-DRB tokens and secondary dust.

2. **Last 3 Transactions DRB Acquired & Elapsed Time**:
   - Call `get_chain_activity_for_wallet` for `0x0593b094c43e15669f0f22628ab6cb7d670578f0` on `base`.
   - Filter for the last 3 incoming DRB transfers.
   - Calculate total DRB tokens acquired and total USD value across those 3 transactions.
   - Calculate how many hours ago from current time those transactions occurred (e.g. 15 to 16 hours ago).

3. **Output Format**:
   Always format the final response strictly in this tweet-ready template:

wallet watch: 0x0593b094c43e15669f0f22628ab6cb7d670578f0 on base

holdings:
• {balance}b drb (${usdValue}m)
• {percentSupply}% of total 100b supply

recent accumulation:
• +{recentAcquired}m drb (${recentUsdValue}k) across last 3 txs
• acquired {hoursRange} hours ago
