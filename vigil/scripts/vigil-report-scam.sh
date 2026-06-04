#!/usr/bin/env bash
set -euo pipefail

# vigil-report-scam.sh — Submit a scam token to the VIGIL community database.
# Usage: ./vigil-report-scam.sh <token_address> <evidence_type> <description> [chain]
#   evidence_type: honeypot | rugpull | phishing | scam | fake
#
# Reporting is a write action. It is submitted through the MCP server's
# report tool. Configure VIGIL_REPORT_ENDPOINT if your server exposes it on a
# non-default path; otherwise this calls the standard tools/call route.

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-report-scam.sh <token> <evidence_type> <description> [chain]}")
EVIDENCE="${2:?evidence_type: honeypot|rugpull|phishing|scam|fake}"
DESC="${3:?Provide a brief description of the scam evidence}"
CHAIN=$(vigil_validate_chain "${4:-base}")

case "$EVIDENCE" in
  honeypot|rugpull|phishing|scam|fake) ;;
  *) echo "Error: evidence_type must be honeypot|rugpull|phishing|scam|fake" >&2; exit 1 ;;
esac

# Escape the free-text description for safe JSON embedding.
DESC_JSON=$(printf '%s' "$DESC" | jq -Rs '.')

echo "🚨 Submitting scam report for $TOKEN ($EVIDENCE) on $CHAIN..."
echo ""

ARGS="{\"token\":\"$TOKEN\",\"evidence_type\":\"$EVIDENCE\",\"description\":$DESC_JSON,\"chain\":\"$CHAIN\"}"
RESPONSE=$(vigil_call vigil_report_scam "$ARGS")

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ $(echo "$RESPONSE" | jq -r '.status // "submitted"')"
echo "  Report ID:  $(echo "$RESPONSE" | jq -r '.report_id // "N/A"')"
echo "  Reports for token: $(echo "$RESPONSE" | jq -r '.total_reports_for_token // 1')"
echo "  Bounty:     $(echo "$RESPONSE" | jq -r '.bounty // "—"')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
