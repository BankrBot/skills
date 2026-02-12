#\!/bin/bash
# Removed set -e to allow proper error handling

export PATH="$HOME/.foundry/bin:$PATH"

CONFIG_FILE="$HOME/.openclaw/skills/aavegotchi/config.json"

# Load private key path from config
PRIVATE_KEY_PATH=$(jq -r ".privateKeyPath" "$CONFIG_FILE")

# Expand tilde in path
PRIVATE_KEY_PATH="${PRIVATE_KEY_PATH/#\~/$HOME}"

# Load private key (NO PASSWORD NEEDED)
set +e
PRIVATE_KEY=$(gpg --quiet --decrypt "$PRIVATE_KEY_PATH" 2>/dev/null)
GPG_EXIT=$?
set -e

if [ $GPG_EXIT -ne 0 ] || [ -z "$PRIVATE_KEY" ]; then
  echo "❌ Failed to decrypt private key from $PRIVATE_KEY_PATH"
  echo "   Make sure the key is encrypted with:"
  echo "   echo '0xYourKey' | gpg --encrypt --recipient automation@openclaw.local -o $PRIVATE_KEY_PATH"
  exit 1
fi

# Load config
CONTRACT=$(jq -r ".contractAddress" "$CONFIG_FILE")
RPC_URL=$(jq -r ".rpcUrl" "$CONFIG_FILE")

# Get gotchi ID from argument or config
if [ -n "$1" ]; then
  GOTCHI_ID="$1"
  echo "🦞 Petting Gotchi #$GOTCHI_ID (manual)..."
else
  # Pet all gotchis from config
  GOTCHI_IDS=$(jq -r ".gotchiIds[]" "$CONFIG_FILE")
  
  for GOTCHI_ID in $GOTCHI_IDS; do
    echo "🦞 Petting Gotchi #$GOTCHI_ID..."
    
    cast send "$CONTRACT" \
      "interact(uint256[])" \
      "[$GOTCHI_ID]" \
      --rpc-url "$RPC_URL" \
      --private-key "$PRIVATE_KEY"
    
    echo "✅ Gotchi #$GOTCHI_ID petted\!"
  done
  
  exit 0
fi

# Pet single gotchi (from argument)
cast send "$CONTRACT" \
  "interact(uint256[])" \
  "[$GOTCHI_ID]" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

echo "✅ Gotchi #$GOTCHI_ID petted\!"
