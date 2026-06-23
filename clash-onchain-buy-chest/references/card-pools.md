# Card Pools Reference

Reference data for cards distributed in chests.

## ⚠️ Chest Type Mapping (MUST match smart contract)

| Numeric Type | Name | Common Cards | Epic Cards | Total |
|--------------|------|-------------|------------|-------|
| **0** | **Silver Chest** | 20 | 0 | 20 |
| **1** | **Gold Chest** | 60 | 10 | 70 |
| **2** | **Magical Chest** | 120 | 30 | 150 |

When calling `buyChest(uint8 chestType)`, always pass:
- `0` for Silver
- `1` for Gold
- `2` for Magical

## Common Pool (8 cards)

| ID | Name | Color | Rarity |
|----|------|-------|--------|
| `knight` | Knight | #3b82f6 (blue) | common |
| `archer` | Archer | #10b981 (green) | common |
| `wizard` | Wizard | #a855f7 (purple) | common |
| `goblin` | Goblin | #22c55e (green) | common |
| `gunslinger` | Gunslinger | #ef4444 (red) | common |
| `barrel_bomb` | Barrel Bomb | #f59e0b (orange) | common |
| `meteor` | Meteor | #ea580c (orange) | common |
| `incubus` | Incubus | #c084fc (purple) | common |

## Epic Pool (4 cards)

| ID | Name | Color | Rarity |
|----|------|-------|--------|
| `giant` | Giant | #f59e0b (orange) | epic |
| `healer` | Healer | #fbbf24 (gold) | epic |
| `wyvern` | Wyvern | #ec4899 (pink) | epic |
| `barbarian` | Barbarian | #f97316 (orange) | epic |

## Card Distribution Logic

```typescript
// Pseudo-code for card distribution
function distributeRewards(pool, totalCards) {
  const rewards = {};
  let remaining = totalCards;
  
  while (remaining > 0) {
    // Pick random card
    const card = pool[Math.floor(Math.random() * pool.length)];
    
    // Random amount: 1-5 copies
    const amount = Math.min(
      Math.floor(Math.random() * 5) + 1,
      remaining
    );
    
    rewards[card.name] = (rewards[card.name] || 0) + amount;
    remaining -= amount;
  }
  
  return Object.entries(rewards).map(([name, count]) => ({
    name,
    count,
    rarity: pool.find(c => c.name === name)?.rarity
  }));
}

// Chest type 0: Silver
distributeRewards(COMMON_POOL, 20);

// Chest type 1: Gold
[...distributeRewards(COMMON_POOL, 60), 
 ...distributeRewards(EPIC_POOL, 10)];

// Chest type 2: Magical
[...distributeRewards(COMMON_POOL, 120), 
 ...distributeRewards(EPIC_POOL, 30)];
```
