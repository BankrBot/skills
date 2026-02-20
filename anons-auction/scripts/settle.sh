#!/bin/bash
# Settle the current auction and start the next one

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${HOME}/.clawdbot/skills/bankr/config.json"
AUCTION_HOUSE="0x51f5a9252A43F89D8eE9D5616263f46a0E02270F"

# Check Bankr configured
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Bankr not configured"
  exit 1
fi

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")

# Get auction status
echo "→ Checking auction status..."
AUCTION_JSON=$("$SCRIPT_DIR/auction-status.sh")

if echo "$AUCTION_JSON" | jq -e '.error' > /dev/null; then
  echo "❌ $(echo "$AUCTION_JSON" | jq -r '.error')"
  exit 1
fi

ANON_ID=$(echo "$AUCTION_JSON" | jq -r '.anon_id')
TIME_REMAINING=$(echo "$AUCTION_JSON" | jq -r '.time_remaining_seconds')
SETTLED=$(echo "$AUCTION_JSON" | jq -r '.settled')
AUCTION_ACTIVE=$(echo "$AUCTION_JSON" | jq -r '.auction_active')

if [ "$SETTLED" = "true" ]; then
  echo "ℹ️  Auction #$ANON_ID already settled"
  echo "Calling settlement anyway to start next auction..."
elif [ "$AUCTION_ACTIVE" = "true" ]; then
  echo "⚠️  Auction #$ANON_ID still active ($TIME_REMAINING seconds remaining)"
  echo "Settlement can only occur after auction ends"
  exit 1
fi

# Encode settlement call
# settleCurrentAndCreateNewAuction()
# Selector: 0xe74945b5
CALLDATA="0xe74945b5"

# Build transaction
TX_JSON=$(cat << EOF
{
  "to": "$AUCTION_HOUSE",
  "data": "$CALLDATA",
  "value": "0",
  "chainId": 8453
}
EOF
)

echo "→ Settling auction #$ANON_ID..."

# Submit via Bankr
RESPONSE=$(curl -s -X POST "https://api.bankr.bot/agent/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"transaction\": $TX_JSON,
    \"waitForConfirmation\": true
  }")

# Parse response
TX_HASH=$(echo "$RESPONSE" | jq -r '.transactionHash // .txHash // .hash // .result.hash // empty')
ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')

if [ -n "$ERROR" ] && [ "$ERROR" != "null" ]; then
  echo "❌ Settlement failed: $ERROR"
  echo "$RESPONSE" | jq '.'
  exit 1
fi

if [ -n "$TX_HASH" ] && [ "$TX_HASH" != "null" ]; then
  echo "✅ Auction settled!"
  echo "   Transaction: https://basescan.org/tx/$TX_HASH"
  echo ""
  echo "→ Checking next auction..."
  sleep 5  # Wait for settlement to process
  "$SCRIPT_DIR/auction-status.sh"
  exit 0
else
  echo "⚠️  Submitted but no transaction hash returned"
  echo "$RESPONSE" | jq '.'
  exit 0
fi
