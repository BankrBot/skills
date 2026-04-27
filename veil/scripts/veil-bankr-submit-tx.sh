#!/usr/bin/env bash
# Submit an unsigned EVM tx JSON to Bankr via the Wallet Submit API.
# Input: JSON on stdin or a file path as $1.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

need_bankr_config
need_bin jq
need_bin curl

if [[ $# -gt 0 ]]; then
  TX_JSON=$(<"$1")
else
  TX_JSON=$(cat)
fi

if ! echo "$TX_JSON" | jq -e '.to and .data and .value and .chainId' >/dev/null 2>&1; then
  echo "Invalid transaction JSON. Required fields: to, data, value, chainId" >&2
  echo "Received: $TX_JSON" >&2
  exit 1
fi

API_KEY=$(jq -r '.apiKey // empty' "$BANKR_CONFIG")
API_URL=$(jq -r '.apiUrl // "https://api.bankr.bot"' "$BANKR_CONFIG")

if [[ -z "$API_KEY" ]]; then
  echo "apiKey missing in $BANKR_CONFIG" >&2
  exit 1
fi

REQUEST_BODY=$(echo "$TX_JSON" | jq -c '{
  transaction: {
    to,
    data,
    value,
    chainId
  },
  description: (
    if .action then "Veil " + .action
    elif .step then "Veil " + .step
    else "Veil transaction"
    end
  ),
  waitForConfirmation: true
}')

RESPONSE=$(curl -sS -X POST "$API_URL/wallet/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$REQUEST_BODY")

if ! echo "$RESPONSE" | jq empty >/dev/null 2>&1; then
  echo "Bankr returned non-JSON response:" >&2
  echo "$RESPONSE" >&2
  exit 1
fi

echo "$RESPONSE" | jq .
