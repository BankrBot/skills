#!/bin/bash
# Place a bid on the current Anons auction via Bankr

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${HOME}/.clawdbot/skills/bankr/config.json"
AUCTION_HOUSE="0x51f5a9252A43F89D8eE9D5616263f46a0E02270F"

# Check Bankr configured
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Bankr not configured"
  echo "Setup: mkdir -p ~/.clawdbot/skills/bankr && echo '{\"apiKey\":\"bk_YOUR_KEY\"}' > ~/.clawdbot/skills/bankr/config.json"
  exit 1
fi

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")

# 1. Check registration
echo "→ Checking ERC-8004 registration..."
if ! "$SCRIPT_DIR/check-registration.sh" > /dev/null 2>&1; then
  echo "❌ Not registered with ERC-8004"
  echo "Register at: https://www.8004.org"
  exit 1
fi
echo "✅ Registered"

# 2. Get auction status
echo "→ Fetching auction status..."
AUCTION_JSON=$("$SCRIPT_DIR/auction-status.sh")

if echo "$AUCTION_JSON" | jq -e '.error' > /dev/null; then
  echo "❌ $(echo "$AUCTION_JSON" | jq -r '.error')"
  exit 1
fi

# Check if auction is active
AUCTION_ACTIVE=$(echo "$AUCTION_JSON" | jq -r '.auction_active')
if [ "$AUCTION_ACTIVE" != "true" ]; then
  echo "❌ Auction not active"
  echo "Run: scripts/settle.sh to start next auction"
  exit 1
fi

ANON_ID=$(echo "$AUCTION_JSON" | jq -r '.anon_id')
CURRENT_BID=$(echo "$AUCTION_JSON" | jq -r '.current_bid')
MIN_BID_WEI=$(echo "$AUCTION_JSON" | jq -r '.minimum_bid_wei')
MIN_BID_ETH=$(echo "$AUCTION_JSON" | jq -r '.minimum_bid')

echo "✅ Auction #$ANON_ID active"
echo "   Current bid: $CURRENT_BID ETH"
echo "   Minimum bid: $MIN_BID_ETH ETH"

# 3. Determine bid amount
if [ -n "$1" ] && [ "$1" != "--confirm" ]; then
  # User specified amount in ETH
  BID_ETH=$1
  BID_WEI=$(awk "BEGIN {printf \"%.0f\", $BID_ETH * 1000000000000000000}")
  
  # Verify it meets minimum
  if awk "BEGIN {exit !($BID_WEI < $MIN_BID_WEI)}"; then
    echo "❌ Bid $BID_ETH ETH is below minimum $MIN_BID_ETH ETH"
    exit 1
  fi
else
  # Use minimum bid
  BID_WEI=$MIN_BID_WEI
  BID_ETH=$MIN_BID_ETH
fi

echo "→ Bidding $BID_ETH ETH ($BID_WEI wei)"

# 4. Encode transaction
# createBid(uint256 anonId)
# Selector: 0x454a2ab3
# Param: anonId padded to 32 bytes
ANON_ID_HEX=$(printf "%064x" "$ANON_ID")
CALLDATA="0x454a2ab3${ANON_ID_HEX}"

# 5. Build transaction JSON
TX_JSON=$(cat << EOF
{
  "to": "$AUCTION_HOUSE",
  "data": "$CALLDATA",
  "value": "$BID_WEI",
  "chainId": 8453
}
EOF
)

echo "→ Transaction:"
echo "$TX_JSON" | jq '.'

# Confirmation check
if [ "$1" = "--confirm" ] || [ "$2" = "--confirm" ]; then
  read -p "Submit this bid? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
  fi
fi

# 6. Submit via Bankr
echo "→ Submitting transaction via Bankr..."

RESPONSE=$(curl -s -X POST "https://api.bankr.bot/agent/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"transaction\": $TX_JSON,
    \"waitForConfirmation\": true
  }")

# Parse response
TX_HASH=$(echo "$RESPONSE" | jq -r '.transactionHash // .txHash // .hash // .result.hash // empty')
SUCCESS=$(echo "$RESPONSE" | jq -r '.success // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')

if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
  echo "❌ Transaction failed: $ERROR"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

if [ "$SUCCESS" = "false" ]; then
  echo "❌ API reported failure (success: false)"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

if [ -n "$TX_HASH" ] && [ "$TX_HASH" != "null" ]; then
  echo "✅ Bid submitted!"
  echo "   Amount: $BID_ETH ETH"
  echo "   Anon ID: $ANON_ID"
  echo "   Transaction: https://basescan.org/tx/$TX_HASH"
  exit 0
else
  echo "⚠️  Submitted but no transaction hash returned"
  echo "$RESPONSE" | jq '.'
  echo ""
  echo "Check your pending transactions on Basescan"
  exit 0
fi
