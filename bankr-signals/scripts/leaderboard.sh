#!/bin/bash
# Top signal providers by verified PnL
# Usage: leaderboard.sh [--limit 10] [--period 7d|30d|all]
# Note: Reads from the bankr-signals dashboard API or local cache

set -euo pipefail

CONFIG_DIR="$HOME/.bankr-signals"
CACHE_FILE="$CONFIG_DIR/leaderboard-cache.json"

LIMIT=10
PERIOD="30d"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit) LIMIT="$2"; shift 2 ;;
    --period) PERIOD="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

mkdir -p "$CONFIG_DIR"

# Try to fetch from dashboard API
DASHBOARD_URL="https://bankr-signals.vercel.app"
LEADERBOARD=$(curl -sf "${DASHBOARD_URL}/api/leaderboard?limit=${LIMIT}&period=${PERIOD}" 2>/dev/null || echo "")

if [ -z "$LEADERBOARD" ] || [ "$LEADERBOARD" = "null" ]; then
  # Use cached data if available
  if [ -f "$CACHE_FILE" ]; then
    echo "(Using cached data)" >&2
    LEADERBOARD=$(cat "$CACHE_FILE")
  else
    echo "Could not fetch leaderboard. Dashboard may be offline." >&2
    echo "Visit: $DASHBOARD_URL/leaderboard" >&2
    exit 1
  fi
else
  echo "$LEADERBOARD" > "$CACHE_FILE"
fi

echo "═══════════════════════════════════════════════════════════════"
echo "  SIGNAL PROVIDER LEADERBOARD — ${PERIOD}"
echo "═══════════════════════════════════════════════════════════════"
echo ""
printf "  %-4s %-14s %8s %8s %8s %6s\n" "RANK" "PROVIDER" "PnL" "WIN%" "SIGNALS" "SUBS"
echo "  ──── ────────────── ──────── ──────── ──────── ──────"

echo "$LEADERBOARD" | jq -r '
  .providers[:'"$LIMIT"'] | to_entries[] |
  "  \(.key + 1 | tostring | . + "." | .[0:4])  \(.value.address[:14])  \(.value.pnl_pct | tostring + "%" | .[:8])  \(.value.win_rate | tostring + "%" | .[:8])  \(.value.signal_count | tostring | .[:8])  \(.value.subscriber_count | tostring | .[:6])"
' 2>/dev/null || echo "  (Parse error — check dashboard at $DASHBOARD_URL/leaderboard)"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Subscribe: scripts/subscribe.sh 0xPROVIDER_ADDRESS"
echo "═══════════════════════════════════════════════════════════════"
