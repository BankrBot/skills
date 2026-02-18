#!/bin/bash
# Smart Timestamp Pricing - Uses Bankr for recent prices, CoinGecko for historical
# Usage: ./smart-price-lookup.sh <TOKEN> <TIMESTAMP>

TOKEN="${1:-ETH}"
TIMESTAMP="${2:-$(date +%s)}"

# Convert timestamp to Unix epoch if needed
if [[ "$TIMESTAMP" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
  # ISO date format - handle both short dates and full datetime
  if [[ "$TIMESTAMP" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    # Short date format (YYYY-MM-DD)
    EPOCH=$(date -d "$TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$TIMESTAMP" +%s 2>/dev/null)
  else
    # Full datetime format
    EPOCH=$(date -d "$TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$TIMESTAMP" +%s 2>/dev/null)
  fi
elif [[ "$TIMESTAMP" =~ ^[0-9]{10}$ ]]; then
  # Already Unix timestamp
  EPOCH=$TIMESTAMP
else
  # Try to parse as date string
  EPOCH=$(date -d "$TIMESTAMP" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$TIMESTAMP" +%s 2>/dev/null)
fi

# Get current time
NOW=$(date +%s)
AGE=$((NOW - EPOCH))
TIMESTAMP_DATE=$(date -d "@$EPOCH" "+%Y-%m-%d %H:%M:%S UTC" 2>/dev/null || date -r "$EPOCH" "+%Y-%m-%d %H:%M:%S UTC")

echo "=== Smart Timestamp Pricing ==="
echo "Token: $TOKEN"
echo "Timestamp: $TIMESTAMP_DATE"
echo "Age: $((AGE / 3600)) hours ago"
echo ""

# Decision: Use Bankr for prices less than 24 hours old, CoinGecko for older
if [ $AGE -lt 86400 ]; then
  # Recent price (< 24 hours) - Use Bankr for real-time data
  echo "Using Bankr (real-time pricing)..."
  echo ""
  
  # Call Bankr API via the bankr.sh script
  BANKR_SCRIPT="$HOME/.openclaw/skills/bankr/scripts/bankr.sh"
  
  if [ -f "$BANKR_SCRIPT" ]; then
    bash "$BANKR_SCRIPT" "What is the current price of $TOKEN?"
  else
    echo "Error: Bankr script not found at $BANKR_SCRIPT"
    echo "Falling back to CoinGecko historical data..."
    echo ""
    bash "$(dirname "$0")/price-lookup.sh" "$TOKEN" "$(date -d "@$EPOCH" +%d-%m-%Y 2>/dev/null || date -r "$EPOCH" +%d-%m-%Y)"
  fi
  
else
  # Historical price (> 24 hours) - Use CoinGecko
  echo "Using CoinGecko (historical data)..."
  echo ""
  
  COINGECKO_DATE=$(date -d "@$EPOCH" +%d-%m-%Y 2>/dev/null || date -r "$EPOCH" +%d-%m-%Y)
  bash "$(dirname "$0")/price-lookup.sh" "$TOKEN" "$COINGECKO_DATE"
fi

# Note: For AAI (aaigotchi) token, use the symbol directly
