---
name: arcadia-finance
description: Manage concentrated liquidity positions on Uniswap and Aerodrome via Arcadia Finance. Use when the user wants to deploy LP positions, add or remove liquidity, rebalance positions, set up automated compounding, borrow against LP collateral, manage yield optimization, or use leverage on Base or Unichain. Returns unsigned transactions for safe wallet signing.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🏛️",
        "homepage": "https://arcadia.finance",
        "requires": { "bins": ["node"] },
      },
  }
---

# Arcadia Finance

Manage concentrated liquidity positions on Uniswap and Aerodrome with automated rebalancing, compounding, yield optimization, and optional leverage. Supported chains: Base (8453), Unichain (130).

## Quick Start

### Check Your Positions

```
What are my Arcadia accounts for 0x...?
```

### Deploy a New LP Position

```
Show me the best Arcadia strategies for WETH/USDC on Base
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

### Borrow Against LP Collateral

```
Borrow 500 USDC against my Arcadia account 0x...
```

### Close a Position

```
Close my Arcadia account 0x... and withdraw everything as USDC
```

## CLI Usage

```bash
node scripts/arcadia.mjs <tool_name> '<json_args>'
node scripts/arcadia.mjs --list
```

The `@modelcontextprotocol/sdk` dependency is required:

```bash
npm install @modelcontextprotocol/sdk
```

## Read Operations

```bash
# List all accounts for a wallet
node scripts/arcadia.mjs read_wallet_accounts '{"wallet_address":"0x..."}'

# Account details (health factor, collateral, debt, positions)
node scripts/arcadia.mjs read_account_info '{"account_address":"0x..."}'

# Featured LP strategies with APY
node scripts/arcadia.mjs read_strategy_list '{"featured_only":true}'

# Lending pools (TVL, APY, utilization)
node scripts/arcadia.mjs read_pool_list '{}'

# Available automations (rebalancer, compounder, yield claimer)
node scripts/arcadia.mjs read_asset_manager_intents '{}'

# Workflow guides
node scripts/arcadia.mjs read_guides '{"topic":"overview"}'
```

## Write Operations

All write tools return unsigned transactions `{ to, data, value, chainId }`. See `references/wallet-signing.md` for how to sign and broadcast.

```bash
# Open LP position (deposits + swaps + mints LP atomically)
node scripts/arcadia.mjs write_account_add_liquidity '{"account_address":"0x...","wallet_address":"0x...","positions":[{"strategy_id":123}],"deposits":[{"asset":"0x...","amount":"1000000","decimals":6}]}'

# Close position (burn LP + swap + repay in one tx)
node scripts/arcadia.mjs write_account_close '{"account_address":"0x...","assets":[...],"receive_assets":[...]}'

# Enable automation
node scripts/arcadia.mjs write_asset_manager_rebalancer '{"dex_protocol":"slipstream"}'
node scripts/arcadia.mjs write_account_set_asset_managers '{"account_address":"0x...","asset_managers":[...],"statuses":[...],"datas":[...]}'
```

## Common Workflows

### First-Time User

1. **Browse strategies**: "Show me Arcadia strategies on Base"
2. **Create account**: "Create an Arcadia account on Base"
3. **Deposit and LP**: "Open an LP position using 1000 USDC on the WETH/USDC strategy"
4. **Enable automation**: "Enable the rebalancer on my account"

### Leverage Farming

1. **Open position**: "Open an LP position on Arcadia with 1000 USDC"
2. **Borrow**: "Borrow 500 USDC against my Arcadia account"
3. **Add more liquidity**: "Add the borrowed USDC as liquidity"
4. **Monitor health**: "What's the health factor on my account?"

### Yield Optimization

1. **Check automations**: "What automations are available on Arcadia?"
2. **Enable compounder**: "Set up compounding on my account"
3. **Enable yield claimer**: "Enable the yield claimer on my account"
4. **Check PnL**: "Show my Arcadia account PnL"

## Safety

- Write tools return unsigned transactions only. Never auto-sign.
- Always confirm transaction details with the user before signing.
- Check account health factor with `read_account_info` before risky operations (borrow, deleverage).
- Do not pass private keys or secrets as tool arguments. Only public addresses and amounts are needed.

## Configuration

The CLI connects to `https://mcp.arcadia.finance/mcp` by default. Set `ARCADIA_MCP_URL` to override.

## References

- **[Contract Addresses](references/contracts.md)**: Protocol contracts, lending pools, key tokens
- **[Wallet Signing](references/wallet-signing.md)**: How to sign unsigned transactions
- **Full tool docs**: https://mcp.arcadia.finance/llms-full.txt
- **Website**: https://arcadia.finance
- **Docs**: https://docs.arcadia.finance
