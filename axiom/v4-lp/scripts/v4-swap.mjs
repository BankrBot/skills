#!/usr/bin/env node
/**
 * V4 Swap — Swap tokens via Uniswap V4 Universal Router
 *
 * Handles Clanker-deployed tokens that only have V4 hook pool liquidity.
 * Supports: TOKEN → WETH, WETH → TOKEN, or TOKEN → WETH → USDC (two-hop)
 *
 * Usage:
 *   # Swap AXIOM → WETH (using pool key from LP position)
 *   node v4-swap.mjs --token-in 0xf3ce... --token-out WETH --amount 1000000 --token-id 1078751
 *
 *   # Swap all AXIOM balance → WETH
 *   node v4-swap.mjs --token-in 0xf3ce... --token-out WETH --all --token-id 1078751
 *
 *   # Swap AXIOM → USDC (V4 to WETH, then V3 WETH→USDC)
 *   node v4-swap.mjs --token-in 0xf3ce... --token-out USDC --all --token-id 1078751
 *
 *   # Dry run (simulate only)
 *   node v4-swap.mjs --token-in 0xf3ce... --token-out WETH --all --token-id 1078751 --dry-run
 *
 *   # With explicit pool key (no position needed)
 *   node v4-swap.mjs --token-in 0xf3ce... --token-out WETH --all \
 *     --currency0 0x4200...0006 --currency1 0xf3ce... --fee 0x800000 \
 *     --tick-spacing 200 --hooks 0xABC...
 */

import { createPublicClient, createWalletClient, http, formatEther, formatUnits, parseEther, maxUint256, encodeAbiParameters, parseAbiParameters } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';
import { defaultAbiCoder } from '@ethersproject/abi';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

dotenv.config({ path: resolve(process.env.HOME, '.axiom/wallet.env') });

const argv = yargs(hideBin(process.argv))
  .option('token-in', { type: 'string', required: true, description: 'Input token address (or WETH/USDC)' })
  .option('token-out', { type: 'string', required: true, description: 'Output token address (or WETH/USDC)' })
  .option('amount', { type: 'string', description: 'Amount in wei (or use --all)' })
  .option('all', { type: 'boolean', default: false, description: 'Swap entire balance' })
  .option('token-id', { type: 'number', description: 'LP position NFT ID (to derive pool key)' })
  // Explicit pool key overrides
  .option('currency0', { type: 'string', description: 'Pool currency0 address' })
  .option('currency1', { type: 'string', description: 'Pool currency1 address' })
  .option('fee', { type: 'string', description: 'Pool fee (hex or decimal)' })
  .option('tick-spacing', { type: 'number', description: 'Pool tick spacing' })
  .option('hooks', { type: 'string', description: 'Pool hooks address' })
  .option('slippage', { type: 'number', default: 2, description: 'Slippage tolerance (%)' })
  .option('dry-run', { type: 'boolean', default: false, description: 'Simulate only' })
  .option('rpc', { type: 'string', default: process.env.BASE_RPC_URL || 'https://mainnet.base.org' })
  .parse();

// ─── Constants ───────────────────────────────────────────────────────────────

const CONTRACTS = {
  POOL_MANAGER: '0x498581ff718922c3f8e6a244956af099b2652b2b',
  POSITION_MANAGER: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  UNIVERSAL_ROUTER: '0x6ff5693b99212da76ad316178a184ab56d299b43',
  PERMIT2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  QUOTER: '0x0d5e0f971ed27fbff6c2837bf31316121532048d',
  STATE_VIEW: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
  WETH: '0x4200000000000000000000000000000000000006',
  USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  SWAP_ROUTER_02: '0x2626664c2603336E57B271c5C0b26F421741e481',
};

// Universal Router Commands
const Commands = {
  V4_SWAP: 0x10,
};

// V4 Actions
const Actions = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SETTLE_ALL: 0x0c,
  SETTLE_PAIR: 0x0d,
  TAKE_ALL: 0x0f,
  TAKE_PAIR: 0x11,
};

// ─── ABIs ────────────────────────────────────────────────────────────────────

const POSITION_MANAGER_ABI = [{
  name: 'getPoolAndPositionInfo', type: 'function',
  inputs: [{ type: 'uint256' }],
  outputs: [
    { type: 'tuple', components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ]},
    { type: 'uint256' },
  ],
}];

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'decimals', type: 'function', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ type: 'string' }] },
];

const PERMIT2_ABI = [
  { name: 'allowance', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint160' }, { type: 'uint48' }, { type: 'uint48' }] },
  { name: 'approve', type: 'function', inputs: [{ type: 'address' }, { type: 'address' }, { type: 'uint160' }, { type: 'uint48' }], outputs: [] },
];

const UNIVERSAL_ROUTER_ABI = [{
  name: 'execute', type: 'function',
  inputs: [
    { name: 'commands', type: 'bytes' },
    { name: 'inputs', type: 'bytes[]' },
    { name: 'deadline', type: 'uint256' },
  ],
  outputs: [],
}];

const SWAP_ROUTER_ABI = [{
  name: 'exactInputSingle', type: 'function',
  inputs: [{
    type: 'tuple',
    components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'recipient', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ],
  }],
  outputs: [{ type: 'uint256' }],
}];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function retry(fn, n = 3) {
  for (let i = 0; i < n; i++) {
    try { return await fn(); }
    catch (e) { if (i === n - 1) throw e; await sleep(2000); }
  }
}

function resolveToken(name) {
  const upper = name.toUpperCase();
  if (upper === 'WETH' || upper === 'ETH') return CONTRACTS.WETH;
  if (upper === 'USDC') return CONTRACTS.USDC;
  return name; // assume it's an address
}

// ─── V4 Swap Core ────────────────────────────────────────────────────────────

/**
 * Execute a V4 swap via Universal Router.
 *
 * Pattern: V4_SWAP command (0x10) with 3 actions:
 *   1. SWAP_EXACT_IN_SINGLE (0x06) — the actual swap
 *   2. SETTLE_ALL (0x0c) — settle input currency (pay what's owed)
 *   3. TAKE_ALL (0x0f) — take output currency (collect what's earned)
 *
 * @param {object} opts
 * @param {object} opts.poolKey - { currency0, currency1, fee, tickSpacing, hooks }
 * @param {boolean} opts.zeroForOne - true if swapping currency0→currency1
 * @param {bigint} opts.amountIn - amount of input token (in wei)
 * @param {bigint} opts.minAmountOut - minimum output (after slippage)
 * @param {object} opts.publicClient
 * @param {object} opts.walletClient
 * @param {object} opts.account
 * @param {boolean} opts.dryRun
 * @returns {{ hash: string, receipt: object }}
 */
async function executeV4Swap({ poolKey, zeroForOne, amountIn, minAmountOut, publicClient, walletClient, account, dryRun }) {
  const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0;

  // 1. Ensure ERC20 → Permit2 approval
  const erc20Allowance = await retry(() => publicClient.readContract({
    address: inputCurrency, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, CONTRACTS.PERMIT2],
  }));
  if (erc20Allowance < amountIn) {
    if (dryRun) { console.log(`   [DRY] Would approve ${inputCurrency} → Permit2`); }
    else {
      console.log(`   Approving token → Permit2...`);
      const tx = await walletClient.writeContract({
        address: inputCurrency, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.PERMIT2, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      await sleep(1000);
    }
  }

  // 2. Ensure Permit2 → Universal Router approval
  const [permit2Amount] = await retry(() => publicClient.readContract({
    address: CONTRACTS.PERMIT2, abi: PERMIT2_ABI, functionName: 'allowance',
    args: [account.address, inputCurrency, CONTRACTS.UNIVERSAL_ROUTER],
  }));
  if (BigInt(permit2Amount) < amountIn) {
    if (dryRun) { console.log(`   [DRY] Would approve Universal Router on Permit2`); }
    else {
      console.log(`   Approving Universal Router on Permit2...`);
      const maxUint160 = (1n << 160n) - 1n;
      const maxUint48 = (1n << 48n) - 1n;
      const tx = await walletClient.writeContract({
        address: CONTRACTS.PERMIT2, abi: PERMIT2_ABI, functionName: 'approve',
        args: [inputCurrency, CONTRACTS.UNIVERSAL_ROUTER, maxUint160, maxUint48],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      await sleep(1000);
    }
  }

  // 3. Encode the V4_SWAP command
  //
  // actions: packed bytes [SWAP_EXACT_IN_SINGLE, SETTLE_ALL, TAKE_ALL]
  // params:  [swapParams, settleParams, takeParams]

  // Action bytes: 0x06 0x0c 0x0f
  const actionsHex = '0x' +
    Actions.SWAP_EXACT_IN_SINGLE.toString(16).padStart(2, '0') +
    Actions.SETTLE_ALL.toString(16).padStart(2, '0') +
    Actions.TAKE_ALL.toString(16).padStart(2, '0');

  // Param 0: SWAP_EXACT_IN_SINGLE
  // CRITICAL: Must encode as a SINGLE STRUCT parameter (not separate fields!)
  // The CalldataDecoder reads the first word as an offset to the struct data.
  // V4 ExactInputSingleParams does NOT have sqrtPriceLimitX96 (unlike V3).
  const swapParams = defaultAbiCoder.encode(
    [
      'tuple(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 amountIn, uint128 amountOutMinimum, bytes hookData)',
    ],
    [
      {
        poolKey: {
          currency0: poolKey.currency0,
          currency1: poolKey.currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks,
        },
        zeroForOne,
        amountIn: amountIn.toString(),
        amountOutMinimum: minAmountOut.toString(),
        hookData: '0x',
      },
    ]
  );

  // Param 1: SETTLE_ALL — (currency, maxAmount)
  const settleParams = defaultAbiCoder.encode(
    ['address', 'uint256'],
    [inputCurrency, amountIn.toString()]
  );

  // Param 2: TAKE_ALL — (currency, minAmount)
  const takeParams = defaultAbiCoder.encode(
    ['address', 'uint256'],
    [outputCurrency, minAmountOut.toString()]
  );

  // V4_SWAP input: abi.encode(bytes actions, bytes[] params)
  const v4SwapInput = defaultAbiCoder.encode(
    ['bytes', 'bytes[]'],
    [actionsHex, [swapParams, settleParams, takeParams]]
  );

  // Command byte: 0x10 = V4_SWAP
  const commands = '0x10';
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800); // 30 min

  if (dryRun) {
    console.log(`   [DRY] Would execute V4_SWAP:`);
    console.log(`     zeroForOne: ${zeroForOne}`);
    console.log(`     amountIn: ${amountIn}`);
    console.log(`     minAmountOut: ${minAmountOut}`);
    console.log(`     actions: ${actionsHex}`);
    return { hash: null, receipt: null };
  }

  console.log(`   Executing V4 swap...`);
  const hash = await walletClient.writeContract({
    address: CONTRACTS.UNIVERSAL_ROUTER,
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, [v4SwapInput], deadline],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`V4 swap reverted: ${hash}`);
  }

  return { hash, receipt };
}

// ─── V3 Swap (WETH → USDC) ──────────────────────────────────────────────────

async function swapWethToUsdc(publicClient, walletClient, account, amount, dryRun) {
  // Approve WETH to SwapRouter02
  const allowance = await retry(() => publicClient.readContract({
    address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'allowance',
    args: [account.address, CONTRACTS.SWAP_ROUTER_02],
  }));
  if (allowance < amount) {
    if (dryRun) { console.log(`   [DRY] Would approve WETH → SwapRouter02`); }
    else {
      console.log(`   Approving WETH → SwapRouter02...`);
      const tx = await walletClient.writeContract({
        address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'approve',
        args: [CONTRACTS.SWAP_ROUTER_02, maxUint256],
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      await sleep(1000);
    }
  }

  if (dryRun) {
    console.log(`   [DRY] Would swap ${formatEther(amount)} WETH → USDC via V3`);
    return { hash: null, receipt: null };
  }

  console.log(`   Swapping ${formatEther(amount)} WETH → USDC via V3 (0.05% pool)...`);
  const hash = await walletClient.writeContract({
    address: CONTRACTS.SWAP_ROUTER_02,
    abi: SWAP_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: CONTRACTS.WETH,
      tokenOut: CONTRACTS.USDC,
      fee: 500,
      recipient: account.address,
      amountIn: amount,
      amountOutMinimum: 0n,
      sqrtPriceLimitX96: 0n,
    }],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const privateKey = process.env.NET_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.error('❌ Set NET_PRIVATE_KEY or PRIVATE_KEY in ~/.axiom/wallet.env');
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: base, transport: http(argv.rpc) });
  const walletClient = createWalletClient({ account, chain: base, transport: http(argv.rpc) });

  const tokenIn = resolveToken(argv.tokenIn);
  const tokenOut = resolveToken(argv.tokenOut);
  const dryRun = argv.dryRun;

  // Get token info
  const [symbolIn, decimalsIn] = await Promise.all([
    retry(() => publicClient.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: 'symbol' })),
    retry(() => publicClient.readContract({ address: tokenIn, abi: ERC20_ABI, functionName: 'decimals' })),
  ]);

  // Determine amount
  let amountIn;
  if (argv.all) {
    amountIn = await retry(() => publicClient.readContract({
      address: tokenIn, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));
    if (amountIn === 0n) {
      console.log(`❌ No ${symbolIn} balance to swap`);
      process.exit(0);
    }
    console.log(`\n💱 V4 Swap — ${symbolIn} → ${tokenOut === CONTRACTS.USDC ? 'USDC' : tokenOut === CONTRACTS.WETH ? 'WETH' : tokenOut}`);
    console.log(`   Amount: ${formatUnits(amountIn, decimalsIn)} ${symbolIn} (entire balance)`);
  } else if (argv.amount) {
    amountIn = BigInt(argv.amount);
    console.log(`\n💱 V4 Swap — ${symbolIn} → ${tokenOut === CONTRACTS.USDC ? 'USDC' : tokenOut === CONTRACTS.WETH ? 'WETH' : tokenOut}`);
    console.log(`   Amount: ${formatUnits(amountIn, decimalsIn)} ${symbolIn}`);
  } else {
    console.error('❌ Specify --amount <wei> or --all');
    process.exit(1);
  }

  console.log(`   Wallet: ${account.address}`);
  if (dryRun) console.log(`   ⚡ DRY RUN — no transactions will be sent`);

  // Get pool key (from position or CLI args)
  let poolKey;
  if (argv.currency0 && argv.currency1 && argv.fee && argv.tickSpacing && argv.hooks) {
    poolKey = {
      currency0: argv.currency0,
      currency1: argv.currency1,
      fee: parseInt(argv.fee),
      tickSpacing: argv.tickSpacing,
      hooks: argv.hooks,
    };
  } else if (argv.tokenId) {
    console.log(`   Fetching pool key from position #${argv.tokenId}...`);
    const [pk] = await retry(() => publicClient.readContract({
      address: CONTRACTS.POSITION_MANAGER, abi: POSITION_MANAGER_ABI,
      functionName: 'getPoolAndPositionInfo', args: [BigInt(argv.tokenId)],
    }));
    poolKey = {
      currency0: pk.currency0,
      currency1: pk.currency1,
      fee: pk.fee,
      tickSpacing: pk.tickSpacing,
      hooks: pk.hooks,
    };
  } else {
    console.error('❌ Provide --token-id or explicit pool key (--currency0, --currency1, --fee, --tick-spacing, --hooks)');
    process.exit(1);
  }

  console.log(`   Pool: ${poolKey.currency0.slice(0, 10)}.../${poolKey.currency1.slice(0, 10)}...`);
  console.log(`   Fee: ${poolKey.fee}${poolKey.fee === 0x800000 ? ' (DYNAMIC)' : ''}`);
  console.log(`   Hooks: ${poolKey.hooks}`);

  // Determine zeroForOne
  const tokenInIsC0 = tokenIn.toLowerCase() === poolKey.currency0.toLowerCase();
  const tokenInIsC1 = tokenIn.toLowerCase() === poolKey.currency1.toLowerCase();

  if (!tokenInIsC0 && !tokenInIsC1) {
    console.error(`❌ Token ${tokenIn} not found in pool (c0=${poolKey.currency0}, c1=${poolKey.currency1})`);
    process.exit(1);
  }

  const zeroForOne = tokenInIsC0;
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0;

  // Calculate minAmountOut (basic slippage protection)
  // For now, use 0 for MEV protection isn't great, but Clanker pools are low-liquidity
  // TODO: Use V4 Quoter to get expected output
  const minAmountOut = 0n;

  console.log(`   Direction: ${zeroForOne ? 'c0→c1' : 'c1→c0'} (zeroForOne=${zeroForOne})`);
  console.log('');

  // Determine if we need a two-hop (TOKEN → WETH via V4, then WETH → USDC via V3)
  const wantUsdc = tokenOut.toLowerCase() === CONTRACTS.USDC.toLowerCase();
  const directV4 = !wantUsdc || outputCurrency.toLowerCase() === CONTRACTS.USDC.toLowerCase();

  if (directV4 || !wantUsdc) {
    // Single V4 swap
    console.log(`🔄 Step 1/1: V4 swap ${symbolIn} → ${zeroForOne ? 'currency1' : 'currency0'}`);
    const result = await executeV4Swap({
      poolKey, zeroForOne, amountIn, minAmountOut,
      publicClient, walletClient, account, dryRun,
    });
    if (result.hash) {
      console.log(`\n✅ V4 swap complete!`);
      console.log(`   TX: https://basescan.org/tx/${result.hash}`);
    }
  } else {
    // Two-hop: TOKEN → WETH via V4, then WETH → USDC via V3
    const wethBefore = await retry(() => publicClient.readContract({
      address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));
    const usdcBefore = await retry(() => publicClient.readContract({
      address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));

    console.log(`🔄 Step 1/2: V4 swap ${symbolIn} → WETH`);
    const v4Result = await executeV4Swap({
      poolKey, zeroForOne, amountIn, minAmountOut: 0n,
      publicClient, walletClient, account, dryRun,
    });
    if (v4Result.hash) {
      console.log(`   ✅ TX: https://basescan.org/tx/${v4Result.hash}`);
    }

    await sleep(2000);

    const wethAfter = await retry(() => publicClient.readContract({
      address: CONTRACTS.WETH, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
    }));
    const wethGained = wethAfter - wethBefore;

    if (wethGained > 0n || dryRun) {
      const swapAmount = dryRun ? amountIn : wethGained; // approximate in dry run
      console.log(`\n🔄 Step 2/2: V3 swap ${dryRun ? '~' : ''}${formatEther(swapAmount)} WETH → USDC`);
      const v3Result = await swapWethToUsdc(publicClient, walletClient, account, wethGained > 0n ? wethGained : 0n, dryRun);
      if (v3Result.hash) {
        console.log(`   ✅ TX: https://basescan.org/tx/${v3Result.hash}`);
      }

      if (!dryRun) {
        const usdcAfter = await retry(() => publicClient.readContract({
          address: CONTRACTS.USDC, abi: ERC20_ABI, functionName: 'balanceOf', args: [account.address],
        }));
        const usdcGained = usdcAfter - usdcBefore;
        console.log(`\n✅ Swap complete!`);
        console.log(`   Swapped: ${formatUnits(amountIn, decimalsIn)} ${symbolIn}`);
        console.log(`   Via: ${formatEther(wethGained)} WETH`);
        console.log(`   Got: ${formatUnits(usdcGained, 6)} USDC`);
      }
    } else {
      console.log(`\n⚠️ No WETH received from V4 swap — check the transaction`);
    }
  }
}

main().catch(e => {
  console.error(`\n❌ Error: ${e.shortMessage || e.message}`);
  if (e.cause) console.error(`   Cause: ${e.cause?.shortMessage || e.cause?.message || e.cause}`);
  process.exit(1);
});
