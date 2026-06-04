#!/usr/bin/env bash
set -euo pipefail

# vigil-deployer.sh — Contract verification + deployer reputation (Basescan).
# Usage: ./vigil-deployer.sh <contract_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

CONTRACT=$(vigil_validate_addr "${1:?Usage: vigil-deployer.sh <contract_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🏗️  Checking deployer reputation for $CONTRACT on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_deployer_check "{\"contract\":\"$CONTRACT\",\"chain\":\"$CHAIN\"}")

if [ "$(echo "$RESPONSE" | jq -r '.available')" != "true" ]; then
  echo "  ❓ $(echo "$RESPONSE" | jq -r '.note')"
  exit 0
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Contract Name: $(echo "$RESPONSE" | jq -r '.contract_name // "N/A"')"
echo "  Verified:      $(echo "$RESPONSE" | jq -r '.verified // false')"
echo "  Deployer:      $(echo "$RESPONSE" | jq -r '.deployer // "N/A"')"
echo "  Age (days):    $(echo "$RESPONSE" | jq -r '.age_days // "N/A"')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$(echo "$RESPONSE" | jq '.risk_factors | length')" -gt 0 ]; then
  echo ""
  echo "⚠️  Risk Factors:"
  echo "$RESPONSE" | jq -r '.risk_factors[] | "  • \(.)"'
fi
if [ "$(echo "$RESPONSE" | jq '.positive_factors | length')" -gt 0 ]; then
  echo ""
  echo "✅ Positive Factors:"
  echo "$RESPONSE" | jq -r '.positive_factors[] | "  • \(.)"'
fi
echo ""
echo "  ℹ️  $(echo "$RESPONSE" | jq -r '.note')"
