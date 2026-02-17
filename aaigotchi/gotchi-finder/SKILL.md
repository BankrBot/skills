---
name: gotchi-finder
description: >
  Fetch Aavegotchi by ID from Base mainnet and display image with full traits.
  Shows on-chain SVG, converts to PNG, and displays complete gotchi stats.
homepage: https://github.com/aavegotchi/gotchi-finder-skill
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
      env:
        - BASE_MAINNET_RPC
---

# Gotchi Finder Skill

Find and display any Aavegotchi by ID with complete traits and image.

## Features

- ✅ Fetch any gotchi by ID from Base mainnet
- ✅ Display full traits (BRS, Kinship, Level, XP, Haunt, Name, Owner)
- ✅ Generate PNG images (standard 512x512 or hi-res 1024x1024)
- ✅ Export as SVG (scalable vector graphics)
- ✅ Flexible format options (PNG, hi-res, SVG, or all)
- ✅ Support for all gotchi states (Portal, Gotchi, etc.)
- ✅ Automatic image conversion and delivery

## Usage

### Find Gotchi by ID

```bash
bash scripts/find-gotchi.sh <gotchi-id> [--format <type>] [--output <dir>]
```

**Format Options:**
- `png` - Standard PNG (512x512)
- `hires` - Hi-res PNG (1024x1024)
- `svg` - SVG only (no PNG conversion)
- `all` - All formats (default)

**Examples:**
```bash
# All formats (JSON + SVG + PNG + Hi-res PNG)
bash scripts/find-gotchi.sh 9638

# Standard PNG only
bash scripts/find-gotchi.sh 9638 --format png

# Hi-res PNG only
bash scripts/find-gotchi.sh 9638 --format hires

# SVG only (no PNG conversion)
bash scripts/find-gotchi.sh 9638 --format svg

# Custom output directory
bash scripts/find-gotchi.sh 9638 --output /tmp/gotchis
bash scripts/find-gotchi.sh 9638 /tmp/gotchis --format all
```

**Output Files:**
- `gotchi-{ID}.json` - Complete metadata (always generated)
- `gotchi-{ID}.svg` - Vector image (always generated)
- `gotchi-{ID}.png` - Standard PNG (512x512, if png/all)
- `gotchi-{ID}-hires.png` - Hi-res PNG (1024x1024, if hires/all)

## What It Shows

**For Live Gotchis (Status 3):**
- 📛 Name
- ⭐ Base Rarity Score (BRS)
- 💜 Kinship
- 🎯 Level
- ✨ Experience (XP)
- 🏰 Haunt
- 👤 Owner address
- 🎨 Full-color PNG image

**For Portals (Status 0-1):**
- Portal status
- Owner
- Haunt
- Portal image

## Technical Details

**Blockchain:**
- Chain: Base mainnet (8453)
- RPC: https://mainnet.base.org
- Diamond: 0xA99c4B08201F2913Db8D28e71d020c4298F29dBF

**Dependencies:**
- Node.js with ethers v6
- Sharp library for image conversion

**Status Codes:**
- 0: Unopened Portal
- 1: Opened Portal
- 2: Gotchi (rare on Base)
- 3: Gotchi (standard on Base)

## Files

- `scripts/find-gotchi.sh` - Main entry point
- `scripts/fetch-gotchi.js` - Fetch from blockchain
- `scripts/svg-to-png.js` - Convert SVG to PNG
- `package.json` - Node dependencies

## Installation

```bash
cd /home/ubuntu/.openclaw/workspace/skills/gotchi-finder
npm install
```

## Examples

**Find your gotchi:**
```bash
bash scripts/find-gotchi.sh 9638
```

**Find any gotchi:**
```bash
bash scripts/find-gotchi.sh 5000
```

**Find multiple gotchis:**
```bash
for id in 9638 21785 10052; do
  bash scripts/find-gotchi.sh $id
done
```

---

Built with 💜 by AAI
