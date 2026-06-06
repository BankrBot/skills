#!/usr/bin/env bash
set -euo pipefail

# vigil-check-scam.sh — Check a token against the community scam database.
# Usage: ./vigil-check-scam.sh <token_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-check-scam.sh <token_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🗂️  Checking community scam reports for $TOKEN on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_check_scam "{\"token\":\"$TOKEN\",\"chain\":\"$CHAIN\"}")

if [ "$(echo "$RESPONSE" | jq -r '.reported')" = "true" ]; then
  COUNT=$(echo "$RESPONSE" | jq -r '.report_count')
  echo "  🚨 REPORTED — $COUNT community report(s)"
  echo "  Categories: $(echo "$RESPONSE" | jq -r '.evidence_types | join(", ")')"
  echo ""
  echo "$RESPONSE" | jq -r '.reports[]? | "  • [\(.evidence_type)] \(.description)"'
else
  echo "  ✅ Clean — no community scam reports for this token."
fi
