#!/bin/bash
# Subscribe to a provider's signal feed
# Usage: subscribe.sh PROVIDER_ADDRESS

set -euo pipefail

CONFIG_DIR="$HOME/.bankr-signals"
SUBS_FILE="$CONFIG_DIR/subscriptions.json"
mkdir -p "$CONFIG_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: subscribe.sh PROVIDER_ADDRESS" >&2
  exit 1
fi

PROVIDER="$1"

# Validate address format
if [[ ! "$PROVIDER" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
  echo "Error: Invalid address format. Expected 0x followed by 40 hex characters." >&2
  exit 1
fi

# Initialize subscriptions file
if [ ! -f "$SUBS_FILE" ]; then
  echo '{"subscriptions":[]}' > "$SUBS_FILE"
fi

# Check if already subscribed
if jq -e --arg addr "$PROVIDER" '.subscriptions[] | select(.address == $addr)' "$SUBS_FILE" >/dev/null 2>&1; then
  echo "Already subscribed to $PROVIDER" >&2
  exit 0
fi

# Verify provider has a signal feed
echo "Checking provider feed..." >&2
FEED_TOPIC="signals-${PROVIDER}"
if command -v botchan &>/dev/null; then
  POSTS=$(botchan read "$FEED_TOPIC" --limit 1 --json 2>/dev/null || echo "[]")
  POST_COUNT=$(echo "$POSTS" | jq 'length' 2>/dev/null || echo "0")
  echo "Provider has $POST_COUNT signal(s) on record" >&2
fi

# Add subscription
TIMESTAMP=$(date +%s)
jq --arg addr "$PROVIDER" --argjson ts "$TIMESTAMP" \
  '.subscriptions += [{"address": $addr, "subscribed_at": $ts, "auto_copy": false}]' \
  "$SUBS_FILE" > "${SUBS_FILE}.tmp" && mv "${SUBS_FILE}.tmp" "$SUBS_FILE"

echo "✓ Subscribed to $PROVIDER"
echo "  Feed: $FEED_TOPIC"
echo "  Run 'feed.sh' to see their signals"
echo "  Run 'auto-copy.sh --provider $PROVIDER' to enable auto-copy"
