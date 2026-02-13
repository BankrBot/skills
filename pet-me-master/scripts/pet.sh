#!/bin/bash
# Main pet script - checks cooldown and executes if ready

set -e

SKILL_DIR="$HOME/.openclaw/workspace/skills/pet-me-master"
CHECK_SCRIPT="$SKILL_DIR/scripts/check-cooldown.sh"
PET_SCRIPT="$SKILL_DIR/scripts/pet-via-bankr.sh"
CONFIG_FILE="$SKILL_DIR/config.json"

GOTCHI_ID="${1:-$(jq -r ".gotchiIds[0]" "$CONFIG_FILE")}"

if [ -z "$GOTCHI_ID" ] || [ "$GOTCHI_ID" = "null" ]; then
  echo "❌ Error: No gotchi ID provided"
  exit 1
fi

echo "👻 Checking gotchi #${GOTCHI_ID}..."
echo ""

# Check cooldown status
STATUS=$("$CHECK_SCRIPT" "$GOTCHI_ID" 2>/dev/null || echo "error:0:0")

STATE=$(echo "$STATUS" | cut -d: -f1)
TIME_LEFT=$(echo "$STATUS" | cut -d: -f2)
LAST_PET=$(echo "$STATUS" | cut -d: -f3)

if [ "$STATE" = "error" ]; then
  echo "❌ Error: Failed to check gotchi status"
  exit 1
fi

# Format last pet timestamp
if [[ "$OSTYPE" == "darwin"* ]]; then
  LAST_PET_STR=$(date -r "$LAST_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
else
  LAST_PET_STR=$(date -d "@$LAST_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
fi

if [ "$STATE" = "ready" ]; then
  echo "✅ Cooldown ready! Petting gotchi #${GOTCHI_ID}..."
  echo ""
  
  # Execute pet via Bankr
  "$PET_SCRIPT" "$GOTCHI_ID"
  
elif [ "$STATE" = "waiting" ]; then
  # Format time left
  HOURS_LEFT=$((TIME_LEFT / 3600))
  MINS_LEFT=$(((TIME_LEFT % 3600) / 60))
  SECS_LEFT=$((TIME_LEFT % 60))
  
  # Calculate next pet time
  NEXT_PET=$((LAST_PET + 43260))
  if [[ "$OSTYPE" == "darwin"* ]]; then
    NEXT_PET_STR=$(date -r "$NEXT_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
  else
    NEXT_PET_STR=$(date -d "@$NEXT_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
  fi
  
  echo "⏰ Not ready yet!"
  echo ""
  echo "Wait: ${HOURS_LEFT}h ${MINS_LEFT}m ${SECS_LEFT}s"
  echo "Last pet: $LAST_PET_STR"
  echo "Next pet: $NEXT_PET_STR"
  echo ""
  echo "Check back in a few hours! 👻💜"
fi
