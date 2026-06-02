#!/usr/bin/env bash
set -euo pipefail

# vigil-honeypot.sh — Detect honeypot tokens (buy OK, sell blocked)
# Usage: ./vigil-honeypot.sh <token_address> [chain]

TOKEN="${1:?Usage: vigil-honeypot.sh <token_address> [chain]}"
CHAIN="${2:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

echo "🍯 Running honeypot detection on $TOKEN ($CHAIN)..."
echo ""

RESPONSE=$(curl -s -f "$API_BASE/token/honeypot?address=$TOKEN&chain=$CHAIN" \
  -H "Accept: application/json" \
  ${BANKR_API_KEY:+-H "Authorization: Bearer $BANKR_API_KEY"}) || {
  echo "Error: API request failed" >&2
  exit 1
}

IS_HONEYPOT=$(echo "$RESPONSE" | jq -r '.is_honeypot')
CAN_BUY=$(echo "$RESPONSE" | jq -r '.can_buy')
CAN_SELL=$(echo "$RESPONSE" | jq -r '.can_sell')
BUY_TAX=$(echo "$RESPONSE" | jq -r '.buy_tax // "N/A"')
SELL_TAX=$(echo "$RESPONSE" | jq -r '.sell_tax // "N/A"')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$IS_HONEYPOT" = "true" ]; then
  echo "  🍯 HONEYPOT CONFIRMED — DO NOT BUY"
  echo ""
  echo "  Can Buy:  $CAN_BUY"
  echo "  Can Sell: $CAN_SELL"
  echo "  Buy Tax:  $BUY_TAX%"
  echo "  Sell Tax: $SELL_TAX%"
  
  BLOCK_REASON=$(echo "$RESPONSE" | jq -r '.block_reason // empty')
  if [ -n "$BLOCK_REASON" ]; then
    echo ""
    echo "  Block Reason: $BLOCK_REASON"
  fi
  
  echo ""
  echo "  ⛔ This token will trap your funds. Avoid at all costs."
else
  if [ "$CAN_SELL" = "true" ]; then
    echo "  ✅ NOT a honeypot — buy and sell both work"
    echo ""
    echo "  Buy Tax:  $BUY_TAX%"
    echo "  Sell Tax: $SELL_TAX%"
    
    HIGH_TAX=$(echo "$RESPONSE" | jq -r '.high_tax_warning // false')
    if [ "$HIGH_TAX" = "true" ]; then
      echo ""
      echo "  ⚠️  Warning: Sell tax > 10% — may still be a soft rug"
    fi
  else
    echo "  🟠 LIKELY HONEYPOT — sell simulation failed"
    echo ""
    echo "  Can Buy:  $CAN_BUY"
    echo "  Can Sell: $CAN_SELL"
    echo ""
    echo "  ⚠️  Token allows buying but selling may fail in practice."
  fi
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Simulation details
echo ""
echo "🧪 Simulation Details:"
echo "$RESPONSE" | jq -r '.simulations[] | 
  "  \(.action): \(if .success then "✅ OK" else "❌ FAILED" end) | Gas: \(.gas_used // "N/A") | Error: \(.error // "none")"'
