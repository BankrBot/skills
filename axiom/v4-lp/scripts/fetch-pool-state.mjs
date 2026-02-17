#!/usr/bin/env node
/**
 * Fetch current state of a Uniswap V4 pool
 * Usage: node fetch-pool-state.mjs --token0 WETH --token1 AXIOM --fee 0x800000
 * Usage: node fetch-pool-state.mjs --pool-id 0x10a0b8eba9d4e0f772c8c47968ee819bb4609ef4454409157961570cdce9a735
 */

import { createPublicClient, http, getAddress, isAddress, formatUnits } from 'viem';
import { base } from 'viem/chains';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

// Load environment
dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

// Parse args
const argv = yargs(hideBin(process.argv))
  .option('token0', { type: 'string', description: 'First token (address or symbol)' })
  .option('token1', { type: 'string', description: 'Second token (address or symbol)' })
  .option('fee', { type: 'string', description: 'Fee tier (hex, e.g., 0x800000)' })
  .option('tick-spacing', { type: 'number', description: 'Tick spacing (e.g., 200)' })
  .option('hooks', { type: 'string', description: 'Hooks address' })
  .option('pool-id', { type: 'string', description: 'Pool ID (if known)' })
  .option('format', { type: 'string', default: 'human', choices: ['json', 'human'], description: 'Output format' })
  .check((argv) => {
    if (!argv.poolId && !(argv.token0 && argv.token1 && argv.fee)) {
      throw new Error('Must provide either --pool-id OR (--token0, --token1, --fee)');
    }
    return true;
  })
  .parse();

// Common Base tokens
const TOKEN_ADDRESSES = {
  'WETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 
  'BNKR': '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b',
  'AXIOM': '0xf3ce5ddaab6c133f9875a4a46c55cf0b58111b07',
  'ETH': '0x0000000000000000000000000000000000000000',
};

// Contract addresses
const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
};

// StateView ABI
const STATE_VIEW_ABI = [
  {
    "inputs": [
      {
        "components": [
          { "name": "currency0", "type": "address" },
          { "name": "currency1", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "tickSpacing", "type": "int24" },
          { "name": "hooks", "type": "address" }
        ],
        "name": "poolKey",
        "type": "tuple"
      }
    ],
    "name": "getSlot0",
    "outputs": [
      { "name": "sqrtPriceX96", "type": "uint160" },
      { "name": "tick", "type": "int24" },
      { "name": "protocolFee", "type": "uint24" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "components": [
          { "name": "currency0", "type": "address" },
          { "name": "currency1", "type": "address" },
          { "name": "fee", "type": "uint24" },
          { "name": "tickSpacing", "type": "int24" },
          { "name": "hooks", "type": "address" }
        ],
        "name": "poolKey",
        "type": "tuple"
      }
    ],
    "name": "getLiquidity",
    "outputs": [
      { "name": "liquidity", "type": "uint128" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// ERC20 ABI for symbol/decimals
const ERC20_ABI = [
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{ "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{ "name": "", "type": "uint8" }],
    "stateMutability": "view",
    "type": "function"
  }
];

function resolveTokenAddress(tokenInput) {
  const upper = tokenInput.toUpperCase();
  if (TOKEN_ADDRESSES[upper]) {
    return TOKEN_ADDRESSES[upper];
  }
  if (isAddress(tokenInput)) {
    return getAddress(tokenInput);
  }
  throw new Error(`Unknown token: ${tokenInput}`);
}

function sortTokens(token0, token1) {
  const addr0 = resolveTokenAddress(token0);
  const addr1 = resolveTokenAddress(token1);
  
  if (addr0.toLowerCase() < addr1.toLowerCase()) {
    return { currency0: addr0, currency1: addr1 };
  } else {
    return { currency0: addr1, currency1: addr0 };
  }
}

function calculatePrice(sqrtPriceX96, decimals0, decimals1) {
  // Price = (sqrtPriceX96 / 2^96)^2
  const Q96 = 2n ** 96n;
  const price = (BigInt(sqrtPriceX96) * BigInt(sqrtPriceX96)) / (Q96 * Q96);
  
  // Adjust for token decimals
  const decimalAdjustment = 10 ** (Number(decimals1) - Number(decimals0));
  return Number(price) * decimalAdjustment;
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

async function getTokenInfo(client, address) {
  if (address === '0x0000000000000000000000000000000000000000') {
    return { symbol: 'ETH', decimals: 18 };
  }
  
  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }),
    ]);
    return { symbol, decimals };
  } catch (error) {
    return { symbol: getTokenSymbol(address), decimals: 18 };
  }
}

async function main() {
  try {
    // Initialize client
    const client = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });

    let poolKey;
    
    if (argv.poolId) {
      console.log(`Fetching state for pool ID: ${argv.poolId}`);
      console.log('⚠️  Pool key reconstruction from ID not implemented yet');
      console.log('Use --token0, --token1, --fee instead\n');
      process.exit(1);
    } else {
      // Build pool key from tokens
      const { currency0, currency1 } = sortTokens(argv.token0, argv.token1);
      
      poolKey = {
        currency0,
        currency1,
        fee: parseInt(argv.fee),
        tickSpacing: argv.tickSpacing || 200, // Default for dynamic fee
        hooks: argv.hooks || '0x0000000000000000000000000000000000000000',
      };
    }

    console.log(`Fetching state for pool: ${getTokenSymbol(poolKey.currency0)}/${getTokenSymbol(poolKey.currency1)}`);
    console.log(`Pool key:`, poolKey);
    console.log('');

    // Get token info
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(client, poolKey.currency0),
      getTokenInfo(client, poolKey.currency1),
    ]);

    // Fetch pool state
    const [slot0, liquidity] = await Promise.all([
      client.readContract({
        address: CONTRACTS.STATE_VIEW,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolKey],
      }),
      client.readContract({
        address: CONTRACTS.STATE_VIEW,
        abi: STATE_VIEW_ABI,
        functionName: 'getLiquidity',
        args: [poolKey],
      }),
    ]);

    const [sqrtPriceX96, tick, protocolFee] = slot0;
    
    // Calculate human-readable price
    const price = calculatePrice(sqrtPriceX96, token0Info.decimals, token1Info.decimals);
    
    const poolState = {
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick: Number(tick),
      protocolFee: Number(protocolFee),
      liquidity: liquidity.toString(),
      price,
      priceFormatted: `1 ${token0Info.symbol} = ${price.toFixed(6)} ${token1Info.symbol}`,
    };

    if (argv.format === 'json') {
      console.log(JSON.stringify({
        poolKey,
        tokens: {
          token0: { address: poolKey.currency0, ...token0Info },
          token1: { address: poolKey.currency1, ...token1Info },
        },
        state: poolState,
      }, null, 2));
    } else {
      console.log('📊 Pool State:');
      console.log(`  Price: ${poolState.priceFormatted}`);
      console.log(`  Current Tick: ${poolState.tick}`);
      console.log(`  Liquidity: ${formatUnits(BigInt(poolState.liquidity), 0)}`);
      console.log(`  SqrtPriceX96: ${poolState.sqrtPriceX96}`);
      console.log(`  Protocol Fee: ${poolState.protocolFee}`);
      
      // TVL estimate (rough)
      if (price > 0) {
        const liquidityFormatted = Number(formatUnits(BigInt(poolState.liquidity), 12)); // rough estimate
        console.log(`  ~TVL Estimate: ${liquidityFormatted.toFixed(2)} units`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    if (error.message.includes('execution reverted')) {
      console.error('Pool may not exist or StateView call failed');
    }
    process.exit(1);
  }
}

main();