#!/usr/bin/env bash
set -euo pipefail

# vigil-score.sh — Get safety score for a contract
# Usage: ./vigil-score.sh <contract_address> [chain]

CONTRACT="${1:?Usage: vigil-score.sh <contract_address> [chain]}"
CHAIN="${2:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

echo "📊 Getting safety score for $CONTRACT on $CHAIN..."
echo ""

RESPONSE=$(curl -s -f "$API_BASE/score?address=$CONTRACT&chain=$CHAIN" \
  -H "Accept: application/json" \
  ${BANKR_API_KEY:+-H "Authorization: Bearer $BANKR_API_KEY"}) || {
  echo "Error: API request failed" >&2
  exit 1
}

SCORE=$(echo "$RESPONSE" | jq -r '.score')
RISK=$(echo "$RESPONSE" | jq -r '.risk_level')

# Visual score bar
FILLED=$(echo "scale=0; $SCORE / 5" | bc)
EMPTY=$((20 - FILLED))
BAR=$(printf '█%.0s' $(seq 1 $FILLED 2>/dev/null) 2>/dev/null || true)
BAR="$BAR$(printf '░%.0s' $(seq 1 $EMPTY 2>/dev/null) 2>/dev/null || true)"

case "$RISK" in
  critical) ICON="🔴" ;;
  high)     ICON="🟠" ;;
  medium)   ICON="🟡" ;;
  low)      ICON="🟢" ;;
  safe)     ICON="✅" ;;
  *)        ICON="❓" ;;
esac

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $ICON Safety Score: $SCORE/100"
echo "  [$BAR]"
echo "  Risk Level: ${RISK^^}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Score breakdown
echo "📋 Score Breakdown:"
echo "$RESPONSE" | jq -r '.breakdown[] | 
  "  \(if .score >= 80 then "✅" elif .score >= 60 then "🟡" elif .score >= 40 then "🟠" else "🔴" end) \(.category): \(.score)/100 — \(.note)"'
echo ""

# Risk factors
RISK_COUNT=$(echo "$RESPONSE" | jq '.risk_factors | length')
if [ "$RISK_COUNT" -gt 0 ]; then
  echo "⚠️  Risk Factors:"
  echo "$RESPONSE" | jq -r '.risk_factors[] | "  • \(.)"'
  echo ""
fi

# Positive factors
POS_COUNT=$(echo "$RESPONSE" | jq '.positive_factors | length')
if [ "$POS_COUNT" -gt 0 ]; then
  echo "✅ Positive Factors:"
  echo "$RESPONSE" | jq -r '.positive_factors[] | "  • \(.)"'
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RESPONSE" | jq -r '"  💡 \(.recommendation)"'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
