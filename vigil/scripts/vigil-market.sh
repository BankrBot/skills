#!/usr/bin/env bash
set -euo pipefail

# vigil-market.sh — Token price, liquidity, volume, and pool age (DexScreener).
# Usage: ./vigil-market.sh <token_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-market.sh <token_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "💹 Fetching market context for $TOKEN on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_token_market "{\"token\":\"$TOKEN\",\"chain\":\"$CHAIN\"}")

if [ "$(echo "$RESPONSE" | jq -r '.found')" != "true" ]; then
  echo "  ❓ No DEX pairs found for this token."
  exit 0
fi

RISK=$(echo "$RESPONSE" | jq -r '.liquidity_risk')
ICON=$(risk_icon "$RISK")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Price:        \$$(echo "$RESPONSE" | jq -r '.price_usd // "N/A"')"
echo "  Liquidity:    \$$(echo "$RESPONSE" | jq -r '.liquidity_usd // "N/A"')"
echo "  24h Volume:   \$$(echo "$RESPONSE" | jq -r '.volume_24h_usd // "N/A"')"
echo "  Pool Age:     $(echo "$RESPONSE" | jq -r '.pool_age_hours // "N/A"') h"
echo "  Liquidity Risk: $ICON ${RISK^^}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NOTES=$(echo "$RESPONSE" | jq -r '.notes[]?')
if [ -n "$NOTES" ]; then
  echo ""
  echo "⚠️  Notes:"
  echo "$RESPONSE" | jq -r '.notes[] | "  • \(.)"'
fi
