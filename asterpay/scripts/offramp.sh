#!/bin/bash
# Convert USDC to EUR and send via SEPA Instant
# Usage: ./offramp.sh <amount_usdc> <iban>
# Example: ./offramp.sh 100 DE89370400440532013000
#
# NOTE: This script validates input and generates the Bankr prompt
# to execute the off-ramp. The actual on-chain transaction is
# submitted via Bankr's agent API.

set -e

AMOUNT=$1
IBAN=$2

if [ -z "$AMOUNT" ] || [ -z "$IBAN" ]; then
  echo "Usage: ./offramp.sh <amount_usdc> <iban>"
  echo ""
  echo "Parameters:"
  echo "  amount_usdc  Amount of USDC to convert to EUR (numeric, 1-110000)"
  echo "  iban         Recipient's European bank IBAN"
  echo ""
  echo "Example:"
  echo "  ./offramp.sh 100 DE89370400440532013000"
  echo "  -> Converts 100 USDC to EUR and sends to German bank account"
  exit 1
fi

# Validate amount is numeric and within safe length to prevent prompt injection
# Max 6 integer digits + optional 2 decimal = 999999.99 (well above SEPA limit)
if ! echo "$AMOUNT" | grep -qE '^[0-9]{1,6}(\.[0-9]{1,2})?$'; then
  echo "Error: Amount must be a numeric value between 1 and 110000 (e.g., 100 or 99.50)"
  exit 1
fi

# Strip decimal part for range check (conservative: 99.50 -> 99)
AMOUNT_INT=$(echo "$AMOUNT" | grep -oE '^[0-9]+')

if [ "$AMOUNT_INT" -lt 1 ]; then
  echo "Error: Minimum amount is 1 USDC"
  exit 1
fi

# SEPA Instant limit is EUR 100,000. At ~1.05-1.10 USD/EUR, that's ~110,000 USDC max.
if [ "$AMOUNT_INT" -gt 110000 ]; then
  echo "Error: Maximum amount is ~110,000 USDC (SEPA Instant limit of EUR 100,000)"
  exit 1
fi

# Validate IBAN format (ISO 13616: 2-letter country + 2 check digits + 11-30 BBAN chars)
if [[ ! "$IBAN" =~ ^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$ ]]; then
  echo "Error: Invalid IBAN format"
  echo "IBAN must start with 2-letter country code followed by check digits"
  exit 1
fi

# Check SEPA country support
COUNTRY=${IBAN:0:2}
SEPA_COUNTRIES="AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE NO IS LI CH GB MC SM AD VA"
if [[ ! " $SEPA_COUNTRIES " =~ " $COUNTRY " ]]; then
  echo "Error: Country $COUNTRY is not in the SEPA zone"
  echo "Supported: $SEPA_COUNTRIES"
  exit 1
fi

echo "======================================="
echo "  AsterPay EUR Settlement"
echo "======================================="
echo ""
echo "  Amount:      $AMOUNT USDC"
echo "  Recipient:   $IBAN"
echo "  Country:     $COUNTRY"
echo "  Rail:        SEPA Instant"
echo "  Est. time:   <10 seconds"
echo ""

# Check if bankr CLI is available
if command -v bankr &> /dev/null; then
  echo "Submitting off-ramp via Bankr..."
  bankr prompt "Send $AMOUNT USDC to AsterPay EUR off-ramp for IBAN $IBAN. Use AsterPay's x402 settlement API at https://x402-api-production-ba87.up.railway.app to convert USDC to EUR via SEPA Instant."
else
  echo "Bankr CLI not found. To execute this off-ramp:"
  echo ""
  echo "Option 1 - Install Bankr CLI:"
  echo "  npm install -g @bankr/cli"
  echo "  bankr login"
  echo "  bankr prompt \"Send $AMOUNT USDC to AsterPay EUR off-ramp for IBAN $IBAN\""
  echo ""
  echo "Option 2 - Use Bankr REST API:"
  echo "  curl -X POST https://api.bankr.bot/agent/prompt \\"
  echo "    -H \"X-API-Key: \$BANKR_API_KEY\" \\"
  echo "    -H \"Content-Type: application/json\" \\"
  echo "    -d '{\"prompt\": \"Send $AMOUNT USDC to AsterPay EUR off-ramp for IBAN $IBAN\"}'"
  echo ""
  echo "Option 3 - Use AsterPay MCP Server (for Claude/Cursor):"
  echo '  {"mcpServers": {"asterpay": {"command": "npx", "args": ["@asterpay/mcp-server"]}}}'
fi
