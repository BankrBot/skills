# Aavegotchi Traits Skill

![Aavegotchi](https://img.shields.io/badge/Aavegotchi-Base%20Chain-blue)
![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-purple)

Fetch detailed on-chain data for Aavegotchi NFTs on Base mainnet with trait emojis, wearable names, and optional subgraph support for instant lookups.

## 🎮 What is Aavegotchi?

Aavegotchi is a player-owned gaming ecosystem on Base where players truly own their assets and earn across interoperable games. Each Aavegotchi is an NFT with unique traits, wearables, kinship, and rarity scores.

## ✨ Features

- 🔍 **Query by Gotchi ID** (instant, reliable)
- 🏷️ **Name-based search** (experimental, via subgraph or on-chain scan)
- 👻 **Trait emojis** (⚡ Energy, 💥 Aggression, 👻 Spookiness, 🧠 Brain, 👁️ Eye Shape, 🎨 Eye Color)
- 👕 **Wearable name resolution** (400+ items mapped: "50: GldnXross Robe")
- 📊 **Complete stats**: BRS, Kinship, XP, Level, Age
- 🔗 **The Graph subgraph support** (ready for Base subgraph deployment)
- 📦 **JSON output** for programmatic use

## ⚠️ Important Notes

### 🌐 Base Chain Only

This skill **only works for Aavegotchi on Base chain** (Chain ID: 8453). 

Aavegotchi migrated from Polygon to Base in July 2025. If you're looking for historical Polygon data, this skill won't work for that.

**Contract:** `0xa99c4b08201f2913db8d28e71d020c4298f29dbf` (Base mainnet)

### 🔢 Use Gotchi ID for Best Results

**Recommended:** Query by gotchi ID (e.g., `2595`, `22470`)
- ✅ Instant lookup
- ✅ 100% reliable
- ✅ Works for all gotchis

**Name search** (e.g., "XIBOT", "SHAAMAAN") is experimental:
- ⏱️ Slow (30-60 seconds to scan 23,000+ gotchis)
- 🔄 Requires subgraph or on-chain scan
- ⚠️ Not yet reliable (encoding issues, special characters)

**When Base subgraph becomes available**, name lookups will be instant via GraphQL.

## 📦 Installation

### As OpenClaw Skill

```bash
# Install the skill
cd ~/.openclaw/workspace/skills
git clone https://github.com/aaigotchi/aavegotchi-traits.git
cd aavegotchi-traits/scripts
npm install
```

### Requirements

- Node.js v18+
- npm packages: `ethers`, `node-fetch` (auto-installed)
- Internet connection (queries Base RPC)

## 🚀 Usage

### Query by Gotchi ID (Recommended)

```bash
cd scripts
node get-gotchi.js 9638  # aaigotchi
```

**Output:**

```
============================================================
AAVEGOTCHI #9638: aaigotchi
============================================================
Owner: 0x8BE974bC760bea450A733c58B051c14F723ce79C
Haunt: 1
Level: 8
Age: 0 days since last interaction

SCORES:
  Base Rarity Score (BRS): 475
  Modified Rarity Score: 475
  Kinship: 2276
  Experience: 2960

TRAITS:
  ⚡ Energy: 0
  💥 Aggression: 66
  👻 Spookiness: 99
  🧠 Brain Size: 76
  👁️ Eye Shape: 41
  🎨 Eye Color: 28

WEARABLES:
  Equipped (1):
    210: Haunt 1 Background

STAKING:
  Collateral: 0x20D3922b4a1A8560E1aC99FBA4faDe0c849e2142
  Staked Amount: 0.0 tokens
  Last Interacted: 2026-02-12T18:30:13.000Z
============================================================
```

### Query by Name (Experimental)

```bash
node get-gotchi.js "aaigotchi"
```

⚠️ **Note:** This scans all 23,000+ gotchis sequentially and may take 30-60 seconds.

### With Subgraph (When Available)

Set the subgraph URL to enable instant name lookups:

```bash
export AAVEGOTCHI_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-base
node get-gotchi.js "aaigotchi"  # Now instant! ⚡
```

## 📊 Data Fetched

### Core Stats
- Base Rarity Score (BRS)
- Modified Rarity Score (with wearable bonuses)
- Kinship level
- Experience points (XP)
- Level
- Haunt number
- Age (days since last interaction)

### Traits (6 numeric values)
- ⚡ Energy (NRG)
- 💥 Aggression (AGG)
- 👻 Spookiness (SPK)
- 🧠 Brain Size (BRN)
- 👁️ Eye Shape (EYS)
- 🎨 Eye Color (EYC)

Each trait shows both base and modified (with wearables) values.

### Wearables
- Full list with IDs and names
- Format: `ID: Name` (e.g., "50: GldnXross Robe")
- 400+ items mapped from Aavegotchi Wiki
- Includes all sets: LINK, Aave, Ethereum, Wizard, Farmer, Haunt 2, Forge, Base chain, etc.

### Identity & Ownership
- Token ID
- Name (if set)
- Owner address
- Collateral token
- Staked amount
- Last interaction timestamp

## 🛠️ Technical Details

### Architecture

```
ID lookup (#9638 - aaigotchi)
  └─> Direct on-chain query (instant)

Name lookup ("aaigotchi" - #9638)  
  ├─> Try subgraph (instant, if available)
  └─> Fall back to on-chain scan (30-60s)
```

### Contract Interaction

Uses `ethers.js` v6 to query the Aavegotchi Diamond contract on Base:

- `getAavegotchi(tokenId)` - Full gotchi data
- `tokenByIndex(index)` - For name scanning
- `totalSupply()` - Get total gotchi count

### Wearables Data

`wearables-data.json` contains 400+ wearable mappings sourced from [Aavegotchi Wiki](https://wiki.aavegotchi.com/en/wearables).

### RPC Endpoint

Default: `https://mainnet.base.org`

Can be overridden via code modification if needed.

## 🧪 Testing

**Test with known gotchis:**

```bash
node get-gotchi.js 23795    # Slide
node get-gotchi.js 7765     # @egornomic
node get-gotchi.js 14140    # ChamallowGotchi
```

## 🔮 Future Enhancements

- [ ] Batch queries for multiple gotchis
- [ ] Historical trait/kinship tracking
- [ ] Wearable rarity/stats display
- [ ] Pocket/inventory queries
- [ ] Guild/lending data
- [ ] Real-time petting status
- [ ] Trait rarity percentiles
- [ ] Subgraph for instant name lookups (awaiting Base deployment)

## 🤝 Contributing

Contributions welcome! Feel free to:

- Report issues
- Submit PRs for improvements
- Add more wearables data
- Improve name search reliability

## 📝 License

MIT

## 🔗 Links

- [Aavegotchi Official](https://aavegotchi.com)
- [Aavegotchi Wiki](https://wiki.aavegotchi.com)
- [Aavegotchi Docs](https://docs.aavegotchi.com)
- [OpenClaw](https://openclaw.ai)
- [Base Chain](https://base.org)

## 👻 Credits

Built by [AAI (aaigotchi)](https://github.com/aaigotchi) - The first autonomous Aavegotchi AI

Wearables data sourced from [Aavegotchi Wiki](https://wiki.aavegotchi.com/en/wearables)

LFGotchi! 🦞🚀👻
