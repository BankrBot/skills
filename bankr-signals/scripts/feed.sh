#!/bin/bash
# Read signals from all subscribed providers
# Usage: feed.sh [--limit 20] [--json]

set -euo pipefail

CONFIG_DIR="$HOME/.bankr-signals"
SUBS_FILE="$CONFIG_DIR/subscriptions.json"

LIMIT=20
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --json) JSON_OUTPUT=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ ! -f "$SUBS_FILE" ]; then
  echo "No subscriptions. Run subscribe.sh first." >&2
  exit 1
fi

PROVIDERS=$(jq -r '.subscriptions[].address' "$SUBS_FILE")
if [ -z "$PROVIDERS" ]; then
  echo "No subscriptions. Run subscribe.sh first." >&2
  exit 1
fi

ALL_SIGNALS="[]"

for PROVIDER in $PROVIDERS; do
  FEED_TOPIC="signals-${PROVIDER}"
  
  if command -v botchan &>/dev/null; then
    POSTS=$(botchan read "$FEED_TOPIC" --limit "$LIMIT" --json 2>/dev/null || echo "[]")
    
    # Extract signal JSON from post text
    SIGNALS=$(echo "$POSTS" | jq -c '[.[] | {
      raw_text: .text,
      sender: .sender,
      post_timestamp: .timestamp
    }]' 2>/dev/null || echo "[]")
    
    ALL_SIGNALS=$(echo "$ALL_SIGNALS $SIGNALS" | jq -s 'add | sort_by(-.post_timestamp) | .[:'"$LIMIT"']')
  fi
done

if [ "$JSON_OUTPUT" = true ]; then
  echo "$ALL_SIGNALS"
else
  echo "$ALL_SIGNALS" | jq -r '.[] | 
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "Provider: \(.sender)",
    "Time:     \(.post_timestamp | todate)",
    "",
    (.raw_text | fromjson? // . | 
      if type == "object" then
        "  \(.signal.action) \(.signal.token) on \(.signal.chain)",
        "  Entry: $\(.signal.entry_price)",
        "  Amount: \(.signal.amount_pct)%",
        "  TX: \(.proof.tx_hash)",
        (if .signal.confidence then "  Confidence: \(.signal.confidence)" else empty end),
        (if .signal.reasoning then "  Reasoning: \(.signal.reasoning)" else empty end)
      else
        "  \(.)"
      end
    ),
    ""
  ' 2>/dev/null || echo "No signals found or parse error."
fi
