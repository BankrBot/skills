#!/bin/bash
# Calculate minimum bid and check if agent can afford it

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${HOME}/.clawdbot/skills/bankr/config.json"

# Check Bankr configured
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Bankr not configured"
  exit 1
fi

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")

# Get auction status
AUCTION_JSON=$("$SCRIPT_DIR/auction-status.sh")

if echo "$AUCTION_JSON" | jq -e '.error' > /dev/null; then
  echo "$AUCTION_JSON" | jq '.'
  exit 1
fi

# Extract values
CURRENT_BID=$(echo "$AUCTION_JSON" | jq -r '.current_bid')
MIN_BID=$(echo "$AUCTION_JSON" | jq -r '.minimum_bid')
MIN_BID_WEI=$(echo "$AUCTION_JSON" | jq -r '.minimum_bid_wei')

# Get agent's Base balance via Bankr
BALANCE_RESPONSE=$(curl -s "https://api.bankr.bot/agent/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is my ETH balance on Base?"}')

# Try to extract balance (format varies, try multiple patterns)
BALANCE=$(echo "$BALANCE_RESPONSE" | jq -r '
  .result.balance // 
  .balance // 
  (.result | capture("(?<bal>[0-9.]+)\\s*ETH") | .bal) // 
  "0"
' | head -n1)

if [ "$BALANCE" = "null" ] || [ "$BALANCE" = "0" ]; then
  echo "⚠️  Could not determine balance from Bankr"
  BALANCE="Unknown"
  CAN_AFFORD="Unknown"
else
  # Compare balance to min bid + gas buffer (0.001 ETH)
  BALANCE_FLOAT=$(awk "BEGIN {print $BALANCE}")
  REQUIRED=$(awk "BEGIN {print $MIN_BID + 0.001}")
  
  if awk "BEGIN {exit !($BALANCE_FLOAT >= $REQUIRED)}"; then
    CAN_AFFORD="YES"
  else
    CAN_AFFORD="NO"
  fi
fi

# Output
cat << EOF
Current bid: $CURRENT_BID ETH
Minimum next bid: $MIN_BID ETH (5% increment)
Minimum bid (wei): $MIN_BID_WEI
Your balance: $BALANCE ETH
Can afford bid: $CAN_AFFORD
EOF

# JSON output if requested
if [ "$1" = "--json" ]; then
  cat << EOF | jq '.'
{
  "current_bid_eth": "$CURRENT_BID",
  "minimum_bid_eth": "$MIN_BID",
  "minimum_bid_wei": "$MIN_BID_WEI",
  "balance_eth": "$BALANCE",
  "can_afford": "$CAN_AFFORD"
}
EOF
fi
