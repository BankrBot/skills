#!/bin/bash
# View your published signals and performance stats
# Usage: my-signals.sh [--limit 20] [--json]

set -euo pipefail

CONFIG_DIR="$HOME/.bankr-signals"
CONFIG_FILE="$CONFIG_DIR/config.json"
LOCAL_LOG="$CONFIG_DIR/signals/published.jsonl"

LIMIT=20
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --json) JSON_OUTPUT=true; shift ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config not found at $CONFIG_FILE" >&2
  exit 1
fi

PROVIDER=$(jq -r '.provider_address' "$CONFIG_FILE")
FEED_TOPIC="signals-${PROVIDER}"

# Try onchain first, fall back to local log
SIGNALS="[]"
if command -v botchan &>/dev/null; then
  SIGNALS=$(botchan read "$FEED_TOPIC" --limit "$LIMIT" --json 2>/dev/null || echo "[]")
fi

# If no onchain signals, use local log
if [ "$(echo "$SIGNALS" | jq 'length')" -eq 0 ] && [ -f "$LOCAL_LOG" ]; then
  SIGNALS=$(tail -n "$LIMIT" "$LOCAL_LOG" | jq -s '.' 2>/dev/null || echo "[]")
fi

COUNT=$(echo "$SIGNALS" | jq 'length')

if [ "$JSON_OUTPUT" = true ]; then
  echo "$SIGNALS"
  exit 0
fi

echo "═══════════════════════════════════════════"
echo "  MY SIGNALS — $PROVIDER"
echo "═══════════════════════════════════════════"
echo "  Total signals: $COUNT"
echo ""

if [ "$COUNT" -gt 0 ]; then
  # Parse signals and show stats
  echo "$SIGNALS" | jq -r '.[] |
    (.text // . | tostring) as $raw |
    ($raw | fromjson? // {signal:{},proof:{}}) as $s |
    "  \($s.signal.action // "?") \($s.signal.token // "?") on \($s.signal.chain // "?")  |  $\($s.signal.entry_price // "?")  |  TX: \($s.proof.tx_hash // "?" | .[:16])..."
  ' 2>/dev/null || echo "  (Could not parse signal data)"
fi

echo ""
echo "═══════════════════════════════════════════"
