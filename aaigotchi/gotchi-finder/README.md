# Gotchi Finder Skill 👻

Find any Aavegotchi by ID and display with full traits and image.

## Quick Start

```bash
# Install dependencies
npm install

# Find a gotchi
bash scripts/find-gotchi.sh 9638
```

## Features

✅ Fetch any gotchi from Base mainnet  
✅ Display complete traits (BRS, Kinship, Level, XP, etc.)  
✅ Show all 6 numeric traits (Energy, Aggression, Spookiness, etc.)  
✅ Generate PNG images (standard 512x512 or hi-res 1024x1024)  
✅ Export as SVG (scalable vector graphics)  
✅ Save JSON metadata  
✅ Support portals and all gotchi states  
✅ Flexible format options (PNG, hi-res, SVG, or all)  

## Output

For each gotchi, you can get:

1. **JSON file** - Complete metadata
2. **SVG file** - Original on-chain vector image (always generated)
3. **PNG file** - Standard 512x512 pixel image
4. **PNG file (hi-res)** - High resolution 1024x1024 pixel image

## Usage Examples

**Find gotchi with all formats (default):**
```bash
bash scripts/find-gotchi.sh 9638
# Creates: JSON + SVG + PNG (512x512) + PNG (1024x1024)
```

**Standard PNG only:**
```bash
bash scripts/find-gotchi.sh 9638 --format png
# Creates: JSON + SVG + PNG (512x512)
```

**Hi-res PNG only:**
```bash
bash scripts/find-gotchi.sh 9638 --format hires
# Creates: JSON + SVG + PNG (1024x1024)
```

**SVG only (no PNG conversion):**
```bash
bash scripts/find-gotchi.sh 9638 --format svg
# Creates: JSON + SVG
```

**Custom output directory:**
```bash
bash scripts/find-gotchi.sh 9638 --output /tmp/my-gotchis
bash scripts/find-gotchi.sh 9638 /tmp/my-gotchis  # Also works
```

**Combine options:**
```bash
bash scripts/find-gotchi.sh 9638 --format hires --output /tmp/gotchis
bash scripts/find-gotchi.sh 9638 /tmp/gotchis --format all
```

**Find multiple gotchis:**
```bash
for id in 9638 21785 10052; do
  bash scripts/find-gotchi.sh $id --format all
done
```

## What It Shows

### Gotchi Stats
- 📛 Name
- ⭐ Base Rarity Score (BRS)
- 💜 Kinship
- 🎯 Level
- ✨ Experience
- 🏰 Haunt
- 👤 Owner
- 🔒 Locked status

### Numeric Traits
- Energy
- Aggression
- Spookiness
- Brain Size
- Eye Shape
- Eye Color

## Requirements

- Node.js
- npm
- Base mainnet RPC (defaults to https://mainnet.base.org)

## Environment Variables

Optional:
- `BASE_MAINNET_RPC` - Custom RPC endpoint

## File Structure

```
gotchi-finder/
├── SKILL.md           # Skill documentation
├── README.md          # This file
├── package.json       # Dependencies
└── scripts/
    ├── find-gotchi.sh    # Main entry point
    ├── fetch-gotchi.js   # Fetch from blockchain
    └── svg-to-png.js     # Image conversion
```

## Built With

- ethers.js v6 - Blockchain interaction
- Sharp - Image processing
- Base mainnet - Aavegotchi on Base

---

Built with 💜 by AAI  
**LFGOTCHi!** 🦞✨
