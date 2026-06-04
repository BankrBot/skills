#!/usr/bin/env bash
set -euo pipefail

# vigil-score.sh — Get a 0-100 safety score for a contract.
# Usage: ./vigil-score.sh <contract_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

CONTRACT=$(vigil_validate_addr "${1:?Usage: vigil-score.sh <contract_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "📊 Getting safety score for $CONTRACT on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_safety_score "{\"contract\":\"$CONTRACT\",\"chain\":\"$CHAIN\"}")

SCORE=$(echo "$RESPONSE" | jq -r '.score')
RISK=$(echo "$RESPONSE" | jq -r '.risk_level')
ICON=$(risk_icon "$RISK")

# Simple 20-cell bar without bc dependency.
FILLED=$(( SCORE / 5 ))
[ "$FILLED" -gt 20 ] && FILLED=20
EMPTY=$(( 20 - FILLED ))
BAR=""
for _ in $(seq 1 "$FILLED"); do BAR="$BAR█"; done
for _ in $(seq 1 "$EMPTY"); do BAR="$BAR░"; done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $ICON Safety Score: $SCORE/100"
echo "  [$BAR]"
echo "  Risk Level: ${RISK^^}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Score Breakdown:"
echo "$RESPONSE" | jq -r '.breakdown[]? |
  "  \(if .score >= 80 then "✅" elif .score >= 60 then "🟡" elif .score >= 40 then "🟠" else "🔴" end) \(.category): \(.score) — \(.note)"'
echo ""

if [ "$(echo "$RESPONSE" | jq '.risk_factors | length')" -gt 0 ]; then
  echo "⚠️  Risk Factors:"
  echo "$RESPONSE" | jq -r '.risk_factors[] | "  • \(.)"'
  echo ""
fi

if [ "$(echo "$RESPONSE" | jq '.positive_factors | length')" -gt 0 ]; then
  echo "✅ Positive Factors:"
  echo "$RESPONSE" | jq -r '.positive_factors[] | "  • \(.)"'
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RESPONSE" | jq -r '"  💡 \(.recommendation)"'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
