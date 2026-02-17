#!/usr/bin/env node
/**
 * Burn V4 Position - Remove all liquidity + claim fees + burn NFT
 * 
 * Usage: node burn-position.mjs --token-id 1078344
 * 
 * Actions: BURN_POSITION (0x03) → CLOSE_CURRENCY (0x11) × 2
 */

import { createPublicClient, createWalletClient, http, encodeAbiParameters, parseAbiParameters, concat, pad, toHex, formatEther } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Parse args
const args = process.argv.slice(2);
const tokenIdIndex = args.indexOf('--token-id');
if (tokenIdIndex === -1 || !args[tokenIdIndex + 1]) {
  console.error('Usage: node burn-position.mjs --token-id <tokenId>');
  process.exit(1);
}
const TOKEN_ID = BigInt(args[tokenIdIndex + 1]);

const dryRun = args.includes('--dry-run');

// Contracts
const POSITION_MANAGER = '0x7c5f5a4bbd8fd63184577525326123b519429bdc';
const POOL_MANAGER = '0x498581ff718922c3f8e6a244956af099b2652b2b';
const STATE_VIEW = '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71';

// Action codes (from V4 periphery Actions.sol)
const BURN_POSITION = 0x03;
const CLOSE_CURRENCY = 0x11;

// Setup
const privateKey = process.env.NET_PRIVATE_KEY;
if (!privateKey) {
  console.error('NET_PRIVATE_KEY not set');
  process.exit(1);
}

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

console.log('🔥 Uniswap V4 - Burn Position');
console.log('==============================');
console.log('Token ID:', TOKEN_ID.toString());
console.log('Wallet:', account.address);
if (dryRun) console.log('⚠️  DRY RUN - no transaction will be sent\n');

// ABIs
const PM_ABI = [
  { name: 'ownerOf', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'address' }] },
  { name: 'getPoolAndPositionInfo', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'tuple', components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }] }, { type: 'uint256' }] },
  { name: 'getPositionLiquidity', type: 'function', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint128' }] },
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
];

const ERC20_ABI = [
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'approve', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
];

async function main() {
  // 1. Verify ownership
  console.log('📋 Fetching position info...');
  const owner = await publicClient.readContract({
    address: POSITION_MANAGER,
    abi: PM_ABI,
    functionName: 'ownerOf',
    args: [TOKEN_ID],
  });
  
  if (owner.toLowerCase() !== account.address.toLowerCase()) {
    console.error(`❌ You don't own this position. Owner: ${owner}`);
    process.exit(1);
  }
  console.log('✅ Ownership verified');

  // 2. Get pool and position info
  const [poolKey, positionInfo] = await publicClient.readContract({
    address: POSITION_MANAGER,
    abi: PM_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [TOKEN_ID],
  });

  const liquidity = await publicClient.readContract({
    address: POSITION_MANAGER,
    abi: PM_ABI,
    functionName: 'getPositionLiquidity',
    args: [TOKEN_ID],
  });

  // Decode position info (packed as uint256)
  const infoNum = BigInt(positionInfo);
  const hasSubscriber = (infoNum >> 252n) & 1n;
  const tickLower = Number(BigInt.asIntN(24, (infoNum >> 228n) & 0xFFFFFFn));
  const tickUpper = Number(BigInt.asIntN(24, (infoNum >> 204n) & 0xFFFFFFn));

  console.log('\n📊 Position Details:');
  console.log('  Currency0:', poolKey.currency0);
  console.log('  Currency1:', poolKey.currency1);
  console.log('  Fee:', poolKey.fee);
  console.log('  Tick Spacing:', poolKey.tickSpacing);
  console.log('  Hooks:', poolKey.hooks);
  console.log('  Tick Range:', tickLower, '→', tickUpper);
  console.log('  Liquidity:', liquidity.toString());
  console.log('  Has Subscriber:', hasSubscriber === 1n);

  if (liquidity === 0n) {
    console.log('\n⚠️  Position has no liquidity - just burning empty NFT');
  }

  // Get token symbols
  let symbol0 = 'Token0', symbol1 = 'Token1';
  try {
    if (poolKey.currency0 !== '0x0000000000000000000000000000000000000000') {
      symbol0 = await publicClient.readContract({ address: poolKey.currency0, abi: ERC20_ABI, functionName: 'symbol' });
    } else {
      symbol0 = 'ETH';
    }
    if (poolKey.currency1 !== '0x0000000000000000000000000000000000000000') {
      symbol1 = await publicClient.readContract({ address: poolKey.currency1, abi: ERC20_ABI, functionName: 'symbol' });
    } else {
      symbol1 = 'ETH';
    }
  } catch {}
  console.log('  Tokens:', symbol0, '/', symbol1);

  // 3. Build the burn transaction
  console.log('\n🔨 Building transaction...');
  
  // Action 1: BURN_POSITION
  // Params: (uint256 tokenId, uint128 amount0Min, uint128 amount1Min, bytes hookData)
  const burnParams = encodeAbiParameters(
    parseAbiParameters('uint256, uint128, uint128, bytes'),
    [TOKEN_ID, 0n, 0n, '0x']
  );
  
  // Action 2: CLOSE_CURRENCY for currency0
  // Params: (address currency, address recipient)
  const closeParams0 = encodeAbiParameters(
    parseAbiParameters('address, address'),
    [poolKey.currency0, account.address]
  );

  // Action 3: CLOSE_CURRENCY for currency1
  const closeParams1 = encodeAbiParameters(
    parseAbiParameters('address, address'),
    [poolKey.currency1, account.address]
  );

  // Build actions bytes (3 actions: BURN + CLOSE × 2)
  const actions = concat([
    toHex(BURN_POSITION, { size: 1 }),
    toHex(CLOSE_CURRENCY, { size: 1 }),
    toHex(CLOSE_CURRENCY, { size: 1 }),
  ]);

  // unlockData = abi.encode(actions, params)
  const unlockData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [burnParams, closeParams0, closeParams1]]
  );

  console.log('  Actions:', actions);
  console.log('  Burn params length:', burnParams.length);
  console.log('  Close params0 length:', closeParams0.length);
  console.log('  Close params1 length:', closeParams1.length);
  console.log('  UnlockData length:', unlockData.length);

  if (dryRun) {
    console.log('\n🔍 DRY RUN - Transaction data:');
    console.log('  UnlockData:', unlockData.slice(0, 100) + '...');
    console.log('\n✅ Dry run complete. Remove --dry-run to execute.');
    return;
  }

  // 4. Execute
  console.log('\n🚀 Sending transaction...');
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

  try {
    const hash = await walletClient.writeContract({
      address: POSITION_MANAGER,
      abi: PM_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline],
      gas: 500000n,
    });

    console.log('⏳ Tx sent:', hash);
    console.log('https://basescan.org/tx/' + hash);

    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'reverted') {
      console.error('❌ Transaction reverted!');
      process.exit(1);
    }

    console.log('\n✅ Position burned successfully!');
    console.log('Gas used:', receipt.gasUsed.toString());
  } catch (error) {
    console.error('\n❌ Transaction failed:', error.message);
    if (error.message.includes('0x3b99b53d')) {
      console.error('   → SliceOutOfBounds - calldata encoding issue');
    }
    process.exit(1);
  }
}

main().catch(console.error);
