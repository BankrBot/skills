#!/bin/bash
# Verify a signal's TX hash onchain
# Usage: verify-trade.sh TX_HASH [--chain base]

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: verify-trade.sh TX_HASH [--chain base]" >&2
  exit 1
fi

TX_HASH="$1"; shift
CHAIN="base"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --chain) CHAIN="$2"; shift 2 ;;
    *) shift ;;
  esac
done

# RPC endpoints
case "$CHAIN" in
  base) RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}" ;;
  ethereum) RPC_URL="${ETH_RPC_URL:-https://eth.llamarpc.com}" ;;
  polygon) RPC_URL="${POLYGON_RPC_URL:-https://polygon-rpc.com}" ;;
  *) echo "Error: Unsupported chain: $CHAIN" >&2; exit 1 ;;
esac

echo "Verifying TX: $TX_HASH on $CHAIN" >&2

# Get transaction receipt
RECEIPT=$(curl -sf -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getTransactionReceipt\",\"params\":[\"$TX_HASH\"],\"id\":1}" 2>/dev/null || true)

if [ -z "$RECEIPT" ]; then
  echo "✗ RPC request failed (network error or RPC down)" >&2
  exit 1
fi

if echo "$RECEIPT" | jq -e '.result == null' >/dev/null 2>&1; then
  echo "✗ Transaction not found on $CHAIN" >&2
  exit 1
fi

STATUS=$(echo "$RECEIPT" | jq -r '.result.status')
FROM=$(echo "$RECEIPT" | jq -r '.result.from')
TO=$(echo "$RECEIPT" | jq -r '.result.to')
BLOCK=$(echo "$RECEIPT" | jq -r '.result.blockNumber')
GAS=$(echo "$RECEIPT" | jq -r '.result.gasUsed')

if [ "$STATUS" != "0x1" ]; then
  echo "✗ Transaction FAILED (reverted)" >&2
  echo "{\"verified\":false,\"reason\":\"tx_reverted\",\"tx_hash\":\"$TX_HASH\"}"
  exit 1
fi

BLOCK_DEC=$((BLOCK))
GAS_DEC=$((GAS))

echo "✓ Transaction verified" >&2
echo "  Status:  SUCCESS" >&2
echo "  From:    $FROM" >&2
echo "  To:      $TO" >&2
echo "  Block:   $BLOCK_DEC" >&2
echo "  Gas:     $GAS_DEC" >&2

jq -n \
  --argjson verified true \
  --arg tx_hash "$TX_HASH" \
  --arg chain "$CHAIN" \
  --arg from "$FROM" \
  --arg to "$TO" \
  --argjson block "$BLOCK_DEC" \
  --argjson gas "$GAS_DEC" \
  '{verified: $verified, tx_hash: $tx_hash, chain: $chain, from: $from, to: $to, block: $block, gas: $gas}'
