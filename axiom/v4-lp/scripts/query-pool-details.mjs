#!/usr/bin/env node
/**
 * Query comprehensive Uniswap V4 pool details
 * Usage: node query-pool-details.mjs --token0 WETH --token1 AXIOM --fee 0x800000
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
  .option('token0', { type: 'string', required: true, description: 'First token (address or symbol)' })
  .option('token1', { type: 'string', required: true, description: 'Second token (address or symbol)' })
  .option('fee', { type: 'string', description: 'Fee tier (hex, e.g., 0x800000). If omitted, shows all pools' })
  .option('format', { type: 'string', default: 'human', choices: ['json', 'human'], description: 'Output format' })
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
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
};

// Pool Manager ABI (Initialize and Swap events)
const POOL_MANAGER_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "id", "type": "bytes32" },
      { "indexed": true, "name": "currency0", "type": "address" },
      { "indexed": true, "name": "currency1", "type": "address" },
      { "indexed": false, "name": "fee", "type": "uint24" },
      { "indexed": false, "name": "tickSpacing", "type": "int24" },
      { "indexed": false, "name": "hooks", "type": "address" }
    ],
    "name": "Initialize",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "id", "type": "bytes32" },
      { "indexed": true, "name": "sender", "type": "address" },
      { "indexed": false, "name": "amount0", "type": "int128" },
      { "indexed": false, "name": "amount1", "type": "int128" },
      { "indexed": false, "name": "sqrtPriceX96", "type": "uint160" },
      { "indexed": false, "name": "liquidity", "type": "uint128" },
      { "indexed": false, "name": "tick", "type": "int24" },
      { "indexed": false, "name": "fee", "type": "uint24" }
    ],
    "name": "Swap",
    "type": "event"
  }
];

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

// Position Manager ABI (Increase/Decrease events)
const POSITION_MANAGER_ABI = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "tokenId", "type": "uint256" },
      { "indexed": false, "name": "liquidity", "type": "uint128" },
      { "indexed": false, "name": "amount0", "type": "uint256" },
      { "indexed": false, "name": "amount1", "type": "uint256" }
    ],
    "name": "IncreaseLiquidity",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "tokenId", "type": "uint256" },
      { "indexed": false, "name": "liquidity", "type": "uint128" },
      { "indexed": false, "name": "amount0", "type": "uint256" },
      { "indexed": false, "name": "amount1", "type": "uint256" }
    ],
    "name": "DecreaseLiquidity",
    "type": "event"
  }
];

// ERC20 ABI
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
    return { currency0: addr1, currency1: addr1 };
  }
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

function formatFee(fee) {
  const feeHex = '0x' + fee.toString(16);
  if (fee === 0x800000) {
    return `${feeHex} (DYNAMIC_FEE_FLAG)`;
  }
  return `${feeHex} (${(fee / 10000).toFixed(2)}%)`;
}

async function getRecentSwapVolume(client, poolId, blocks = 1000) {
  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock - BigInt(blocks);
    
    const swapLogs = await client.getLogs({
      address: CONTRACTS.POOL_MANAGER,
      event: POOL_MANAGER_ABI[1], // Swap event
      args: { id: poolId },
      fromBlock,
      toBlock: 'latest',
    });
    
    return {
      swapCount: swapLogs.length,
      blocksScanned: blocks,
    };
  } catch (error) {
    return { swapCount: 0, blocksScanned: 0, error: error.message };
  }
}

async function getActivePositions(client, poolId, blocks = 5000) {
  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock - BigInt(blocks);
    
    // Get increase/decrease events (approximation)
    const [increaseLogs, decreaseLogs] = await Promise.all([
      client.getLogs({
        address: CONTRACTS.POSITION_MANAGER,
        event: POSITION_MANAGER_ABI[0], // IncreaseLiquidity
        fromBlock,
        toBlock: 'latest',
      }),
      client.getLogs({
        address: CONTRACTS.POSITION_MANAGER,
        event: POSITION_MANAGER_ABI[1], // DecreaseLiquidity  
        fromBlock,
        toBlock: 'latest',
      }),
    ]);
    
    // Rough estimate (this doesn't account for pool-specific filtering)
    return {
      recentIncreases: increaseLogs.length,
      recentDecreases: decreaseLogs.length,
      blocksScanned: blocks,
      note: 'Approximate counts across all pools'
    };
  } catch (error) {
    return { recentIncreases: 0, recentDecreases: 0, error: error.message };
  }
}

async function analyzePool(client, pool) {
  const poolKey = {
    currency0: pool.currency0,
    currency1: pool.currency1, 
    fee: pool.fee,
    tickSpacing: pool.tickSpacing,
    hooks: pool.hooks,
  };
  
  try {
    // Get current state
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
    
    // Get activity metrics
    const [swapVolume, positions] = await Promise.all([
      getRecentSwapVolume(client, pool.poolId),
      getActivePositions(client, pool.poolId),
    ]);
    
    return {
      ...pool,
      state: {
        sqrtPriceX96: sqrtPriceX96.toString(),
        tick: Number(tick),
        protocolFee: Number(protocolFee),
        liquidity: liquidity.toString(),
      },
      activity: {
        ...swapVolume,
        ...positions,
      }
    };
  } catch (error) {
    return {
      ...pool,
      error: error.message
    };
  }
}

async function main() {
  try {
    // Initialize client
    const client = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });

    // Resolve and sort tokens
    const { currency0, currency1 } = sortTokens(argv.token0, argv.token1);
    
    console.log(`🔍 Analyzing pools: ${getTokenSymbol(currency0)} / ${getTokenSymbol(currency1)}`);
    console.log(`Currency0: ${currency0}`);
    console.log(`Currency1: ${currency1}\n`);

    // Get token info
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(client, currency0),
      getTokenInfo(client, currency1),
    ]);

    // Find all pools for this pair
    const logs = await client.getLogs({
      address: CONTRACTS.POOL_MANAGER,
      event: POOL_MANAGER_ABI[0], // Initialize event
      args: {
        currency0: currency0,
        currency1: currency1,
      },
      fromBlock: 'earliest',
      toBlock: 'latest',
    });

    let pools = logs.map(log => ({
      poolId: log.args.id,
      currency0: log.args.currency0,
      currency1: log.args.currency1,
      fee: Number(log.args.fee),
      tickSpacing: Number(log.args.tickSpacing),
      hooks: log.args.hooks,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));

    // Filter by fee if specified
    if (argv.fee) {
      const targetFee = parseInt(argv.fee);
      pools = pools.filter(p => p.fee === targetFee);
    }

    if (pools.length === 0) {
      console.log('❌ No pools found for this token pair' + (argv.fee ? ` with fee ${argv.fee}` : ''));
      process.exit(0);
    }

    console.log(`📊 Found ${pools.length} pool(s). Analyzing...`);

    // Analyze each pool
    const analyses = await Promise.all(
      pools.map(pool => analyzePool(client, pool))
    );

    if (argv.format === 'json') {
      console.log(JSON.stringify({
        query: {
          token0: argv.token0,
          token1: argv.token1,
          fee: argv.fee || 'all',
          currency0,
          currency1,
        },
        tokens: {
          token0: { address: currency0, ...token0Info },
          token1: { address: currency1, ...token1Info },
        },
        pools: analyses,
        count: analyses.length,
      }, null, 2));
    } else {
      console.log('\n═══════════════════════════════════════════════════\n');
      
      analyses.forEach((analysis, i) => {
        const symbol0 = token0Info.symbol;
        const symbol1 = token1Info.symbol;
        
        console.log(`🏊‍♂️ Pool ${i + 1}: ${symbol0}/${symbol1}`);
        console.log(`   Fee: ${formatFee(analysis.fee)}`);
        console.log(`   Tick Spacing: ${analysis.tickSpacing}`);
        console.log(`   Hooks: ${analysis.hooks}`);
        console.log(`   Pool ID: ${analysis.poolId}`);
        
        if (analysis.hooks !== '0x0000000000000000000000000000000000000000') {
          console.log(`   🔗 Custom hooks detected (likely Clanker/special pool)`);
        }
        
        if (analysis.error) {
          console.log(`   ❌ Error: ${analysis.error}`);
        } else {
          console.log(`   Current Tick: ${analysis.state.tick}`);
          console.log(`   Liquidity: ${formatUnits(BigInt(analysis.state.liquidity), 0)}`);
          console.log(`   Protocol Fee: ${analysis.state.protocolFee}`);
          
          if (analysis.activity.swapCount !== undefined) {
            console.log(`   Recent Swaps: ${analysis.activity.swapCount} (last ${analysis.activity.blocksScanned} blocks)`);
          }
          if (analysis.activity.recentIncreases !== undefined) {
            console.log(`   Recent LP Activity: ${analysis.activity.recentIncreases} increases, ${analysis.activity.recentDecreases} decreases`);
            if (analysis.activity.note) {
              console.log(`   Note: ${analysis.activity.note}`);
            }
          }
        }
        
        console.log('');
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();