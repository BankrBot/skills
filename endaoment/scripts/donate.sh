#!/bin/bash
# Donate USDC to an Endaoment charity on Base via Bankr arbitrary transactions
# Usage: ./donate.sh <ein> <amount_usdc>
#
# Example: ./donate.sh 11-1666852 1   (donates 1 USDC to North Shore Animal League)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BANKR_SCRIPT="${BANKR_SCRIPT:-$SCRIPT_DIR/../../bankr/scripts/bankr.sh}"

EIN="${1:-}"
AMOUNT="${2:-}"

if [[ -z "$EIN" ]] || [[ -z "$AMOUNT" ]]; then
  echo "Usage: $0 <ein> <amount_usdc>"
  echo ""
  echo "Examples:"
  echo "  $0 11-1666852 1      # North Shore Animal League America"
  echo "  $0 27-1661997 5      # GiveDirectly"
  echo "  $0 53-0196605 10     # American Red Cross"
  exit 1
fi

# Base chain addresses
FACTORY="0x10fd9348136dcea154f752fe0b6db45fc298a589"
USDC="0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
CHAIN_ID=8453

# Convert amount to USDC decimals (6)
AMOUNT_WEI=$(echo "$AMOUNT * 1000000" | bc | cut -d'.' -f1)
AMOUNT_HEX=$(printf '%064x' "$AMOUNT_WEI")

# Encode EIN as bytes32 (remove spaces, convert to hex, pad to 32 bytes)
EIN_CLEAN=$(echo "$EIN" | tr -d ' ')
EIN_HEX=$(echo -n "$EIN_CLEAN" | xxd -p)
ORG_ID="${EIN_HEX}$(printf '%0*d' $((64 - ${#EIN_HEX})) 0)"

# Function selectors
APPROVE_SELECTOR="095ea7b3"  # approve(address,uint256)
DEPLOY_SELECTOR="db9e30cc"   # deployOrgAndDonate(bytes32,uint256)

# Construct calldata
APPROVE_DATA="0x${APPROVE_SELECTOR}000000000000000000000000${FACTORY:2}${AMOUNT_HEX}"
DEPLOY_DATA="0x${DEPLOY_SELECTOR}${ORG_ID}${AMOUNT_HEX}"

echo "🎁 Endaoment Donation on Base"
echo "   EIN: $EIN"
echo "   Amount: $AMOUNT USDC"
echo ""

# Transaction 1: Approve USDC
echo "📝 Step 1: Approving USDC..."
APPROVE_TX="{\"to\": \"$USDC\", \"data\": \"$APPROVE_DATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

APPROVE_RESULT=$("$BANKR_SCRIPT" "Submit this transaction: $APPROVE_TX" 2>&1)
if echo "$APPROVE_RESULT" | grep -q "basescan.org/tx"; then
  APPROVE_HASH=$(echo "$APPROVE_RESULT" | grep -o 'https://basescan.org/tx/[^ "]*' | head -1)
  echo "   ✅ Approved: $APPROVE_HASH"
else
  echo "   ❌ Approve failed: $APPROVE_RESULT"
  exit 1
fi

# Transaction 2: Deploy & Donate
echo "📝 Step 2: Deploying org & donating..."
DEPLOY_TX="{\"to\": \"$FACTORY\", \"data\": \"$DEPLOY_DATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}"

DEPLOY_RESULT=$("$BANKR_SCRIPT" "Submit this transaction: $DEPLOY_TX" 2>&1)
if echo "$DEPLOY_RESULT" | grep -q "basescan.org/tx"; then
  DEPLOY_HASH=$(echo "$DEPLOY_RESULT" | grep -o 'https://basescan.org/tx/[^ "]*' | head -1)
  echo "   ✅ Donated: $DEPLOY_HASH"
else
  echo "   ❌ Donation failed: $DEPLOY_RESULT"
  exit 1
fi

echo ""
echo "🎉 Success! Donated $AMOUNT USDC to charity (EIN: $EIN)"
echo "   Net to charity: ~\$$(echo "$AMOUNT * 0.985" | bc) (after 1.5% Endaoment fee)"
