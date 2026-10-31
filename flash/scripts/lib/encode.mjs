// Pure calldata builders (no RPC): the Universal Router v4 swap plans the
// Flash app sends (app/src/stackRoute.ts, stackPayRoute.ts), the referral
// in-swap bind hookData and its EIP-712 typed data, and slippage math.
import { concatHex, encodeAbiParameters, encodeFunctionData, parseAbiParameters, keccak256 } from 'viem';
import * as A from './abis.mjs';
import { K, NATIVE } from './contracts.mjs';

const MSG_SENDER = '0x0000000000000000000000000000000000000001';
// v4-periphery Actions
const A_SWAP_EXACT_IN_SINGLE = '06';
const A_SWAP_EXACT_IN = '07';
const A_SWAP_EXACT_OUT_SINGLE = '08';
const A_SETTLE = '0b';
const A_SETTLE_ALL = '0c';
const A_TAKE_ALL = '0f';
// Universal Router commands. The UR's V4Router does not implement the v4 SWEEP
// action; an exact-out ETH refund uses the UR SWEEP command.
const C_V4_SWAP = '10';
const C_SWEEP = '04';

const POOL_KEY_T = '(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)';
const exactInSingle = parseAbiParameters(`(${POOL_KEY_T} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`);
const exactOutSingle = parseAbiParameters(`(${POOL_KEY_T} poolKey,bool zeroForOne,uint128 amountOut,uint128 amountInMaximum,bytes hookData)`);
const exactInPath = parseAbiParameters('(address currencyIn,(address intermediateCurrency,uint24 fee,int24 tickSpacing,address hooks,bytes hookData)[] path,uint128 amountIn,uint128 amountOutMinimum)');
const currencyAmount = parseAbiParameters('address currency,uint256 amount');
const settleParams = parseAbiParameters('address currency,uint256 amount,bool payerIsUser');
const sweepParams = parseAbiParameters('address token,address recipient,uint256 amountMin');
const planParams = parseAbiParameters('bytes actions,bytes[] params');
const keyType = parseAbiParameters(POOL_KEY_T);

export const same = (a, b) => a.toLowerCase() === b.toLowerCase();
export const isNative = (currency) => same(currency, NATIVE);
export const poolIdOf = (key) => keccak256(encodeAbiParameters(keyType, [key]));

/** input / output currency and v4 direction of a buy (pay quote, get token) or a sell. */
export function swapSides(pool, buy) {
  const input = buy ? pool.quote : pool.token;
  const output = buy ? pool.token : pool.quote;
  return { input, output, zeroForOne: same(input, pool.key.currency0) };
}

/** One V4_SWAP command on one pool: exact-in or exact-out. */
export function encodeSingleSwap({ pool, buy, mode, amount, limit, hookData = '0x', deadline }) {
  if (amount <= 0n) throw new Error('Amount must be positive');
  if (amount >= 1n << 128n || limit >= 1n << 128n) throw new Error('Amount out of range');
  const { input, output, zeroForOne } = swapSides(pool, buy);
  const nativeIn = isNative(input);
  const actions = [];
  const params = [];
  if (mode === 'exactIn') {
    actions.push(A_SWAP_EXACT_IN_SINGLE);
    params.push(encodeAbiParameters(exactInSingle, [{ poolKey: pool.key, zeroForOne, amountIn: amount, amountOutMinimum: limit, hookData }]));
  } else {
    actions.push(A_SWAP_EXACT_OUT_SINGLE);
    params.push(encodeAbiParameters(exactOutSingle, [{ poolKey: pool.key, zeroForOne, amountOut: amount, amountInMaximum: limit, hookData }]));
  }
  if (nativeIn) {
    // amount 0 = OPEN_DELTA: settle exactly what the swap owes.
    actions.push(A_SETTLE);
    params.push(encodeAbiParameters(settleParams, [input, mode === 'exactIn' ? amount : 0n, false]));
  } else {
    actions.push(A_SETTLE_ALL);
    params.push(encodeAbiParameters(currencyAmount, [input, mode === 'exactIn' ? amount : limit]));
  }
  actions.push(A_TAKE_ALL);
  params.push(encodeAbiParameters(currencyAmount, [output, mode === 'exactIn' ? limit : amount]));
  const commands = [C_V4_SWAP];
  const inputs = [encodeAbiParameters(planParams, [`0x${actions.join('')}`, params])];
  if (nativeIn && mode === 'exactOut') {
    commands.push(C_SWEEP);
    inputs.push(encodeAbiParameters(sweepParams, [input, MSG_SENDER, 0n]));
  }
  const value = nativeIn ? (mode === 'exactIn' ? amount : limit) : 0n;
  const data = encodeFunctionData({ abi: A.universalRouter, functionName: 'execute', args: [`0x${commands.join('')}`, inputs, deadline] });
  return { to: K.uniswap.universalRouter, data, value, input, output };
}

/** A multi-hop exact-in route: SWAP_EXACT_IN over PathKey[], SETTLE(_ALL), TAKE_ALL. */
export function encodePathSwap({ input, output, hops, amountIn, minOut, rcHookData = '0x', deadline }) {
  if (amountIn <= 0n) throw new Error('Amount must be positive');
  const nativeIn = isNative(input);
  const path = hops.map((hop) => ({ intermediateCurrency: hop.out, fee: hop.key.fee, tickSpacing: hop.key.tickSpacing, hooks: hop.key.hooks, hookData: hop.rc ? rcHookData : '0x' }));
  const swap = encodeAbiParameters(exactInPath, [{ currencyIn: input, path, amountIn, amountOutMinimum: minOut }]);
  const settle = nativeIn ? encodeAbiParameters(settleParams, [input, amountIn, false]) : encodeAbiParameters(currencyAmount, [input, amountIn]);
  const take = encodeAbiParameters(currencyAmount, [output, minOut]);
  const plan = encodeAbiParameters(planParams, [`0x${A_SWAP_EXACT_IN}${nativeIn ? A_SETTLE : A_SETTLE_ALL}${A_TAKE_ALL}`, [swap, settle, take]]);
  const data = encodeFunctionData({ abi: A.universalRouter, functionName: 'execute', args: [`0x${C_V4_SWAP}`, [plan], deadline] });
  return { to: K.uniswap.universalRouter, data, value: nativeIn ? amountIn : 0n, path };
}

// ------------------------------------------------------------------ pools

const F = K.pools['FLASH/ETH'];
export const RC_POOL = { name: 'FLASH/ETH', kind: 'rc', id: F.id, key: F.key, token: K.tokens.FLASH.address, quote: NATIVE, tokenSymbol: 'FLASH', quoteSymbol: 'ETH', tokenDecimals: 18, quoteDecimals: 18, gas: BigInt(F.gasFloorTx), bindExtra: BigInt(F.bindExtraGas) };
const Q = K.pools['QUANT/FLASH'];
export const QUANT_POOL = { name: 'QUANT/FLASH', kind: 'v3', id: Q.id, key: Q.key, token: K.tokens.QUANT.address, quote: K.tokens.FLASH.address, tokenSymbol: 'QUANT', quoteSymbol: 'FLASH', tokenDecimals: 18, quoteDecimals: 18, gas: BigInt(Q.gasFloorTx) };
export const V3_GAS = BigInt(Q.gasFloorTx);

export function perpPool(market) {
  return {
    name: market.symbol, kind: 'perps', marketId: market.id, id: market.poolId,
    key: { currency0: K.tokens.USDC.address, currency1: market.token, fee: 0x800000, tickSpacing: 1, hooks: K.perps.hook },
    token: market.token, quote: K.tokens.USDC.address, tokenSymbol: market.symbol, quoteSymbol: 'USDC', tokenDecimals: 18, quoteDecimals: 6, gas: BigInt(market.gasTx),
  };
}

const ETH_USDC_KEYS = K.pools['ETH/USDC hookless (pay-route leg)'];
const ETH_USDC_HOP_GAS = 200_000n;

/** Pay routes the app supports (exact-in buys only): ETH / USDC / FLASH converted in the same tx. */
export function payRoutes(pool, asset) {
  const from = asset === 'ETH' ? NATIVE : asset === 'USDC' ? K.tokens.USDC.address : K.tokens.FLASH.address;
  if (same(from, pool.quote)) return [];
  const rcHop = (out) => ({ key: RC_POOL.key, out, rc: true, gas: RC_POOL.gas });
  const build = (ethKey) => {
    const ethUsdc = (out) => ({ key: ethKey, out, rc: false, gas: ETH_USDC_HOP_GAS });
    let legs;
    if (same(pool.quote, K.tokens.FLASH.address)) legs = asset === 'ETH' ? [rcHop(K.tokens.FLASH.address)] : asset === 'USDC' ? [ethUsdc(NATIVE), rcHop(K.tokens.FLASH.address)] : undefined;
    else if (same(pool.quote, K.tokens.USDC.address)) legs = asset === 'ETH' ? [ethUsdc(K.tokens.USDC.address)] : asset === 'FLASH' ? [rcHop(NATIVE), ethUsdc(K.tokens.USDC.address)] : undefined;
    else if (same(pool.quote, NATIVE)) legs = asset === 'USDC' ? [ethUsdc(NATIVE)] : undefined;
    if (!legs) return undefined;
    const hops = [...legs, { key: pool.key, out: pool.token, rc: pool.kind === 'rc', gas: pool.gas }];
    return { asset, input: from, output: pool.token, hops, usesEthUsdc: hops.some((hop) => !hop.rc && same(hop.key.hooks, NATIVE)) };
  };
  const first = build(ETH_USDC_KEYS[0]);
  if (!first) return undefined;
  return first.usesEthUsdc ? ETH_USDC_KEYS.map(build) : [first];
}

// --------------------------------------------------------------- slippage

export function slippageLimit(mode, quoted, bps) {
  const b = BigInt(Math.max(0, Math.min(5_000, Math.round(bps))));
  if (mode === 'exactIn') return (quoted * (10_000n - b)) / 10_000n;
  return (quoted * (10_000n + b) + 9_999n) / 10_000n;
}

/** The limit a hook swap is sent with: estimate x1.1, never below the pool constant, never above Base's cap. */
export function swapGas(constant, estimated) {
  const padded = estimated ? (estimated * 11n + 9n) / 10n : 0n;
  const gas = padded > constant ? padded : constant;
  return gas > 16_777_216n ? 16_777_216n : gas;
}

// ------------------------------------------------------------ referral bind

/** bytes4(keccak256("FlashReferral.bind(address,uint64,uint256,bytes)")), equal to rcHook.BIND_MAGIC(). */
export const BIND_MAGIC = '0x64dc7253';
const bindPayload = parseAbiParameters('address account,uint64 code,uint256 deadline,bytes sig');

export function encodeBindHookData({ account, code, deadline, signature }) {
  return concatHex([BIND_MAGIC, encodeAbiParameters(bindPayload, [account, code, deadline, signature])]);
}

/** EIP-712 typed data for ReferralRegistry Bind (domain "Flash Referral" / "1"). */
export function bindTypedData(account, code, nonce, deadline) {
  return {
    domain: { name: 'Flash Referral', version: '1', chainId: 8453, verifyingContract: K.referralCoin.registry },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Bind: [
        { name: 'account', type: 'address' },
        { name: 'code', type: 'uint64' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'Bind',
    message: { account, code: code.toString(), nonce: nonce.toString(), deadline: deadline.toString() },
  };
}

// ----------------------------------------------------------------- launch shapes

/** LaunchShapeV5 with registry defaults (zero split / Lattice / stockpile = mode + preset values). */
export function launchShape({ mode = 0, preset = 0, rewardAsset = NATIVE }) {
  const segment = { bins: 0, exponentTicks: 0, sharePpm: 0 };
  return {
    mode, preset, overrideStockpile: false, stockpileBps: 0,
    split: { participantBps: 0, liquidityBps: 0, creatorChurnBps: 0, protocolChurnBps: 0 },
    lattice: { widthTicks: 0, binsBelowLaunch: 0, count: 0, segments: Array(8).fill(segment) },
    rewardAsset, ownerLadder: 0,
  };
}

// ----------------------------------------------------------------- churn levels

/** price (quote per token, equal decimals) -> bin floor tick snapped UP to the step (the churn snaps up too). */
export function priceToLevelTick(price, stepTicks) {
  if (!(price > 0)) throw new Error('Price must be positive');
  const raw = Math.log(price) / Math.log(1.0001);
  const step = Math.max(1, Math.floor(stepTicks));
  return Math.ceil(raw / step) * step;
}
export const tickToPrice = (tick) => 1.0001 ** tick;

export function presetWeights(preset, count) {
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    if (preset === 'front') return 1 - 0.8 * t;
    if (preset === 'back') return 0.2 + 0.8 * t;
    if (preset === 'exp') return 1.6 ** (t * 6) / 1.6 ** 6;
    return 1;
  });
}

/** Geometric bin floors over [low, high], snapped, de-duplicated, with the amount split by weight (dust to the heaviest). */
export function curveBins(total, low, high, count, stepTicks, preset) {
  if (!(low > 0) || !(high > low)) throw new Error('Invalid price range: need 0 < low < high');
  const lo = Math.log(low);
  const hi = Math.log(high);
  const ticks = Array.from({ length: count }, (_, index) => priceToLevelTick(Math.exp(count === 1 ? lo : lo + ((hi - lo) * index) / (count - 1)), stepTicks));
  const weights = presetWeights(preset, count);
  const sum = weights.reduce((a, b) => a + b, 0);
  const scale = 1_000_000_000n;
  const parts = weights.map((w) => (total * BigInt(Math.round((w / sum) * Number(scale)))) / scale);
  const heaviest = weights.indexOf(Math.max(...weights));
  parts[heaviest] += total - parts.reduce((a, b) => a + b, 0n);
  const byTick = new Map();
  ticks.forEach((tick, index) => { if (parts[index] > 0n) byTick.set(tick, (byTick.get(tick) || 0n) + parts[index]); });
  return [...byTick.entries()].sort((a, b) => a[0] - b[0]).map(([tick, amount]) => ({ tick, amount }));
}
