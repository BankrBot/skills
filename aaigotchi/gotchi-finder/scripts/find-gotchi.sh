#!/bin/bash
set -e

# Parse arguments
GOTCHI_ID=""
OUTPUT_DIR="."
FORMAT="preview"  # Default: preview only (fetch data + standard PNG)

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --format)
      FORMAT="$2"
      shift 2
      ;;
    --output)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -*)
      echo "Unknown option: $1"
      echo "Usage: bash find-gotchi.sh <gotchi-id> [--format preview|png|hires|svg|all] [--output <dir>]"
      exit 1
      ;;
    *)
      if [ -z "$GOTCHI_ID" ]; then
        GOTCHI_ID="$1"
      else
        OUTPUT_DIR="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$GOTCHI_ID" ]; then
  echo "Usage: bash find-gotchi.sh <gotchi-id> [output-dir] [--format preview|png|hires|svg|all]"
  echo ""
  echo "Arguments:"
  echo "  <gotchi-id>  Gotchi ID number (e.g., 9638)"
  echo ""
  echo "Options:"
  echo "  --format <type>    Image format to generate (default: preview)"
  echo "                     preview - Fetch data + standard PNG preview (512x512)"
  echo "                     png     - Standard PNG only (512x512)"
  echo "                     hires   - Hi-res PNG only (1024x1024)"
  echo "                     svg     - SVG only (no PNG)"
  echo "                     all     - All formats (PNG + Hi-res + SVG)"
  echo "  --output <dir>     Output directory (default: current directory)"
  echo ""
  echo "Examples:"
  echo "  # Preview mode (default)"
  echo "  bash find-gotchi.sh 9638"
  echo ""
  echo "  # With specific format"
  echo "  bash find-gotchi.sh 9638 --format hires"
  echo "  bash find-gotchi.sh 9638 --format all"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"

# Validate ID is numeric
if [[ ! "$GOTCHI_ID" =~ ^[0-9]+$ ]]; then
  echo "❌ Invalid gotchi ID: \"$GOTCHI_ID\""
  echo "Please provide a numeric gotchi ID (e.g., 9638)"
  exit 1
fi

echo "🔍 Finding Gotchi #$GOTCHI_ID..."
echo "📂 Output: $OUTPUT_DIR"
echo "🎨 Format: $FORMAT"
echo ""

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Fetch gotchi data and SVG
cd "$SKILL_DIR"
node scripts/fetch-gotchi.js "$GOTCHI_ID" "$OUTPUT_DIR"

SVG_FILE="$OUTPUT_DIR/gotchi-$GOTCHI_ID.svg"

if [ ! -f "$SVG_FILE" ]; then
  echo "❌ SVG file not found: $SVG_FILE"
  exit 1
fi

# Generate PNG files based on format option
PNG_FILE="$OUTPUT_DIR/gotchi-$GOTCHI_ID.png"
HIRES_FILE="$OUTPUT_DIR/gotchi-$GOTCHI_ID-hires.png"

case $FORMAT in
  preview)
    # Default preview mode: just standard PNG
    node scripts/svg-to-png.js "$SVG_FILE" "$PNG_FILE" 512
    ;;
  png)
    node scripts/svg-to-png.js "$SVG_FILE" "$PNG_FILE" 512
    ;;
  hires)
    node scripts/svg-to-png.js "$SVG_FILE" "$HIRES_FILE" 1024
    ;;
  svg)
    echo "✅ SVG only - no PNG conversion"
    ;;
  all)
    node scripts/svg-to-png.js "$SVG_FILE" "$PNG_FILE" 512
    node scripts/svg-to-png.js "$SVG_FILE" "$HIRES_FILE" 1024
    ;;
  *)
    echo "❌ Invalid format: $FORMAT"
    echo "Valid formats: preview, png, hires, svg, all"
    exit 1
    ;;
esac

# Print summary
echo ""
echo "🎉 Success! Files created:"
echo "   📄 JSON: $OUTPUT_DIR/gotchi-$GOTCHI_ID.json"

if [ "$FORMAT" != "svg" ]; then
  if [ "$FORMAT" = "all" ] || [ "$FORMAT" = "png" ] || [ "$FORMAT" = "preview" ]; then
    echo "   🖼️  PNG:  $PNG_FILE (512x512)"
  fi
  if [ "$FORMAT" = "all" ] || [ "$FORMAT" = "hires" ]; then
    echo "   🖼️  PNG:  $HIRES_FILE (1024x1024)"
  fi
fi

echo "   🎨 SVG:  $SVG_FILE"

# Show download options (unless already downloaded all)
if [ "$FORMAT" = "preview" ]; then
  echo ""
  echo "📥 Download options:"
  echo "   • Standard PNG (512x512): --format png"
  echo "   • Hi-res PNG (1024x1024): --format hires"
  echo "   • SVG (vector): --format svg"
  echo "   • All formats: --format all"
fi
