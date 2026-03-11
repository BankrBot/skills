#!/bin/bash
set -e

export PATH="$HOME/.foundry/bin:$PATH"

# Load secrets from encrypted storage
PRIVATE_KEY=$(gpg --quiet --decrypt ~/.openclaw/secrets/aavegotchi-private-key.gpg 2>/dev/null)

if [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Failed to load private key. Run: ~/.openclaw/scripts/secrets.sh add aavegotchi-private-key"
  exit 1
fi

# Config (non-sensitive data can stay in plaintext)
CONTRACT="0xa99c4b08201f2913db8d28e71d020c4298f29dbf"
GOTCHI_ID="${1:-9638}"
RPC_URL="https://mainnet.base.org"

echo "Petting Aavegotchi #$GOTCHI_ID..."

cast send "$CONTRACT" \
  "interact(uint256[])" \
  "[$GOTCHI_ID]" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

echo "✅ Aavegotchi #$GOTCHI_ID petted successfully!"
