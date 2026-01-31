#!/bin/bash
# ENS Avatar - Set avatar for your ENS name
# Usage: ./set-avatar.sh <ens-name> <avatar-url>
# Example: ./set-avatar.sh clawd.myk.eth https://example.com/avatar.png
#
# Avatar URL formats:
# - HTTPS: https://example.com/image.png
# - IPFS: ipfs://QmHash
# - NFT: eip155:1/erc721:0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d/1234

set -e

ENS_NAME="${1:?Usage: set-avatar.sh <ens-name> <avatar-url>}"
AVATAR_URL="${2:?Usage: set-avatar.sh <ens-name> <avatar-url>}"

# ENS Public Resolver on Ethereum mainnet
# Note: Text records must be set on L1, they're read across all chains
PUBLIC_RESOLVER="0x231b0Ee14048e9dCcD1d247744d114a4EB5E8E63"
RPC_URL="https://eth.llamarpc.com"
CHAIN_ID=1
EXPLORER="etherscan.io"

echo "=== ENS Avatar Setup ===" >&2
echo "Name: $ENS_NAME" >&2
echo "Avatar: $AVATAR_URL" >&2

# Ensure js-sha3 is available
if ! node -e "require('js-sha3')" 2>/dev/null; then
  echo "Installing js-sha3..." >&2
  cd /tmp && npm install --silent js-sha3 2>/dev/null
fi

# Calculate namehash and encode calldata
CALLDATA=$(node -e "
const { keccak256 } = require('js-sha3');

// Namehash calculation
function namehash(name) {
  if (!name) return '0'.repeat(64);
  const labels = name.split('.');
  let node = '0'.repeat(64);
  for (let i = labels.length - 1; i >= 0; i--) {
    const labelHash = keccak256(labels[i]);
    node = keccak256(Buffer.from(node + labelHash, 'hex'));
  }
  return node;
}

const name = '$ENS_NAME';
const avatar = '$AVATAR_URL';
const node = namehash(name);
const key = 'avatar';

// setText(bytes32 node, string key, string value)
// Selector: 0x10f13a8c
const selector = '10f13a8c';

// Encode: node (32 bytes) + offset to key + offset to value + key data + value data
// node: 32 bytes
// key offset: 0x60 (96 bytes from start of params - after node and two offsets)
// value offset: dynamic (after key)

const nodeHex = node;
const keyOffset = '0000000000000000000000000000000000000000000000000000000000000060';
const keyLen = key.length.toString(16).padStart(64, '0');
const keyData = Buffer.from(key, 'utf8').toString('hex').padEnd(64, '0');
const valueLen = avatar.length.toString(16).padStart(64, '0');
const valueData = Buffer.from(avatar, 'utf8').toString('hex').padEnd(Math.ceil(avatar.length / 32) * 64, '0');

// Value offset = 0x60 + 0x20 (key length slot) + 0x20 (key data, padded to 32) = 0xa0
const valueOffset = (0x60 + 0x20 + Math.ceil(key.length / 32) * 32).toString(16).padStart(64, '0');

console.log('0x' + selector + nodeHex + keyOffset + valueOffset + keyLen + keyData + valueLen + valueData);
")

echo "Namehash: calculated" >&2
echo "Submitting to ENS Public Resolver on Ethereum..." >&2

# Submit transaction via Bankr
RESULT=$(~/clawd/skills/bankr/scripts/bankr.sh "Submit this transaction: {\"to\": \"$PUBLIC_RESOLVER\", \"data\": \"$CALLDATA\", \"value\": \"0\", \"chainId\": $CHAIN_ID}" 2>/dev/null)

if echo "$RESULT" | grep -q "$EXPLORER"; then
  TX_HASH=$(echo "$RESULT" | grep -oE "$EXPLORER/tx/0x[a-fA-F0-9]{64}" | grep -oE '0x[a-fA-F0-9]{64}')
  echo "=== SUCCESS ===" >&2
  echo "Avatar set for: $ENS_NAME" >&2
  echo "TX: https://$EXPLORER/tx/$TX_HASH" >&2
  echo "{\"success\":true,\"name\":\"$ENS_NAME\",\"avatar\":\"$AVATAR_URL\",\"tx\":\"$TX_HASH\"}"
elif echo "$RESULT" | grep -q "reverted"; then
  echo "Transaction reverted. Make sure:" >&2
  echo "1. You own or control the ENS name" >&2
  echo "2. The name uses the public resolver" >&2
  echo "Error: $RESULT" >&2
  exit 1
else
  echo "Failed: $RESULT" >&2
  exit 1
fi
