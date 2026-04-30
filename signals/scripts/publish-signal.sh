#!/bin/bash
# Publish a trading signal to bankrsignals.com via the API
# Usage: ./publish-signal.sh <action> <token> <entry_price> <leverage> <tx_hash> <collateral_usd> [confidence] [reasoning] [stop_loss_pct] [take_profit_pct]
#
# Requires: NET_PRIVATE_KEY env var for EIP-191 signature (use with-secrets.sh)

set -euo pipefail

ACTION="${1:?Usage: publish-signal.sh <action> <token> <entry_price> <leverage> <tx_hash> <collateral_usd> [confidence] [reasoning] [stop_loss_pct] [take_profit_pct]}"
TOKEN="${2:?}"
ENTRY_PRICE="${3:?}"
LEVERAGE="${4:-0}"
TX_HASH="${5:?}"
COLLATERAL_USD="${6:?Size (collateralUsd) is required}"
CONFIDENCE="${7:-}"
REASONING="${8:-}"
STOP_LOSS_PCT="${9:-}"
TAKE_PROFIT_PCT="${10:-}"

# Provider address derived from signing wallet (requires NET_PRIVATE_KEY)
PROVIDER=$(node -e "
const { privateKeyToAccount } = require('viem/accounts');
const pk = process.env.NET_PRIVATE_KEY;
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
console.log(account.address);
")
API_URL="https://bankrsignals.com/api/signals"

# Generate timestamp and message for signing
TIMESTAMP=$(date +%s)
ACTION_UPPER=$(echo "$ACTION" | tr '[:lower:]' '[:upper:]')
TOKEN_UPPER=$(echo "$TOKEN" | tr '[:lower:]' '[:upper:]')
MESSAGE="bankr-signals:signal:${PROVIDER}:${ACTION_UPPER}:${TOKEN_UPPER}:${TIMESTAMP}"

# Sign message with wallet
if [ -z "${NET_PRIVATE_KEY:-}" ]; then
  echo "ERROR: NET_PRIVATE_KEY not set. Use with-secrets.sh" >&2
  exit 1
fi

SIGNATURE=$(node -e "
const { privateKeyToAccount } = require('viem/accounts');
const pk = process.env.NET_PRIVATE_KEY;
const account = privateKeyToAccount(pk.startsWith('0x') ? pk : '0x' + pk);
account.signMessage({ message: '$MESSAGE' }).then(sig => console.log(sig));
")

# Build JSON payload
PAYLOAD=$(python3 -c "
import json
payload = {
    'provider': '$PROVIDER',
    'action': '$ACTION_UPPER',
    'token': '$TOKEN_UPPER',
    'entryPrice': float('$ENTRY_PRICE'),
    'txHash': '$TX_HASH',
    'collateralUsd': float('$COLLATERAL_USD'),
    'message': '$MESSAGE',
    'signature': '$SIGNATURE',
}
if '$LEVERAGE' and '$LEVERAGE' != '0':
    payload['leverage'] = int('$LEVERAGE')
if '$CONFIDENCE':
    payload['confidence'] = float('$CONFIDENCE')
if '''$REASONING''':
    payload['reasoning'] = '''$REASONING'''
if '$STOP_LOSS_PCT':
    payload['stopLossPct'] = float('$STOP_LOSS_PCT')
if '$TAKE_PROFIT_PCT':
    payload['takeProfitPct'] = float('$TAKE_PROFIT_PCT')
print(json.dumps(payload))
")

# POST to API
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "201" ]; then
  SIGNAL_ID=$(echo "$BODY" | python3 -c "import json,sys; print(json.load(sys.stdin).get('signal',{}).get('id','unknown'))")
  echo "✅ Published: $SIGNAL_ID - ${ACTION_UPPER} ${TOKEN_UPPER} @ ${ENTRY_PRICE} (size: \$${COLLATERAL_USD})"
  echo "$BODY"
else
  echo "❌ Failed (HTTP $HTTP_CODE): $BODY" >&2
  exit 1
fi
