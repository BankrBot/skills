#!/usr/bin/env bash
set -euo pipefail

# vigil-report.sh — Full wallet security report.
# Usage: ./vigil-report.sh <wallet_address> [chain]

. "$(dirname "$0")/_vigil_lib.sh"

WALLET=$(vigil_validate_addr "${1:?Usage: vigil-report.sh <wallet_address> [chain]}")
CHAIN=$(vigil_validate_chain "${2:-base}")

echo "🛡️  VIGIL Security Report"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Wallet: $WALLET"
echo "  Chain:  $CHAIN"
echo "  Time:   $(date -u '+%Y-%m-%d %H:%M UTC')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(vigil_call vigil_wallet_report "{\"wallet\":\"$WALLET\",\"chain\":\"$CHAIN\"}")

OVERALL=$(echo "$RESPONSE" | jq -r '.overall_score')
RISK=$(echo "$RESPONSE" | jq -r '.risk_level')
ICON=$(risk_icon "$RISK")

echo "📊 Overall Security Score: $OVERALL/100 $ICON  (${RISK^^})"
echo ""

echo "━━━ Approvals ━━━"
echo "  Total:     $(echo "$RESPONSE" | jq -r '.approvals.total')"
echo "  Critical:  $(echo "$RESPONSE" | jq -r '.approvals.critical')"
echo "  High:      $(echo "$RESPONSE" | jq -r '.approvals.high')"
echo "  Unlimited: $(echo "$RESPONSE" | jq -r '.approvals.unlimited')"
echo ""

if [ "$(echo "$RESPONSE" | jq '.top_risks | length')" -gt 0 ]; then
  echo "━━━ Top Risky Approvals ━━━"
  echo "$RESPONSE" | jq -r '.top_risks[:5][] |
    "  \(if .risk == "critical" then "🔴" elif .risk == "high" then "🟠" else "🟡" end) \(.token_symbol) → \(.spender_address[0:16]) | \(if .amount == "unlimited" then "UNLIMITED ⚠️" else .amount end)"'
  echo ""
fi

if [ "$(echo "$RESPONSE" | jq '.recommendations | length')" -gt 0 ]; then
  echo "━━━ Recommendations ━━━"
  echo "$RESPONSE" | jq -r '.recommendations[] | "  \(if .priority == "critical" then "🔴" elif .priority == "high" then "🟠" else "🟡" end) \(.action): \(.detail)"'
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Run ./vigil-batch-revoke.sh $WALLET $CHAIN to fix risky approvals"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
