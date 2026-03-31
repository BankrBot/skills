#!/usr/bin/env bash
# Quick honeypot-only check via GoPlus
# Usage: ./honeypot.sh <chain> <contract_address>

set -euo pipefail
CHAIN="${1:-}"
ADDRESS="${2:-}"
CHAIN_IDS=( [base]=8453 [ethereum]=1 [polygon]=137 [bsc]=56 [arbitrum]=42161 )
CHAIN_ID="${CHAIN_IDS[$CHAIN]:-}"
ADDRESS_LOWER=$(echo "$ADDRESS" | tr '[:upper:]' '[:lower:]')

if [[ -z "$CHAIN_ID" ]]; then
  echo "Error: unsupported chain. Use: base, ethereum, polygon, bsc, arbitrum" >&2; exit 1
fi

GP=$(curl -sf --max-time 15 \
  "https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${ADDRESS_LOWER}")

IS_HONEYPOT=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].is_honeypot // "unknown"')
SELL_TAX=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].sell_tax // "unknown"')
CANNOT_SELL=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].cannot_sell_all // "0"')

echo "Honeypot:      $IS_HONEYPOT  (1=yes, 0=no)"
echo "Cannot sell:   $CANNOT_SELL"
echo "Sell tax:      $SELL_TAX"

[[ "$IS_HONEYPOT" == "1" ]] && echo "RESULT: HONEYPOT CONFIRMED" || echo "RESULT: Not a honeypot"
