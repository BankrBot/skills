#!/bin/bash
set -e

export PATH="$HOME/.foundry/bin:$PATH"

CONFIG_FILE="$HOME/.openclaw/workspace/skills/pet-me-master/config.json"

# Load config
CONTRACT=$(jq -r ".contractAddress" "$CONFIG_FILE")
RPC_URL=$(jq -r ".rpcUrl" "$CONFIG_FILE")
GOTCHI_ID="${1:-$(jq -r ".gotchiIds[0]" "$CONFIG_FILE")}"

if [ -z "$GOTCHI_ID" ] || [ "$GOTCHI_ID" = "null" ]; then
  echo "error:0:0"
  echo "Error: No gotchi ID provided" >&2
  exit 1
fi

# Query on-chain data (guard against set -e early exit)
DATA=$(cast call "$CONTRACT" "getAavegotchi(uint256)" "$GOTCHI_ID" --rpc-url "$RPC_URL" 2>/dev/null || true)

if [ -z "$DATA" ]; then
  echo "error:0:0"
  echo "Error: Failed to query gotchi #$GOTCHI_ID" >&2
  exit 1
fi

# Extract last pet timestamp (byte offset 2498, 64 hex chars)
LAST_PET_HEX=${DATA:2498:64}

if [ -z "$LAST_PET_HEX" ] || [ "$LAST_PET_HEX" = "0000000000000000000000000000000000000000000000000000000000000000" ]; then
  echo "error:0:0"
  echo "Error: Invalid last pet timestamp for gotchi #$GOTCHI_ID" >&2
  exit 1
fi

# Convert to decimal
LAST_PET_DEC=$((16#$LAST_PET_HEX))
NOW=$(date +%s)
TIME_SINCE=$((NOW - LAST_PET_DEC))
REQUIRED_WAIT=43260  # 12 hours + 1 minute

# Calculate time remaining
TIME_LEFT=$((REQUIRED_WAIT - TIME_SINCE))

if [ $TIME_LEFT -le 0 ]; then
  echo "ready:0:$LAST_PET_DEC"
else
  echo "waiting:$TIME_LEFT:$LAST_PET_DEC"
fi
