# Card Pools Reference

Reference data for cards distributed in chests.

## ⚠️ Chest Type Mapping (MUST match smart contract)

| Numeric Type | Name | Common | Rare | Epic | Total |
|--------------|------|--------|------|------|-------|
| **0** | **Silver Chest** | 20 | 0 | 0 | 20 |
| **1** | **Gold Chest** | 60 | 8 | 2 | 70 |
| **2** | **Magical Chest** | 120 | 25 | 5 | 150 |

When calling `buyChest(uint8 chestType)`, always pass:
- `0` for Silver
- `1` for Gold
- `2` for Magical

## Roster (13 card types)

The tier split mirrors `supabase/functions/open-chest` (`COMMON_CARDS` /
`RARE_CARDS` / `EPIC_CARDS`). Epic is a single-card tier, so an Epic draw is
always Robinhood.

### Common Pool (7 cards)

| ID | Name | Color | Rarity |
|----|------|-------|--------|
| `knight` | Knight | #3b82f6 (blue) | common |
| `archer` | Archer | #10b981 (green) | common |
| `wizard` | Wizard | #a855f7 (purple) | common |
| `goblin` | Goblin | #22c55e (green) | common |
| `barrel_bomb` | Barrel Bomb | #f59e0b (orange) | common |
| `meteor` | Meteor | #ea580c (orange) | common |
| `incubus` | Incubus | #c084fc (purple) | common |

### Rare Pool (5 cards)

| ID | Name | Color | Rarity |
|----|------|-------|--------|
| `wyvern` | Wyvern | #ec4899 (pink) | rare |
| `giant` | Giant | #f59e0b (orange) | rare |
| `barbarian` | Barbarian | #f97316 (orange) | rare |
| `healer` | Healer | #fbbf24 (gold) | rare |
| `gunslinger` | Gunslinger | #ef4444 (red) | rare |

### Epic Pool (1 card)

| ID | Name | Color | Rarity |
|----|------|-------|--------|
| `robinhood` | Robinhood | #0f766e (teal) | epic |

## Card Distribution Logic

Every slot in a chest is **one L1 card NFT**. The tier counts above are
guaranteed; within a tier the card type is drawn at random, so duplicates in
the result are normal.

```typescript
const COMMON_CARDS = ["knight", "archer", "wizard", "goblin", "barrel_bomb", "meteor", "incubus"];
const RARE_CARDS   = ["wyvern", "giant", "barbarian", "healer", "gunslinger"];
const EPIC_CARDS   = ["robinhood"];

const CHEST_CONFIG = {
  silver:  { common: 20,  rare: 0,  epic: 0  },
  gold:    { common: 60,  rare: 8,  epic: 2  },
  magical: { common: 120, rare: 25, epic: 5  },
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Pseudo-code for card distribution
function getChestContents(chestType: "silver" | "gold" | "magical") {
  const config = CHEST_CONFIG[chestType];
  const contents: Array<{ card_id: string; level: number; amount: number }> = [];

  for (let i = 0; i < config.common; i++) {
    contents.push({ card_id: pickRandom(COMMON_CARDS), level: 1, amount: 1 });
  }
  for (let i = 0; i < config.rare; i++) {
    contents.push({ card_id: pickRandom(RARE_CARDS), level: 1, amount: 1 });
  }
  for (let i = 0; i < config.epic; i++) {
    contents.push({ card_id: pickRandom(EPIC_CARDS), level: 1, amount: 1 });
  }

  return contents;
}
```

All cards come out at **L1** — upgrades to L2+ are a separate
`upgradeCard` flow on the ClashCardManager contract.
