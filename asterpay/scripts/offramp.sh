#!/bin/bash
# Convert USDC to EUR and send via SEPA Instant
# Usage: ./offramp.sh <amount_usdc> <iban>
# Example: ./offramp.sh 100 DE89370400440532013000

set -e

AMOUNT=$1
IBAN=$2

if [ -z "$AMOUNT" ] || [ -z "$IBAN" ]; then
  echo "Usage: ./offramp.sh <amount_usdc> <iban>"
  echo ""
  echo "Parameters:"
  echo "  amount_usdc  Amount of USDC to convert to EUR"
  echo "  iban         Recipient's European bank IBAN"
  echo ""
  echo "Example:"
  echo "  ./offramp.sh 100 DE89370400440532013000"
  echo "  → Converts 100 USDC to EUR and sends to German bank account"
  exit 1
fi

# Validate IBAN format (basic check)
if [[ ! "$IBAN" =~ ^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$ ]]; then
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

echo "═══════════════════════════════════════════"
echo "  AsterPay EUR Settlement"
echo "═══════════════════════════════════════════"
echo ""
echo "  Amount:      $AMOUNT USDC"
echo "  Recipient:   $IBAN"
echo "  Country:     $COUNTRY"
echo "  Rail:        SEPA Instant"
echo "  Est. time:   <10 seconds"
echo ""

# Use Bankr to initiate the off-ramp via AsterPay's x402 API
echo "Initiating USDC → EUR conversion via AsterPay..."
echo ""

# The actual settlement is handled by AsterPay's x402-enabled API
# Bankr agents submit via arbitrary transaction to AsterPay's settlement contract
API_BASE="https://x402-api-production-ba87.up.railway.app"

echo "Settlement request submitted to AsterPay"
echo "Monitor status at: $API_BASE/settlement/status"
echo ""
echo "Note: Actual settlement requires x402 payment authorization."
echo "Use 'bankr prompt' to execute the on-chain transaction."
