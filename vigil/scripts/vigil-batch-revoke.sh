#!/usr/bin/env bash
set -euo pipefail

# vigil-batch-revoke.sh — Scan a wallet and revoke all risky approvals via Bankr.
# Usage: ./vigil-batch-revoke.sh <wallet_address> [chain] [--risk-level critical|high|medium]
#
# Read side (scan) uses the public VIGIL endpoint; the write side (revoke) runs
# through the Bankr agent for signing. Requires the `bankr` CLI authenticated.

. "$(dirname "$0")/_vigil_lib.sh"

WALLET=$(vigil_validate_addr "${1:?Usage: vigil-batch-revoke.sh <wallet> [chain] [--risk-level L]}")
CHAIN=$(vigil_validate_chain "${2:-base}")
RISK_LEVEL="critical"

shift 2 || true
while [ $# -gt 0 ]; do
  case "$1" in
    --risk-level) RISK_LEVEL="${2:-critical}"; shift 2 ;;
    *) shift ;;
  esac
done
case "$RISK_LEVEL" in critical|high|medium) ;; *) echo "Error: --risk-level must be critical|high|medium" >&2; exit 1 ;; esac

if ! command -v bankr >/dev/null 2>&1; then
  echo "Error: 'bankr' CLI not found. Install/authenticate Bankr to revoke." >&2
  exit 1
fi

echo "🛡️  VIGIL Batch Revoker (scan + Bankr signing)"
echo "  Wallet: $WALLET | Chain: $CHAIN | Risk: $RISK_LEVEL+"
echo ""

# 1. Scan approvals via the public endpoint.
RESPONSE=$(vigil_call vigil_scan_approvals "{\"wallet\":\"$WALLET\",\"chain\":\"$CHAIN\"}")

# 2. Filter to the requested risk level (and worse).
case "$RISK_LEVEL" in
  critical) FILTER='.risk == "critical"' ;;
  high)     FILTER='.risk == "critical" or .risk == "high"' ;;
  medium)   FILTER='.risk == "critical" or .risk == "high" or .risk == "medium"' ;;
esac

TARGETS=$(echo "$RESPONSE" | jq -c "[.approvals[] | select($FILTER)]")
COUNT=$(echo "$TARGETS" | jq 'length')

if [ "$COUNT" -eq 0 ]; then
  echo "✅ No $RISK_LEVEL+ approvals found. Wallet is clean."
  exit 0
fi

echo "📋 Found $COUNT approval(s) to revoke:"
echo "$TARGETS" | jq -r '.[] | "  \(.token_symbol // .token_address[0:10]) → \(.spender_address[0:16])"'
echo ""

read -r -p "⚠️  Revoke all $COUNT via Bankr? (y/N) " REPLY
echo ""
case "$REPLY" in [Yy]*) ;; *) echo "Cancelled."; exit 0 ;; esac

SUCCESS=0; FAILED=0
while IFS= read -r approval; do
  TOKEN=$(echo "$approval" | jq -r '.token_address')
  SPENDER=$(echo "$approval" | jq -r '.spender_address')
  SYMBOL=$(echo "$approval" | jq -r '.token_symbol // .token_address[0:10]')
  echo "  Revoking $SYMBOL..."
  if bankr agent "revoke the ERC-20 approval for token $TOKEN granted to spender $SPENDER on $CHAIN (set allowance to 0)"; then
    SUCCESS=$((SUCCESS + 1))
  else
    echo "    ❌ failed"; FAILED=$((FAILED + 1))
  fi
  sleep 2
done < <(echo "$TARGETS" | jq -c '.[]')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Revoked: $SUCCESS    ❌ Failed: $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
