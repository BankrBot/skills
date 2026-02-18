#!/usr/bin/env bash
# Build unsigned deposit tx JSON and submit via Bankr.
# For ETH: single tx. For USDC/cbBTC: approve tx first, then deposit tx.
# Usage: veil-deposit-via-bankr.sh <asset> <amount> [extra flags...]
#   asset: ETH, USDC, or CBBTC (default: ETH)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

need_bin jq

ASSET="${1:?asset required (ETH, USDC, CBBTC)}"
AMOUNT="${2:?amount required}"
shift 2 || true

PAYLOAD=$(veil_cli deposit "$ASSET" "$AMOUNT" --unsigned --quiet "$@")

# Check if payload is an array (ERC20: approve + deposit) or single object (ETH)
IS_ARRAY=$(echo "$PAYLOAD" | jq -r 'if type == "array" then "true" else "false" end')

if [[ "$IS_ARRAY" == "true" ]]; then
  # ERC20 deposit: submit approve tx first, then deposit tx
  APPROVE_TX=$(echo "$PAYLOAD" | jq -c '.[0]')
  DEPOSIT_TX=$(echo "$PAYLOAD" | jq -c '.[1]')

  echo "Submitting approval transaction..." >&2
  APPROVE_RESULT=$(echo "$APPROVE_TX" | "$SCRIPT_DIR/veil-bankr-submit-tx.sh") || {
    echo "Approval transaction failed" >&2
    echo "$APPROVE_RESULT" >&2
    exit 1
  }

  APPROVE_STATUS=$(echo "$APPROVE_RESULT" | jq -r '.status // empty')
  if [[ "$APPROVE_STATUS" != "completed" ]]; then
    echo "Approval transaction not completed (status: ${APPROVE_STATUS:-unknown})" >&2
    echo "$APPROVE_RESULT" >&2
    exit 1
  fi

  echo "Submitting deposit transaction..." >&2
  echo "$DEPOSIT_TX" | "$SCRIPT_DIR/veil-bankr-submit-tx.sh"
else
  # ETH deposit: single tx
  echo "$PAYLOAD" | "$SCRIPT_DIR/veil-bankr-submit-tx.sh"
fi
