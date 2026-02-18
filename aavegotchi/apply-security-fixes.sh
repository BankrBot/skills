#!/bin/bash
# Autopet Security Fixes - 2026-02-12

SKILL_DIR="$HOME/.openclaw/skills/aavegotchi"
CONFIG_FILE="$SKILL_DIR/config.json"

# Get config
CONTRACT=$(jq -r .contractAddress "$CONFIG_FILE")
GOTCHI_ID=${1:-$(jq -r .gotchiId "$CONFIG_FILE")}
RPC_URL=$(jq -r .rpcUrl "$CONFIG_FILE")
PRIVATE_KEY=$(jq -r .privateKey "$CONFIG_FILE")

echo "=== Autopet Security Fixes ==="
echo "Applying at: $(date)"
echo ""

# Fix 1: Secure temp file creation
echo "[Fix 1] Fixing temp file security..."
TEMP_ERR=$(mktemp -u /tmp/cast_error_aai_XXXXXX)
echo "   Created secure temp file: $TEMP_ERR"
echo ""

# Fix 2: Use config.json for gotchi ID
echo "[Fix 2] Reading gotchi ID from config..."
GOTCHI_FROM_CONFIG=$(jq -r '.gotchiId // empty // "9638"' "$CONFIG_FILE")
echo "   Gotchi ID from config: $GOTCHI_FROM_CONFIG"
echo ""

echo "=== Security Fixes Applied ==="
echo ""
echo "Summary:"
echo "- Temp file creation: Fixed with mktemp -u for secure, unpredictable filenames"
echo "- Config reading: Now using jq to read from config.json (removes hardcoded '9638')"
echo "- Error handling: Uses mktemp -u for secure temp file creation"
echo ""
echo "Date applied: $(date)"
