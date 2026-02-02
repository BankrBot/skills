/**
 * Streme Token Deployment Script
 * 
 * Deploy SuperTokens on Base via Streme V2 contracts.
 * 
 * Usage:
 *   npx ts-node deploy-token.ts
 * 
 * Environment:
 *   PRIVATE_KEY - Deployer wallet private key
 *   TOKEN_NAME - Token name
 *   TOKEN_SYMBOL - Token symbol (without $)
 *   TOKEN_IMAGE - Image URL (optional)
 *   STAKING_PERCENT - Staking allocation % (default: 10)
 *   STAKING_LOCK_DAYS - Lock duration (default: 1)
 *   STAKING_FLOW_DAYS - Stream duration (default: 365)
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  encodeAbiParameters,
  type Hex,
} from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// ============ CONTRACTS ============

const CONTRACTS = {
  DEPLOYER: '0x8712F62B3A2EeBA956508e17335368272f162748' as const,
  TOKEN_FACTORY: '0xB973FDd29c99da91CAb7152EF2e82090507A1ce9' as const,
  ALLOCATION_HOOK: '0xC907788f3e71a6eC916ba76A9f1a7C7C19384c7B' as const,
  LP_FACTORY: '0xfF65a5f74798EebF87C8FdFc4e56a71B511aB5C8' as const,
  MAIN_STREME: '0x5797a398fe34260f81be65908da364cc18fbc360' as const,
  WETH: '0x4200000000000000000000000000000000000006' as const,
};

// ============ ABI ============

const DEPLOY_ABI = [
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

// ============ HELPERS ============

function daysToSeconds(days: number): bigint {
  return BigInt(days * 24 * 60 * 60);
}

function createStakingAllocation(
  percentage: number,
  lockDays: number,
  flowDays: number,
  delegate?: string
) {
  const data = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'int96' }],
    [daysToSeconds(lockDays), daysToSeconds(flowDays)]
  );

  return {
    allocationType: 1 as const,
    admin: (delegate || '0x0000000000000000000000000000000000000000') as Hex,
    percentage: BigInt(percentage),
    data,
  };
}

function createVaultAllocation(
  percentage: number,
  beneficiary: string,
  lockDays: number,
  vestingDays: number
) {
  const data = encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }],
    [daysToSeconds(Math.max(lockDays, 7)), daysToSeconds(vestingDays)]
  );

  return {
    allocationType: 0 as const,
    admin: beneficiary as Hex,
    percentage: BigInt(percentage),
    data,
  };
}

// ============ MAIN ============

async function main() {
  // Config from environment
  const privateKey = process.env.PRIVATE_KEY as Hex;
  const tokenName = process.env.TOKEN_NAME || 'My Token';
  const tokenSymbol = (process.env.TOKEN_SYMBOL || 'MYTOKEN').replace('$', '');
  const tokenImage = process.env.TOKEN_IMAGE || '';
  const stakingPercent = parseInt(process.env.STAKING_PERCENT || '10');
  const stakingLockDays = parseInt(process.env.STAKING_LOCK_DAYS || '1');
  const stakingFlowDays = parseInt(process.env.STAKING_FLOW_DAYS || '365');

  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable required');
  }

  // Setup clients
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  console.log(`Deploying token: ${tokenName} ($${tokenSymbol})`);
  console.log(`Deployer: ${account.address}`);

  // Generate salt
  console.log('Generating salt...');
  const [salt, predictedToken] = await publicClient.readContract({
    address: CONTRACTS.MAIN_STREME,
    abi: DEPLOY_ABI,
    functionName: 'generateSalt',
    args: [
      tokenSymbol,
      account.address,
      CONTRACTS.TOKEN_FACTORY,
      CONTRACTS.WETH,
    ],
  });

  console.log(`Predicted token address: ${predictedToken}`);

  // Build token config
  const tokenConfig = {
    _name: tokenName,
    _symbol: tokenSymbol,
    _supply: parseEther('100000000000'), // 100B
    _fee: 10000, // 10%
    _salt: salt,
    _deployer: account.address,
    _fid: 0n,
    _image: tokenImage,
    _castHash: 'streme-launcher deployment',
    _poolConfig: {
      tick: -230400,
      pairedToken: CONTRACTS.WETH,
      devBuyFee: 10000,
    },
  };

  // Build allocations
  const allocations = [];
  if (stakingPercent > 0) {
    allocations.push(
      createStakingAllocation(stakingPercent, stakingLockDays, stakingFlowDays)
    );
    console.log(`Staking: ${stakingPercent}% (${stakingLockDays}d lock, ${stakingFlowDays}d stream)`);
  }

  const lpPercent = 100 - stakingPercent;
  console.log(`Liquidity: ${lpPercent}%`);

  // Deploy
  console.log('Deploying token...');
  const hash = await walletClient.writeContract({
    address: CONTRACTS.DEPLOYER,
    abi: DEPLOY_ABI,
    functionName: 'deployWithAllocations',
    args: [
      CONTRACTS.TOKEN_FACTORY,
      CONTRACTS.ALLOCATION_HOOK,
      CONTRACTS.LP_FACTORY,
      '0x0000000000000000000000000000000000000000', // postLPHook
      tokenConfig,
      allocations,
    ],
  });

  console.log(`Transaction: ${hash}`);
  console.log('Waiting for confirmation...');

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === 'success') {
    console.log('\n✅ Token deployed successfully!');
    console.log(`Token: ${predictedToken}`);
    console.log(`TX: https://basescan.org/tx/${hash}`);
    console.log(`View: https://streme.fun/token/${predictedToken}`);
  } else {
    console.error('❌ Deployment failed');
    process.exit(1);
  }
}

main().catch(console.error);
