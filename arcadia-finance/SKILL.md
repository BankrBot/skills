---
name: arcadia-finance
version: 1.1.0
description: DeFi liquidity management with Arcadia Finance. Use when the user wants to provide liquidity on Uniswap or Aerodrome, deploy concentrated LP positions, add or remove liquidity, set up automated rebalancing or compounding, borrow against LP collateral, lend single-sided into a lending pool, check PnL, use leverage, or optimize DeFi yields on Base, Unichain or Robinhood Chain. Returns unsigned transactions for Bankr to submit.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🏛️",
        "homepage": "https://arcadia.finance",
        "requires": { "bins": ["curl", "jq", "bankr"] },
      },
  }
---

# Arcadia Finance

Arcadia manages concentrated liquidity positions on Uniswap and Aerodrome with automated rebalancing, compounding, yield optimization and optional leverage. It also offers single-sided lending pools. Positions live in Arcadia accounts, which can borrow against their collateral.

Chains available through Bankr: Base (8453), Unichain (130), Robinhood Chain (4663). Arcadia is also live on Optimism (10), which Bankr cannot submit on.

## Requirements

- `curl`, `jq` and the `bankr` CLI, logged in.
- Arcadia write tools return raw calldata, so the Bankr wallet needs **Enable arbitrary contract calls** turned on, which requires MFA on the account. Without it Bankr rejects the submission.
- The wallet pays its own gas in the chain's native token. Raw submissions are not gas-sponsored.

## CLI usage

```bash
scripts/arcadia.sh --list
scripts/arcadia.sh <tool_name> '<json_args>'
```

The script calls `https://mcp.arcadia.finance/mcp`. Set `ARCADIA_MCP_URL` to use another endpoint.

## Read operations

```bash
# Accounts owned by a wallet
scripts/arcadia.sh read_wallet_accounts '{"wallet_address":"0x...","chain_id":8453}'

# Account detail: health factor, collateral, debt, positions
scripts/arcadia.sh read_account_info '{"account_address":"0x...","chain_id":8453}'

# PnL and yield earned
scripts/arcadia.sh read_account_pnl '{"account_address":"0x...","chain_id":8453}'

# Featured LP strategies with APY (start here)
scripts/arcadia.sh read_strategy_list '{"featured_only":true,"chain_id":8453}'

# Lending pools: TVL, APY, utilization
scripts/arcadia.sh read_pool_list '{"chain_id":8453}'

# Available automations
scripts/arcadia.sh read_asset_manager_intents '{"chain_id":8453}'

# Workflow guides
scripts/arcadia.sh read_guides '{"topic":"overview"}'
```

## Write operations

Every write tool returns a `transaction` object: `{ to, data, value, chainId }`. Extract it with `jq` and submit it through Bankr.

```bash
# Create an account
TX=$(scripts/arcadia.sh write_account_create '{"wallet_address":"0x...","salt":1,"chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"

# Approve a token before depositing from the wallet
TX=$(scripts/arcadia.sh write_wallet_approve '{"token_address":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","spender_address":"0x...","amount":"1000000","chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"

# Open an LP position (deposit, swap, mint LP and optional borrow in one transaction)
TX=$(scripts/arcadia.sh write_account_add_liquidity '{"account_address":"0x...","wallet_address":"0x...","positions":[{"strategy_id":123}],"deposits":[{"asset":"0x...","amount":"1000000","decimals":6}],"chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"

# Enable compounding and rebalancing on a position
TX=$(scripts/arcadia.sh write_account_automations '{"account_address":"0x...","position_id":12345,"intents":[{"kind":"compound_fees"},{"kind":"rebalance"}],"chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"
```

Batched tools (`write_account_add_liquidity`, `write_account_close`, `write_account_swap`, `write_account_deleverage`, `write_account_remove_liquidity`, `write_account_stake`) return calldata that expires in 30 to 60 seconds. Submit promptly. If it reverts on price movement, rebuild and retry once before splitting into single steps.

If `write_account_add_liquidity` returns price warnings and no transaction, show the warnings to the user. Call it again with `accept_price_checks` set to the returned list only after the user explicitly confirms. New warnings on a rebuild need a new confirmation.

## Single-sided lending

Deposit a pool's underlying asset into its lending tranche (ERC-4626) to earn borrower interest. Find `tranches[0].address` with `read_pool_list`, then approve the tranche.

```bash
TX=$(scripts/arcadia.sh write_pool_deposit '{"tranche_address":"0x...","assets":"10000000","receiver":"0x...","chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"

TX=$(scripts/arcadia.sh write_pool_redeem '{"tranche_address":"0x...","shares":"10000000","receiver":"0x...","owner":"0x...","chain_id":8453}' | jq -c .transaction)
bankr agent "Submit this transaction: $TX"
```

`write_pool_deposit` is for lenders. To put collateral into an account, use `write_account_deposit`.

## Safety

- Write tools return unsigned transactions only. Bankr signs and submits them.
- Confirm the transaction details with the user before submitting.
- Check the health factor with `read_account_info` before borrowing or deleveraging. Higher is safer: 1 means no debt, 0 means liquidation.
- Never pass private keys as tool arguments. Only public addresses and amounts are needed.
- Tool calls send public wallet and account addresses and transaction parameters to `mcp.arcadia.finance`. This is data that is already public onchain.

## Troubleshooting

- **Failed to connect**: `mcp.arcadia.finance` is unreachable. Check the network or `ARCADIA_MCP_URL`.
- **ERROR from a tool**: the message comes from the Arcadia server. Common causes are an invalid address, a missing parameter (run `scripts/arcadia.sh --list`) or an unsupported chain.
- **Bankr refuses the submission**: check the wallet's arbitrary contract calls switch, spend limits and permitted recipients.
- **Rate limit**: the server allows 600 requests per minute per client IP.

## References

- [Contract addresses](references/contracts.md)
- Full tool documentation: https://mcp.arcadia.finance/llms-full.txt
- Website: https://arcadia.finance
- Docs: https://docs.arcadia.finance
