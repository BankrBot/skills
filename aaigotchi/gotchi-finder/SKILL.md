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
- ✅ Generate PNG image from on-chain SVG
- ✅ Support for all gotchi states (Portal, Gotchi, etc.)
- ✅ Automatic image conversion and delivery

## Usage

### Find Gotchi by ID

```bash
bash scripts/find-gotchi.sh <gotchi-id>
```

**Example:**
```bash
bash scripts/find-gotchi.sh 9638
```

**Output:**
- Complete gotchi stats
- PNG image saved to workspace
- Ready for display/sharing

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
