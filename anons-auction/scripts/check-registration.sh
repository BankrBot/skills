#!/bin/bash
# Check if agent is registered with ERC-8004 on Base

set -e

# Configuration
RPC_URL="https://mainnet.base.org"
REGISTRY="0x00256C0D814c455425A0699D5eEE2A7DB7A5519c"
CONFIG_FILE="${HOME}/.clawdbot/skills/bankr/config.json"

# Get agent's wallet address from Bankr
if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Bankr not configured"
  echo "Run: mkdir -p ~/.clawdbot/skills/bankr && echo '{\"apiKey\":\"bk_YOUR_KEY\"}' > ~/.clawdbot/skills/bankr/config.json"
  exit 1
fi

API_KEY=$(jq -r '.apiKey' "$CONFIG_FILE")

# Get wallet address from Bankr
WALLET_RESPONSE=$(curl -s -X POST "https://api.bankr.bot/agent/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is my Base wallet address?",
    "waitForConfirmation": false
  }')

# Extract address (basic parsing - adjust if Bankr response format differs)
AGENT_ADDRESS=$(echo "$WALLET_RESPONSE" | jq -r '.result.address // .wallet.base // .address' | head -n1)

if [ -z "$AGENT_ADDRESS" ] || [ "$AGENT_ADDRESS" = "null" ]; then
  echo "❌ Could not retrieve wallet address from Bankr"
  exit 1
fi

echo "Checking registration for: $AGENT_ADDRESS"

# Encode balanceOf(address) call
# balanceOf selector: 0x70a08231
# Padded address (remove 0x, pad to 32 bytes)
PADDED_ADDR=$(echo "$AGENT_ADDRESS" | sed 's/0x//' | awk '{printf "000000000000000000000000%s", tolower($0)}')
CALLDATA="0x70a08231${PADDED_ADDR}"

# Call RPC
RESPONSE=$(curl -s -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"method\": \"eth_call\",
    \"params\": [{
      \"to\": \"$REGISTRY\",
      \"data\": \"$CALLDATA\"
    }, \"latest\"],
    \"id\": 1
  }")

# Parse result (hex balance)
BALANCE_HEX=$(echo "$RESPONSE" | jq -r '.result')

if [ -z "$BALANCE_HEX" ] || [ "$BALANCE_HEX" = "null" ] || [ "$BALANCE_HEX" = "0x" ]; then
  echo "❌ RPC call failed or returned empty"
  echo "Response: $RESPONSE"
  exit 1
fi

# Convert hex to decimal
BALANCE=$((16#${BALANCE_HEX#0x}))

if [ "$BALANCE" -gt 0 ]; then
  echo "✅ Registered! Agent ID: $BALANCE"
  echo "Can participate in Anons auctions."
  exit 0
else
  echo "❌ Not registered with ERC-8004"
  echo ""
  echo "To participate in Anons auctions, you must register at:"
  echo "https://www.8004.org"
  echo ""
  echo "Or use the erc-8004 skill if available."
  exit 1
fi
