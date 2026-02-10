#!/bin/bash
# Query AsterPay Data API via x402 protocol
# Usage: ./api-query.sh <endpoint> <symbol>
# Example: ./api-query.sh market-data BTC

set -e

ENDPOINT=$1
SYMBOL=$2
API_BASE="https://x402-api-production-ba87.up.railway.app"

if [ -z "$ENDPOINT" ]; then
  echo "Usage: ./api-query.sh <endpoint> [symbol]"
  echo ""
  echo "Available endpoints ($0.001 USDC per call via x402):"
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
  URL="$URL?symbol=$SYMBOL"
fi

echo "Querying AsterPay: $ENDPOINT ${SYMBOL:+($SYMBOL)}"
echo "Cost: \$0.001 USDC via x402 protocol"
echo ""

RESPONSE=$(curl -s "$URL" 2>/dev/null)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" 2>/dev/null)

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
