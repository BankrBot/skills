#!/usr/bin/env bash
set -euo pipefail

# vigil-batch-revoke.sh — Revoke all risky approvals in one session
# Usage: ./vigil-batch-revoke.sh <wallet_address> [chain] [--risk-level critical|high|all]
# Requires: BANKR_API_KEY environment variable

WALLET="${1:?Usage: vigil-batch-revoke.sh <wallet_address> [chain] [--risk-level critical|high|all]}"
CHAIN="${2:-base}"
RISK_LEVEL="critical"

# Parse optional flag
shift 2 || true
while [ $# -gt 0 ]; do
  case "$1" in
    --risk-level) RISK_LEVEL="${2:-critical}"; shift 2 ;;
    *) shift ;;
  esac
done

API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

if [ -z "${BANKR_API_KEY:-}" ]; then
  echo "Error: BANKR_API_KEY required for revocation" >&2
  exit 1
fi

echo "🛡️  VIGIL Batch Revoker"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Wallet:     $WALLET"
echo "  Chain:      $CHAIN"
echo "  Risk Level: $RISK_LEVEL+"
echo ""

# Fetch approvals filtered by risk
echo "🔍 Fetching risky approvals..."
APPROVALS=$(curl -s -f "$API_BASE/approvals?wallet=$WALLET&chain=$CHAIN&risk=$RISK_LEVEL" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $BANKR_API_KEY") || {
  echo "Error: Failed to fetch approvals" >&2
  exit 1
}

COUNT=$(echo "$APPROVALS" | jq '.approvals | length')

if [ "$COUNT" -eq 0 ]; then
  echo "✅ No $RISK_LEVEL+ risk approvals found. Wallet is clean!"
  exit 0
fi

echo "📋 Found $COUNT risky approvals to revoke:"
echo ""

echo "$APPROVALS" | jq -r '.approvals[] | 
  "  \(.token_symbol // .token_address[0:10]) → \(.spender_name // .spender_address[0:16]) | \(if .amount == "unlimited" then "UNLIMITED" else .amount end)"'
echo ""

# Confirm
read -p "⚠️  Revoke all $COUNT approvals? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

# Revoke each
SUCCESS=0
FAILED=0

echo "$APPROVALS" | jq -c '.approvals[]' | while read -r approval; do
  TOKEN=$(echo "$approval" | jq -r '.token_address')
  SPENDER=$(echo "$approval" | jq -r '.spender_address')
  SYMBOL=$(echo "$approval" | jq -r '.token_symbol // .token_address[0:10]')
  
  echo -n "  Revoking $ SYMBOL... "
  
  RESULT=$(curl -s -f "$API_BASE/revoke/submit" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $BANKR_API_KEY" \
    -d "{\"token\":\"$TOKEN\",\"spender\":\"$SPENDER\",\"chain\":\"$CHAIN\"}" 2>/dev/null) || {
    echo "❌ Failed"
    FAILED=$((FAILED + 1))
    continue
  }
  
  TX_HASH=$(echo "$RESULT" | jq -r '.tx_hash // empty')
  if [ -n "$TX_HASH" ]; then
    echo "✅ $TX_HASH"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "❌ $(echo "$RESULT" | jq -r '.error // "unknown"')"
    FAILED=$((FAILED + 1))
  fi
  
  # Rate limit: wait between revocations
  sleep 2
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Revoked: $SUCCESS"
echo "  ❌ Failed:  $FAILED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
