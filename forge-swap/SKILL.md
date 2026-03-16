---
name: forge-swap
description: Non-custodial cross-chain swaps via THORChain. Use when the user wants to swap crypto across chains (ETH→BTC, BTC→RUNE, RUNE→ETH, etc.), get a swap quote, check supported assets, or route a cross-chain transaction without giving up custody. FORGE earns a 0.5% affiliate fee on every swap — embedded in the THORChain memo. No API key needed. No custody. Swaps settle on-chain.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚒️",
        "homepage": "https://forge-api-production-50de.up.railway.app",
        "requires": { "bins": ["curl"] },
      },
  }
---

# FORGE — Cross-Chain Swap Agent

Non-custodial cross-chain swaps powered by THORChain. Get quotes, execute swaps, check supported assets — all without giving up custody of your funds.

**Live API:** `https://forge-api-production-50de.up.railway.app`  
**Built by:** MoreBetter Studios (@morebetterclaw)  
**Affiliate:** `forgemb` (embedded in all swap memos — 0.5% fee)

---

## What It Does

FORGE routes swaps through THORChain — the leading decentralised cross-chain liquidity protocol. No wrapped assets. No bridges. Native swaps between BTC, ETH, RUNE, AVAX, BNB, DOGE, and more.

- **Non-custodial** — you sign and send from your own wallet
- **Quote first** — always get a quote before executing
- **On-chain settlement** — funds go directly to your destination address
- **No API key needed** — public endpoints, open access

---

## Tools

### 1. Get a Swap Quote

```bash
curl -X POST https://forge-api-production-50de.up.railway.app/quote \
  -H "Content-Type: application/json" \
  -d '{
    "fromAsset": "ETH.ETH",
    "toAsset": "BTC.BTC",
    "amount": "0.1",
    "destinationAddress": "bc1q..."
  }'
```

Response includes: `expectedOutput`, `minimumOutput`, `memo`, `inboundAddress`, `estimatedTime`

### 2. Execute a Swap

```bash
curl -X POST https://forge-api-production-50de.up.railway.app/swap \
  -H "Content-Type: application/json" \
  -d '{
    "fromAsset": "ETH.ETH",
    "toAsset": "BTC.BTC",
    "amount": "0.1",
    "destinationAddress": "bc1q...",
    "slippageBps": 100
  }'
```

Response includes: `memo`, `inboundAddress`, `amountIn` — send this transaction from your wallet to execute.

### 3. List Supported Assets

```bash
curl https://forge-api-production-50de.up.railway.app/assets
```

Returns all supported assets with chain, ticker, and minimum swap amounts.

### 4. Service Status

```bash
curl https://forge-api-production-50de.up.railway.app/health
```

---

## MCP Integration

FORGE exposes a native MCP server for AI agent use:

```json
{
  "mcpServers": {
    "forge": {
      "url": "https://forge-api-production-50de.up.railway.app/mcp",
      "transport": "streamable-http"
    }
  }
}
```

MCP tools: `forge_quote`, `forge_execute`, `forge_assets`, `forge_status`

Discovery: `https://forge-api-production-50de.up.railway.app/.well-known/mcp.json`

---

## How Swaps Work

1. **Get a quote** → FORGE queries THORChain for route + slippage
2. **Review** → check `expectedOutput` and `minimumOutput`
3. **Send funds** → transfer `amountIn` to `inboundAddress` with `memo` in the transaction data
4. **Settle** → THORChain routes the swap; funds arrive at `destinationAddress` on-chain

> ⚠️ Always verify the inbound address and memo from the quote response before sending funds.

---

## Supported Chains (via THORChain)

BTC · ETH · AVAX · BNB · DOGE · GAIA (ATOM) · LTC · BCH · RUNE

---

## Natural Language Usage

Once installed, your agent understands:

- *"Swap 0.1 ETH to BTC, send to bc1q..."*
- *"Get me a quote for 500 RUNE to ETH"*
- *"What chains does FORGE support?"*
- *"Is FORGE online?"*

---

## Source

GitHub: [github.com/morebetterclaw/forge](https://github.com/morebetterclaw/forge)  
ClawHub: `forge-swap` by `@morebetterclaw`
