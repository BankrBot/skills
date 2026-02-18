#!/bin/bash
# Timestamp Pricing - Usage Examples
# Demonstrates various use cases for the skill

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🦞 Timestamp Pricing - Usage Examples"
echo "======================================"
echo ""

# Example 1: Recent price (real-time via Bankr)
echo "Example 1: Recent Price (< 24 hours)"
echo "-------------------------------------"
echo "Getting GHST price from 12 hours ago..."
TIMESTAMP=$(date -d "12 hours ago" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || date -v-12H "+%Y-%m-%d %H:%M:%S")
bash "$SCRIPT_DIR/scripts/smart-price-lookup.sh" GHST "$TIMESTAMP"
echo ""

# Example 2: Historical price (CoinGecko)
echo "Example 2: Historical Price (> 24 hours)"
echo "----------------------------------------"
echo "Getting ETH price from 1 week ago..."
bash "$SCRIPT_DIR/scripts/smart-price-lookup.sh" ETH "2026-02-03"
echo ""

# Example 3: Multiple tokens
echo "Example 3: Comparing Multiple Tokens"
echo "-----------------------------------"
for token in BTC ETH GHST; do
  echo "Checking $token..."
  bash "$SCRIPT_DIR/scripts/price-lookup.sh" "$token" "01-02-2026"
  echo ""
done

# Example 4: Unix timestamp
echo "Example 4: Using Unix Timestamp"
echo "------------------------------"
echo "Getting BTC price at Unix timestamp 1704067200..."
bash "$SCRIPT_DIR/scripts/smart-price-lookup.sh" BTC "1704067200"
echo ""

echo "✅ All examples completed!"
