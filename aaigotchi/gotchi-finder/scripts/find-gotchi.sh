#!/bin/bash
set -e

GOTCHI_ID="$1"
OUTPUT_DIR="${2:-.}"

if [ -z "$GOTCHI_ID" ]; then
  echo "Usage: bash find-gotchi.sh <gotchi-id> [output-dir]"
  echo "Example: bash find-gotchi.sh 9638"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔍 Finding Gotchi #$GOTCHI_ID..."
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Fetch gotchi data and SVG
cd "$SKILL_DIR"
node scripts/fetch-gotchi.js "$GOTCHI_ID" "$OUTPUT_DIR"

# Convert SVG to PNG
SVG_FILE="$OUTPUT_DIR/gotchi-$GOTCHI_ID.svg"
PNG_FILE="$OUTPUT_DIR/gotchi-$GOTCHI_ID.png"

if [ -f "$SVG_FILE" ]; then
  node scripts/svg-to-png.js "$SVG_FILE" "$PNG_FILE" 512
  echo ""
  echo "🎉 Success! Files created:"
  echo "   📄 JSON: $OUTPUT_DIR/gotchi-$GOTCHI_ID.json"
  echo "   🎨 SVG:  $SVG_FILE"
  echo "   🖼️  PNG:  $PNG_FILE"
else
  echo "❌ SVG file not found: $SVG_FILE"
  exit 1
fi
