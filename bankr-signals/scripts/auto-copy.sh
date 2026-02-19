#!/bin/bash
# Auto-copy trades from a followed provider via Bankr
# Usage: auto-copy.sh --provider ADDRESS [--max-position-pct 5] [--daily-loss-limit 100] [--enabled true]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.bankr-signals"
CONFIG_FILE="$CONFIG_DIR/config.json"
SUBS_FILE="$CONFIG_DIR/subscriptions.json"
COPY_LOG="$CONFIG_DIR/copy-log.jsonl"

PROVIDER="" MAX_POS_PCT=5 DAILY_LOSS=100 ENABLED="true" EXECUTE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider) PROVIDER="$2"; shift 2 ;;
    --max-position-pct) MAX_POS_PCT="$2"; shift 2 ;;
    --daily-loss-limit) DAILY_LOSS="$2"; shift 2 ;;
    --enabled) ENABLED="$2"; shift 2 ;;
    --execute) EXECUTE=true; shift ;; # Actually run copy for latest signal
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$PROVIDER" ]; then
  echo "Error: --provider is required" >&2
  exit 1
fi

mkdir -p "$CONFIG_DIR"

# Initialize config if needed
if [ ! -f "$CONFIG_FILE" ]; then
  echo '{"provider_address":"","risk":{"max_position_pct":5,"daily_loss_limit":100},"auto_copy":{}}' > "$CONFIG_FILE"
fi

if [ "$EXECUTE" = false ]; then
  # Configure auto-copy settings
  jq --arg addr "$PROVIDER" --argjson max "$MAX_POS_PCT" --argjson loss "$DAILY_LOSS" --argjson on "$([ "$ENABLED" = "true" ] && echo true || echo false)" \
    '.auto_copy[$addr] = {"enabled": $on, "max_position_pct": $max, "daily_loss_limit": $loss}' \
    "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"
  
  if [ "$ENABLED" = "true" ]; then
    echo "✓ Auto-copy enabled for $PROVIDER"
    echo "  Max position: ${MAX_POS_PCT}% per trade"
    echo "  Daily loss limit: \$${DAILY_LOSS}"
  else
    echo "✓ Auto-copy disabled for $PROVIDER"
  fi
  exit 0
fi

# --execute: Process latest signal from provider
echo "Fetching latest signal from $PROVIDER..." >&2
FEED_TOPIC="signals-${PROVIDER}"
LATEST=$(botchan read "$FEED_TOPIC" --limit 1 --json 2>/dev/null || echo "[]")

if [ "$(echo "$LATEST" | jq 'length')" -eq 0 ]; then
  echo "No signals found from $PROVIDER" >&2
  exit 1
fi

SIGNAL_TEXT=$(echo "$LATEST" | jq -r '.[0].text')
SIGNAL=$(echo "$SIGNAL_TEXT" | jq '.' 2>/dev/null)

if [ -z "$SIGNAL" ] || [ "$SIGNAL" = "null" ]; then
  echo "Error: Could not parse signal JSON" >&2
  exit 1
fi

ACTION=$(echo "$SIGNAL" | jq -r '.signal.action')
TOKEN=$(echo "$SIGNAL" | jq -r '.signal.token')
CHAIN=$(echo "$SIGNAL" | jq -r '.signal.chain')
AMOUNT_PCT=$(echo "$SIGNAL" | jq -r '.signal.amount_pct')
TX_HASH=$(echo "$SIGNAL" | jq -r '.proof.tx_hash')

# Step 1: Verify the original trade onchain
echo "Verifying original trade..." >&2
"$SCRIPT_DIR/verify-trade.sh" "$TX_HASH" --chain "$CHAIN" >/dev/null 2>&1 || {
  echo "Error: Could not verify original trade TX. Skipping copy." >&2
  exit 1
}
echo "✓ Original trade verified" >&2

# Step 2: Check risk limits
AUTO_COPY_CONFIG=$(jq --arg addr "$PROVIDER" '.auto_copy[$addr] // empty' "$CONFIG_FILE")
if [ -z "$AUTO_COPY_CONFIG" ] || [ "$(echo "$AUTO_COPY_CONFIG" | jq -r '.enabled')" != "true" ]; then
  echo "Error: Auto-copy not enabled for $PROVIDER" >&2
  exit 1
fi

CONFIGURED_MAX=$(echo "$AUTO_COPY_CONFIG" | jq -r '.max_position_pct')
CONFIGURED_LOSS=$(echo "$AUTO_COPY_CONFIG" | jq -r '.daily_loss_limit')

# Use the smaller of provider's amount_pct and our max
COPY_PCT=$(echo "$AMOUNT_PCT $CONFIGURED_MAX" | awk '{print ($1 < $2) ? $1 : $2}')

# Check daily loss (sum today's copy losses)
TODAY=$(date +%Y-%m-%d)
if [ -f "$COPY_LOG" ]; then
  DAILY_SPENT=$(grep "$TODAY" "$COPY_LOG" 2>/dev/null | jq -s '[.[].usd_amount // 0] | add // 0')
else
  DAILY_SPENT=0
fi

echo "Daily spend so far: \$${DAILY_SPENT} / \$${CONFIGURED_LOSS} limit" >&2

# Step 3: Execute via Bankr
BANKR_SCRIPT="${HOME}/.openclaw/skills/bankr/scripts/bankr.sh"
if [ ! -f "$BANKR_SCRIPT" ]; then
  BANKR_SCRIPT="${HOME}/.clawdbot/skills/bankr/scripts/bankr.sh"
fi

PROMPT="${ACTION} ${COPY_PCT}% of portfolio in ${TOKEN} on ${CHAIN}"
echo "Executing: $PROMPT" >&2

RESULT=$("$BANKR_SCRIPT" "$PROMPT" 2>&1) || {
  echo "Error executing copy trade: $RESULT" >&2
  exit 1
}

echo "✓ Copy trade executed" >&2

# Log the copy
jq -n \
  --arg date "$TODAY" \
  --arg provider "$PROVIDER" \
  --arg action "$ACTION" \
  --arg token "$TOKEN" \
  --arg chain "$CHAIN" \
  --argjson amount_pct "$COPY_PCT" \
  --arg original_tx "$TX_HASH" \
  --argjson timestamp "$(date +%s)" \
  '{date: $date, provider: $provider, action: $action, token: $token, chain: $chain, amount_pct: $amount_pct, original_tx: $original_tx, timestamp: $timestamp}' \
  >> "$COPY_LOG"

echo "$RESULT"
