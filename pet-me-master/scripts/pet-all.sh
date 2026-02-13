#!/bin/bash
# Pet all ready gotchis in a single batch transaction

set -e

SKILL_DIR="$HOME/.openclaw/workspace/skills/pet-me-master"
CHECK_SCRIPT="$SKILL_DIR/scripts/check-cooldown.sh"
CONFIG_FILE="$SKILL_DIR/config.json"
BANKR_SCRIPT="$HOME/.openclaw/skills/bankr/scripts/bankr.sh"

# Load config
CONTRACT=$(jq -r ".contractAddress" "$CONFIG_FILE")
CHAIN_ID=$(jq -r ".chainId" "$CONFIG_FILE")
GOTCHI_IDS=$(jq -r ".gotchiIds[]" "$CONFIG_FILE")

if [ -z "$GOTCHI_IDS" ]; then
  echo "❌ Error: No gotchis configured"
  exit 1
fi

if [ ! -f "$BANKR_SCRIPT" ]; then
  echo "❌ Error: Bankr script not found at $BANKR_SCRIPT"
  exit 1
fi

echo "👻 Checking all gotchis..."
echo ""

READY_IDS=()
WAITING_IDS=()

# Check each gotchi
for GOTCHI_ID in $GOTCHI_IDS; do
  STATUS=$("$CHECK_SCRIPT" "$GOTCHI_ID" 2>/dev/null || echo "error:0:0")
  
  STATE=$(echo "$STATUS" | cut -d: -f1)
  TIME_LEFT=$(echo "$STATUS" | cut -d: -f2)
  
  if [ "$STATE" = "ready" ]; then
    echo "  ✅ #${GOTCHI_ID} ready"
    READY_IDS+=("$GOTCHI_ID")
  elif [ "$STATE" = "waiting" ]; then
    HOURS_LEFT=$((TIME_LEFT / 3600))
    MINS_LEFT=$(((TIME_LEFT % 3600) / 60))
    echo "  ⏰ #${GOTCHI_ID} wait ${HOURS_LEFT}h ${MINS_LEFT}m"
    WAITING_IDS+=("$GOTCHI_ID")
  else
    echo "  ❌ #${GOTCHI_ID} error"
  fi
done

echo ""

# Check results
READY_COUNT=${#READY_IDS[@]}
WAITING_COUNT=${#WAITING_IDS[@]}

if [ $READY_COUNT -eq 0 ]; then
  echo "⏰ No gotchis ready to pet yet!"
  echo "All are still on cooldown. Check back later! 👻💜"
  exit 0
fi

echo "📝 Summary: ${READY_COUNT} ready, ${WAITING_COUNT} waiting"
echo ""

# Build batch calldata
# Function: interact(uint256[])
# Selector: 0xbafa9107

SELECTOR="bafa9107"

# Offset to array data (32 bytes = 0x20)
OFFSET="0000000000000000000000000000000000000000000000000000000000000020"

# Array length
LENGTH=$(printf "%064x" "$READY_COUNT")

# Encode each gotchi ID
GOTCHI_DATA=""
for ID in "${READY_IDS[@]}"; do
  GOTCHI_HEX=$(printf "%064x" "$ID")
  GOTCHI_DATA="${GOTCHI_DATA}${GOTCHI_HEX}"
done

CALLDATA="0x${SELECTOR}${OFFSET}${LENGTH}${GOTCHI_DATA}"

# Format ready IDs for display
READY_LIST=""
for ID in "${READY_IDS[@]}"; do
  if [ -z "$READY_LIST" ]; then
    READY_LIST="#$ID"
  else
    READY_LIST="$READY_LIST, #$ID"
  fi
done

echo "🦞 Petting gotchis: $READY_LIST"
echo ""

# Build transaction prompt for Bankr
PROMPT="Submit this transaction to pet multiple gotchis ($READY_LIST): {\"to\": \"${CONTRACT}\", \"data\": \"${CALLDATA}\", \"value\": \"0\", \"chainId\": ${CHAIN_ID}}"

# Execute via Bankr
"$BANKR_SCRIPT" "$PROMPT"

echo ""
echo "✅ Batch pet complete!"
echo "Petted: ${READY_COUNT} gotchis"
if [ $WAITING_COUNT -gt 0 ]; then
  echo "Skipped: ${WAITING_COUNT} (still on cooldown)"
fi
