#!/usr/bin/env bash
# Fetch contract info from EthereumHistory.com
# Usage: ./scripts/lookup.sh <contract_address>

set -euo pipefail

ADDRESS="${1:?Usage: lookup.sh <contract_address>}"

# Normalize to lowercase
ADDRESS=$(echo "$ADDRESS" | tr '[:upper:]' '[:lower:]')

URL="https://www.ethereumhistory.com/contract/${ADDRESS}"

echo "Fetching: ${URL}"
echo "---"

# Fetch the contract page and extract readable content
curl -sL "${URL}" \
  -H "User-Agent: Mozilla/5.0 (compatible; BankrBot/1.0)" \
  -H "Accept: text/html" | \
  sed -n 's/<title>\(.*\)<\/title>/Title: \1/p; s/<meta name="description" content="\([^"]*\)"/Description: \1/p' 2>/dev/null

echo ""
echo "Full page: ${URL}"
