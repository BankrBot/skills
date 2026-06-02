#!/usr/bin/env bash
set -euo pipefail

# vigil-revoke.sh — Revoke a token approval via Bankr
# Usage: ./vigil-revoke.sh <token_address> <spender_address> [chain]
# Requires: BANKR_API_KEY environment variable

TOKEN="${1:?Usage: vigil-revoke.sh <token_address> <spender_address> [chain]}"
SPENDER="${2:?Usage: vigil-revoke.sh <token_address> <spender_address> [chain]}"
CHAIN="${3:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

if [ -z "${BANKR_API_KEY:-}" ]; then
  echo "Error: BANKR_API_KEY required for revocation" >&2
  echo "Set it with: export BANKR_API_KEY=bk_your_key" >&2
  exit 1
fi

echo "🔓 Revoking approval..."
echo "  Token:   $TOKEN"
echo "  Spender: $SPENDER"
echo "  Chain:   $CHAIN"
echo ""

# Step 1: Build unsigned revocation transaction
echo "📝 Building revocation transaction..."
TX_DATA=$(curl -s -f "$API_BASE/revoke/build" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -d "{\"token\":\"$TOKEN\",\"spender\":\"$SPENDER\",\"chain\":\"$CHAIN\"}") || {
  echo "Error: Failed to build transaction" >&2
  exit 1
}

UNSIGNED_TX=$(echo "$TX_DATA" | jq -r '.unsigned_tx')
GAS_EST=$(echo "$TX_DATA" | jq -r '.gas_estimate // "unknown"')

echo "  Gas Estimate: $GAS_EST"
echo ""

# Step 2: Sign and submit via Bankr
echo "✍️  Signing via Bankr..."
SIGN_RESPONSE=$(curl -s -f "$API_BASE/revoke/submit" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -d "{\"unsigned_tx\":\"$UNSIGNED_TX\",\"chain\":\"$CHAIN\"}") || {
  echo "Error: Transaction submission failed" >&2
  exit 1
}

TX_HASH=$(echo "$SIGN_RESPONSE" | jq -r '.tx_hash // .transactionHash')
STATUS=$(echo "$SIGN_RESPONSE" | jq -r '.status')

if [ "$STATUS" = "success" ] || [ -n "$TX_HASH" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✅ Approval Revoked Successfully"
  echo ""
  echo "  TX Hash: $TX_HASH"
  
  case "$CHAIN" in
    base)      echo "  Explorer: https://basescan.org/tx/$TX_HASH" ;;
    ethereum)  echo "  Explorer: https://etherscan.io/tx/$TX_HASH" ;;
    polygon)   echo "  Explorer: https://polygonscan.com/tx/$TX_HASH" ;;
    arbitrum)  echo "  Explorer: https://arbiscan.io/tx/$TX_HASH" ;;
  esac
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "❌ Transaction failed: $(echo "$SIGN_RESPONSE" | jq -r '.error // "unknown error"')"
  exit 1
fi
