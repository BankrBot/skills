# x402 Protocol Integration

## Overview

AsterPay uses the x402 HTTP payment protocol for its Data API. This enables pay-per-call access without API keys — agents pay with USDC on Base for each request.

## How x402 Works

The x402 protocol adds a payment layer to HTTP requests:

```
1. Agent sends GET request to AsterPay API
2. Server responds with 402 Payment Required
   → Includes payment details (amount, address, network)
3. Agent signs USDC payment on Base
4. Agent resends request with payment proof in header
5. Server validates payment and returns data
```

## Integration with Bankr

Bankr agents can interact with x402-protected endpoints using the arbitrary transaction feature:

```bash
# AsterPay x402 API base URL
API_BASE="https://x402-api-production-ba87.up.railway.app"

# Discover available endpoints
curl "$API_BASE/discovery/resources"

# Pay-per-call via x402 (handled automatically by x402-compatible clients)
curl -H "X-402-Payment: <signed_payment>" "$API_BASE/api/market-data?symbol=ETH"
```

## Payment Details

| Parameter | Value |
|-----------|-------|
| Network | Base (Chain ID: 8453) |
| Token | USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913) |
| Cost per call | $0.001 USDC |
| Facilitator | Coinbase CDP |
| Protocol | x402 (HTTP 402) |

## Available Endpoints

All endpoints follow the pattern: `GET /api/<endpoint>?symbol=<TOKEN>`

Cost: $0.001 USDC per call via x402 protocol.

### Market Data
```
GET /api/market-data?symbol=BTC
→ Price, 24h volume, market cap, 24h change
```

### Sentiment Analysis
```
GET /api/sentiment?symbol=ETH
→ Social sentiment score, volume, trending topics
```

### DeFi Analytics
```
GET /api/defi-analytics?protocol=AAVE
→ TVL, yield rates, risk metrics
```

### Price History
```
GET /api/price-history?symbol=BTC&period=7d
→ OHLCV data for specified period
```

## MCP Server Alternative

For Cursor, Claude, and other AI tools, AsterPay also provides an MCP server:

```json
{
  "mcpServers": {
    "asterpay": {
      "command": "npx",
      "args": ["@asterpay/mcp-server"]
    }
  }
}
```

This provides the same data API with automatic x402 payment handling.

## Resources

- **npm**: https://npmjs.com/package/@asterpay/mcp-server
- **Live API**: https://x402-api-production-ba87.up.railway.app/discovery/resources
- **x402 Protocol Spec**: https://www.x402.org
