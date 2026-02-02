---
name: streme-launcher
description: Launch tokens on Streme (streme.fun) - the streaming token platform on Base. Use when deploying SuperTokens with built-in staking rewards, Uniswap V3 liquidity, and optional vesting vaults. Triggers on "launch token on streme", "deploy streme token", "create supertoken", or any Streme token deployment task.
---

# Streme Token Launcher

Deploy SuperTokens on Base via Streme's V2 contracts. Tokens include automatic Uniswap V3 liquidity, Superfluid streaming staking rewards, and optional vesting vaults.

## Quick Start

```typescript
import { createWalletClient, http, parseEther, encodeAbiParameters } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// See references/contracts.md for full ABIs
const DEPLOYER = '0x8712F62B3A2EeBA956508e17335368272f162748';

const tokenConfig = {
  _name: 'My Token',
  _symbol: 'MYTOKEN',
  _supply: parseEther('100000000000'), // 100B
  _fee: 10000, // 10%
  _salt: '0x0...', // from generateSalt()
  _deployer: walletAddress,
  _fid: 0n, // Farcaster FID or 0
  _image: 'https://example.com/image.png',
  _castHash: 'deployment',
  _poolConfig: {
    tick: -230400,
    pairedToken: '0x4200000000000000000000000000000000000006', // WETH
    devBuyFee: 10000
  }
};

// Deploy with 10% staking (1 day lock, 365 day stream)
const stakingAlloc = createStakingAllocation(10, 1, 365);
await deployWithAllocations(tokenConfig, [stakingAlloc]);
```

## Contract Addresses (Base Mainnet)

| Contract | Address |
|----------|---------|
| STREME_PUBLIC_DEPLOYER_V2 | `0x8712F62B3A2EeBA956508e17335368272f162748` |
| STREME_SUPER_TOKEN_FACTORY | `0xB973FDd29c99da91CAb7152EF2e82090507A1ce9` |
| STREME_ALLOCATION_HOOK | `0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B` |
| LP_FACTORY | `0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8` |
| MAIN_STREME (for salt) | `0x5797a398fe34260f81be65908da364cc18fbc360` |
| WETH (Base) | `0x4200000000000000000000000000000000000006` |

## Deployment Flow

1. **Generate Salt** - Call `generateSalt()` to get deterministic token address
2. **Upload Image** - Host token image (see Image Hosting below)
3. **Build Config** - Create tokenConfig and allocations
4. **Deploy** - Call `deployWithAllocations()`

## Image Hosting

Token images must be publicly accessible URLs. Options:

### IPFS (Recommended)
```typescript
// Using Pinata
const pinata = new PinataSDK({ pinataJwt: PINATA_JWT });
const { IpfsHash } = await pinata.pinFileToIPFS(fileStream);
const imageUrl = `https://gateway.pinata.cloud/ipfs/${IpfsHash}`;
```

### Cloudinary
```typescript
import { v2 as cloudinary } from 'cloudinary';

const result = await cloudinary.uploader.upload(imagePath, {
  folder: 'tokens',
  transformation: [{ width: 400, height: 400, crop: 'fill' }]
});
const imageUrl = result.secure_url;
```

### Direct URL
Any publicly accessible image URL works:
```typescript
const imageUrl = 'https://example.com/my-token.png';
```

### Requirements
- Format: PNG, JPG, GIF, WebP
- Size: < 5MB (< 1MB recommended)
- Dimensions: Square preferred (400x400 ideal)

### Upload Script
```bash
# IPFS via Pinata
PINATA_JWT=xxx npx ts-node scripts/upload-image.ts pinata ./token.png

# Cloudinary
CLOUDINARY_CLOUD_NAME=xxx CLOUDINARY_API_KEY=xxx CLOUDINARY_API_SECRET=xxx \
  npx ts-node scripts/upload-image.ts cloudinary ./token.png

# imgBB (free)
npx ts-node scripts/upload-image.ts imgbb ./token.png
```

## Allocations

### Staking Allocation (Type 1)
Streams tokens to stakers over time.

```typescript
function createStakingAllocation(
  percentage: number,    // % of supply (e.g., 10)
  lockDays: number,      // min stake duration
  flowDays: number,      // reward stream duration
  delegate?: string      // optional admin address
) {
  const lockSec = lockDays * 86400;
  const flowSec = flowDays * 86400;
  
  return {
    allocationType: 1,
    admin: delegate || '0x0000000000000000000000000000000000000000',
    percentage: BigInt(percentage),
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'int96' }],
      [BigInt(lockSec), BigInt(flowSec)]
    )
  };
}
```

### Vault Allocation (Type 0)
Locked tokens with optional vesting.

```typescript
function createVaultAllocation(
  percentage: number,     // % of supply
  beneficiary: string,    // recipient address
  lockDays: number,       // lockup (min 7 days)
  vestingDays: number     // vesting after lock
) {
  const lockSec = Math.max(lockDays, 7) * 86400;
  const vestSec = vestingDays * 86400;
  
  return {
    allocationType: 0,
    admin: beneficiary,
    percentage: BigInt(percentage),
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      [BigInt(lockSec), BigInt(vestSec)]
    )
  };
}
```

### Allocation Rules
- Staking + Vault percentages must be ≤100%
- Remaining % goes to Uniswap V3 LP
- Vault lock minimum: 7 days
- Standard config: 10% staking, 90% LP

## Token Config Defaults

| Parameter | Value |
|-----------|-------|
| Supply | 100,000,000,000 (100B) |
| Creator Fee | 10000 (10%) |
| Dev Buy Fee | 10000 (10%) |
| Tick | -230400 |
| Paired Token | WETH |

## API Endpoints

```bash
# Get tokens by deployer
GET https://api.streme.fun/api/tokens/deployer/{address}

# Search all tokens
GET https://api.streme.fun/api/tokens

# Token details
GET https://api.streme.fun/api/tokens/{address}
```

## Full Implementation

See `scripts/deploy-token.ts` for complete deployment script.

See `references/contracts.md` for full ABIs and type definitions.

## Common Patterns

### Standard Launch (10% staking)
```typescript
const allocations = [createStakingAllocation(10, 1, 365)];
```

### With Team Vault (10% staking + 10% vested)
```typescript
const allocations = [
  createStakingAllocation(10, 1, 365),
  createVaultAllocation(10, teamAddress, 30, 365)
];
```

### Max Liquidity (no allocations)
```typescript
const allocations = [];
// 100% goes to Uniswap V3 LP
```
