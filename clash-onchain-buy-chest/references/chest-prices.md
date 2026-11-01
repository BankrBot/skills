# Chest Prices Reference

## ⚠️ Smart Contract Mapping

The ChestManager smart contract uses `uint8` for chest type. **Always pass numeric values**.

| Numeric Type | Chest Name | Cost ($CLASH) | Cost (Wei) | Cost (Formatted) |
|--------------|------------|---------------|------------|------------------|
| **0** | **Silver Chest** | 1,000,000 $CLASH | `1000000000000000000000000` | 1.0M $CLASH |
| **1** | **Gold Chest** | 3,000,000 $CLASH | `3000000000000000000000000` | 3.0M $CLASH |
| **2** | **Magical Chest** | 5,000,000 $CLASH | `5000000000000000000000000` | 5.0M $CLASH |

## Conversion Reference

$CLASH is an ERC20 token with **18 decimals**. 

```
1 $CLASH = 10^18 wei = 1,000,000,000,000,000,000 wei
```

### Conversion Examples

```typescript
import { parseUnits, formatUnits } from 'viem';

// $CLASH amount → wei (for transactions)
const silverCost = parseUnits('1000000', 18);  // 1000000000000000000000000
const goldCost = parseUnits('3000000', 18);    // 3000000000000000000000000
const magicalCost = parseUnits('5000000', 18);  // 5000000000000000000000000

// wei → $CLASH (for display)
const displayAmount = formatUnits(silverCost, 18);  // "1000000"
```

## Type Conversion

When user provides a string name, convert to numeric type:

```typescript
const CHEST_TYPE_MAP: Record<string, 0 | 1 | 2> = {
  // String names
  'silver': 0,
  'gold': 1,
  'magical': 2,
  'magic': 2,  // alias
  
  // Numeric strings
  '0': 0,
  '1': 1,
  '2': 2,
  
  // Numeric values
  0: 0,
  1: 1,
  2: 2,
};

function getChestType(input: string | number): 0 | 1 | 2 {
  const normalized = String(input).toLowerCase().trim();
  const type = CHEST_TYPE_MAP[normalized];
  
  if (type === undefined) {
    throw new Error(
      `Invalid chest type: "${input}". Must be 0 (Silver), 1 (Gold), or 2 (Magical).`
    );
  }
  
  return type;
}

function getChestName(type: 0 | 1 | 2): string {
  const names = { 0: 'Silver Chest', 1: 'Gold Chest', 2: 'Magical Chest' };
  return names[type];
}

function getChestCost(type: 0 | 1 | 2): bigint {
  const costs = {
    0: parseUnits('1000000', 18),   // Silver: 1M $CLASH
    1: parseUnits('3000000', 18),   // Gold: 3M $CLASH
    2: parseUnits('5000000', 18),   // Magical: 5M $CLASH
  };
  return costs[type];
}
```

## Smart Contract Function

```solidity
// ChestManager.sol
function buyChest(uint8 chestType) external;

// chestType values:
//   0 = Silver (1,000,000 $CLASH)
//   1 = Gold (3,000,000 $CLASH)  
//   2 = Magical (5,000,000 $CLASH)
```

⚠️ **DO NOT pass string values like "silver" or "gold" to the contract**. Always convert to numeric first.
