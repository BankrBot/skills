#!/bin/bash
# Check status of an AsterPay EUR settlement
# Usage: ./check-settlement.sh <transaction_id>

TXID=$1
API_BASE="https://x402-api-production-ba87.up.railway.app"

if [ -z "$TXID" ]; then
  echo "Usage: ./check-settlement.sh <transaction_id>"
  echo ""
  echo "Check the status of a EUR settlement via SEPA Instant."
  echo "Transaction ID is returned when you initiate an off-ramp."
  exit 1
fi

# Validate TXID format: alphanumeric, hyphens, underscores only (max 128 chars)
# Prevents URL path manipulation via metacharacters (../ ? # etc.)
if ! echo "$TXID" | grep -qE '^[a-zA-Z0-9_-]{1,128}$'; then
  echo "Error: Invalid transaction ID format."
  echo "Transaction IDs contain only alphanumeric characters, hyphens, and underscores."
  exit 1
fi

echo "Checking settlement status..."
echo "Transaction: $TXID"
echo ""

# Single curl call to avoid double requests
RESULT=$(curl -s -w "\n%{http_code}" "$API_BASE/settlement/status/$TXID" 2>/dev/null)
HTTP_CODE=$(echo "$RESULT" | tail -1)
RESPONSE=$(echo "$RESULT" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
elif [ "$HTTP_CODE" = "404" ]; then
  echo "Transaction not found. It may still be processing."
  echo ""
  echo "SEPA Instant typically settles in <10 seconds."
  echo "If more than 30 minutes have passed, contact support@asterpay.io"
else
  echo "Unable to check status (HTTP $HTTP_CODE)."
  echo ""
  echo "SEPA Instant typically settles in <10 seconds."
  echo "If more than 30 minutes have passed, contact support@asterpay.io"
fi
