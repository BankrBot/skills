#!/bin/bash
# Publish a trade signal with onchain proof via Net Protocol
# Usage: publish-signal.sh --action BUY --token ETH --chain base --entry-price 2750.50 --amount-pct 5 --tx-hash 0x...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$HOME/.bankr-signals"
CONFIG_FILE="$CONFIG_DIR/config.json"

# Defaults
ACTION="" TOKEN="" CHAIN="base" ENTRY_PRICE="" AMOUNT_PCT="5"
STOP_LOSS_PCT="" TAKE_PROFIT_PCT="" CONFIDENCE="" REASONING="" TX_HASH=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --action) ACTION="$2"; shift 2 ;;
    --token) TOKEN="$2"; shift 2 ;;
    --chain) CHAIN="$2"; shift 2 ;;
    --entry-price) ENTRY_PRICE="$2"; shift 2 ;;
    --amount-pct) AMOUNT_PCT="$2"; shift 2 ;;
    --stop-loss-pct) STOP_LOSS_PCT="$2"; shift 2 ;;
    --take-profit-pct) TAKE_PROFIT_PCT="$2"; shift 2 ;;
    --confidence) CONFIDENCE="$2"; shift 2 ;;
    --reasoning) REASONING="$2"; shift 2 ;;
    --tx-hash) TX_HASH="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# Validate required fields
for field in ACTION TOKEN ENTRY_PRICE TX_HASH; do
  if [ -z "${!field}" ]; then
    echo "Error: --$(echo $field | tr '[:upper:]' '[:lower:]' | tr '_' '-') is required" >&2
    exit 1
  fi
done

ACTION=$(echo "$ACTION" | tr '[:lower:]' '[:upper:]')
if [[ "$ACTION" != "BUY" && "$ACTION" != "SELL" ]]; then
  echo "Error: --action must be BUY or SELL" >&2
  exit 1
fi

# Ensure config exists
mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config not found. Run: mkdir -p ~/.bankr-signals && echo '{\"provider_address\":\"0xYOUR_ADDRESS\"}' > ~/.bankr-signals/config.json" >&2
  exit 1
fi

PROVIDER=$(jq -r '.provider_address' "$CONFIG_FILE")
if [ -z "$PROVIDER" ] || [ "$PROVIDER" = "null" ]; then
  echo "Error: provider_address not set in $CONFIG_FILE" >&2
  exit 1
fi

TIMESTAMP=$(date +%s)

# Verify TX hash onchain before publishing
echo "Verifying TX hash onchain..." >&2
case "$CHAIN" in
  base)     RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}" ;;
  ethereum) RPC_URL="${ETH_RPC_URL:-https://eth.llamarpc.com}" ;;
  polygon)  RPC_URL="${POLYGON_RPC_URL:-https://polygon-rpc.com}" ;;
  *)        RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}" ;;
esac

TX_RECEIPT=$(curl -sf -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$TX_HASH\"],\"id\":1}" 2>/dev/null || true)

if [ -z "$TX_RECEIPT" ] || echo "$TX_RECEIPT" | jq -e '.result == null' >/dev/null 2>&1; then
  echo "Warning: Could not verify TX hash. Publishing anyway (subscribers will verify independently)." >&2
  BLOCK_NUMBER=""
else
  TX_STATUS=$(echo "$TX_RECEIPT" | jq -r '.result.status')
  if [ "$TX_STATUS" != "0x1" ]; then
    echo "Error: TX $TX_HASH failed (status: $TX_STATUS). Cannot publish failed trade as signal." >&2
    exit 1
  fi
  BLOCK_NUMBER=$(echo "$TX_RECEIPT" | jq -r '.result.blockNumber')
  BLOCK_NUMBER=$((BLOCK_NUMBER))
  echo "✓ TX verified at block $BLOCK_NUMBER" >&2
fi

# Build signal JSON
SIGNAL_JSON=$(jq -n \
  --arg version "1.0" \
  --arg provider "$PROVIDER" \
  --argjson timestamp "$TIMESTAMP" \
  --arg action "$ACTION" \
  --arg token "$TOKEN" \
  --arg chain "$CHAIN" \
  --argjson entry_price "$ENTRY_PRICE" \
  --argjson amount_pct "$AMOUNT_PCT" \
  --arg tx_hash "$TX_HASH" \
  --arg block_number "${BLOCK_NUMBER:-}" \
  --arg stop_loss_pct "${STOP_LOSS_PCT:-}" \
  --arg take_profit_pct "${TAKE_PROFIT_PCT:-}" \
  --arg confidence "${CONFIDENCE:-}" \
  --arg reasoning "${REASONING:-}" \
  '{
    version: $version,
    provider: $provider,
    timestamp: $timestamp,
    signal: {
      action: $action,
      token: $token,
      chain: $chain,
      entry_price: $entry_price,
      amount_pct: $amount_pct
    },
    proof: {
      tx_hash: $tx_hash
    }
  }
  | if $stop_loss_pct != "" then .signal.stop_loss_pct = ($stop_loss_pct | tonumber) else . end
  | if $take_profit_pct != "" then .signal.take_profit_pct = ($take_profit_pct | tonumber) else . end
  | if $confidence != "" then .signal.confidence = ($confidence | tonumber) else . end
  | if $reasoning != "" then .signal.reasoning = $reasoning else . end
  | if $block_number != "" then .proof.block_number = ($block_number | tonumber) else . end
  ')

FEED_TOPIC="signals-${PROVIDER}"

echo "Publishing signal to feed: $FEED_TOPIC" >&2

# Publish via botchan (Net Protocol)
if command -v botchan &>/dev/null; then
  # Try direct publish with private key
  if [ -n "${NET_PRIVATE_KEY:-}" ] || [ -n "${BOTCHAN_PRIVATE_KEY:-}" ]; then
    PKEY="${NET_PRIVATE_KEY:-$BOTCHAN_PRIVATE_KEY}"
    botchan post "$FEED_TOPIC" "$SIGNAL_JSON" --private-key "$PKEY"
  else
    # Fall back to with-secrets.sh
    export FEED_TOPIC SIGNAL_JSON
    ~/clawd/scripts/with-secrets.sh bash -c 'botchan post "$FEED_TOPIC" "$SIGNAL_JSON" --private-key "$NET_PRIVATE_KEY"'
  fi
else
  echo "Error: botchan not installed. Run: npm install -g botchan" >&2
  exit 1
fi

echo "✓ Signal published" >&2
echo "$SIGNAL_JSON"

# Log locally
LOG_DIR="$CONFIG_DIR/signals"
mkdir -p "$LOG_DIR"
echo "$SIGNAL_JSON" >> "$LOG_DIR/published.jsonl"
