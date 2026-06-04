#!/usr/bin/env bash
set -euo pipefail

# vigil-honeypot.sh — Detect honeypot tokens (buy OK, sell blocked).
# Usage: ./vigil-honeypot.sh <token_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-honeypot.sh <token_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🍯 Running honeypot detection on $TOKEN ($CHAIN)..."
echo ""

RESPONSE=$(vigil_call vigil_detect_honeypot "{\"token\":\"$TOKEN\",\"chain\":\"$CHAIN\"}")

IS_HONEYPOT=$(echo "$RESPONSE" | jq -r '.is_honeypot')
CAN_BUY=$(echo "$RESPONSE" | jq -r '.can_buy')
CAN_SELL=$(echo "$RESPONSE" | jq -r '.can_sell')
BUY_TAX=$(echo "$RESPONSE" | jq -r '.buy_tax // "N/A"')
SELL_TAX=$(echo "$RESPONSE" | jq -r '.sell_tax // "N/A"')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$IS_HONEYPOT" = "true" ]; then
  echo "  🍯 HONEYPOT CONFIRMED — DO NOT BUY"
  echo ""
  echo "  Can Buy:  $CAN_BUY   Can Sell: $CAN_SELL"
  echo "  Buy Tax:  $BUY_TAX   Sell Tax: $SELL_TAX"
  BLOCK_REASON=$(echo "$RESPONSE" | jq -r '.block_reason // empty')
  [ -n "$BLOCK_REASON" ] && { echo ""; echo "  Block Reason: $BLOCK_REASON"; }
  echo ""
  echo "  ⛔ This token will trap your funds. Avoid."
elif [ "$CAN_SELL" = "true" ]; then
  echo "  ✅ NOT a honeypot — buy and sell both work"
  echo ""
  echo "  Buy Tax:  $BUY_TAX   Sell Tax: $SELL_TAX"
  HIGH_TAX=$(echo "$RESPONSE" | jq -r '.high_tax_warning // false')
  [ "$HIGH_TAX" = "true" ] && { echo ""; echo "  ⚠️  High tax (>10%) — may still be a soft rug"; }
else
  echo "  🟠 LIKELY HONEYPOT — sell simulation failed"
  echo ""
  echo "  Can Buy:  $CAN_BUY   Can Sell: $CAN_SELL"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "🧪 Simulation Details:"
echo "$RESPONSE" | jq -r '.simulations[]? |
  "  \(.action): \(if .success then "✅ OK" else "❌ FAILED" end)\(if .error then " — \(.error)" else "" end)"'
