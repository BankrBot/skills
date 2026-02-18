#!/bin/bash
set -e

CONFIG_FILE="$HOME/.openclaw/workspace/skills/pet-me-master/config.json"
CHECK_SCRIPT="$HOME/.openclaw/workspace/skills/pet-me-master/scripts/check-cooldown.sh"

# Load gotchi IDs
GOTCHI_IDS=$(jq -r ".gotchiIds[]" "$CONFIG_FILE")

echo "👻 Your Gotchis:"
echo ""

READY_COUNT=0
WAITING_COUNT=0
ERROR_COUNT=0

for GOTCHI_ID in $GOTCHI_IDS; do
  # Check cooldown status (check-cooldown.sh already outputs error:0:0 on failure)
  STATUS=$("$CHECK_SCRIPT" "$GOTCHI_ID" 2>/dev/null || true)
  
  # Handle silent failures (empty STATUS)
  if [ -z "$STATUS" ]; then
    STATUS="error:0:0"
  fi
  
  STATE=$(echo "$STATUS" | cut -d: -f1)
  TIME_LEFT=$(echo "$STATUS" | cut -d: -f2)
  LAST_PET=$(echo "$STATUS" | cut -d: -f3)
  
  if [ "$STATE" = "error" ]; then
    echo "  #${GOTCHI_ID}"
    echo "  ❌ Error checking status"
    echo ""
    ERROR_COUNT=$((ERROR_COUNT + 1))
    continue
  fi
  
  # Calculate time since last pet
  NOW=$(date +%s)
  TIME_AGO=$((NOW - LAST_PET))
  
  # Format time ago
  HOURS_AGO=$((TIME_AGO / 3600))
  MINS_AGO=$(((TIME_AGO % 3600) / 60))
  
  # Format last pet timestamp
  if [[ "$OSTYPE" == "darwin"* ]]; then
    LAST_PET_STR=$(date -r "$LAST_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
  else
    LAST_PET_STR=$(date -d "@$LAST_PET" "+%Y-%m-%d %H:%M UTC" 2>/dev/null || echo "Unknown")
  fi
  
  echo "  #${GOTCHI_ID}"
  
  if [ "$STATE" = "ready" ]; then
    echo "  ✅ Ready to pet!"
    echo "  Last: ${HOURS_AGO}h ${MINS_AGO}m ago ($LAST_PET_STR)"
    READY_COUNT=$((READY_COUNT + 1))
  else
    # Format time left
    HOURS_LEFT=$((TIME_LEFT / 3600))
    MINS_LEFT=$(((TIME_LEFT % 3600) / 60))
    SECS_LEFT=$((TIME_LEFT % 60))
    
    echo "  ⏰ Wait ${HOURS_LEFT}h ${MINS_LEFT}m ${SECS_LEFT}s"
    echo "  Last: ${HOURS_AGO}h ${MINS_AGO}m ago ($LAST_PET_STR)"
    WAITING_COUNT=$((WAITING_COUNT + 1))
  fi
  
  echo ""
done

if [ "$ERROR_COUNT" -gt 0 ]; then
  echo "Summary: ${READY_COUNT} ready, ${WAITING_COUNT} waiting, ${ERROR_COUNT} error"
else
  echo "Summary: ${READY_COUNT} ready, ${WAITING_COUNT} waiting"
fi
