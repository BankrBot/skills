#\!/bin/bash
set -e

SKILL_DIR="$HOME/.openclaw/skills/aavegotchi"
CONFIG_FILE="$SKILL_DIR/config.json"
LOG_FILE="$HOME/.openclaw/logs/aavegotchi-autopet.log"

# Load config
CONTRACT=$(jq -r .contractAddress "$CONFIG_FILE")
RPC_URL=$(jq -r .rpcUrl "$CONFIG_FILE")

# Get gotchi ID from argument or use first from config
if [ -n "$1" ]; then
  GOTCHI_ID="$1"
else
  GOTCHI_ID=$(jq -r .gotchiIds[0] "$CONFIG_FILE")
fi

export PATH="$HOME/.foundry/bin:$PATH"

echo "$(date): Checking if Gotchi #$GOTCHI_ID needs petting..." >> "$LOG_FILE"

# Get Aavegotchi data
DATA=$(cast call "$CONTRACT" "getAavegotchi(uint256)" "$GOTCHI_ID" --rpc-url "$RPC_URL")

# Extract lastInteracted timestamp (at char position 2498, length 64)
LAST_PET_HEX=${DATA:2498:64}
LAST_PET_DEC=$((16#$LAST_PET_HEX))

# Get current time
NOW=$(date +%s)

# Calculate time since last pet
TIME_SINCE=$((NOW - LAST_PET_DEC))

# Required wait: 12h 1m = 43260 seconds
REQUIRED_WAIT=43260

echo "Last pet: $(date -d @$LAST_PET_DEC 2>/dev/null || date -r $LAST_PET_DEC 2>/dev/null || echo $LAST_PET_DEC)" >> "$LOG_FILE"
echo "Time since: ${TIME_SINCE}s (need ${REQUIRED_WAIT}s)" >> "$LOG_FILE"

if [ $TIME_SINCE -ge $REQUIRED_WAIT ]; then
  echo "✅ Time to pet\! Petting now..." >> "$LOG_FILE"
  "$SKILL_DIR/scripts/pet.sh" "$GOTCHI_ID" >> "$LOG_FILE" 2>&1
  echo "$(date): Pet complete\!" >> "$LOG_FILE"
else
  TIME_LEFT=$((REQUIRED_WAIT - TIME_SINCE))
  HOURS=$((TIME_LEFT / 3600))
  MINS=$(((TIME_LEFT % 3600) / 60))
  SECS=$((TIME_LEFT % 60))
  echo "⏰ Not yet. Wait ${HOURS}h ${MINS}m ${SECS}s more" >> "$LOG_FILE"
fi
