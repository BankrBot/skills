#!/bin/bash
# ENS Primary Name - Set your primary ENS name on Base (or other L2s)
# Usage: ./set-primary.sh <ens-name> [chain]
# Example: ./set-primary.sh clawd.myk.eth base

set -e

ENS_NAME="${1:?Usage: set-primary.sh <ens-name> [chain]}"
CHAIN="${2:-base}"

# Reverse Registrar addresses by chain
case "$CHAIN" in
  base)
    REVERSE_REGISTRAR="0x0000000000D8e504002cC26E3Ec46D81971C1664"
    RPC_URL="https://mainnet.base.org"
    CHAIN_ID=8453
    EXPLORER="basescan.org"
    ;;
  arbitrum)
    REVERSE_REGISTRAR="0x0000000000D8e504002cC26E3Ec46D81971C1664"
    RPC_URL="https://arb1.arbitrum.io/rpc"
    CHAIN_ID=42161
    EXPLORER="arbiscan.io"
    ;;
  optimism)
    REVERSE_REGISTRAR="0x0000000000D8e504002cC26E3Ec46D81971C1664"
    RPC_URL="https://mainnet.optimism.io"
    CHAIN_ID=10
    EXPLORER="optimistic.etherscan.io"
    ;;
  ethereum|mainnet)
    # For L1, use the default reverse registrar
    REVERSE_REGISTRAR="0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9"
    RPC_URL="https://eth.llamarpc.com"
    CHAIN_ID=1
    EXPLORER="etherscan.io"
    ;;
  *)
    echo "Unsupported chain: $CHAIN" >&2
    echo "Supported: base, arbitrum, optimism, ethereum" >&2
    exit 1
    ;;
esac

echo "=== ENS Primary Name Setup ===" >&2
echo "Name: $ENS_NAME" >&2
echo "Chain: $CHAIN (ID: $CHAIN_ID)" >&2
echo "Reverse Registrar: $REVERSE_REGISTRAR" >&2

# Encode setName(string) calldata
# Function selector: 0xc47f0027
# String encoding: offset (0x20), length, padded data

CALLDATA=$(node -e "
const name = '$ENS_NAME';
const selector = '0xc47f0027';

// String offset (always 0x20 for single string param)
const offset = '0000000000000000000000000000000000000000000000000000000000000020';

// String length
const len = name.length.toString(16).padStart(64, '0');

// String data (UTF-8 bytes, padded to 32-byte boundary)
const data = Buffer.from(name, 'utf8').toString('hex').padEnd(Math.ceil(name.length / 32) * 64, '0');

console.log(selector + offset + len + data);
")

echo "Calldata: $CALLDATA" >&2

# Submit transaction via Bankr
echo "Submitting transaction..." >&2
RESULT=$(~/clawd/skills/bankr/scripts/bankr.sh "Submit this transaction: {\"to\": \"$REVERSE_REGISTRAR\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}" 2>/dev/null)

if echo "$RESULT" | grep -q "$EXPLORER"; then
  TX_HASH=$(echo "$RESULT" | grep -oE "$EXPLORER/tx/0x[a-fA-F0-9]{64}" | grep -oE '0x[a-fA-F0-9]{64}')
  echo "=== SUCCESS ===" >&2
  echo "Primary name set to: $ENS_NAME" >&2
  echo "TX: https://$EXPLORER/tx/$TX_HASH" >&2
  echo "{\"success\":true,\"name\":\"$ENS_NAME\",\"chain\":\"$CHAIN\",\"tx\":\"$TX_HASH\"}"
elif echo "$RESULT" | grep -q "reverted"; then
  echo "Transaction reverted. Make sure:" >&2
  echo "1. The ENS name resolves to your address on $CHAIN" >&2
  echo "2. You own or control the name" >&2
  echo "Error: $RESULT" >&2
  exit 1
else
  echo "Failed: $RESULT" >&2
  exit 1
fi
