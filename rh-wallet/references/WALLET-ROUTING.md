# Wallet routing — which skill for which request

**Mandatory.** Wrong routing causes trades on the wrong wallet (e.g. HOODIE on Robinhood Chain instead of Robinhood Crypto).

## Decision table

| User says | Contract `0x…`? | Pair like `BTC-USD`? | Route |
|-----------|-----------------|----------------------|--------|
| Robinhood Crypto, RH wallet, rh-wallet | No | Yes or implied | **rh-wallet** (this skill) |
| Buy HOODIE, memecoin on chain | **Yes** | No | **Bankr onchain** — NOT rh-wallet |
| hood.markets, Robinhood Chain deploy | Often yes | No | **hoodmarkets** skill — NOT rh-wallet |
| AAPL, stocks, agentic account | No | Stock ticker | **Robinhood Agentic MCP** — NOT rh-wallet |
| “My wallet” (ambiguous) | — | — | **Ask:** Robinhood Crypto (USD) vs onchain vs stocks |

## rh-wallet handles

- Robinhood **Crypto** account (US)
- Listed pairs: `BTC-USD`, `ETH-USD`, `SOL-USD`, etc.
- USD **buying power** on Robinhood Crypto
- Market buy/sell via gateway

## rh-wallet does NOT handle

- Token contract addresses (`0xC72c…`) → Bankr onchain / hoodmarkets
- Robinhood **Chain** L2 tokens → hoodmarkets or Bankr onchain
- **Stocks / ETFs** → [Robinhood Agentic MCP](https://agent.robinhood.com/mcp/trading) (separate OAuth setup)
- Deposits / ACH → Robinhood app only

## If user mentions “rh-wallet” but gives a contract address

**Stop.** Reply:

> That token uses a contract address — rh-wallet only trades Robinhood Crypto **pairs** (e.g. ETH-USD). For onchain tokens on Robinhood Chain, use Bankr’s onchain wallet or the hoodmarkets skill.

Do **not** silently route to onchain and claim it was Robinhood Crypto.
