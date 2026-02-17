#!/usr/bin/env node
/**
 * Discover Uniswap V4 pools for any token pair
 * Usage: node discover-pool.mjs --token0 WETH --token1 AXIOM
 * Usage: node discover-pool.mjs --token0 0x4200000000000000000000000000000000000006 --token1 0xf3ce5ddaab6c133f9875a4a46c55cf0b58111b07
 */

import { createPublicClient, http, getAddress, isAddress } from 'viem';
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
  .option('format', { type: 'string', default: 'json', choices: ['json', 'human'], description: 'Output format' })
  .parse();

// Common Base tokens
const TOKEN_ADDRESSES = {
  'WETH': '0x4200000000000000000000000000000000000006',
  'USDC': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 
  'BNKR': '0x22af33fe49fd1fa80c7149773dde5890d3c76f3b',
  'AXIOM': '0xf3ce5ddaab6c133f9875a4a46c55cf0b58111b07',
  'ETH': '0x0000000000000000000000000000000000000000', // Native ETH in V4
};

// Contract addresses
const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
};

// Pool Manager ABI (Initialize event)
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
  throw new Error(`Unknown token: ${tokenInput}. Use address or symbol: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`);
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

function formatPoolKey(poolKey) {
  return {
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: poolKey.hooks,
  };
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

function formatHumanReadable(pools) {
  if (pools.length === 0) {
    return 'No pools found for this token pair.';
  }

  let output = `Found ${pools.length} pool(s):\n\n`;
  
  pools.forEach((pool, i) => {
    const token0Symbol = getTokenSymbol(pool.currency0);
    const token1Symbol = getTokenSymbol(pool.currency1);
    const feeHex = '0x' + pool.fee.toString(16);
    const isDynamicFee = pool.fee === 0x800000;
    
    output += `Pool ${i + 1}: ${token0Symbol}/${token1Symbol}\n`;
    output += `  Currency0: ${pool.currency0}\n`;
    output += `  Currency1: ${pool.currency1}\n`;
    output += `  Fee: ${feeHex}${isDynamicFee ? ' (DYNAMIC_FEE_FLAG)' : ` (${pool.fee / 10000}%)`}\n`;
    output += `  Tick Spacing: ${pool.tickSpacing}\n`;
    output += `  Hooks: ${pool.hooks}\n`;
    
    if (pool.hooks !== '0x0000000000000000000000000000000000000000') {
      output += `  🔗 Has custom hooks (likely Clanker pool)\n`;
    }
    output += '\n';
  });
  
  return output.trim();
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
    
    console.log(`Searching for pools: ${getTokenSymbol(currency0)} / ${getTokenSymbol(currency1)}`);
    console.log(`Currency0: ${currency0}`);
    console.log(`Currency1: ${currency1}\n`);

    // Query Initialize events from PoolManager
    const logs = await client.getLogs({
      address: CONTRACTS.POOL_MANAGER,
      event: POOL_MANAGER_ABI[0],
      args: {
        currency0: currency0,
        currency1: currency1,
      },
      fromBlock: 'earliest',
      toBlock: 'latest',
    });

    const pools = logs.map(log => ({
      poolId: log.args.id,
      currency0: log.args.currency0,
      currency1: log.args.currency1,
      fee: Number(log.args.fee),
      tickSpacing: Number(log.args.tickSpacing),
      hooks: log.args.hooks,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    }));

    // Output results
    if (argv.format === 'json') {
      console.log(JSON.stringify({
        query: {
          token0: argv.token0,
          token1: argv.token1,
          currency0,
          currency1,
        },
        pools: pools.map(formatPoolKey),
        count: pools.length,
      }, null, 2));
    } else {
      console.log(formatHumanReadable(pools));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();