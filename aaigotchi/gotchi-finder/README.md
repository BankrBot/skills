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
✅ Generate PNG image from on-chain SVG  
✅ Save JSON metadata  
✅ Support portals and all gotchi states  

## Output

For each gotchi, you get:

1. **JSON file** - Complete metadata
2. **SVG file** - Original on-chain vector image
3. **PNG file** - 512x512 pixel image

## Usage Examples

**Find one gotchi:**
```bash
bash scripts/find-gotchi.sh 9638
```

**Find multiple gotchis:**
```bash
for id in 9638 21785 10052; do
  bash scripts/find-gotchi.sh $id
done
```

**Custom output directory:**
```bash
bash scripts/find-gotchi.sh 9638 /tmp/my-gotchis
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
