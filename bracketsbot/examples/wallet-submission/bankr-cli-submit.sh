#!/usr/bin/env bash
set -euo pipefail

# Example flow:
# 1) generate unsigned transaction payload from bracketsbot
# 2) submit via Bankr CLI wallet

TX_JSON="${1:-/tmp/bracketsbot-submit-tx.json}"

bracketsbot prepare-submit-tx --json > "$TX_JSON"

TX=$(jq -c '{to,data,value,chainId}' "$TX_JSON")
bankr submit json "$TX" --description "BracketsBot bracket mint"
