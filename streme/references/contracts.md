# Streme Contract Reference

## Contract Addresses (Base Mainnet, Chain ID: 8453)

```typescript
export const CONTRACTS = {
  STREME_PUBLIC_DEPLOYER_V2: '0x8712F62B3A2EeBA956508e17335368272f162748',
  STREME_SUPER_TOKEN_FACTORY: '0xB973FDd29c99da91CAb7152EF2e82090507A1ce9',
  STREME_ALLOCATION_HOOK: '0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B',
  LP_FACTORY: '0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8',
  MAIN_STREME: '0x5797a398fe34260f81be65908da364cc18fbc360',
  WETH: '0x4200000000000000000000000000000000000006',
  STAKING_FACTORY_V2: '0xC749105bc4b4eA6285dBBe2E3A36C2B899233d02c0',
  STREME_VAULT: '0xDa902C1F73160daDE69AB3c3355110442359EB70',
} as const;
```

## ABIs

### STREME_DEPLOY_V2_ABI

```typescript
export const STREME_DEPLOY_V2_ABI = [
  {
    inputs: [
      { name: '_symbol', type: 'string' },
      { name: '_requestor', type: 'address' },
      { name: '_tokenFactory', type: 'address' },
      { name: '_pairedToken', type: 'address' },
    ],
    name: 'generateSalt',
    outputs: [
      { name: 'salt', type: 'bytes32' },
      { name: 'token', type: 'address' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokenFactory', type: 'address' },
      { name: 'postDeployHook', type: 'address' },
      { name: 'liquidityFactory', type: 'address' },
      { name: 'postLPHook', type: 'address' },
      {
        name: 'preSaleTokenConfig',
        type: 'tuple',
        components: [
          { name: '_name', type: 'string' },
          { name: '_symbol', type: 'string' },
          { name: '_supply', type: 'uint256' },
          { name: '_fee', type: 'uint24' },
          { name: '_salt', type: 'bytes32' },
          { name: '_deployer', type: 'address' },
          { name: '_fid', type: 'uint256' },
          { name: '_image', type: 'string' },
          { name: '_castHash', type: 'string' },
          {
            name: '_poolConfig',
            type: 'tuple',
            components: [
              { name: 'tick', type: 'int24' },
              { name: 'pairedToken', type: 'address' },
              { name: 'devBuyFee', type: 'uint24' },
            ],
          },
        ],
      },
      {
        name: 'allocationConfigs',
        type: 'tuple[]',
        components: [
          { name: 'allocationType', type: 'uint8' },
          { name: 'admin', type: 'address' },
          { name: 'percentage', type: 'uint256' },
          { name: 'data', type: 'bytes' },
        ],
      },
    ],
    name: 'deployWithAllocations',
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'liquidityId', type: 'uint256' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
```

## TypeScript Types

```typescript
interface PoolConfig {
  tick: number;           // -230400 for standard
  pairedToken: `0x${string}`;  // WETH address
  devBuyFee: number;      // 10000 = 10%
}

interface TokenConfig {
  _name: string;
  _symbol: string;
  _supply: bigint;        // parseEther('100000000000')
  _fee: number;           // 10000 = 10%
  _salt: `0x${string}`;
  _deployer: `0x${string}`;
  _fid: bigint;           // Farcaster FID or 0n
  _image: string;
  _castHash: string;
  _poolConfig: PoolConfig;
}

interface AllocationConfig {
  allocationType: 0 | 1;  // 0=Vault, 1=Staking
  admin: `0x${string}`;
  percentage: bigint;
  data: `0x${string}`;
}
```

## Allocation Encoding

### Staking (Type 1)

```typescript
import { encodeAbiParameters } from 'viem';

// Encodes [lockDuration, streamDuration] in seconds
const data = encodeAbiParameters(
  [{ type: 'uint256' }, { type: 'int96' }],
  [BigInt(lockSeconds), BigInt(streamSeconds)]
);
```

### Vault (Type 0)

```typescript
// Encodes [lockupDuration, vestingDuration] in seconds
const data = encodeAbiParameters(
  [{ type: 'uint256' }, { type: 'uint256' }],
  [BigInt(lockupSeconds), BigInt(vestingSeconds)]
);
```

## RPC Endpoints

```typescript
const RPC_ENDPOINTS = [
  'https://mainnet.base.org',
  'https://base.meowrpc.com',
  'https://1rpc.io/base',
];
```

## Superfluid Integration

Streme tokens are Superfluid SuperTokens. Key Superfluid addresses on Base:

```typescript
export const SUPERFLUID = {
  HOST: '0x4C073B3baB6d8826b8C5b229f3cfdC1eC6E47E74',
  CFA_V1: '0x19ba78B9cDB05A877718841c574325fdB53601bb',
  CFA_V1_FORWARDER: '0xcfA132E353cB4E398080B9700609bb008eceB125',
  GDA_V1_FORWARDER: '0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08',
} as const;
```

## Post-Deployment

After deployment, the token will have:

1. **Uniswap V3 Pool** - Paired with WETH at tick -230400
2. **Staking Pool** (if configured) - Streams rewards to stakers
3. **Vault** (if configured) - Locked tokens with vesting schedule

Query deployed tokens via:
```
GET https://api.streme.fun/api/tokens/deployer/{deployerAddress}
```
