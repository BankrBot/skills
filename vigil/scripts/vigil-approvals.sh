#!/usr/bin/env bash
set -euo pipefail

# vigil-approvals.sh — List all token approvals for a wallet
# Usage: ./vigil-approvals.sh <wallet_address> [chain]
# Chain defaults to "base"

WALLET="${1:?Usage: vigil-approvals.sh <wallet_address> [chain]}"
CHAIN="${2:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

case "$CHAIN" in
  base|ethereum|polygon|arbitrum) ;;
  *) echo "Error: unsupported chain '$CHAIN'. Use: base, ethereum, polygon, arbitrum" >&2; exit 1 ;;
esac

echo "🔍 Scanning approvals for $WALLET on $CHAIN..."
echo ""

RESPONSE=$(curl -s -f "$API_BASE/approvals?wallet=$WALLET&chain=$CHAIN" \
  -H "Accept: application/json" \
  ${BANKR_API_KEY:+-H "Authorization: Bearer $BANKR_API_KEY"}) || {
  echo "Error: API request failed" >&2
  exit 1
}

TOTAL=$(echo "$RESPONSE" | jq '.approvals | length')
CRITICAL=$(echo "$RESPONSE" | jq '[.approvals[] | select(.risk == "critical")] | length')
HIGH=$(echo "$RESPONSE" | jq '[.approvals[] | select(.risk == "high")] | length')

echo "📊 Results: $TOTAL approvals found"
echo "   🔴 Critical: $CRITICAL"
echo "   🟠 High: $HIGH"
echo ""

if [ "$TOTAL" -gt 0 ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  printf "%-8s %-42s %-42s %-10s\n" "RISK" "TOKEN" "SPENDER" "AMOUNT"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  echo "$RESPONSE" | jq -r '.approvals[] | 
    "\(.risk | if . == "critical" then "🔴 CRIT" elif . == "high" then "🟠 HIGH" elif . == "medium" then "🟡 MED " elif . == "low" then "🟢 LOW " else "✅ SAFE" end) \(.token_symbol // .token_address[0:10]) \(.spender_name // .spender_address[0:10]) \(if .amount == "unlimited" then "UNLIMITED" else .amount[0:10] end)"' | \
  while IFS= read -r line; do
    echo "$line"
  done
  
  echo ""
  echo "⚠️  Found $CRITICAL critical + $HIGH high risk approvals"
  
  if [ "$CRITICAL" -gt 0 ] || [ "$HIGH" -gt 0 ]; then
    echo ""
    echo "To revoke a risky approval, run:"
    echo "  ./vigil-revoke.sh <token_address> <spender_address> $CHAIN"
    echo ""
    echo "To revoke all risky approvals at once:"
    echo "  ./vigil-batch-revoke.sh $WALLET $CHAIN"
  fi
else
  echo "✅ No approvals found. Wallet is clean."
fi
