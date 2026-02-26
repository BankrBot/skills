#!/bin/bash
# ENS Agent Identity - Resolve an agent's ENS name and all metadata
# Usage: ./resolve-agent.sh <ens-name>
# Example: ./resolve-agent.sh alpha-go.bankr.eth

set -e

ENS_NAME="${1:?Usage: resolve-agent.sh <ens-name>}"

echo "=== Resolving Agent: $ENS_NAME ===" >&2
echo "" >&2

# Resolve address and all agent text records
RESULT=$(node -e "
const { createPublicClient, http } = require('viem');
const { mainnet } = require('viem/chains');
const { normalize } = require('viem/ens');

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.drpc.org'),
});

const AGENT_KEYS = [
  'agent:type',
  'agent:capabilities',
  'agent:chains',
  'agent:a2a',
  'agent:version',
  'agent:creator',
  'agent:token',
  'agent:token:symbol',
  'agent:token:address',
  'agent:delegation',
  'agent:mode',
  'agent:policy',
  'agent:chainId',
];

(async () => {
  try {
    const name = normalize('$ENS_NAME');

    // Resolve address
    const address = await client.getEnsAddress({ name });

    // Resolve avatar
    let avatar = null;
    try {
      avatar = await client.getEnsAvatar({ name });
    } catch (e) {}

    // Resolve text records
    const records = {};
    const results = await Promise.allSettled(
      AGENT_KEYS.map(async (key) => {
        const value = await client.getEnsText({ name, key });
        return { key, value };
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.value) {
        records[result.value.key] = result.value.value;
      }
    }

    const output = {
      name: '$ENS_NAME',
      address: address || null,
      avatar: avatar || null,
      records,
    };

    console.log(JSON.stringify(output, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
    process.exit(1);
  }
})();
" 2>/dev/null)

if [ -z "$RESULT" ]; then
  echo "Error: Could not resolve $ENS_NAME" >&2
  exit 1
fi

# Parse and display
ADDRESS=$(echo "$RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.address||'(none)')" 2>/dev/null)
AVATAR=$(echo "$RESULT" | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(d.avatar||'')" 2>/dev/null)

echo "Name:    $ENS_NAME" >&2
echo "Address: $ADDRESS" >&2
if [ -n "$AVATAR" ]; then
  echo "Avatar:  $AVATAR" >&2
fi
echo "" >&2

# Display agent records
echo "--- Agent Metadata ---" >&2
echo "$RESULT" | node -e "
const data = JSON.parse(require('fs').readFileSync('/dev/stdin', 'utf8'));
const records = data.records || {};
const keys = Object.keys(records);

if (keys.length === 0) {
  console.error('No agent text records found');
} else {
  const maxKeyLen = Math.max(...keys.map(k => k.length));
  for (const [key, value] of Object.entries(records)) {
    console.error(key.padEnd(maxKeyLen + 2) + value);
  }
}
" 2>/dev/null

echo "" >&2

# Output JSON
echo "$RESULT"
