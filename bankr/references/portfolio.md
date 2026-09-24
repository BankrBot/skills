# Portfolio Reference

Balances, USD values, PnL and NFTs across every chain Bankr supports.

## CLI

```bash
bankr wallet portfolio                        # all chains; tokens under $1 hidden
bankr wallet portfolio --chain base,solana    # filter by chain (comma-separated)
bankr wallet portfolio --pnl                  # add profit/loss per token
bankr wallet portfolio --nfts                 # add NFT holdings
bankr wallet portfolio --all                  # PnL + NFTs
bankr wallet portfolio --low-value            # include tokens under $1
bankr wallet portfolio --json                 # raw JSON
```

`--chain` takes `base`, `polygon`, `mainnet`, `unichain`, `worldchain`, `arbitrum`, `bnb`, `robinhood`, `arc` and `solana`. PnL covers EVM tokens only; Solana rows carry no PnL.

## REST API

```bash
curl -s "https://api.bankr.bot/wallet/portfolio?chains=base,solana&include=pnl,nfts&showLowValueTokens=true" \
  -H "X-API-Key: $BANKR_API_KEY"
```

Any active API key works, read-only keys included. PnL and NFTs are fetched only when `include` asks for them, and PnL is EVM-only. Response schema: [portfolio docs](https://docs.bankr.bot/wallet-api/portfolio) and the [OpenAPI spec](https://docs.bankr.bot/openapi/api.yaml).

- **Exact amounts:** `token.balance`, `nativeBalance`, `nativeUsd` and `total` are exact decimal **strings** (never rounded, never scientific notation). Parse them with a decimal-safe library before building a max-size trade.
- **Partial-failure resilient:** a chain's native balance and its token list are fetched independently, so a token-indexer failure still returns the native balance instead of reporting the wallet empty.
- Wrapping or unwrapping the native token (ETH ↔ WETH and equivalents) shows up in both balances on the next read.

## Low-value tokens are filtered

**A balance list is filtered by default — never read it as the whole wallet.**

- The CLI and REST API hide tokens worth under **$1** unless you pass `--low-value` / `showLowValueTokens=true`.
- The agent applies the wallet's own hide-low-value setting (the web portfolio's toggle), so chat shows the same holdings as the web. Its reply says how many low-value tokens it hid, and its USD totals cover only the rows shown. Ask for "all my tokens, including dust" to see everything.
- Never hidden: native gas balances, tokens launched through Bankr (even without a market price), and tokens you acquired that no source can price yet.

## Selling and transferring by ticker

Sells and transfers resolve a ticker against **what you actually hold**, with no USD floor — "sell all my WOLF for ETH" finds the WOLF in your wallet, however small, even though it wouldn't show in a filtered balance list. Holdings are the candidate set, not the answer: when several of your tokens on the chain match, the agent lists your contracts and balances to choose from; when none match, it falls back to the global search (so buying a token you don't hold yet is unaffected). Security checks run on whichever contract is selected.

## Prompt examples

- "Show my portfolio" / "What's my net worth?"
- "What tokens do I have on Polygon?"
- "Show my ETH across all chains"
- "Show my portfolio with PnL"
- "Show all my tokens, including dust"
