#!/bin/bash
set -e

CONFIG_FILE="$HOME/.openclaw/workspace/skills/pet-me-master/config.json"
BANKR_SCRIPT="$HOME/.openclaw/skills/bankr/scripts/bankr.sh"

# Load config
CONTRACT=$(jq -r ".contractAddress" "$CONFIG_FILE")
CHAIN_ID=$(jq -r ".chainId" "$CONFIG_FILE")
GOTCHI_ID="${1:-$(jq -r ".gotchiIds[0]" "$CONFIG_FILE")}"

if [ -z "$GOTCHI_ID" ]; then
  echo "Error: No gotchi ID provided"
  exit 1
fi

if [ ! -f "$BANKR_SCRIPT" ]; then
  echo "Error: Bankr script not found at $BANKR_SCRIPT"
  exit 1
fi

# Encode interact([tokenId]) calldata
# Function selector: interact(uint256[])
# Selector: 0xbafa9107
SELECTOR="bafa9107"

# Encode uint256[] array with one element
# offset to array data (32 bytes = 0x20)
OFFSET="0000000000000000000000000000000000000000000000000000000000000020"

# array length (1)
LENGTH="0000000000000000000000000000000000000000000000000000000000000001"

# gotchi ID (padded to 32 bytes)
GOTCHI_HEX=$(printf "%064x" "$GOTCHI_ID")

CALLDATA="0x${SELECTOR}${OFFSET}${LENGTH}${GOTCHI_HEX}"

# Build transaction prompt for Bankr
PROMPT="Submit this transaction to pet gotchi #${GOTCHI_ID}: {\"to\": \"${CONTRACT}\", \"data\": \"${CALLDATA}\", \"value\": \"0\", \"chainId\": ${CHAIN_ID}}"

echo "Submitting pet transaction for gotchi #${GOTCHI_ID}..."
echo ""

# Execute via Bankr
"$BANKR_SCRIPT" "$PROMPT"
