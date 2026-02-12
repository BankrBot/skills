#!/bin/bash
# Price Lookup - Simple CoinGecko historical price lookup
# Usage: ./price-lookup.sh <TOKEN> <DATE>

TOKEN="${1:-ETH}"
DATE="${2:-$(date +%d-%m-%Y)}"

# Path to Node.js script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Call the Node.js price lookup script
node "$SCRIPT_DIR/get-price.cjs" "$TOKEN" "$DATE"
