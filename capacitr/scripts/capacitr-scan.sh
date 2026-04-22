#!/bin/bash
# capacitr-scan.sh — query the Capacitr market discovery API
# Usage:
#   ./capacitr-scan.sh --url "https://reuters.com/article/..."
#   ./capacitr-scan.sh --query "OPEC oil production cuts"
#
# Requires: curl, jq
# Payment: $0.01 USDC on Base via x402 (handled automatically by x402-capable clients)
# For direct curl calls (no x402): the endpoint currently accepts unauthenticated requests
# while x402 enforcement is being rolled out.

ENDPOINT="https://app.capacitr.xyz/api/analyze-link"
URL_INPUT=""
QUERY_INPUT=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --url) URL_INPUT="$2"; shift 2 ;;
    --query) QUERY_INPUT="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$URL_INPUT" && -z "$QUERY_INPUT" ]]; then
  echo "Error: provide --url or --query"
  exit 1
fi

# Build payload
if [[ -n "$URL_INPUT" ]]; then
  PAYLOAD=$(jq -n --arg url "$URL_INPUT" '{"url": $url}')
else
  PAYLOAD=$(jq -n --arg query "$QUERY_INPUT" '{"query": $query}')
fi

echo "Scanning: ${URL_INPUT:-$QUERY_INPUT}"
echo ""

RESPONSE=$(curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  echo "Error: $(echo "$RESPONSE" | jq -r '.error')"
  exit 1
fi

# Summary
echo "=== SUMMARY ==="
echo "$RESPONSE" | jq -r '.content.summary'
echo ""
echo "Entities: $(echo "$RESPONSE" | jq -r '[.content.entities[]] | join(", ")')"
echo "Tickers:  $(echo "$RESPONSE" | jq -r '[.content.tickers[]] | join(", ")')"
echo ""

# Edge predictions (spread > 0.05)
EDGE=$(echo "$RESPONSE" | jq '[.predictions[] | select(.spread > 0.05)] | sort_by(-.spread)')
EDGE_COUNT=$(echo "$EDGE" | jq 'length')

if [[ "$EDGE_COUNT" -gt 0 ]]; then
  echo "=== ⚡ EDGE OPPORTUNITIES ($EDGE_COUNT) ==="
  echo "$EDGE" | jq -r '.[] | "[\(.spreadDirection == "q_higher" | if . then "BUY YES" else "BUY NO" end) +\((.spread * 100 | floor))%] \(.question)\n  Market: \((.yesPrice * 100 | floor))%  Q: \((.quotientOdds * 100 | floor))%  Vol: $\(.volume)\n  BLUF: \(.bluf // "—")\n  Trade: https://polymarket.com/event/\(.slug)\n"'
fi

# All predictions
echo "=== PREDICTION MARKETS ($(echo "$RESPONSE" | jq '.predictions | length')) ==="
echo "$RESPONSE" | jq -r '.predictions[:5][] | "[\((.yesPrice * 100 | floor))% YES] \(.question)"'
echo ""

# Perps
PERPS_COUNT=$(echo "$RESPONSE" | jq '.perps | length')
if [[ "$PERPS_COUNT" -gt 0 ]]; then
  echo "=== PERPETUALS ($PERPS_COUNT) ==="
  echo "$RESPONSE" | jq -r '.perps[] | "\(.asset)-PERP  $\(.markPrice)  Funding: \(.funding)  Trade: https://app.hyperliquid.xyz/trade/\(.coinId // .asset)"'
  echo ""
fi

# Options
OPTIONS_COUNT=$(echo "$RESPONSE" | jq '.options | length')
if [[ "$OPTIONS_COUNT" -gt 0 ]]; then
  echo "=== OPTIONS ($OPTIONS_COUNT) ==="
  echo "$RESPONSE" | jq -r '.options[] | "\(.instrument)  IV: \(.markIv)%  OI: \(.openInterest)"'
fi
