#!/bin/bash
# Get current Anons auction status

set -e

# Configuration
RPC_URL="https://mainnet.base.org"
AUCTION_HOUSE="0x51f5a9252A43F89D8eE9D5616263f46a0E02270F"

# Helper: Call contract view function
call_view() {
  local selector=$1
  local params=${2:-""}
  
  curl -s -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"method\": \"eth_call\",
      \"params\": [{
        \"to\": \"$AUCTION_HOUSE\",
        \"data\": \"${selector}${params}\"
      }, \"latest\"],
      \"id\": 1
    }" | jq -r '.result'
}

# Helper: Hex to decimal
hex_to_dec() {
  echo $((16#${1#0x}))
}

# Helper: Wei to ETH (18 decimals)
wei_to_eth() {
  local wei=$1
  awk "BEGIN {printf \"%.4f\", $wei / 1000000000000000000}"
}

# Helper: Decode address from 32-byte hex
decode_address() {
  echo "0x${1:26:40}"
}

# Get paused status
# paused() -> bool (selector: 0x5c975abb)
PAUSED_HEX=$(call_view "0x5c975abb")
PAUSED=$((16#${PAUSED_HEX#0x}))

if [ "$PAUSED" -eq 1 ]; then
  echo '{"error": "Auctions are paused", "paused": true}' | jq '.'
  exit 0
fi

# Get current auction
# auction() -> (anonId, amount, startTime, endTime, bidder, settled, isDusk)
# Selector: 0x7d9f6db5
AUCTION_HEX=$(call_view "0x7d9f6db5")

# Parse auction struct (7 values, each 32 bytes = 64 hex chars)
ANON_ID=$(hex_to_dec "${AUCTION_HEX:2:64}")
AMOUNT=$(hex_to_dec "${AUCTION_HEX:66:64}")
START_TIME=$(hex_to_dec "${AUCTION_HEX:130:64}")
END_TIME=$(hex_to_dec "${AUCTION_HEX:194:64}")
BIDDER=$(decode_address "${AUCTION_HEX:258:64}")
SETTLED=$(hex_to_dec "${AUCTION_HEX:322:64}")
IS_DUSK=$(hex_to_dec "${AUCTION_HEX:386:64}")

# Get reserve price for minimum bid calculation
# reservePrice() -> uint256 (selector: 0xcd3293de)
RESERVE_HEX=$(call_view "0xcd3293de")
RESERVE_PRICE=$(hex_to_dec "$RESERVE_HEX")

# Calculate minimum next bid
if [ "$AMOUNT" -eq 0 ]; then
  MIN_BID=$RESERVE_PRICE
else
  # Current + 5%
  MIN_BID=$((AMOUNT + (AMOUNT * 5 / 100)))
fi

# Get current time
CURRENT_TIME=$(date +%s)

# Calculate time remaining
if [ "$END_TIME" -gt "$CURRENT_TIME" ]; then
  TIME_REMAINING=$((END_TIME - CURRENT_TIME))
  HOURS=$((TIME_REMAINING / 3600))
  MINUTES=$(((TIME_REMAINING % 3600) / 60))
  SECONDS=$((TIME_REMAINING % 60))
  TIME_STR="${HOURS}h ${MINUTES}m ${SECONDS}s"
else
  TIME_STR="Ended"
fi

# Convert amounts to ETH
AMOUNT_ETH=$(wei_to_eth $AMOUNT)
MIN_BID_ETH=$(wei_to_eth $MIN_BID)

# Build JSON output
cat << EOF | jq '.'
{
  "anon_id": $ANON_ID,
  "current_bid": "$AMOUNT_ETH",
  "current_bid_wei": "$AMOUNT",
  "current_bidder": "$BIDDER",
  "start_time": $START_TIME,
  "end_time": $END_TIME,
  "current_time": $CURRENT_TIME,
  "time_remaining": "$TIME_STR",
  "time_remaining_seconds": $((END_TIME - CURRENT_TIME)),
  "minimum_bid": "$MIN_BID_ETH",
  "minimum_bid_wei": "$MIN_BID",
  "settled": $([ "$SETTLED" -eq 1 ] && echo "true" || echo "false"),
  "is_dusk": $([ "$IS_DUSK" -eq 1 ] && echo "true" || echo "false"),
  "paused": false,
  "auction_active": $([ "$CURRENT_TIME" -lt "$END_TIME" ] && [ "$SETTLED" -eq 0 ] && echo "true" || echo "false")
}
EOF
