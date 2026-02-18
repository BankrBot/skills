#!/bin/bash
# Query AsterPay Data API via x402 protocol
# Usage: ./api-query.sh <endpoint> <symbol>
# Example: ./api-query.sh market-data BTC

ENDPOINT=$1
SYMBOL=$2
API_BASE="https://x402-api-production-ba87.up.railway.app"

# Validate ENDPOINT: alphanumeric and hyphens only (prevents path traversal and URL injection)
if [ -n "$ENDPOINT" ] && ! echo "$ENDPOINT" | grep -qE '^[a-zA-Z0-9-]{1,64}$'; then
  echo "Error: Invalid endpoint name. Use alphanumeric characters and hyphens only."
  echo "Run './api-query.sh' without arguments to see available endpoints."
  exit 1
fi

# Validate SYMBOL: alphanumeric, hyphens, underscores only (prevents query injection)
if [ -n "$SYMBOL" ] && ! echo "$SYMBOL" | grep -qE '^[a-zA-Z0-9_-]{1,32}$'; then
  echo "Error: Invalid symbol/protocol name. Use alphanumeric characters, hyphens, and underscores only."
  exit 1
fi

if [ -z "$ENDPOINT" ]; then
  echo "Usage: ./api-query.sh <endpoint> [symbol]"
  echo ""
  echo "Available endpoints (\$0.001 USDC per call via x402):"
  echo ""
  echo "  market-data <symbol>      Real-time price, volume, market cap"
  echo "  sentiment <symbol>        Social sentiment analysis"
  echo "  defi-analytics <protocol> Protocol TVL, yields, risk metrics"
  echo "  price-history <symbol>    Historical OHLCV data"
  echo "  whale-tracking <symbol>   Large transaction monitoring"
  echo "  gas-tracker               Multi-chain gas prices"
  echo "  token-metrics <symbol>    On-chain token analytics"
  echo "  liquidity-scan <symbol>   DEX liquidity depth"
  echo "  correlation               Cross-asset correlation"
  echo "  volatility <symbol>       Historical/implied volatility"
  echo "  funding-rates <symbol>    Perpetual futures funding"
  echo "  on-chain-flow <symbol>    Exchange inflow/outflow"
  echo "  ai-summary                AI-generated market briefing"
  echo ""
  echo "Discover all endpoints:"
  echo "  curl $API_BASE/discovery/resources"
  exit 1
fi

URL="$API_BASE/api/$ENDPOINT"
if [ -n "$SYMBOL" ]; then
  # defi-analytics uses ?protocol= instead of ?symbol=
  if [ "$ENDPOINT" = "defi-analytics" ]; then
    URL="$URL?protocol=$SYMBOL"
  else
    URL="$URL?symbol=$SYMBOL"
  fi
fi

echo "Querying AsterPay: $ENDPOINT ${SYMBOL:+($SYMBOL)}"
echo "Cost: \$0.001 USDC via x402 protocol"
echo ""

# Single curl call to avoid double requests and race conditions
RESPONSE=$(curl -s -w "\n%{http_code}" "$URL" 2>/dev/null)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
RESPONSE=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "402" ]; then
  echo "Payment Required (HTTP 402)"
  echo "This endpoint requires x402 payment of \$0.001 USDC on Base."
  echo ""
  echo "To pay automatically, use an x402-compatible client or the AsterPay MCP server:"
  echo '  {"mcpServers": {"asterpay": {"command": "npx", "args": ["@asterpay/mcp-server"]}}}'
elif [ "$HTTP_CODE" = "200" ]; then
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "Response (HTTP $HTTP_CODE):"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
fi
