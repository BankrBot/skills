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

echo "Checking settlement status..."
echo "Transaction: $TXID"
echo ""

RESPONSE=$(curl -s "$API_BASE/settlement/status/$TXID" 2>/dev/null)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_BASE/settlement/status/$TXID" 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
  echo "Status: Checking..."
  echo ""
  echo "SEPA Instant typically settles in <10 seconds."
  echo "If more than 30 minutes have passed, contact support@asterpay.io"
fi
