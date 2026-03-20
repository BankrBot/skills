---
name: arcadia-finance
version: 1.0.0
description: DeFi liquidity management via Arcadia Finance. Use when the user wants to provide liquidity on Uniswap V3 or Aerodrome Slipstream, deploy concentrated LP positions, add or remove liquidity, set up automated rebalancing or compounding, borrow against LP collateral, manage yield farming, check PnL, use leverage, or optimize DeFi yields on Base or Unichain. Returns unsigned transactions for Bankr to sign and submit.
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

DeFi liquidity management on Uniswap V3 and Aerodrome Slipstream. Deploy concentrated LP positions with automated rebalancing, compounding, yield optimization, and optional leverage. Supported chains: Base (8453), Unichain (130).

## Quick Start

### Check Wallet Positions

First, discover the user's accounts from their wallet address:

```
What Arcadia accounts do I have?
```

Then inspect a specific account:

```
Show me the details of my Arcadia account 0x...
```

### Deploy a New LP Position

```
What are the best Arcadia strategies for WETH/USDC on Base?
```

```
Open an LP position on Arcadia using 1000 USDC on the WETH/USDC strategy
```

### Set Up Automation

```
Enable the rebalancer on my Arcadia account 0x...
```

```
Set up compounding on my Arcadia account
```

### Use Leverage

```
Borrow 500 USDC against my Arcadia account 0x...
```

```
What's the health factor on my Arcadia account?
```

### Close a Position

```
Close my Arcadia account 0x... and withdraw everything as USDC
```

## Capabilities

- **LP Management**: Create accounts, deposit collateral, open/close concentrated LP positions on Uniswap V3 and Aerodrome Slipstream
- **Automation**: Enable rebalancers, compounders, yield claimers, and CoW Swap-based yield harvesters per account
- **Leverage**: Borrow from lending pools against LP collateral, deleverage when needed
- **Monitoring**: Check health factor, PnL, collateral/debt breakdown, position history
- **Strategy Discovery**: Browse curated strategies with APY, get rebalancing recommendations
- **Lending Pools**: View TVL, utilization, borrow rates, available liquidity

## CLI Usage

```bash
scripts/arcadia.sh <tool_name> '<json_args>'
scripts/arcadia.sh --list
```

Requires: `curl`, `jq`. No npm dependencies.

## Read Operations

```bash
# Discover accounts from wallet address
scripts/arcadia.sh read_wallet_accounts '{"wallet_address":"0x..."}'

# Account details: health factor, collateral, debt, positions
scripts/arcadia.sh read_account_info '{"account_address":"0x..."}'

# Account PnL and yield earned
scripts/arcadia.sh read_account_pnl '{"account_address":"0x..."}'

# Featured LP strategies with APY (start here)
scripts/arcadia.sh read_strategy_list '{"featured_only":true}'

# Lending pools: TVL, APY, utilization, borrow rates
scripts/arcadia.sh read_pool_list

# Available automations and their parameters
scripts/arcadia.sh read_asset_manager_intents

# Workflow guides
scripts/arcadia.sh read_guides '{"topic":"overview"}'
```

## Write Operations

All write tools return unsigned transactions `{ to, data, value, chainId }`. Submit via Bankr:

```bash
# Get unsigned tx, then sign and submit
TX=$(scripts/arcadia.sh write_account_deposit '{"account_address":"0x...","assets":[{"asset":"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913","id":0,"amount":"1000000"}]}')
bankr prompt "Submit this transaction: $TX"
```

```bash
# Open LP position (deposit + swap + mint LP atomically)
TX=$(scripts/arcadia.sh write_account_add_liquidity '{"account_address":"0x...","wallet_address":"0x...","positions":[{"strategy_id":123}],"deposits":[{"asset":"0x...","amount":"1000000","decimals":6}]}')
bankr prompt "Submit this transaction: $TX"
```

```bash
# Enable rebalancer automation
TX=$(scripts/arcadia.sh write_asset_manager_rebalancer '{"dex_protocol":"slipstream"}')
bankr prompt "Submit this transaction: $TX"
```

## Common Workflows

### First-Time User

1. **Browse strategies**: `scripts/arcadia.sh read_strategy_list '{"featured_only":true}'`
2. **Create account**: get tx from `write_account_create`, submit via Bankr
3. **Deposit and LP**: get tx from `write_account_add_liquidity`, submit via Bankr
4. **Enable automation**: get tx from `write_asset_manager_rebalancer`, submit via Bankr

### Leverage Farming

1. **Open position** with `write_account_add_liquidity`
2. **Borrow** with `write_account_borrow`
3. **Add more liquidity** with the borrowed funds
4. **Monitor** health factor via `read_account_info` (1 = no debt, 0 = liquidation)

### Yield Optimization

1. **Check available automations** via `read_asset_manager_intents`
2. **Enable compounder** via `write_asset_manager_compounder`
3. **Enable yield claimer** via `write_asset_manager_yield_claimer`
4. **Track** earnings via `read_account_pnl`

## Safety

- Write tools return unsigned transactions only. Bankr handles signing.
- Always confirm transaction details with the user before submitting.
- Check account health factor before borrow/deleverage operations. Higher = safer (1 = no debt, 0 = liquidation).
- Never pass private keys as tool arguments.

## Configuration

The CLI connects to `https://mcp.arcadia.finance/mcp` by default. Set `ARCADIA_MCP_URL` to override.

## Troubleshooting

**"Failed to connect"**: The MCP server at `mcp.arcadia.finance` is unreachable. Check your network or set `ARCADIA_MCP_URL` if using a local instance.

**"ERROR: ..."**: The MCP server returned an error. Common causes:
- Invalid account/wallet address (must be valid hex `0x...`)
- Missing required parameters (run `scripts/arcadia.sh --list` to see tool descriptions)
- Chain not supported (only Base 8453 and Unichain 130)

**Empty response from write tools**: The tool returned a transaction object. Pipe it to Bankr: `bankr prompt "Submit this transaction: $TX"`

**Rate limiting**: The server allows 60 requests per minute per session. Space out batch operations.

## References

- **[Contract Addresses](references/contracts.md)**: Protocol contracts, lending pools, key tokens
- **[Wallet Signing](references/wallet-signing.md)**: Transaction submission via Bankr
- **Full tool docs**: https://mcp.arcadia.finance/llms-full.txt
- **Website**: https://arcadia.finance
- **Docs**: https://docs.arcadia.finance
