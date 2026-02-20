#!/usr/bin/env node
/**
 * Generate approval transactions for Uniswap V4 LP operations
 * Usage: node generate-approvals.mjs --token0 WETH --token1 AXIOM --amount 100
 */

import { createPublicClient, createWalletClient, http, parseEther, parseUnits, formatUnits, encodeFunctionData, getAddress, isAddress, maxUint256 } from 'viem';
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
  .option('token0', { type: 'string', required: true, description: 'First token (address or symbol)' })
  .option('token1', { type: 'string', required: true, description: 'Second token (address or symbol)' })
  .option('amount0', { type: 'string', description: 'Token0 amount to approve (e.g., 100)' })
  .option('amount1', { type: 'string', description: 'Token1 amount to approve (e.g., 100)' })
  .option('max', { type: 'boolean', default: false, description: 'Use maximum approval amounts' })
  .option('permit2', { type: 'boolean', default: true, description: 'Generate Permit2 approvals (recommended)' })
  .option('direct', { type: 'boolean', default: false, description: 'Generate direct token approvals (legacy)' })
  .option('bankr', { type: 'boolean', default: false, description: 'Output bankr-compatible calldata format' })
  .option('dry-run', { type: 'boolean', default: true, description: 'Simulate only (default)' })
  .option('execute', { type: 'boolean', default: false, description: 'Actually send transactions' })
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
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
};

// ERC20 ABI
const ERC20_ABI = [
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
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
  },
  {
    "inputs": [
      { "name": "account", "type": "address" }
    ],
    "name": "balanceOf",
    "outputs": [{ "name": "", "type": "uint256" }],
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

async function checkCurrentAllowances(client, tokenAddress, owner, spenders) {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return {}; // ETH doesn't need approvals
  }
  
  const allowances = {};
  for (const [name, spender] of Object.entries(spenders)) {
    try {
      const allowance = await client.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [owner, spender],
      });
      allowances[name] = allowance;
    } catch (error) {
      allowances[name] = 0n;
    }
  }
  return allowances;
}

async function getBalance(client, tokenAddress, owner) {
  if (tokenAddress === '0x0000000000000000000000000000000000000000') {
    return await client.getBalance({ address: owner });
  }
  
  try {
    return await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  } catch (error) {
    return 0n;
  }
}

function generateApprovalCalldata(tokenAddress, spender, amount) {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, amount],
  });
}

function formatBankrTransaction(tokenAddress, calldata, description) {
  return {
    to: tokenAddress,
    data: calldata,
    value: '0',
    description,
    gasLimit: '100000', // Conservative estimate
  };
}

async function main() {
  try {
    // Initialize client
    const client = createPublicClient({
      chain: base,
      transport: http('https://mainnet.base.org'),
    });

    // Get wallet if executing
    let walletClient, account;
    if (argv.execute) {
      if (!process.env.NET_PRIVATE_KEY) {
        throw new Error('NET_PRIVATE_KEY required for execution');
      }
      account = privateKeyToAccount(process.env.NET_PRIVATE_KEY);
      walletClient = createWalletClient({
        account,
        chain: base,
        transport: http('https://mainnet.base.org'),
      });
    }

    // Resolve token addresses
    const token0Address = resolveTokenAddress(argv.token0);
    const token1Address = resolveTokenAddress(argv.token1);

    console.log(`💳 Generating approvals for ${getTokenSymbol(token0Address)}/${getTokenSymbol(token1Address)}`);
    console.log(`Token0: ${token0Address}`);
    console.log(`Token1: ${token1Address}\n`);

    // Get token info
    const [token0Info, token1Info] = await Promise.all([
      getTokenInfo(client, token0Address),
      getTokenInfo(client, token1Address),
    ]);

    console.log(`📊 Token Info:`);
    console.log(`  ${token0Info.symbol}: ${token0Address} (${token0Info.decimals} decimals)`);
    console.log(`  ${token1Info.symbol}: ${token1Address} (${token1Info.decimals} decimals)\n`);

    // Determine approval amounts
    let amount0, amount1;
    
    if (argv.max) {
      amount0 = maxUint256;
      amount1 = maxUint256;
      console.log(`📈 Using maximum approval amounts`);
    } else if (argv.amount0 && argv.amount1) {
      amount0 = parseUnits(argv.amount0, token0Info.decimals);
      amount1 = parseUnits(argv.amount1, token1Info.decimals);
      console.log(`📈 Approval amounts: ${argv.amount0} ${token0Info.symbol}, ${argv.amount1} ${token1Info.symbol}`);
    } else {
      console.log(`⚠️  No amounts specified. Use --amount0 and --amount1, or --max`);
      console.log(`Example: --amount0 100 --amount1 50000 (for 100 WETH, 50000 AXIOM)`);
      process.exit(1);
    }

    const approvals = [];
    const spenders = argv.permit2 
      ? { 'Permit2': CONTRACTS.PERMIT2 }
      : { 'PositionManager': CONTRACTS.POSITION_MANAGER };

    if (argv.permit2 && argv.direct) {
      spenders['PositionManager'] = CONTRACTS.POSITION_MANAGER;
    }

    console.log(`🎯 Target spenders: ${Object.keys(spenders).join(', ')}\n`);

    // Check current allowances if wallet available
    if (account) {
      console.log(`🔍 Current allowances for ${account.address}:`);
      
      for (const [tokenAddr, tokenInfo] of [[token0Address, token0Info], [token1Address, token1Info]]) {
        if (tokenAddr === '0x0000000000000000000000000000000000000000') {
          const balance = await getBalance(client, tokenAddr, account.address);
          console.log(`  ${tokenInfo.symbol} balance: ${formatUnits(balance, tokenInfo.decimals)}`);
          continue;
        }
        
        const allowances = await checkCurrentAllowances(client, tokenAddr, account.address, spenders);
        const balance = await getBalance(client, tokenAddr, account.address);
        
        console.log(`  ${tokenInfo.symbol} balance: ${formatUnits(balance, tokenInfo.decimals)}`);
        for (const [name, allowance] of Object.entries(allowances)) {
          const formatted = allowance === maxUint256 
            ? 'MAX' 
            : formatUnits(allowance, tokenInfo.decimals);
          console.log(`    ${name} allowance: ${formatted}`);
        }
      }
      console.log('');
    }

    // Generate approval transactions
    const transactions = [];

    for (const [tokenAddr, tokenInfo, amount] of [
      [token0Address, token0Info, amount0],
      [token1Address, token1Info, amount1]
    ]) {
      if (tokenAddr === '0x0000000000000000000000000000000000000000') {
        console.log(`⚡ ${tokenInfo.symbol} is native ETH - no approval needed`);
        continue;
      }

      for (const [spenderName, spenderAddr] of Object.entries(spenders)) {
        const calldata = generateApprovalCalldata(tokenAddr, spenderAddr, amount);
        const amountFormatted = amount === maxUint256 ? 'MAX' : formatUnits(amount, tokenInfo.decimals);
        
        const approval = {
          token: tokenAddr,
          tokenSymbol: tokenInfo.symbol,
          spender: spenderAddr,
          spenderName,
          amount,
          amountFormatted,
          calldata,
          description: `Approve ${amountFormatted} ${tokenInfo.symbol} to ${spenderName}`,
        };

        approvals.push(approval);
        
        if (argv.bankr) {
          transactions.push(formatBankrTransaction(tokenAddr, calldata, approval.description));
        }
      }
    }

    // Output results
    if (argv.bankr) {
      console.log(`🏦 Bankr Transaction Format:`);
      console.log(JSON.stringify(transactions, null, 2));
    } else {
      console.log(`📝 Generated ${approvals.length} approval transaction(s):\n`);
      
      approvals.forEach((approval, i) => {
        console.log(`${i + 1}. ${approval.description}`);
        console.log(`   To: ${approval.token}`);
        console.log(`   Data: ${approval.calldata}`);
        console.log('');
      });
    }

    // Execute if requested
    if (argv.execute) {
      console.log(`🚀 Executing ${approvals.length} approval transaction(s)...`);
      
      for (const approval of approvals) {
        try {
          console.log(`⏳ ${approval.description}...`);
          
          const hash = await walletClient.writeContract({
            address: approval.token,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [approval.spender, approval.amount],
          });
          
          console.log(`✅ Success: ${hash}`);
          
          // Wait for confirmation
          const receipt = await client.waitForTransactionReceipt({ hash });
          console.log(`   Confirmed in block ${receipt.blockNumber}`);
          
        } catch (error) {
          console.error(`❌ Failed: ${error.message}`);
        }
      }
    } else {
      console.log(`⚠️  DRY RUN MODE - Use --execute to send transactions`);
    }

    // Show next steps
    console.log(`\n🎯 Next Steps:`);
    if (argv.permit2) {
      console.log(`• Tokens approved to Permit2 contract`);
      console.log(`• Use these tokens in V4 LP operations (add-liquidity.mjs, etc.)`);
      console.log(`• Permit2 provides advanced approval management`);
    } else {
      console.log(`• Tokens approved directly to PositionManager`);
      console.log(`• Ready for V4 LP operations`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();