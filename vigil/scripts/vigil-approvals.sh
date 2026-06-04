#!/usr/bin/env bash
set -euo pipefail

# vigil-approvals.sh — List all token approvals for a wallet.
# Usage: ./vigil-approvals.sh <wallet_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

WALLET=$(vigil_validate_addr "${1:?Usage: vigil-approvals.sh <wallet_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🔍 Scanning approvals for $WALLET on $CHAIN..."
echo ""

RESPONSE=$(vigil_call vigil_scan_approvals "{\"wallet\":\"$WALLET\",\"chain\":\"$CHAIN\"}")

TOTAL=$(echo "$RESPONSE" | jq '.approvals | length')
CRITICAL=$(echo "$RESPONSE" | jq '[.approvals[] | select(.risk == "critical")] | length')
HIGH=$(echo "$RESPONSE" | jq '[.approvals[] | select(.risk == "high")] | length')

echo "📊 Results: $TOTAL approvals found"
echo "   🔴 Critical: $CRITICAL    🟠 High: $HIGH"
echo ""

if [ "$TOTAL" -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$RESPONSE" | jq -r '.approvals[] |
    "\(.risk | if . == "critical" then "🔴 CRIT" elif . == "high" then "🟠 HIGH" elif . == "medium" then "🟡 MED " elif . == "low" then "🟢 LOW " else "✅ SAFE" end)  \(.token_symbol // .token_address[0:10])  →  \(.spender_name // .spender_address[0:16])  |  \(if .amount == "unlimited" then "UNLIMITED" else .amount[0:12] end)"'
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    echo ""
    echo "To revoke (via Bankr): ./vigil-revoke.sh <token> <spender> $CHAIN"
    echo "To revoke all risky:   ./vigil-batch-revoke.sh $WALLET $CHAIN"
  fi
else
  echo "✅ No active approvals found. Wallet is clean."
fi
