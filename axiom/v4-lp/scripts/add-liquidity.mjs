#!/usr/bin/env node
/**
 * Add liquidity to Uniswap V4 pool on Base
 * Usage: node add-liquidity.mjs --amount 20 --range 25
 */

import { createPublicClient, createWalletClient, http, parseEther, parseUnits, encodeFunctionData, encodeAbiParameters, parseAbiParameters, formatEther, formatUnits, maxUint256, keccak256, encodePacked } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment
dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

// Parse args
const argv = yargs(hideBin(process.argv))
  .option('amount', { type: 'number', default: 20, description: 'USD amount to add' })
  .option('range', { type: 'number', default: 25, description: 'Range percentage (±%)' })
  .option('token0', { type: 'string', description: 'First token (address or symbol)' })
  .option('token1', { type: 'string', description: 'Second token (address or symbol)' })
  .option('fee', { type: 'string', description: 'Fee tier (hex, e.g., 0x800000 or 3000)' })
  .option('tick-spacing', { type: 'number', description: 'Tick spacing (e.g., 200)' })
  .option('hooks', { type: 'string', description: 'Hooks address' })
  .option('pool-key', { type: 'string', description: 'Complete pool key JSON' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .option('skip-approvals', { type: 'boolean', default: false, description: 'Skip approval checks' })
  .parse();

// Constants
const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  WETH: '0x4200000000000000000000000000000000000006',
  AXIOM: '0xf3Ce5dDAAb6C133F9875a4a46C55cf0b58111B07',
};

// Common Base tokens
const TOKEN_ADDRESSES = {
  'WETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 
  'BNKR': '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b',
  'AXIOM': '0xf3ce5ddaab6c133f9875a4a46c55cf0b58111b07',
  'ETH': '0x0000000000000000000000000000000000000000',
};

const AXIOM_POOL = {
  poolId: '0x10a0b8eba9d4e0f772c8c47968ee819bb4609ef4454409157961570cdce9a735',
  fee: 0x800000, // DYNAMIC_FEE_FLAG - hook controls fee
  tickSpacing: 200,
  hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc',
};

// Action codes
const ACTIONS = {
  MINT_POSITION: 0x02,
  SETTLE_PAIR: 0x0d,
};

// Uniswap math constants
const Q96 = 2n ** 96n;

// Helper functions for generic token support
function resolveTokenAddress(tokenInput) {
  const upper = tokenInput.toUpperCase();
  if (TOKEN_ADDRESSES[upper]) {
    return TOKEN_ADDRESSES[upper];
  }
  if (isAddress(tokenInput)) {
    return getAddress(tokenInput);
  }
  throw new Error(`Unknown token: ${tokenInput}. Use address or symbol: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`);
}

function getTokenSymbol(address) {
  const addr = address.toLowerCase();
  for (const [symbol, tokenAddr] of Object.entries(TOKEN_ADDRESSES)) {
    if (tokenAddr.toLowerCase() === addr) {
      return symbol;
    }
  }
  return address.slice(0, 8) + '...';
}

function sortTokens(token0, token1) {
  // V4 requires currency0 < currency1
  const addr0 = resolveTokenAddress(token0);
  const addr1 = resolveTokenAddress(token1);
  
  if (addr0.toLowerCase() < addr1.toLowerCase()) {
    return { currency0: addr0, currency1: addr1 };
  } else {
    return { currency0: addr1, currency1: addr0 };
  }
}

function parsePoolKey(poolKeyJson) {
  try {
    const poolKey = JSON.parse(poolKeyJson);
    return {
      currency0: getAddress(poolKey.currency0),
      currency1: getAddress(poolKey.currency1),
      fee: parseInt(poolKey.fee),
      tickSpacing: parseInt(poolKey.tickSpacing),
      hooks: getAddress(poolKey.hooks),
    };
  } catch (error) {
    throw new Error(`Invalid pool key JSON: ${error.message}`);
  }
}

function buildPoolConfig() {
  // Check if user provided pool key directly
  if (argv.poolKey) {
    const poolKey = parsePoolKey(argv.poolKey);
    return {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks,
    };
  }
  
  // Check if user provided token addresses
  if (argv.token0 && argv.token1) {
    const { currency0, currency1 } = sortTokens(argv.token0, argv.token1);
    return {
      currency0,
      currency1,
      fee: argv.fee ? (argv.fee.startsWith('0x') ? parseInt(argv.fee) : parseInt(argv.fee)) : 3000,
      tickSpacing: argv.tickSpacing || 60,
      hooks: argv.hooks || '0x0000000000000000000000000000000000000000',
    };
  }
  
  // Default to AXIOM/WETH pool for backward compatibility
  return {
    currency0: CONTRACTS.WETH,
    currency1: CONTRACTS.AXIOM, 
    fee: 0x800000,
    tickSpacing: 200,
    hooks: '0xb429d62f8f3bffb98cdb9569533ea23bf0ba28cc',
  };
}

// Compute poolId from poolKey (keccak256 of abi-encoded PoolKey struct)
function computePoolId(poolKey) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('address, address, uint24, int24, address'),
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    )
  );
}

// Get token decimals (handles native ETH)
async function getTokenDecimals(publicClient, tokenAddress) {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') return 18;
  try {
    return await publicClient.readContract({
      address: tokenAddress,
      abi: [{ name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] }],
      functionName: 'decimals',
    });
  } catch {
    return 18; // fallback
  }
}

// Calculate sqrt price from tick: sqrt(1.0001^tick) * 2^96
function tickToSqrtPriceX96(tick) {
  const sqrtRatio = Math.sqrt(Math.pow(1.0001, tick));
  return BigInt(Math.floor(sqrtRatio * Number(Q96)));
}

// Get liquidity for amount0: amount0 * (sqrtA * sqrtB) / (sqrtB - sqrtA)
function getLiquidityForAmount0(sqrtPriceA, sqrtPriceB, amount0) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  const intermediate = (sqrtPriceA * sqrtPriceB) / Q96;
  return (amount0 * intermediate) / (sqrtPriceB - sqrtPriceA);
}

// Get liquidity for amount1: amount1 * Q96 / (sqrtB - sqrtA)
function getLiquidityForAmount1(sqrtPriceA, sqrtPriceB, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  return (amount1 * Q96) / (sqrtPriceB - sqrtPriceA);
}

// Get max liquidity for given amounts and price range
function getLiquidityForAmounts(sqrtPriceX96, sqrtPriceA, sqrtPriceB, amount0, amount1) {
  if (sqrtPriceA > sqrtPriceB) [sqrtPriceA, sqrtPriceB] = [sqrtPriceB, sqrtPriceA];
  
  if (sqrtPriceX96 <= sqrtPriceA) {
    // Current price below range - only need token0
    return getLiquidityForAmount0(sqrtPriceA, sqrtPriceB, amount0);
  } else if (sqrtPriceX96 < sqrtPriceB) {
    // Current price in range - need both tokens
    const liquidity0 = getLiquidityForAmount0(sqrtPriceX96, sqrtPriceB, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtPriceA, sqrtPriceX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  } else {
    // Current price above range - only need token1
    return getLiquidityForAmount1(sqrtPriceA, sqrtPriceB, amount1);
  }
}

// ABIs
const ERC20_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
];

const PERMIT2_ABI = [
  { name: 'approve', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }], outputs: [] },
  { name: 'allowance', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'token', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: 'amount', type: 'uint160' }, { name: 'expiration', type: 'uint48' }, { name: 'nonce', type: 'uint48' }] },
];

const STATE_VIEW_ABI = [
  { name: 'getSlot0', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ name: 'sqrtPriceX96', type: 'uint160' }, { name: 'tick', type: 'int24' }, { name: 'protocolFee', type: 'uint24' }, { name: 'lpFee', type: 'uint24' }] },
  { name: 'getLiquidity', type: 'function', inputs: [{ name: 'poolId', type: 'bytes32' }], outputs: [{ type: 'uint128' }] },
];

const POSITION_MANAGER_ABI = [
  { name: 'modifyLiquidities', type: 'function', inputs: [{ name: 'unlockData', type: 'bytes' }, { name: 'deadline', type: 'uint256' }], outputs: [{ type: 'bytes' }] },
  { name: 'nextTokenId', type: 'function', inputs: [], outputs: [{ type: 'uint256' }] },
];

async function main() {
  console.log('🦄 Uniswap V4 LP - Add Liquidity');
  console.log('================================');
  
  // Build pool configuration
  const poolConfig = buildPoolConfig();
  const token0Symbol = getTokenSymbol(poolConfig.currency0);
  const token1Symbol = getTokenSymbol(poolConfig.currency1);
  
  console.log(`Pool: ${token0Symbol}/${token1Symbol}`);
  console.log(`Currency0: ${poolConfig.currency0}`);
  console.log(`Currency1: ${poolConfig.currency1}`);
  console.log(`Fee: 0x${poolConfig.fee.toString(16)} ${poolConfig.fee === 0x800000 ? '(DYNAMIC_FEE_FLAG)' : `(${poolConfig.fee / 10000}%)`}`);
  console.log(`Tick Spacing: ${poolConfig.tickSpacing}`);
  console.log(`Amount: $${argv.amount}`);
  console.log(`Range: ±${argv.range}%`);
  console.log(`Dry run: ${argv.dryRun}`);
  console.log('');

  // Setup clients
  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ No private key found in environment');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  console.log(`Wallet: ${account.address}`);

  const publicClient = createPublicClient({
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http('https://mainnet.base.org'),
  });

  // 1. Get current pool state
  console.log('\n📊 Fetching pool state...');
  const poolId = computePoolId(poolConfig);
  console.log(`Pool ID: ${poolId}`);
  const [sqrtPriceX96, currentTick, , lpFee] = await publicClient.readContract({
    address: CONTRACTS.STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [poolId],
  });

  console.log(`Current tick: ${currentTick}`);
  console.log(`LP Fee: ${lpFee / 100}%`);

  // 2. Calculate tick range
  // Calculate tick range based on percentage
  const tickRange = Math.floor((argv.range / 100) * 46054); // ~46054 ticks per 100% (for ETH pairs)
  const tickLower = Math.floor((currentTick - tickRange) / poolConfig.tickSpacing) * poolConfig.tickSpacing;
  const tickUpper = Math.ceil((currentTick + tickRange) / poolConfig.tickSpacing) * poolConfig.tickSpacing;

  console.log(`Tick range: ${tickLower} to ${tickUpper}`);

  // 3. Check balances
  const getTokenBalance = async (tokenAddress) => {
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return await publicClient.getBalance({ address: account.address });
    }
    return await publicClient.readContract({ 
      address: tokenAddress, 
      abi: ERC20_ABI, 
      functionName: 'balanceOf', 
      args: [account.address] 
    });
  };

  // Fetch token decimals for proper formatting
  const [token0Decimals, token1Decimals] = await Promise.all([
    getTokenDecimals(publicClient, poolConfig.currency0),
    getTokenDecimals(publicClient, poolConfig.currency1),
  ]);

  const [token0Balance, token1Balance] = await Promise.all([
    getTokenBalance(poolConfig.currency0),
    getTokenBalance(poolConfig.currency1),
  ]);

  console.log(`\n💰 Balances:`);
  console.log(`  ${token0Symbol} (${token0Decimals} decimals): ${formatUnits(token0Balance, token0Decimals)}`);
  console.log(`  ${token1Symbol} (${token1Decimals} decimals): ${formatUnits(token1Balance, token1Decimals)}`);

  // 4. Calculate amounts for position (split 50/50)
  const ETH_PRICE = 2750; // Approximate for USD calculation
  
  // For generic pools, we'll split the USD value 50/50 between tokens
  // This is a simplified approach - in production you'd want proper price feeds
  const halfAmount = argv.amount / 2;
  
  // Simple approximation: if token0 is WETH, use ETH price, otherwise treat as $1
  const token0Price = poolConfig.currency0.toLowerCase() === CONTRACTS.WETH.toLowerCase() ? ETH_PRICE : 1;
  const token1Price = 1; // Simplified - treat other tokens as ~$1 for calculation
  
  const token0Amount = parseUnits(String(halfAmount / token0Price), token0Decimals);
  
  // Get token1 amount based on current price ratio
  // sqrtPriceX96 encodes price as sqrt(token1/token0) * 2^96
  const price = (Number(sqrtPriceX96) / 2 ** 96) ** 2;
  // Adjust for decimal difference between tokens
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  const token1PerToken0 = price * decimalAdjustment;
  const token1Amount = BigInt(Math.floor(Number(token0Amount) * token1PerToken0));

  console.log(`\n📦 Position amounts:`);
  console.log(`  ${token0Symbol}: ${formatUnits(token0Amount, token0Decimals)}`);
  console.log(`  ${token1Symbol}: ${formatUnits(token1Amount, token1Decimals)}`);

  if (token0Amount > token0Balance) {
    console.error(`❌ Insufficient ${token0Symbol} balance`);
    process.exit(1);
  }
  if (token1Amount > token1Balance) {
    console.error(`❌ Insufficient ${token1Symbol} balance`);
    process.exit(1);
  }

  if (argv.dryRun) {
    console.log('\n✅ Dry run complete - no transactions sent');
    return;
  }

  // 5. Approve tokens to Permit2
  if (!argv.skipApprovals) {
    console.log('\n🔐 Checking/setting approvals...');
    
    const approveTokenIfNeeded = async (tokenAddress, tokenAmount, tokenSymbol) => {
      // Skip ETH - it doesn't need approval
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return;
      }
      
      const allowance = await publicClient.readContract({
        address: tokenAddress, 
        abi: ERC20_ABI, 
        functionName: 'allowance',
        args: [account.address, CONTRACTS.PERMIT2],
      });

      if (allowance < tokenAmount) {
        console.log(`  Approving ${tokenSymbol} to Permit2...`);
        const hash = await walletClient.writeContract({
          address: tokenAddress, 
          abi: ERC20_ABI, 
          functionName: 'approve',
          args: [CONTRACTS.PERMIT2, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  ✅ ${tokenSymbol} approved: ${hash}`);
      }
    };

    await Promise.all([
      approveTokenIfNeeded(poolConfig.currency0, token0Amount, token0Symbol),
      approveTokenIfNeeded(poolConfig.currency1, token1Amount, token1Symbol),
    ]);

    // 6. Approve PositionManager on Permit2
    console.log('  Checking Permit2 allowances for PositionManager...');
    
    const expiration = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

    const approvePermit2IfNeeded = async (tokenAddress, tokenAmount, tokenSymbol) => {
      // Skip ETH - it doesn't use Permit2
      if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return;
      }
      
      const [p2Amount] = await publicClient.readContract({
        address: CONTRACTS.PERMIT2, 
        abi: PERMIT2_ABI, 
        functionName: 'allowance',
        args: [account.address, tokenAddress, CONTRACTS.POSITION_MANAGER],
      });

      if (p2Amount < tokenAmount) {
        console.log(`  Approving ${tokenSymbol} on Permit2 for PositionManager...`);
        const hash = await walletClient.writeContract({
          address: CONTRACTS.PERMIT2, 
          abi: PERMIT2_ABI, 
          functionName: 'approve',
          args: [tokenAddress, CONTRACTS.POSITION_MANAGER, BigInt('0xffffffffffffffffffffffffffffffff'), expiration],
        });
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`  ✅ Permit2 ${tokenSymbol} approved: ${hash}`);
      }
    };

    await Promise.all([
      approvePermit2IfNeeded(poolConfig.currency0, token0Amount, token0Symbol),
      approvePermit2IfNeeded(poolConfig.currency1, token1Amount, token1Symbol),
    ]);
  } else {
    console.log('\n🔐 Skipping approval checks (--skip-approvals)');
  }

  // 7. Encode and send the modifyLiquidities transaction
  console.log('\n🚀 Adding liquidity...');

  // Calculate liquidity from amounts using Uniswap math
  const sqrtPriceLower = tickToSqrtPriceX96(tickLower);
  const sqrtPriceUpper = tickToSqrtPriceX96(tickUpper);
  
  console.log(`sqrtPriceX96: ${sqrtPriceX96}`);
  console.log(`sqrtPriceLower: ${sqrtPriceLower}`);
  console.log(`sqrtPriceUpper: ${sqrtPriceUpper}`);
  
  const liquidity = getLiquidityForAmounts(
    sqrtPriceX96,
    sqrtPriceLower,
    sqrtPriceUpper,
    token0Amount,
    token1Amount
  );
  
  console.log(`Calculated liquidity: ${liquidity}`);
  
  if (liquidity === 0n) {
    console.error('❌ Calculated liquidity is 0 - amounts may be too small');
    process.exit(1);
  }

  // Use MINT_POSITION (0x02) with pre-calculated liquidity
  const actions = '0x020d'; // MINT_POSITION + SETTLE_PAIR

  // Pad values to 32 bytes
  const pad32 = (hex) => hex.slice(2).padStart(64, '0');
  const toInt24Hex = (n) => {
    const val = n < 0 ? (0x1000000 + n) : n;
    return val.toString(16).padStart(64, '0');
  };
  
  // MINT_POSITION params (decodeMintParams expects):
  // PoolKey (5 slots) + tickLower + tickUpper + liquidity + amount0Max + amount1Max + owner + hookData
  const mintParamsHex = '0x' +
    // PoolKey (5 slots = 0xa0)
    pad32(poolConfig.currency0) +                    // 0x00: currency0
    pad32(poolConfig.currency1) +                    // 0x20: currency1
    poolConfig.fee.toString(16).padStart(64, '0') +  // 0x40: fee (uint24)
    poolConfig.tickSpacing.toString(16).padStart(64, '0') +  // 0x60: tickSpacing (int24)
    pad32(poolConfig.hooks) +                        // 0x80: hooks
    // Position params
    toInt24Hex(tickLower) +                          // 0xa0: tickLower (int24)
    toInt24Hex(tickUpper) +                          // 0xc0: tickUpper (int24)
    liquidity.toString(16).padStart(64, '0') +       // 0xe0: liquidity (uint256)
    token0Amount.toString(16).padStart(64, '0') +    // 0x100: amount0Max (uint128)
    token1Amount.toString(16).padStart(64, '0') +    // 0x120: amount1Max (uint128)
    '0000000000000000000000000000000000000000000000000000000000000001' +  // 0x140: owner (MSG_SENDER = 1)
    // hookData: offset to bytes data (0x160 = 11 slots from PoolKey start)
    (12 * 32).toString(16).padStart(64, '0') +       // 0x160: hookData offset -> points to 0x180
    '0000000000000000000000000000000000000000000000000000000000000000';   // 0x180: hookData length (0)

  // SETTLE_PAIR params: just currency0, currency1 (tightly packed)
  const settleParamsHex = '0x' +
    pad32(poolConfig.currency0) +
    pad32(poolConfig.currency1);

  // Now build the outer unlockData structure
  // Format: abi.encode(bytes actions, bytes[] params)
  const unlockData = encodeAbiParameters(
    parseAbiParameters('bytes, bytes[]'),
    [actions, [mintParamsHex, settleParamsHex]]
  );

  const deadline = Math.floor(Date.now() / 1000) + 1800; // 30 minutes

  try {
    const hash = await walletClient.writeContract({
      address: CONTRACTS.POSITION_MANAGER,
      abi: POSITION_MANAGER_ABI,
      functionName: 'modifyLiquidities',
      args: [unlockData, deadline],
    });

    console.log(`\n⏳ Transaction sent: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      console.log(`\n✅ Liquidity added successfully!`);
      console.log(`Block: ${receipt.blockNumber}`);
      console.log(`Gas used: ${receipt.gasUsed}`);
      console.log(`\nView on BaseScan: https://basescan.org/tx/${hash}`);
    } else {
      console.error('❌ Transaction failed');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main().catch(console.error);
