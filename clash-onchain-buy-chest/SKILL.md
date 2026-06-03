---
name: clash-onchain-buy-chest
description: >
  Buy chest in Clash-Onchain blockchain game on Base Mainnet using BankrBot Agent API.
  
  Triggers:
  - "buy chest"
  - "open {silver|gold|magical} chest"
  - "purchase chest type {0|1|2}"
  - "buy chest 0" / "buy chest 1" / "buy chest 2"
  
  Boundaries:
  - NOT for checking balance → use clash-onchain-check-balance
  - NOT for claiming battle rewards → use clash-onchain-claim-reward
  - NOT for viewing cards → use clash-onchain-check-cards
  - Requires $CLASH ERC20 token payment (not native ETH)
---

# Buy Chest Skill (Clash-Onchain)

Buy a chest in Clash-Onchain game using **BankrBot Agent API**. The skill approves $CLASH tokens, calls the ChestManager contract, and returns card rewards.

## Chest Types

Match the smart contract enum exactly. Use the numeric type when calling the contract.

| Numeric Type | Name | Cost ($CLASH) | Card Distribution |
|--------------|------|----------------|--------------------|
| **0** | **Silver Chest** | 1,000,000 $CLASH | 20 Common cards only |
| **1** | **Gold Chest** | 3,000,000 $CLASH | 60 Common + 10 Epic (70 total) |
| **2** | **Magical Chest** | 5,000,000 $CLASH | 120 Common + 30 Epic (150 total) |

⚠️ **CRITICAL**: Smart contract uses `uint8` for chest type. Always pass the numeric value (0, 1, or 2), not the string.

## Prerequisites

This skill uses **BankrBot Agent API** for wallet and transaction signing.

### 1. Install Bankr CLI
```bash
npm i -g @bankr/cli
bankr login
```

This creates an agent wallet + API key. Save the API key securely.

### 2. Configure Environment
```bash
export BANKR_API_KEY="bk_..."
```

## Inputs

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chestType` | `0` \| `1` \| `2` | ✅ | Numeric chest type. Accepts "silver"/"gold"/"magical" and converts. |

### Input Normalization

```typescript
const CHEST_TYPE_MAP: Record<string, 0 | 1 | 2> = {
  "silver": 0, "gold": 1, "magical": 2, "magic": 2,
  "0": 0, "1": 1, "2": 2, 0: 0, 1: 1, 2: 2
};

function normalizeChestType(input: string | number): 0 | 1 | 2 {
  const key = String(input).toLowerCase().trim();
  const type = CHEST_TYPE_MAP[key];
  if (type === undefined) {
    throw new Error(`Invalid chest type: "${input}". Must be 0 (Silver), 1 (Gold), or 2 (Magical).`);
  }
  return type;
}
```

## Procedure

### Step 1: Normalize Chest Type
Convert user input to numeric type (0/1/2).

```typescript
const numericType = normalizeChestType(userInput);
// "gold" → 1
// "silver" → 0
// 2 → 2
```

### Step 2: Check $CLASH Balance via BankrBot

```bash
curl -X POST https://api.bankr.bot/agent/wallet/balance \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "0xf3C66dc3afF9d04CbCEAfA8f9dE762a39EE0BBA3",
    "chainId": 8453
  }'
```

**Response**:
```json
{
  "balance": "5000000000000000000000000",  // 5,000,000 $CLASH in wei
  "formatted": "5000000",
  "symbol": "CLASH"
}
```

If balance < required cost → return error.

### Step 3: Approve $CLASH to ChestManager

BankrBot's `submitTransaction` handles ERC20 approvals automatically when calling non-payable contract functions. If manual approval needed:

```bash
curl -X POST https://api.bankr.bot/agent/tx/submit \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 8453,
    "to": "0xf3C66dc3afF9d04CbCEAfA8f9dE762a39EE0BBA3",  // $CLASH token
    "data": "<encoded approve(0x16D1984cbf88837012f9A741df2C33C044421966, MAX_UINT256)>",
    "value": "0"
  }'
```

Wait for approval confirmation.

### Step 4: Call buyChest via BankrBot

```bash
curl -X POST https://api.bankr.bot/agent/tx/submit \
  -H "Authorization: Bearer $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 8453,
    "to": "0x16D1984cbf88837012f9A741df2C33C044421966",  // ChestManager
    "data": "<encoded buyChest(chestType)>",  // chestType = 0, 1, or 2
    "value": "0"
  }'
```

**Function signature**:
```solidity
buyChest(uint8 chestType)  // 0=Silver, 1=Gold, 2=Magical
```

**Encoded data for each chest type**:
- Silver: `0x6f41f8770000000000000000000000000000000000000000000000000000000000000000`
- Gold: `0x6f41f8770000000000000000000000000000000000000000000000000000000000000001`
- Magical: `0x6f41f8770000000000000000000000000000000000000000000000000000000000000002`

### Step 5: Wait for Confirmation

BankrBot returns transaction hash. Poll for receipt:

```bash
curl -X GET "https://api.bankr.bot/agent/tx/{txHash}?chainId=8453" \
  -H "Authorization: Bearer $BANKR_API_KEY"
```

Wait until `status: "success"`.

### Step 6: Parse ChestBought Event

From receipt logs, decode the `ChestBought` event:

```solidity
event ChestBought(
    address indexed player,
    uint8 indexed chestType,    // 0, 1, or 2
    uint256 price,
    uint256 timestamp
);
```

Extract `chestType` from logs to verify it matches the request.

### Step 7: Persist to Database (Optional)

If BankrBot agent has Supabase access, save card rewards to player's `card_inventory` table. Otherwise, return rewards only.

## Output Contract

```typescript
interface BuyChestResult {
  success: boolean;
  chestType: 0 | 1 | 2;
  chestName: "Silver Chest" | "Gold Chest" | "Magical Chest";
  txHash: string;
  rewards: {
    name: string;
    count: number;
    rarity: "common" | "epic";
  }[];
  totalCards: number;
  cost: string;  // wei
  timestamp: string;
}
```

### Example Output

```json
{
  "success": true,
  "chestType": 1,
  "chestName": "Gold Chest",
  "txHash": "0xabc123...",
  "rewards": [
    { "name": "Knight", "count": 8, "rarity": "common" },
    { "name": "Archer", "count": 12, "rarity": "common" },
    { "name": "Giant", "count": 3, "rarity": "epic" }
  ],
  "totalCards": 70,
  "cost": "3000000000000000000000000",
  "timestamp": "2026-06-03T10:21:17Z"
}
```

## Error Handling

| Error | Response |
|-------|----------|
| Insufficient balance | "You need X $CLASH but only have Y. Need Z more to proceed." |
| Token not approved | Auto-approve $CLASH, then retry |
| Invalid chest type | "Chest type must be 0 (Silver), 1 (Gold), or 2 (Magical)" |
| Transaction failed | "Transaction reverted. Check approval and balance, then try again." |
| Network timeout | "Base RPC is slow. Check transaction status in 30s." |
| BankrBot API error | "BankrBot API error: {message}. Check API key." |

## Examples

### Example 1: User says "Buy a gold chest"

```
User: "Buy a gold chest"

Agent:
1. Normalize "gold" → chestType = 1
2. Check balance via BankrBot: 5,000,000 $CLASH ✓
3. Check approval: $CLASH approved ✓
4. Submit buyChest(1) via BankrBot
5. Confirmed in 2.3s

Result: ✅ Gold Chest purchased! (Type 1)
        70 cards received
        Tx: 0xabc123...
```

### Example 2: User says "Buy chest 2"

```
User: "Buy chest 2"

Agent: chestType = 2 (Magical)
       Cost: 5,000,000 $CLASH
       
Result: ✅ Magical Chest purchased! (Type 2)
        150 cards received
```

### Example 3: Insufficient balance

```
User: "Buy a magical chest"

Agent: Check balance: 500,000 $CLASH
       Cost: 5,000,000 $CLASH

Result: ❌ Insufficient balance!
        You have 500,000 $CLASH
        Need 4,500,000 more $CLASH
```

## BankrBot API Reference

### Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/agent/wallet/balance` | POST | Check $CLASH balance |
| `/agent/tx/submit` | POST | Submit approval + buyChest transactions |
| `/agent/tx/{hash}` | GET | Get transaction status |

### Authentication

```bash
Authorization: Bearer $BANKR_API_KEY
```

### Setup

```bash
npm i -g @bankr/cli
bankr login
export BANKR_API_KEY="bk_..."
```

## Smart Contract Reference

### ChestManager

```
Address: 0x16D1984cbf88837012f9A741df2C33C044421966
Network: Base Mainnet (Chain ID: 8453)
Function: buyChest(uint8 chestType)
```

### $CLASH Token

```
Address: 0xf3C66dc3afF9d04CbCEAfA8f9dE762a39EE0BBA3
Decimals: 18
```

## References

- [Card Pools](references/card-pools.md) - Common and Epic card lists
- [Chest Prices](references/chest-prices.md) - Cost breakdown in wei and $CLASH
- [Contract API](references/contract-api.md) - Smart contract ABI
- [BankrBot API Docs](https://docs.bankr.bot/) - External API reference
