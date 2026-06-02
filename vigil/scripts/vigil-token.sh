#!/usr/bin/env bash
set -euo pipefail

# vigil-token.sh — Scan a token contract for rugpull/honeypot indicators
# Usage: ./vigil-token.sh <token_address> [chain]

TOKEN="${1:?Usage: vigil-token.sh <token_address> [chain]}"
CHAIN="${2:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

echo "🔍 Scanning token $TOKEN on $CHAIN..."
echo ""

RESPONSE=$(curl -s -f "$API_BASE/token/scan?address=$TOKEN&chain=$CHAIN" \
  -H "Accept: application/json" \
  ${BANKR_API_KEY:+-H "Authorization: Bearer $BANKR_API_KEY"}) || {
  echo "Error: API request failed" >&2
  exit 1
}

SAFETY=$(echo "$RESPONSE" | jq -r '.safety_score')
RISK=$(echo "$RESPONSE" | jq -r '.risk_level')
NAME=$(echo "$RESPONSE" | jq -r '.token_name // "Unknown"')
SYMBOL=$(echo "$RESPONSE" | jq -r '.token_symbol // "???"')

case "$RISK" in
  critical) ICON="🔴" ;;
  high)     ICON="🟠" ;;
  medium)   ICON="🟡" ;;
  low)      ICON="🟢" ;;
  safe)     ICON="✅" ;;
  *)        ICON="❓" ;;
esac

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $ICON $NAME ($SYMBOL)"
echo "  Safety Score: $SAFETY/100 | Risk Level: ${RISK^^}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Print findings
echo "📋 Findings:"
echo "$RESPONSE" | jq -r '.findings[] | 
  "  \(if .severity == "critical" then "🔴" elif .severity == "high" then "🟠" elif .severity == "medium" then "🟡" else "🟢" end) [\(.category)] \(.message)"'
echo ""

# Print contract info
echo "📄 Contract Info:"
echo "  Owner:          $(echo "$RESPONSE" | jq -r '.contract.owner // "N/A"')"
echo "  Proxy:          $(echo "$RESPONSE" | jq -r '.contract.is_proxy // false')"
echo "  Verified:       $(echo "$RESPONSE" | jq -r '.contract.verified // false')"
echo "  Renounced:      $(echo "$RESPONSE" | jq -r '.contract.ownership_renounced // false')"
echo ""

# Print liquidity info
echo "💧 Liquidity:"
echo "  Total Locked:   $(echo "$RESPONSE" | jq -r '.liquidity.total_locked_usd // "N/A"')"
echo "  Lock Duration:  $(echo "$RESPONSE" | jq -r '.liquidity.lock_duration // "N/A"')"
echo "  LP Holders:     $(echo "$RESPONSE" | jq -r '.liquidity.lp_holders // "N/A"')"
echo ""

# Print holder distribution
echo "👥 Holder Distribution:"
echo "  Top 10 Hold:    $(echo "$RESPONSE" | jq -r '.holders.top10_percentage // "N/A"')%"
echo "  Total Holders:  $(echo "$RESPONSE" | jq -r '.holders.total // "N/A"')"
echo "  Whale (>1%):    $(echo "$RESPONSE" | jq -r '.holders.whales // "N/A"')"
echo ""

# Print tax info if available
TAX_BUY=$(echo "$RESPONSE" | jq -r '.tax.buy // "N/A"')
TAX_SELL=$(echo "$RESPONSE" | jq -r '.tax.sell // "N/A"')
if [ "$TAX_BUY" != "N/A" ] || [ "$TAX_SELL" != "N/A" ]; then
  echo "💰 Tax:"
  echo "  Buy:  $TAX_BUY%"
  echo "  Sell: $TAX_SELL%"
  
  MODIFIABLE=$(echo "$RESPONSE" | jq -r '.tax.modifiable // false')
  if [ "$MODIFIABLE" = "true" ]; then
    echo "  ⚠️  Tax is MODIFIABLE by owner — high rug risk"
  fi
  echo ""
fi

# Honeypot check
HONEYPOT=$(echo "$RESPONSE" | jq -r '.honeypot.detected // false')
if [ "$HONEYPOT" = "true" ]; then
  echo "🍯 HONEYPOT DETECTED"
  echo "  $(echo "$RESPONSE" | jq -r '.honeypot.reason // "Token blocks selling"')"
  echo ""
fi

# Recommendation
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RESPONSE" | jq -r '"  💡 Recommendation: \(.recommendation)"'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
