# Aavegotchi Contract Information

## Base Mainnet

**Diamond Contract:** `0xA99c4B08201F2913Db8D28e71d020c4298F29dBF`  
**Chain ID:** 8453  
**RPC:** https://mainnet.base.org

## Functions

### getAavegotchi(uint256 _tokenId)

Returns complete gotchi data structure.

**Relevant Fields:**
- `lastInteracted` (uint40) - timestamp of last pet
- Located at byte offset 2498 in return data
- 64 hex characters (32 bytes / uint256)

**Cooldown:** 43260 seconds (12 hours + 1 minute)

### interact(uint256[] calldata _tokenIds)

Pets one or more gotchis to increase kinship.

**Function Selector:** `0xbafa9107`

**Parameters:**
- `_tokenIds` - Array of gotchi IDs to pet

**Requirements:**
- Caller must own the gotchi
- Cooldown must have elapsed (12h 1min)
- Gotchi must not be locked

**Calldata Encoding:**

For single gotchi (e.g., #9638):
```
0xbafa9107                                                         // function selector
0000000000000000000000000000000000000000000000000000000000000020 // offset to array
0000000000000000000000000000000000000000000000000000000000000001 // array length (1)
00000000000000000000000000000000000000000000000000000000000025a6 // gotchi ID (9638)
```

For multiple gotchis:
```
0xbafa9107                                                         // function selector
0000000000000000000000000000000000000000000000000000000000000020 // offset to array
0000000000000000000000000000000000000000000000000000000000000002 // array length (2)
00000000000000000000000000000000000000000000000000000000000025a6 // gotchi ID 1
0000000000000000000000000000000000000000000000000000000000005ceb // gotchi ID 2
```

## Events

### AavegotchiInteracted

Emitted when a gotchi is petted.

```solidity
event AavegotchiInteracted(uint256 indexed _tokenId, uint256 kinship);
```

## Gas Costs

**Estimated Gas:**
- Single pet: ~55,000 gas
- Batch (5 gotchis): ~150,000 gas

**Base Mainnet:**
- Gas price: typically < 0.001 gwei
- Very cheap! Usually < $0.01 per pet

## Security

**Safe Operations:**
- ✅ No token transfers
- ✅ No approvals needed
- ✅ Only updates kinship state
- ✅ Reverts if cooldown not ready

**Owner Check:**
- Contract verifies `msg.sender` owns the gotchi
- Cannot pet gotchis you don't own

## Cooldown Calculation

```
lastInteracted + 43260 seconds <= block.timestamp
```

**In hours:** 12 hours + 1 minute

**Why +1 minute?**
- Prevents exact timing issues
- Ensures minimum 12 hour gap
- Small buffer for block timestamp variance
