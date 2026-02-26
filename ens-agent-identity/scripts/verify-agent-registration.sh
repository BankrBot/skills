#!/bin/bash
# ENS Agent Identity - Verify ENSIP-25 link between ENS name and ERC-8004 identity
# Usage: ./verify-agent-registration.sh <ens-name> <agent-id> [chain]
# Example: ./verify-agent-registration.sh alpha-go.bankr.eth 42 base

set -e

ENS_NAME="${1:?Usage: verify-agent-registration.sh <ens-name> <agent-id> [chain]}"
AGENT_ID="${2:?Usage: verify-agent-registration.sh <ens-name> <agent-id> [chain]}"
CHAIN="${3:-base}"

# Chain configuration
case "$CHAIN" in
  base)
    CHAIN_ID=8453
    RPC_URL="https://mainnet.base.org"
    EXPLORER="basescan.org"
    # ERC-7930 prefix for Base: version 1, EVM (0x0000), 2-byte chain ref, chain ID 0x2105, 20-byte addr (0x14)
    ERC7930_PREFIX="0x0001000002210514"
    ;;
  ethereum|mainnet)
    CHAIN_ID=1
    RPC_URL="https://eth.llamarpc.com"
    EXPLORER="etherscan.io"
    ERC7930_PREFIX="0x00010000010114"
    ;;
  sepolia)
    CHAIN_ID=11155111
    RPC_URL="https://rpc.sepolia.org"
    EXPLORER="sepolia.etherscan.io"
    ERC7930_PREFIX="0x0001000003AA36A714"
    ;;
  *)
    echo "Unsupported chain: $CHAIN" >&2
    echo "Supported: base, ethereum, sepolia" >&2
    exit 1
    ;;
esac

# Default registry addresses (ERC-8004)
case "$CHAIN" in
  ethereum|mainnet)
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}"
    ;;
  base)
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A169FB4a3325136EB29fA0ceB6D2e539a432}"
    ;;
  sepolia)
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-0x8004A818BFB912233c491871b3d84c89A494BD9e}"
    ;;
  *)
    IDENTITY_REGISTRY="${ERC8004_REGISTRY:-}"
    ;;
esac

echo "=== ENSIP-25 Verification ===" >&2
echo "ENS Name: $ENS_NAME" >&2
echo "Agent ID: $AGENT_ID" >&2
echo "Chain: $CHAIN (ID: $CHAIN_ID)" >&2
if [ -n "$IDENTITY_REGISTRY" ]; then
  echo "Registry: $IDENTITY_REGISTRY" >&2
fi
echo "" >&2

# Step 1: Resolve ENS name to address
echo "Step 1: Resolving ENS name..." >&2

RESOLVED_ADDR=$(node -e "
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

(async () => {
  try {
    const address = await client.getEnsAddress({ name: normalize('$ENS_NAME') });
    if (address) console.log(address);
  } catch (e) {
    console.error(e.message);
  }
})();
" 2>/dev/null)

if [ -z "$RESOLVED_ADDR" ]; then
  echo "Could not resolve $ENS_NAME to an address" >&2
  exit 1
fi

echo "Address: $RESOLVED_ADDR" >&2

# Step 2: Check ENSIP-25 text record
echo "" >&2
echo "Step 2: Checking ENSIP-25 verification record..." >&2

if [ -n "$IDENTITY_REGISTRY" ]; then
  # Construct the ERC-7930 registry address
  REGISTRY_LOWER=$(echo "$IDENTITY_REGISTRY" | tr '[:upper:]' '[:lower:]')
  ERC7930_ADDR="${ERC7930_PREFIX}${REGISTRY_LOWER#0x}"
  TEXT_RECORD_KEY="agent-registration[${ERC7930_ADDR}][${AGENT_ID}]"

  echo "Text record key: $TEXT_RECORD_KEY" >&2

  RECORD_VALUE=$(node -e "
  const { createPublicClient, http } = require('viem');
  const { mainnet } = require('viem/chains');
  const { normalize } = require('viem/ens');

  const client = createPublicClient({
    chain: mainnet,
    transport: http('https://eth.drpc.org'),
  });

  (async () => {
    try {
      const value = await client.getEnsText({
        name: normalize('$ENS_NAME'),
        key: '$TEXT_RECORD_KEY'
      });
      if (value) console.log(value);
    } catch (e) {}
  })();
  " 2>/dev/null)

  if [ -n "$RECORD_VALUE" ]; then
    echo "ENSIP-25 record value: $RECORD_VALUE" >&2
    ENSIP25_VERIFIED=true
  else
    echo "No ENSIP-25 record found" >&2
    ENSIP25_VERIFIED=false
  fi
else
  echo "No registry address configured for $CHAIN. Set ERC8004_REGISTRY env var." >&2
  ENSIP25_VERIFIED=false
fi

# Step 3: Check ERC-8004 registry (if available)
echo "" >&2
echo "Step 3: Checking ERC-8004 registry..." >&2

ERC8004_VERIFIED=false
if [ -n "$IDENTITY_REGISTRY" ]; then
  # Call tokenURI(uint256) on the Identity Registry (standard ERC-721)
  # Selector: 0xc87b56dd (tokenURI)
  AGENT_ID_HEX=$(printf '%064x' "$AGENT_ID")
  CALLDATA="0xc87b56dd${AGENT_ID_HEX}"

  REGISTRY_RESULT=$(curl -s --max-time 10 -X POST "$RPC_URL" \
    -H "Content-Type: application/json" \
    -d "{
      \"jsonrpc\": \"2.0\",
      \"id\": 1,
      \"method\": \"eth_call\",
      \"params\": [{
        \"to\": \"$IDENTITY_REGISTRY\",
        \"data\": \"$CALLDATA\"
      }, \"latest\"]
    }" | node -e "
      const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
      if (data.result && data.result !== '0x') {
        // Decode ABI-encoded string
        const hex = data.result;
        try {
          const length = parseInt(hex.slice(130, 194), 16);
          if (length > 0) {
            const str = Buffer.from(hex.slice(194, 194 + length * 2), 'hex').toString('utf8');
            console.log(str);
          }
        } catch (e) {}
      }
    " 2>/dev/null)

  if [ -n "$REGISTRY_RESULT" ]; then
    echo "ERC-8004 agent URI: $REGISTRY_RESULT" >&2
    ERC8004_VERIFIED=true
  else
    echo "Agent #$AGENT_ID not found in registry" >&2
  fi
else
  echo "Skipped (no registry address)" >&2
fi

# Summary
echo "" >&2
echo "=== Verification Summary ===" >&2
echo "" >&2

if [ "$ENSIP25_VERIFIED" = "true" ] && [ "$ERC8004_VERIFIED" = "true" ]; then
  echo "ENS Resolution:       $ENS_NAME -> $RESOLVED_ADDR" >&2
  echo "ENSIP-25 Record:      $TEXT_RECORD_KEY = \"$RECORD_VALUE\"" >&2
  echo "ERC-8004 Registry:    Agent #$AGENT_ID found" >&2
  echo "" >&2
  echo "FULLY VERIFIED: $ENS_NAME is agent #$AGENT_ID" >&2
  echo "{\"verified\":true,\"name\":\"$ENS_NAME\",\"address\":\"$RESOLVED_ADDR\",\"agentId\":$AGENT_ID,\"ensip25\":true,\"erc8004\":true}"
elif [ "$ENSIP25_VERIFIED" = "true" ]; then
  echo "ENS Resolution:       $ENS_NAME -> $RESOLVED_ADDR" >&2
  echo "ENSIP-25 Record:      Set" >&2
  echo "ERC-8004 Registry:    Not verified" >&2
  echo "" >&2
  echo "PARTIAL: ENSIP-25 set but ERC-8004 not confirmed" >&2
  echo "{\"verified\":\"partial\",\"name\":\"$ENS_NAME\",\"address\":\"$RESOLVED_ADDR\",\"agentId\":$AGENT_ID,\"ensip25\":true,\"erc8004\":false}"
elif [ "$ERC8004_VERIFIED" = "true" ]; then
  echo "ENS Resolution:       $ENS_NAME -> $RESOLVED_ADDR" >&2
  echo "ENSIP-25 Record:      Not set" >&2
  echo "ERC-8004 Registry:    Agent #$AGENT_ID found" >&2
  echo "" >&2
  echo "PARTIAL: ERC-8004 exists but ENSIP-25 not set" >&2
  echo "{\"verified\":\"partial\",\"name\":\"$ENS_NAME\",\"address\":\"$RESOLVED_ADDR\",\"agentId\":$AGENT_ID,\"ensip25\":false,\"erc8004\":true}"
else
  echo "ENS Resolution:       $ENS_NAME -> $RESOLVED_ADDR" >&2
  echo "ENSIP-25 Record:      Not set" >&2
  echo "ERC-8004 Registry:    Not verified" >&2
  echo "" >&2
  echo "NOT VERIFIED: No ENSIP-25 or ERC-8004 link found" >&2
  echo "{\"verified\":false,\"name\":\"$ENS_NAME\",\"address\":\"$RESOLVED_ADDR\",\"agentId\":$AGENT_ID,\"ensip25\":false,\"erc8004\":false}"
fi
