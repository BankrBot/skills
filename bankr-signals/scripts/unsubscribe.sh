#!/bin/bash
# Unsubscribe from a provider's signal feed
# Usage: unsubscribe.sh PROVIDER_ADDRESS

set -euo pipefail

CONFIG_DIR="$HOME/.bankr-signals"
SUBS_FILE="$CONFIG_DIR/subscriptions.json"

if [ $# -lt 1 ]; then
  echo "Usage: unsubscribe.sh PROVIDER_ADDRESS" >&2
  exit 1
fi

PROVIDER="$1"

if [ ! -f "$SUBS_FILE" ]; then
  echo "No subscriptions found." >&2
  exit 1
fi

if ! jq -e --arg addr "$PROVIDER" '.subscriptions[] | select(.address == $addr)' "$SUBS_FILE" >/dev/null 2>&1; then
  echo "Not subscribed to $PROVIDER" >&2
  exit 1
fi

jq --arg addr "$PROVIDER" '.subscriptions |= map(select(.address != $addr))' \
  "$SUBS_FILE" > "${SUBS_FILE}.tmp" && mv "${SUBS_FILE}.tmp" "$SUBS_FILE"

echo "✓ Unsubscribed from $PROVIDER"
