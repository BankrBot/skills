#\!/bin/bash
set -e

# Load config
SKILL_DIR="$HOME/.openclaw/skills/aavegotchi"
CONFIG_FILE="$SKILL_DIR/config.json"

if [ \! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file not found at $CONFIG_FILE"
  exit 1
fi

# Parse config
CONTRACT=$(jq -r .contractAddress "$CONFIG_FILE")
RPC_URL=$(jq -r .rpcUrl "$CONFIG_FILE")
PRIVATE_KEY_PATH=$(jq -r .privateKeyPath "$CONFIG_FILE")
PRIVATE_KEY_ENCRYPTED=$(jq -r .privateKeyEncrypted "$CONFIG_FILE")

# Expand tilde in path
PRIVATE_KEY_PATH="${PRIVATE_KEY_PATH/#\~/$HOME}"

# Load private key
if [ "$PRIVATE_KEY_ENCRYPTED" = "true" ]; then
  # Decrypt private key
  PRIVATE_KEY=$(gpg --quiet --decrypt "$PRIVATE_KEY_PATH" 2>/dev/null) || {
    echo "Error: Failed to decrypt private key from $PRIVATE_KEY_PATH"
    exit 1
  }
else
  # Read plain text private key
  PRIVATE_KEY=$(cat "$PRIVATE_KEY_PATH" 2>/dev/null) || {
    echo "Error: Failed to read private key from $PRIVATE_KEY_PATH"
    exit 1
  }
fi

if [ -z "$PRIVATE_KEY" ]; then
  echo "Error: Private key is empty"
  exit 1
fi

# Get gotchi ID from argument or use first from config
if [ -n "$1" ]; then
  GOTCHI_ID="$1"
else
  GOTCHI_ID=$(jq -r .gotchiIds[0] "$CONFIG_FILE")
fi

echo "Petting Aavegotchi #$GOTCHI_ID..."

# Call interact function with gotchi ID
export PATH="$HOME/.foundry/bin:$PATH"
cast send "$CONTRACT" \
  "interact(uint256[])" \
  "[$GOTCHI_ID]" \
  --rpc-url "$RPC_URL" \
  --private-key "$PRIVATE_KEY"

echo "✅ Aavegotchi #$GOTCHI_ID petted successfully\!"
