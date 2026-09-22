# Market Research Reference

Prices, market data, charts, trending tokens, technical analysis, sentiment and holder snapshots through the agent, plus token lookups from the CLI. Research is informational, not investment advice.

## CLI

```bash
bankr tokens search PEPE                  # by name, symbol or address
bankr tokens search BNKR --chain 8453     # --chain takes a numeric chain ID (default Base, 8453)
bankr tokens info 0x...                   # name, symbol, decimals, price for a contract address
```

## Agent

```
"What's the price of ETH?"                "Market cap and volume for BNKR"
"Show me a 30-day chart for BNKR"         "Compare ETH vs SOL"
"What tokens are trending on Base?"       "Top gainers in the last 24 hours"
"New pools on Base"                       "What is the contract for PEPE on Base?"
"Do technical analysis on ETH"            "Twitter sentiment for PEPE"
"What are the trending Bankr launches?"   "Where can I trade gold?"
```

- **Name the chain** for on-chain queries — holders, trading pairs, new pools and chain-specific trending need one.
- **Bankr-launched tokens:** questions about the Bankr ecosystem (trending, newest or biggest Bankr launches, or finding one by name) are answered from Bankr's own launch feed — the same data as [bankr.bot/terminal/discover](https://bankr.bot/terminal/discover) — not from generic market categories.
- **Stocks and commodities:** asking about one ("where can I trade gold?") returns its candidates across venues — tokenized spot and Hyperliquid perps, plus Avantis for commodities — so name the venue when you act on it. See [tokenized-stocks.md](tokenized-stocks.md).
- **Bankr Club:** technical analysis, social sentiment and web search need Bankr Club in chat, but are open to every Agent API (`/agent/prompt`) request. Bankr scores, the score leaderboard and trading PnL / volume analytics are Club-only everywhere.

## Token holders

Ask for a token's holders to get them largest-first with **USD value** and **percentage of supply**, plus a concentration summary. It needs a contract address and a chain.

```
"who are the top holders of 0x... on base?"
"list holders of 0x... on solana with at least $50"
```

- Set a **minimum USD value** to bound the snapshot by value rather than by count — the shape you want for airdrop targeting ("holders with $50+").
- The list is the **raw on-chain holder set**: liquidity pools, the token contract and treasuries are included and are often the largest entries. Exclude them before paying anyone out.
- A read returns at most 1,000 holders and says when it was truncated with more holders still qualifying.
