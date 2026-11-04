# Smart Contract API Reference

## Network

The addresses below are the **Base mainnet** deployment.

| Chain | Chain ID | RPC | Status |
|-------|----------|-----|--------|
| Base Mainnet | 8453 | `https://mainnet.base.org` (or `VITE_BASE_RPC_URL`) | Live |
| Robinhood Chain | 4663 | `https://rpc.mainnet.chain.robinhood.com` (or `ROBINHOOD_RPC_URL`) | Live |

### Robinhood Chain addresses

| Contract | Address |
|----------|---------|
| `$CLASH` (18 decimals, bridged from Base — supply grows as tokens bridge over) | `0xe577182a9a29af25675b3563f3b96aa948b5df19` |
| ClashCards (ERC-1155) | `0x92f1185a7668c3730a2b3222db3047ae6135beca` |
| ClashCardManager | `0x17d7509ab855d7fda63d1391cc3d81c891f68f32` |
| ClashRewardClaim | `0x12c6481345dc16688c6ec7a932ff033be4b3aec7` |

They are also published as `RH_CLASH_CARDS_ADDRESS`, `RH_CARD_MANAGER_ADDRESS`,
`RH_CLASH_TOKEN_ADDRESS` and `RH_REWARD_CONTRACT_ADDRESS`.

On Robinhood Chain the `$CLASH` token is **bridged from Base** — the same token
with the same economy. The prices are still contract state, so read
`chestCosts` and `getUpgradeCost` from the Robinhood contracts; the numbers
match Base (chest 1,000,000 / 3,000,000 / 5,000,000, upgrade 10,000,000 →
2,560,000,000, reward per win 10,000 – 100,000). The EIP-712 domain uses chain
id 4663, so a Base signature is never valid on Robinhood Chain.

## ⚠️ Chest Type Enum

The `ChestManager` contract uses `uint8` for chest type. **Always use numeric values**:

```solidity
enum ChestType {
    SILVER = 0,   // 1M $CLASH
    GOLD = 1,     // 3M $CLASH
    MAGICAL = 2   // 5M $CLASH
}
```

## Contract Addresses

### $CLASH Token (ERC20)

```typescript
const CLASH_TOKEN_ADDRESS = "0xf3C66dc3afF9d04CbCEAfA8f9dE762a39EE0BBA3";
```

**ERC20 ABI (minimal)**:
```typescript
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
];
```

### ChestManager Contract

```typescript
const CHEST_MANAGER_ADDRESS = "0x16D1984cbf88837012f9A741df2C33C044421966";
```

**ChestManager ABI**:
```typescript
const CHEST_MANAGER_ABI = [
  {
    name: "buyChest",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "chestType", type: "uint8" }  // 0=Silver, 1=Gold, 2=Magical
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "chestPrices",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint8" }  // chest type: 0, 1, or 2
    ],
    outputs: [{ name: "", type: "uint256" }]
  }
];
```

## Events

### ChestBought Event

```solidity
event ChestBought(
    address indexed player,
    uint8 indexed chestType,    // 0=Silver, 1=Gold, 2=Magical
    uint256 price,
    uint256 timestamp
);
```

**Decoding in viem**:
```typescript
const eventAbi = {
  name: "ChestBought",
  type: "event",
  inputs: [
    { name: "player", type: "address", indexed: true },
    { name: "chestType", type: "uint8", indexed: true },
    { name: "price", type: "uint256" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

// In transaction receipt
const log = receipt.logs.find(
  (l) => l.address.toLowerCase() === CHEST_MANAGER_ADDRESS.toLowerCase()
);

const decoded = decodeEventLog({
  abi: [eventAbi],
  data: log.data,
  topics: log.topics,
});

// decoded.args.chestType will be 0, 1, or 2
const chestTypeNum = Number(decoded.args.chestType);
```

## Chest Type Mapping

| Type Number | Type Name | Cost (wei) | Cost ($CLASH) | Common | Rare | Epic |
|-------------|-----------|------------|---------------|--------|------|------|
| 0 | Silver Chest | 1,000,000 × 10^18 | 1,000,000 | 20 | 0 | 0 |
| 1 | Gold Chest | 3,000,000 × 10^18 | 3,000,000 | 60 | 8 | 2 |
| 2 | Magical Chest | 5,000,000 × 10^18 | 5,000,000 | 120 | 25 | 5 |

## Transaction Flow

```
1. User → Agent: "Buy gold chest"
2. Agent: Convert "gold" → chestType = 1
3. Agent: Check $CLASH balance (need 3,000,000)
4. Agent: Check $CLASH approval to ChestManager
5. If not approved: Submit approve() tx
6. Wait for approval confirmation
7. Submit buyChest(1) transaction  ← chestType as uint8
8. Wait for buyChest confirmation
9. Decode ChestBought event from logs
10. Parse card rewards server-side
11. Return rewards to user
```

⚠️ **Important**: 
- `buyChest` is `nonpayable` and takes `uint8`
- Payment is via ERC20 ($CLASH), NOT native ETH
- `msg.value` should always be 0
