// Quotes and swaps on the three hook families through the pinned Universal
// Router: FLASH/ETH (Referral Coin hook), QUANT and launched tokens (FlashV3
// hook), tokenized perps (perps hook). Mirrors app/src/stackSwap.ts.
import { getAddress, isAddress, parseUnits, zeroAddress } from 'viem';
import * as A from './abis.mjs';
import { K, NATIVE, BASE_TX_GAS_CAP, DEFAULT_SLIPPAGE_BPS } from './contracts.mjs';
import { RC_POOL, QUANT_POOL, V3_GAS, perpPool, payRoutes, encodeSingleSwap, encodePathSwap, encodeBindHookData, slippageLimit, swapGas, swapSides, poolIdOf, same, isNative } from './encode.mjs';
import { client, deadline, permit2Approvals, simulate, estimate, plan, fmt, revertReason } from './plan.mjs';

const QUOTE_GAS = 15_000_000n;

const PAY = {
  ETH: { address: NATIVE, decimals: 18 },
  USDC: { address: K.tokens.USDC.address, decimals: 6 },
  FLASH: { address: K.tokens.FLASH.address, decimals: 18 },
};

/** --market: FLASH | QUANT | a perp symbol (ETH2xL) | a launched token address. */
export async function resolveMarket(market) {
  if (!market) throw new Error('--market is required (FLASH, QUANT, a perp symbol like ETH2xL, or a launched token address)');
  const upper = market.toUpperCase();
  if (upper === 'FLASH') return RC_POOL;
  if (upper === 'QUANT') return QUANT_POOL;
  const live = K.perpMarkets.live.find((entry) => entry.symbol.toUpperCase() === upper || same(entry.token, isAddress(market) ? market : zeroAddress));
  if (live) return perpPool(live);
  const exit = K.perpMarkets.exitOnly.find((entry) => entry.symbol.toUpperCase() === upper || same(entry.token, isAddress(market) ? market : zeroAddress));
  if (exit) return { ...perpPool(exit), exitOnly: exit.exit };
  if (!isAddress(market)) throw new Error(`Unknown market ${market}. Use FLASH, QUANT, a live perp symbol (${K.perpMarkets.live.map((entry) => entry.symbol).join(', ')}) or a launched token address.`);
  return resolveLaunchedToken(getAddress(market));
}

/** A graduated launch-v5 token: its FlashV3 pool key from the executor, checked against the registry. */
async function resolveLaunchedToken(token) {
  const [record, registryId] = await Promise.all([
    client.readContract({ address: K.launchV5.launchpad, abi: A.launchpad, functionName: 'launchOf', args: [token] }),
    client.readContract({ address: K.flashV3.registry, abi: A.v3Registry, functionName: 'poolOfToken', args: [token] }),
  ]);
  if (record.curve === zeroAddress) throw new Error(`${token} is not a Flash launch`);
  if (!record.graduated) throw new Error(`${record.symbol} has not graduated: it trades on its bonding curve (use launch-buy / launch-sell)`);
  const quote = record.pair === 0 ? K.tokens.WETH.address : record.pair === 1 ? K.tokens.FLASH.address : record.quote;
  const [key] = await client.readContract({ address: K.launchV5.executorQ, abi: A.launchExecutor, functionName: 'poolKeyForQuote', args: [token, quote] });
  const id = poolIdOf(key);
  if (!same(id, registryId) || !same(id, record.poolId)) throw new Error(`Pool key check failed for ${token}: computed ${id}, registry ${registryId}, launch ${record.poolId}. Refusing to build.`);
  const quoteMeta = quote === K.tokens.WETH.address ? { symbol: 'WETH', decimals: 18 } : quote === K.tokens.FLASH.address ? { symbol: 'FLASH', decimals: 18 } : { symbol: await client.readContract({ address: quote, abi: A.erc20, functionName: 'symbol' }), decimals: Number(await client.readContract({ address: quote, abi: A.erc20, functionName: 'decimals' })) };
  return { name: `${record.symbol}/${quoteMeta.symbol}`, kind: 'v3', id, key, token, quote, tokenSymbol: record.symbol, quoteSymbol: quoteMeta.symbol, tokenDecimals: 18, quoteDecimals: quoteMeta.decimals, gas: V3_GAS };
}

/** The live gasleft() floor of a pool's hook (an owner raise makes measured constants stale). */
async function liveFloor(pool) {
  try {
    if (pool.kind === 'rc') return BigInt(await client.readContract({ address: K.referralCoin.policy, abi: A.rcPolicy, functionName: 'gasFloor' }));
    if (pool.kind === 'perps') return BigInt((await client.readContract({ address: K.perps.hook, abi: A.perpsHook, functionName: 'pools', args: [pool.id] }))[3]);
  } catch { /* fall back to the measured constant */ }
  return undefined;
}

/** Constant gas for a pool: the measured tx figure, raised if the live floor moved above its measurement margin. */
async function poolGas(pool, withBind) {
  let gas = pool.gas + (withBind ? pool.bindExtra || 0n : 0n);
  const floor = await liveFloor(pool);
  if (floor && floor + 450_000n > gas) gas = floor + 450_000n;
  return gas > BASE_TX_GAS_CAP ? BASE_TX_GAS_CAP : gas;
}

export async function quoteSingle(pool, buy, mode, amount, account, hookData = '0x') {
  const { zeroForOne } = swapSides(pool, buy);
  const { result } = await client.simulateContract({
    address: K.uniswap.v4Quoter, abi: A.v4Quoter, functionName: mode === 'exactIn' ? 'quoteExactInputSingle' : 'quoteExactOutputSingle',
    args: [{ poolKey: pool.key, zeroForOne, exactAmount: amount, hookData }], gas: QUOTE_GAS, ...(account ? { account } : {}),
  });
  return result[0];
}

async function quotePath(route, amount, account) {
  const path = route.hops.map((hop) => ({ intermediateCurrency: hop.out, fee: hop.key.fee, tickSpacing: hop.key.tickSpacing, hooks: hop.key.hooks, hookData: '0x' }));
  const { result } = await client.simulateContract({
    address: K.uniswap.v4Quoter, abi: A.v4Quoter, functionName: 'quoteExactInput',
    args: [{ exactCurrency: route.input, path, exactAmount: amount }], gas: QUOTE_GAS, ...(account ? { account } : {}),
  });
  return result[0];
}

function parseAmount(text, decimals) {
  if (!text) throw new Error('--amount is required');
  return parseUnits(String(text), decimals);
}

/** Builds a quote (and optionally the swap) from CLI options. */
async function prepare(options) {
  const pool = await resolveMarket(options.market);
  const side = (options.side || '').toLowerCase();
  if (side !== 'buy' && side !== 'sell') throw new Error('--side buy|sell is required');
  const buy = side === 'buy';
  if (buy && pool.exitOnly) throw new Error(`${pool.tokenSymbol} is exit-only: holders can only sell${pool.exitOnly === 'issuer.unwind' ? ' through perp-unwind' : ''}`);
  if (!buy && pool.exitOnly === 'issuer.unwind') throw new Error(`${pool.tokenSymbol} exits through the issuer: use perp-unwind --market ${pool.tokenSymbol}`);
  const mode = options['exact-out'] ? 'exactOut' : 'exactIn';
  const nativePay = pool.quote === NATIVE ? 'ETH' : same(pool.quote, K.tokens.USDC.address) ? 'USDC' : same(pool.quote, K.tokens.FLASH.address) ? 'FLASH' : undefined;
  const pay = buy ? (options.pay || nativePay || pool.quoteSymbol).toUpperCase() : undefined;
  const account = options.wallet ? getAddress(options.wallet) : undefined;
  const slippage = options['slippage-bps'] !== undefined ? Number(options['slippage-bps']) : DEFAULT_SLIPPAGE_BPS;
  if (!(slippage >= 0 && slippage <= 5_000)) throw new Error('--slippage-bps must be 0..5000');

  // Pay route: a different pay asset converts into the quote in the same transaction.
  if (buy && pay !== (nativePay || pool.quoteSymbol)) {
    if (mode === 'exactOut') throw new Error('Exact-out is single-pool only: pay with the pool quote or use exact-in');
    const meta = PAY[pay];
    if (!meta) throw new Error(`--pay must be ETH, USDC or FLASH`);
    const candidates = payRoutes(pool, pay);
    if (!candidates?.length) throw new Error(`No ${pay} route into ${pool.name}`);
    const amountIn = parseAmount(options.amount, meta.decimals);
    let best;
    for (const route of candidates) {
      const out = await quotePath(route, amountIn, account).catch(() => undefined);
      if (out !== undefined && (!best || out > best.out)) best = { route, out };
    }
    if (!best) throw new Error(`No quote for ${pay} -> ${pool.tokenSymbol} at this size (liquidity)`);
    return { pool, buy, mode, account, slippage, route: best.route, amountIn, quoted: best.out, inputSymbol: pay, inputDecimals: meta.decimals };
  }

  const inDecimals = buy ? pool.quoteDecimals : pool.tokenDecimals;
  const outDecimals = buy ? pool.tokenDecimals : pool.quoteDecimals;
  let amount;
  if (options.amount === 'all') {
    if (buy || mode !== 'exactIn' || !account) throw new Error('--amount all works for exact-in sells with --wallet');
    amount = await client.readContract({ address: pool.token, abi: A.erc20, functionName: 'balanceOf', args: [account] });
    if (!amount) throw new Error(`No ${pool.tokenSymbol} to sell`);
  } else amount = parseAmount(options.amount, mode === 'exactIn' ? inDecimals : outDecimals);
  const quoted = await quoteSingle(pool, buy, mode, amount, account);
  return { pool, buy, mode, account, slippage, amount, quoted, inputSymbol: buy ? pool.quoteSymbol : pool.tokenSymbol, inputDecimals: inDecimals, outDecimals };
}

function describe(p) {
  const outSymbol = p.buy ? p.pool.tokenSymbol : p.pool.quoteSymbol;
  const outDecimals = p.buy ? p.pool.tokenDecimals : p.pool.quoteDecimals;
  if (p.route) return { market: p.pool.name, side: 'buy', pay: p.inputSymbol, amountIn: fmt(p.amountIn, p.inputDecimals), expectedOut: `${fmt(p.quoted, outDecimals)} ${outSymbol}`, route: p.route.hops.map((hop) => hop.out).join(' -> ') };
  return p.mode === 'exactIn'
    ? { market: p.pool.name, side: p.buy ? 'buy' : 'sell', amountIn: `${fmt(p.amount, p.inputDecimals)} ${p.inputSymbol}`, expectedOut: `${fmt(p.quoted, outDecimals)} ${outSymbol}` }
    : { market: p.pool.name, side: p.buy ? 'buy' : 'sell', amountOut: `${fmt(p.amount, outDecimals)} ${outSymbol}`, expectedIn: `${fmt(p.quoted, p.inputDecimals)} ${p.inputSymbol}` };
}

export async function quoteCommand(options) {
  const p = await prepare(options);
  return { ok: true, status: 'info', action: 'quote', quote: describe(p), referredPricing: p.account ? 'fee attributed to --wallet (1.69% if referred, 6.9% if not, on FLASH)' : 'unattributed (FLASH quotes at the 6.9% unreferred fee without --wallet)', note: 'The hooks guarantee quote == execution for the same state; prices move with every trade.' };
}

export async function swapCommand(options) {
  if (!options.wallet) throw new Error('--wallet is required to build a swap');
  const p = await prepare(options);
  const warnings = [];
  const ddl = deadline();
  let hookData = '0x';
  if (options['ref-code']) {
    if (p.pool.kind !== 'rc' && !(p.route && p.route.hops.some((hop) => hop.rc))) throw new Error('--ref-code binds only on a swap that touches the FLASH/ETH pool');
    if (!options['ref-signature'] || !options['ref-deadline']) throw new Error('An in-swap bind needs --ref-signature and --ref-deadline from the EIP-712 Bind (run referral-bind first to get the typed data), or bind with referral-bind before swapping');
    hookData = encodeBindHookData({ account: p.account, code: BigInt(options['ref-code']), deadline: BigInt(options['ref-deadline']), signature: options['ref-signature'] });
  }
  let swap;
  let inputToken;
  let inputAmount;
  let constant;
  let minOrMax;
  let floorWithEstimate;
  if (p.route) {
    minOrMax = slippageLimit('exactIn', p.quoted, p.slippage);
    swap = encodePathSwap({ input: p.route.input, output: p.route.output, hops: p.route.hops, amountIn: p.amountIn, minOut: minOrMax, rcHookData: hookData, deadline: ddl });
    inputToken = p.route.input;
    inputAmount = p.amountIn;
    // With an estimate: estimate x1.1 floored at the heaviest hop (app/src/stackSwap.ts payGasLimit).
    // Without one: every hop's constant summed (each hook checks its own gasleft() floor in turn).
    floorWithEstimate = p.route.hops.reduce((max, hop) => (hop.gas > max ? hop.gas : max), 0n);
    const sum = p.route.hops.reduce((total, hop) => total + hop.gas, 0n);
    constant = sum > BASE_TX_GAS_CAP ? BASE_TX_GAS_CAP : sum;
  } else {
    minOrMax = slippageLimit(p.mode, p.quoted, p.slippage);
    swap = encodeSingleSwap({ pool: p.pool, buy: p.buy, mode: p.mode, amount: p.amount, limit: minOrMax, hookData, deadline: ddl });
    inputToken = swap.input;
    inputAmount = p.mode === 'exactIn' ? p.amount : minOrMax;
    constant = await poolGas(p.pool, hookData !== '0x');
  }
  const approvals = await permit2Approvals(p.account, inputToken, inputAmount, p.inputSymbol);
  const swapTx = { to: swap.to, data: swap.data, value: swap.value, description: `${p.buy ? 'Buy' : 'Sell'} ${p.pool.tokenSymbol} on ${p.pool.name}` };
  if (!approvals.length) {
    const estimated = await estimate(p.account, swapTx);
    swapTx.gas = estimated ? swapGas(floorWithEstimate || constant, estimated) : constant;
  } else {
    swapTx.gas = constant;
    warnings.push('Approvals come first; the swap gas is the measured pool constant. Bankr: re-run this command after the approvals confirm to get an eth_estimateGas-sized limit.');
  }
  const transactions = [...approvals, swapTx];
  const simulation = await simulate(p.account, transactions);
  if (p.pool.kind === 'rc' && p.buy) {
    const game = await client.readContract({ address: K.referralCoin.koth, abi: A.rcKoth, functionName: 'nextTrigger' }).catch(() => 0n);
    const gross = p.mode === 'exactIn' ? p.amount : p.quoted;
    if (game && gross >= game) warnings.push(`This buy (>= ${fmt(game)} ETH) takes the King of the Hill throne.`);
  }
  if (p.pool.kind === 'rc' && !p.buy) warnings.push('Selling FLASH while you lead King of the Hill forfeits your leader share to the protocol owner.');
  if (p.pool.kind === 'perps' && !p.buy) warnings.push('Selling a perp at a loss mints QUANT to you in the same transaction (80% you, 20% protocol).');
  if (p.pool.kind === 'rc') {
    const referred = await client.readContract({ address: K.referralCoin.registry, abi: A.rcRegistry, functionName: 'isReferred', args: [p.account] }).catch(() => undefined);
    if (referred === false && hookData === '0x') warnings.push('This wallet is not referred: it pays the 6.9% fee. Binding a referral code first cuts it to 1.69% (referral-bind).');
  }
  return plan({
    action: 'swap',
    summary: { ...describe(p), [p.mode === 'exactIn' || p.route ? 'minimumOut' : 'maximumIn']: fmt(minOrMax, p.route || p.mode === 'exactIn' ? (p.buy ? p.pool.tokenDecimals : p.pool.quoteDecimals) : p.inputDecimals), slippageBps: p.slippage, gasLimit: swapTx.gas.toString() },
    transactions,
    simulation,
    warnings,
  });
}

export { PAY, revertReason, isNative };
