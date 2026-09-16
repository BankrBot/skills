# Portfolio Reference

Query token balances and portfolio across all supported chains.

## CLI Commands

```bash
bankr wallet portfolio                    # Full portfolio (hides tokens under $1)
bankr wallet portfolio --pnl              # Include profit/loss data
bankr wallet portfolio --nfts             # Include NFT holdings
bankr wallet portfolio --all              # PnL + NFTs
bankr wallet portfolio --chain base       # Filter by chain
bankr wallet portfolio --chain base,solana  # Multiple chains
bankr wallet portfolio --json             # Raw JSON output
```

## REST API

```bash
# Basic portfolio
curl -s "https://api.bankr.bot/wallet/portfolio" \
  -H "X-API-Key: $API_KEY"

# With PnL and NFTs (progressive loading)
curl -s "https://api.bankr.bot/wallet/portfolio?include=pnl,nfts" \
  -H "X-API-Key: $API_KEY"

# Filter by chain
curl -s "https://api.bankr.bot/wallet/portfolio?chains=base,solana" \
  -H "X-API-Key: $API_KEY"
```

> **Deprecation notice**: `GET /agent/balances` still works but is deprecated. Use `GET /wallet/portfolio` instead.

The `/wallet/portfolio` endpoint is a read endpoint — any valid API key with a wallet can access it (no feature flags required).

## Supported Chains

All chains: Base, Polygon, Ethereum, Unichain, Solana, World Chain, Arbitrum, BNB Chain, Robinhood Chain

## Prompt Examples

**Full portfolio:**
- "Show my portfolio"
- "What's my total balance?"
- "How much crypto do I have?"
- "Portfolio value"
- "What's my net worth?"

**Chain-specific:**
- "Show my Base balance"
- "What tokens do I have on Polygon?"
- "Ethereum portfolio"
- "Solana holdings"

**Token-specific:**
- "How much ETH do I have?"
- "What's my USDC balance?"
- "Show my ETH across all chains"
- "BNKR balance"

## Features

- **USD Valuation**: All balances include current USD value
- **PnL Tracking**: Profit/loss data via `--pnl` or `?include=pnl`
- **NFT Holdings**: View NFTs via `--nfts` or `?include=nfts`
- **Progressive Loading**: Request only the data you need with `?include=` parameters
- **Multi-Chain Aggregation**: See the same token across all chains
- **Real-Time Prices**: Values reflect current market prices
- **Comprehensive View**: Shows all tokens with meaningful balances
- **Wrap/Unwrap Aware**: Wrapping and unwrapping the native token (ETH ↔ WETH and equivalents) updates both balances, so a portfolio read straight after an unwrap reflects it
- **Exact Balances**: token `balance` is the exact decimal amount in plain notation, carried as a string — never rounded, and never in scientific notation for very small or very large holdings. If you do arithmetic on it, parse it with a decimal-safe library rather than relying on a float
- **Partial-Failure Resilient**: the native balance and the token-list lookup are fetched independently per chain, so an indexer failure on the token side no longer takes the chain's native row down with it. A degraded chain returns the native balance it did retrieve rather than reporting the wallet as empty of it

## Low-Value Tokens Are Filtered

**A balance list you get back from the agent is filtered by default, and you must not read it as the whole wallet.** The agent's balance tools apply the same low-value rule as the web portfolio — the wallet's `showLowValueTokens` preference and its **$1** threshold — so a wallet holding airdrop dust on a thinly-indexed chain answers with its real holdings instead of a wall of `$0.00` rows.

What that means when you consume the result:

- **Native gas rows are never hidden.** "How much ETH do I have?" still answers on a near-empty wallet, whatever the balance is worth.
- **The filtering is reported, not silent.** A filtered response carries `hiddenLowValueTokens` — a count of what was dropped — so "the list didn't mention token X" is never evidence the wallet doesn't hold it. Check the count before concluding anything about absence.
- **Ask for everything explicitly** with `includeLowValueTokens` when you genuinely need the full list (dust sweeps, auditing an airdrop, reconciling against an indexer).
- **Trading paths are unfiltered.** Swap and transfer resolution reads balances directly, so a token too small to show in a balance listing is still sellable and transferable — see below.

## Selling and Transferring by Ticker

Ticker resolution for sells and transfers runs against **what you actually hold**, with no USD floor, so a holding worth a few cents resolves the same way a large one does. "Sell all my WOLF for ETH" finds the WOLF in your wallet rather than falling through to a global market-cap search that doesn't know what you own.

Holdings form the *candidate set*, not the answer — an airdropped token sharing a real one's symbol can't win by being held. If several tokens on the chain match the ticker you named, the agent returns a disambiguation listing **your own contracts and balances** to choose from. If none match, it falls back to the global search, so buying a token you don't yet hold is unchanged. Security checks run on whichever contract is finally selected.

## Common Tokens Tracked

- **Stablecoins**: USDC, USDT, DAI
- **Blue Chips**: ETH, WETH, WBTC
- **DeFi**: UNI, AAVE, LINK, COMP, CRV
- **Memecoins**: DOGE, SHIB, PEPE, BONK
- **Project tokens**: BNKR, ARB, OP, MATIC

## Use Cases

**Before trading:**
- "Do I have enough ETH to swap for 100 USDC?"
- "Check if I have MATIC for gas on Polygon"

**Portfolio review:**
- "What's my largest holding?"
- "Show portfolio breakdown by chain"
- "What percentage of my portfolio is stablecoins?"

**After transactions:**
- "Did my ETH arrive?"
- "Show my new BNKR balance"
- "Verify the swap completed"

## Output Format

Portfolio responses typically include:
- Token name and symbol
- Amount held
- Current USD value
- Chain location
- Price per token
- 24h price change

## Notes

- Portfolio queries are read-only (no transactions) — any valid API key works
- Shows balance of connected wallet address
- Tokens valued under $1 are hidden by default in CLI output
- Includes native tokens (ETH, MATIC, SOL) and ERC20/SPL tokens
- PnL and NFT data use progressive loading — only fetched when requested, keeping base queries fast
