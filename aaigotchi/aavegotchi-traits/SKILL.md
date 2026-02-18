---
name: aavegotchi-traits
description: Retrieve Aavegotchi NFT data by gotchi ID or name from Base mainnet. Fetches traits (BRS, Kinship, XP, Energy, Aggression, Spookiness, Brain Size, Eye Shape, Eye Color), equipped wearables, haunt number, level, and age. Use when users ask about specific Aavegotchi stats, traits, wearables, rarity scores, or any gotchi-specific information on Base chain. Supports instant ID lookup and name search via The Graph subgraph (when available) or on-chain fallback.
---

# Aavegotchi Traits

Fetch detailed on-chain data for Aavegotchi NFTs on Base mainnet with optional subgraph support for instant name lookups.

## Quick Start

Fetch data for a gotchi by ID or name:

```bash
# By ID
cd scripts && node get-gotchi.js 9638  # aaigotchi

# By name
cd scripts && node get-gotchi.js "aaigotchi"
```

The script outputs:
1. Human-readable formatted display
2. JSON object for programmatic use

## Subgraph Support (The Graph)

The skill includes **The Graph subgraph integration** for instant name lookups:

### Current Status (Feb 2026)

⚠️ **No Base subgraph available yet.** Aavegotchi migrated to Base in July 2025, but an official subgraph hasn't been deployed. The script automatically falls back to on-chain scanning.

### When Subgraph Becomes Available

Set the subgraph endpoint via environment variable:

```bash
export AAVEGOTCHI_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-base
```

Or in your shell config (~/.bashrc, ~/.zshrc):

```bash
echo 'export AAVEGOTCHI_SUBGRAPH_URL=https://api.thegraph.com/subgraphs/name/aavegotchi/aavegotchi-base' >> ~/.bashrc
source ~/.bashrc
```

With subgraph configured:
- **Name lookups:** Instant (GraphQL query)
- **ID lookups:** Still use on-chain (most reliable for full trait data)

### Lookup Strategy

```
ID lookup (#9638 - aaigotchi)
  └─> Direct on-chain query (instant)

Name lookup ("aaigotchi" - #9638)  
  ├─> Try subgraph (instant, if available)
  └─> Fall back to on-chain scan (30-60s)
```

## What It Fetches

For any Aavegotchi token ID, the script retrieves:

**Core Stats:**
- Base Rarity Score (BRS)
- Modified Rarity Score (with wearable bonuses)
- Kinship level
- Experience points (XP)
- Level

**Traits (6 numeric values):**
- ⚡ Energy (NRG)
- 💥 Aggression (AGG)
- 👻 Spookiness (SPK)
- 🧠 Brain Size (BRN)
- 👁️ Eye Shape (EYS)
- 🎨 Eye Color (EYC)

Each trait shows both base and modified (with wearables) values.

**Wearables:**
- List of all equipped wearables with IDs and names
- Format: `ID: Name` (e.g., "50: GldnXross Robe")
- Empty slots filtered out
- Includes count of equipped items

**Identity:**
- Token ID
- Name (if set)
- Owner address
- Haunt number

**Staking:**
- Collateral token address
- Staked amount
- Last interaction timestamp
- Age (days since last interaction)

## Usage

### By Gotchi ID

```bash
cd scripts && node get-gotchi.js 9638  # aaigotchi
```

### By Name

```bash
cd scripts && node get-gotchi.js "aaigotchi"
cd scripts && node get-gotchi.js "Slide"
cd scripts && node get-gotchi.js "XIBOT"
```

**Performance:**
- With subgraph (when available): **Instant** ⚡
- Without subgraph (current): **30-60 seconds** (on-chain scan of all gotchis)

💡 **Tip:** Use gotchi ID when possible for guaranteed instant results.

## Example Output

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

JSON OUTPUT:
{
  "tokenId": "9638",
  "name": "aaigotchi",
  ...
}
```

## Contract Details

**Contract:** `0xa99c4b08201f2913db8d28e71d020c4298f29dbf` (Base mainnet)

**Network:** Base (Chain ID: 8453)

**RPC:** `https://mainnet.base.org`

## Understanding the Data

For detailed explanations of traits, BRS, kinship, wearables, haunts, and other Aavegotchi mechanics:

**See:** [references/aavegotchi-data.md](references/aavegotchi-data.md)

## Requirements

- Node.js (v18+)
- npm packages: `ethers`, `node-fetch` (installed via package.json)
- Internet connection (queries Base RPC and optionally The Graph)
- Wearables data file (included: `wearables-data.json` with 400+ items)

Dependencies and data files are pre-installed in the skill's scripts directory.

## Troubleshooting

**"Invalid token ID" error:**
- Gotchi doesn't exist on Base
- Verify the ID is correct

**Network errors:**
- Check internet connection
- Base RPC may be temporarily down
- Try again in a few moments

**Name lookup taking too long:**
- **With subgraph:** Check AAVEGOTCHI_SUBGRAPH_URL is set correctly
- **Without subgraph (current):** Name search scans all 23,000+ gotchis sequentially (30-60s)
- Use gotchi ID for instant results
- Ensure stable internet connection

**"Subgraph unavailable" message:**
- Expected behavior (no Base subgraph deployed yet)
- Script automatically falls back to on-chain scan
- No action needed

## Future Enhancements

Potential additions:
- ✅ **The Graph subgraph support** (implemented, awaiting Base subgraph deployment)
- ✅ **Wearable name resolution** (implemented: 400+ wearables mapped)
- Batch queries for multiple gotchis
- Historical trait/kinship tracking
- Wearable rarity/stats display
- Pocket/inventory queries
- Guild/lending data
- Real-time petting status
- Trait rarity percentiles
