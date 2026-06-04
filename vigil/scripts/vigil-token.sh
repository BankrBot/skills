#!/usr/bin/env bash
set -euo pipefail

# vigil-token.sh — Scan a token contract for rugpull/honeypot indicators.
# Usage: ./vigil-token.sh <token_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-token.sh <token_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🔍 Scanning token $TOKEN on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_scan_token "{\"token\":\"$TOKEN\",\"chain\":\"$CHAIN\"}")

SAFETY=$(echo "$RESPONSE" | jq -r '.safety_score')
RISK=$(echo "$RESPONSE" | jq -r '.risk_level')
NAME=$(echo "$RESPONSE" | jq -r '.token_name // "Unknown"')
SYMBOL=$(echo "$RESPONSE" | jq -r '.token_symbol // "???"')
ICON=$(risk_icon "$RISK")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $ICON $NAME ($SYMBOL)"
echo "  Safety Score: $SAFETY/100 | Risk Level: ${RISK^^}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "📋 Findings:"
echo "$RESPONSE" | jq -r '.findings[]? |
  "  \(if .severity == "critical" then "🔴" elif .severity == "high" then "🟠" elif .severity == "medium" then "🟡" else "🟢" end) [\(.category)] \(.message)"'
echo ""

echo "📄 Contract Info:"
echo "  Proxy:     $(echo "$RESPONSE" | jq -r '.contract.is_proxy // false')"
echo "  Verified:  $(echo "$RESPONSE" | jq -r '.contract.verified // false')"
echo "  Renounced: $(echo "$RESPONSE" | jq -r '.contract.ownership_renounced // false')"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "$RESPONSE" | jq -r '"  💡 \(.recommendation)"'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
