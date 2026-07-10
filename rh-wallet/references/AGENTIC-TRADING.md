# Robinhood Agentic Trading (stocks) — separate from rh-wallet

**rh-wallet = Robinhood Crypto (BTC, ETH, …).**  
**Agentic MCP = Robinhood stocks (AAPL, …) in a dedicated Agentic account.**

## Agentic MCP endpoint

```
https://agent.robinhood.com/mcp/trading
```

Connect via Bankr native MCP (not env vars). OAuth in browser on desktop. Fund a separate **Agentic** account.

Docs: [Robinhood Agentic Trading overview](https://robinhood.com/us/en/support/articles/agentic-trading-overview/)

## Env vars

**None for Agentic.** No `RH_API_KEY` / `RH_PRIVATE_KEY_BASE64` for stocks.

## When user asks for stocks

1. Do **not** use rh-wallet curl helpers.
2. Use connected MCP tools (`robinhood-trading`) if configured.
3. If MCP not connected, tell user to add MCP URL in Bankr and complete OAuth.

## Read vs trade

Agentic MCP can **read** broader portfolio data; **writes** go to the Agentic account only per Robinhood policy.
