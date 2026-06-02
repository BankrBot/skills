#!/usr/bin/env bash
set -euo pipefail

# vigil-report-scam.sh — Submit scam token to community database
# Usage: ./vigil-report-scam.sh <token_address> <evidence_type> <description> [chain]
# Requires: BANKR_API_KEY environment variable + staked $VIGIL

TOKEN="${1:?Usage: vigil-report-scam.sh <token_address> <evidence_type> <description> [chain]}"
EVIDENCE="${2:?Evidence type: honeypot|rugpull|phishing|scam|fake}"
DESC="${3:?Provide a brief description of the scam}"
CHAIN="${4:-base}"
API_BASE="${VIGIL_API:-https://api.bankr.bot/vigil}"

if [ -z "${BANKR_API_KEY:-}" ]; then
  echo "Error: BANKR_API_KEY required" >&2
  exit 1
fi

echo "🚨 Submitting scam report..."
echo "  Token:    $TOKEN"
echo "  Type:     $EVIDENCE"
echo "  Chain:    $CHAIN"
echo "  Details:  $DESC"
echo ""

RESPONSE=$(curl -s -f "$API_BASE/report/submit" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -d "{
    \"token\": \"$TOKEN\",
    \"evidence_type\": \"$EVIDENCE\",
    \"description\": \"$DESC\",
    \"chain\": \"$CHAIN\"
  }") || {
  echo "Error: Submission failed" >&2
  exit 1
}

STATUS=$(echo "$RESPONSE" | jq -r '.status')
REPORT_ID=$(echo "$RESPONSE" | jq -r '.report_id')

if [ "$STATUS" = "submitted" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  ✅ Report Submitted"
  echo ""
  echo "  Report ID: $REPORT_ID"
  echo "  Status:    Pending verification"
  echo ""
  echo "  Your report will be reviewed by the community."
  echo "  If verified, you earn a $VIGIL bounty reward."
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo "❌ Submission rejected: $(echo "$RESPONSE" | jq -r '.error // "unknown"')"
fi
