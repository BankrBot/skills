#!/usr/bin/env node
// chop.mjs: read Chop logs and build Bankr-ready transactions on Robinhood Chain (4663).
//
// This script never signs, never holds keys and never broadcasts. Every write command
// returns a JSON plan whose `transactions[]` the agent submits, in order, through Bankr
// (`bankr wallet submit` or POST https://api.bankr.bot/wallet/submit). Approvals are exact,
// never unlimited. Final transactions are simulated from the user's wallet before they are
// returned, with protected minimum outputs.
//
// Usage: node chop.mjs <command> [--flag value ...]   (node chop.mjs help)
// Exit codes: 0 ok · 1 error (JSON on stdout with ok:false) · 2 usage error.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient, http, fallback, defineChain, parseAbi, encodeFunctionData, encodeAbiParameters,
  concatHex, keccak256, hexToBigInt, getAddress, isAddress, parseUnits, formatUnits, decodeEventLog,
  BaseError, ContractFunctionRevertedError, zeroAddress, maxUint256,
} from "viem";

const HERE = dirname(fileURLToPath(import.meta.url));
// CHOP_CONTRACTS_FILE swaps in another contracts file (local fork or test deployment); production uses known-contracts.json.
const K = JSON.parse(readFileSync(process.env.CHOP_CONTRACTS_FILE || join(HERE, "..", "known-contracts.json"), "utf8"));
const CHAIN_ID = 4663;
const C = Object.fromEntries(Object.entries(K.contracts).map(([k, v]) => [k, getAddress(v)]));
const T = Object.fromEntries(Object.entries(K.tokens).map(([k, v]) => [k, { ...v, address: getAddress(v.address) }]));
const U = Object.fromEntries(Object.entries(K.uniswap).map(([k, v]) => [k, getAddress(v)]));
const DEN = 10_000n;
const Q96 = 1n << 96n;
const YEAR = 365 * 86_400;
const HARVEST_GAS = BigInt(K.protocol.harvestGasPerLog);
const DEADLINE_SECONDS = 20 * 60;
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// ------------------------------------------------------------------ ABIs (deployed bundle, chopdemo src/contracts/abis)
const ERC20 = parseAbi([
  "function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)",
  "function allowance(address,address) view returns (uint256)", "function approve(address spender,uint256 value) returns (bool)",
]);
const LOG = parseAbi([
  "function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)",
  "function getAllAssets() view returns ((address token,uint256 weighting,uint256 basePriceUSDX96,address c1,uint256 q1)[])",
  "function PAIRED_LP_TOKEN() view returns (address)", "function lpStakingPool() view returns (address)",
  "function lpRewardsToken() view returns (address)",
  "function fees() view returns ((uint16 burn,uint16 bond,uint16 debond,uint16 buy,uint16 sell,uint16 partner))",
  "function config() view returns ((address partner,uint256 debondCooldown,bool hasTransferTax,bool blacklistTKNpTKNPoolV2))",
  "function convertToShares(uint256 _assets) view returns (uint256)", "function convertToAssets(uint256 _shares) view returns (uint256)",
  "function totalAssets(address _asset) view returns (uint256)", "function created() view returns (uint256)",
  "function bond(address _token,uint256 _amount,uint256 _amountMintMin)",
  "function debond(uint256 _amount,address[],uint8[])",
  "function processFees()",
  "function updateFeeOracle() returns (bool)",
]);
const MANAGER = parseAbi([
  "function indexLength() view returns (uint256)",
  "function getIndexes(uint256 _offset,uint256 _limit) view returns ((address index,address creator,bool verified,bool selfLending,bool makePublic)[])",
  "function getIndex(address _index) view returns ((address index,address creator,bool verified,bool selfLending,bool makePublic))",
  "function isRegistered(address _index) view returns (bool)", "function validateIndex(address index) view",
  "function approvedRewardRouters(address) view returns (bool)",
  "function deployNewIndex(string indexName,string indexSymbol,bytes baseConfig,bytes immutables,address _owner) returns (address)",
  "event AddIndex(address indexed index, bool verified)",
]);
const STAKING = parseAbi([
  "function POOL_REWARDS() view returns (address)", "function stakingToken() view returns (address)",
  "function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)",
  "function withdrawableStake(address wallet) view returns (uint256)", "function stakeUserRestriction() view returns (address)",
  "function stake(address _user,uint256 _amount)", "function unstake(uint256 _amount)",
  "function approve(address spender,uint256 value) returns (bool)",
]);
const REWARDS = parseAbi([
  "function claimReward(address _wallet)", "function getUnpaid(address _token,address _wallet) view returns (uint256)",
  "function getClaimable(address token,address wallet) view returns (uint256)", "function getAllRewardsTokens() view returns (address[])",
  "function rewardsDeposited(address) view returns (uint256)", "function rewardsDistributed(address) view returns (uint256)",
  "function rewards(address,address) view returns (uint256 excluded,uint256 realized)", "function totalStakers() view returns (uint256)",
  "function rewardsToken() view returns (address)", "function rewardRouter() view returns (address)",
  "function pendingPairedRewards() view returns (uint256)", "function shares(address) view returns (uint256)",
  "function totalShares() view returns (uint256)",
]);
const UTILS = parseAbi([
  "function addLPAndStake(address _indexFund,uint256 _amountIdxTokens,address _pairedLpTokenProvided,uint256 _amtPairedLpTokenProvided,uint256 _amountPairedLpTokenMin,uint256 _slippage,uint256 _deadline) payable returns (uint256)",
  "function addLPAndStakeSingleSided(address _indexFund,(address inputToken,uint256 inputAmount,uint256 minSwapOutput,uint256 minStakedLpOutput,uint256 liquiditySlippage,uint256 deadline) _params) returns (uint256)",
  "function previewAddLPAndStakeSingleSided(address _indexFund,address _inputToken,uint256 _inputAmount) view returns (uint256,uint256)",
  "function unstakeAndRemoveLP(address _indexFund,uint256 _amountStakedTokens,uint256 _minLPTokens,uint256 _minPairedLpToken,uint256 _deadline)",
  "function unstakeAndRemoveLPSingleSided(address _indexFund,(address outputToken,uint256 stakedLpAmount,uint256 minLogOutput,uint256 minPairedOutput,uint256 minSwapOutput,uint256 minOutput,uint256 deadline) _params) returns (uint256)",
  "function claimRewardsMulti(address[] _rewards)",
  "error InvalidSingleSidedParams()", "error InvalidSingleSidedPool()", "error InvalidSingleSidedOutputToken()",
  "error SingleSidedOutputTooLow()", "error SingleSidedBalanceMismatch()", "error SingleSidedOutputTransferMismatch()",
]);
const SEEDER = parseAbi([
  "function createAndSeed(string name,string symbol,bytes baseConfig,bytes dependencies,(uint256 underlyingAmount,uint256 pairedPerToken,uint256 maxPaired,uint256 minLog,uint256 minStakedLp,uint256 deadline) p) returns (address,uint256)",
  "function seed(address logAddress,uint256 underlyingAmount,uint256 pairedPerToken,uint256 maxPaired,uint256 minLog,uint256 minStakedLp,uint256 deadline) returns (uint256)",
  "event LogSeeded(address indexed caller, address indexed log, address indexed underlying, uint256 underlyingAmount, uint256 pairedAmount, uint256 logAmount, uint256 lpAmount, uint256 stakedAmount)",
  "error InvalidAddress()", "error InvalidInput()", "error InvalidRegistryStatus()", "error InvalidLog()", "error InvalidPair()",
  "error InexactTransfer()", "error BelowMinimum()", "error OracleNotInitialized()",
]);
const ADAPTER = parseAbi(["function getV2Pool(address,address) view returns (address)"]);
const V2_ROUTER = parseAbi([
  "function getAmountsOut(uint256 amountIn,address[] path) view returns (uint256[])",
  "function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256 amountIn,uint256 amountOutMin,address[] path,address to,uint256 deadline)",
]);
const V2_PAIR = parseAbi([
  "function token0() view returns (address)", "function getReserves() view returns (uint112,uint112,uint32)",
  "function totalSupply() view returns (uint256)",
]);
const V2_FACTORY = parseAbi(["function getPair(address,address) view returns (address)"]);
const V3_FACTORY = parseAbi(["function getPool(address,address,uint24) view returns (address)"]);
const V3_POOL = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96,int24,uint16,uint16,uint16,uint8,bool)",
  "function liquidity() view returns (uint128)", "function token0() view returns (address)",
]);
const V4_PM = parseAbi(["function extsload(bytes32 slot) view returns (bytes32)"]);
const V4_ROUTER = parseAbi(["function hasRoute(address tokenIn) view returns (bool)"]);
const WETH9 = parseAbi(["function deposit() payable", "function withdraw(uint256 wad)"]);
// every custom error declared in the Chop contracts and their OpenZeppelin bases, so reverts decode by name
const ERRORS = parseAbi(JSON.parse(readFileSync(join(HERE, "errors.json"), "utf8")));

// ------------------------------------------------------------------ CLI plumbing
class UsageError extends Error {}
class ChopError extends Error { constructor(msg, code = "ERROR", extra = {}) { super(msg); this.code = code; this.extra = extra; } }

function parseArgs(argv) {
  const [cmd, ...rest] = argv; const o = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const k = a.slice(2); const n = rest[i + 1];
      if (n === undefined || n.startsWith("--")) o[k] = true; else { o[k] = n; i++; }
    } else o._.push(a);
  }
  return { cmd, o };
}
const out = (x) => process.stdout.write(JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2) + "\n");

const robinhood = defineChain({
  id: CHAIN_ID, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [K.rpc.primary] } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});
let client;
async function makeClient(o) {
  const urls = [...new Set([o.rpc || process.env.CHOP_RPC_URL, K.rpc.primary, K.rpc.secondary].filter(Boolean))];
  const transport = fallback(urls.map((u) => http(u, { retryCount: 2, timeout: 20_000 })));
  client = createPublicClient({ chain: robinhood, transport });
  // batch reads through Multicall3 when the chain has it (Robinhood Chain does; bare test chains may not)
  const code = await client.getCode({ address: robinhood.contracts.multicall3.address }).catch(() => null);
  if (code && code !== "0x") client = createPublicClient({ chain: robinhood, batch: { multicall: true }, transport });
  return client;
}
const read = (address, abi, functionName, args = [], extra = {}) => client.readContract({ address, abi, functionName, args, ...extra });
const tryRead = (...a) => read(...a).catch(() => null);

function addr(v, name) {
  if (!v || v === true || !isAddress(v)) throw new UsageError(`--${name} must be a 0x address`);
  return getAddress(v);
}
function wallet(o) { return addr(o.wallet || process.env.BANKR_WALLET_ADDRESS, "wallet"); }
function bps(o, key, def, max = 1000) {
  if (o[key] === undefined) return def;
  const v = Number(o[key]);
  if (!Number.isInteger(v) || v < 1 || v > max) throw new UsageError(`--${key} must be an integer from 1 to ${max}`);
  return v;
}
const minAfter = (x, b) => (x * (DEN - BigInt(b))) / DEN;
let CHAIN_NOW = Math.floor(Date.now() / 1000); // replaced by the latest block timestamp at startup
const deadline = () => BigInt(CHAIN_NOW + DEADLINE_SECONDS);
function amount(o, decimals, key = "amount", allValue = null) {
  const v = o[key];
  if (v === undefined || v === true) throw new UsageError(`--${key} is required`);
  if (v === "all" || v === "max") { if (allValue === null) throw new UsageError(`--${key} all is not supported here`); return allValue; }
  if (o.raw) { if (!/^\d+$/.test(v)) throw new UsageError(`--${key} must be an integer in raw units with --raw`); return BigInt(v); }
  if (!/^\d+(\.\d+)?$/.test(v)) throw new UsageError(`--${key} must be a decimal number, "all", or raw units with --raw`);
  return parseUnits(v, decimals);
}
const fmt = (x, d) => (x === null || x === undefined ? null : formatUnits(x, d));
const pct = (x) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

// ------------------------------------------------------------------ token + log reads
const tokenCache = new Map();
async function token(address) {
  const a = getAddress(address); const key = a.toLowerCase();
  if (!tokenCache.has(key)) {
    tokenCache.set(key, Promise.all([tryRead(a, ERC20, "symbol"), read(a, ERC20, "decimals")])
      .then(([symbol, decimals]) => ({ address: a, symbol: symbol ?? "?", decimals: Number(decimals) })));
  }
  return tokenCache.get(key);
}

async function registry() {
  const n = Number(await read(C.indexManager, MANAGER, "indexLength"));
  const rows = [];
  for (let off = 0; off < n; off += 100) {
    const page = await read(C.indexManager, MANAGER, "getIndexes", [BigInt(off), BigInt(Math.min(100, n - off))]);
    page.forEach((p, i) => rows.push({ position: off + i, ...p }));
  }
  return rows;
}

async function eligibility(logAddr) {
  const reasons = [];
  const [registered, entry] = await Promise.all([
    tryRead(C.indexManager, MANAGER, "isRegistered", [logAddr]),
    tryRead(C.indexManager, MANAGER, "getIndex", [logAddr]),
  ]);
  if (!registered) reasons.push("not registered in the Chop IndexManager");
  if (entry && !entry.makePublic) reasons.push("not public (pending review)");
  try { await read(C.indexManager, MANAGER, "validateIndex", [logAddr]); } catch { reasons.push("failed IndexManager.validateIndex"); }
  return { eligible: reasons.length === 0, reasons, verified: entry?.verified ?? false, creator: entry?.creator ?? null };
}

async function getLog(address) {
  const a = getAddress(address);
  const [name, symbol, decimals, totalSupply, assets, pairedAddr, stakingPool, fees, config, created] = await Promise.all([
    read(a, LOG, "name"), read(a, LOG, "symbol"), read(a, LOG, "decimals"), read(a, LOG, "totalSupply"),
    read(a, LOG, "getAllAssets"), read(a, LOG, "PAIRED_LP_TOKEN"), read(a, LOG, "lpStakingPool"), read(a, LOG, "fees"),
    read(a, LOG, "config"), tryRead(a, LOG, "created"),
  ]);
  if (assets.length !== 1) throw new ChopError("Only single-token logs are supported.", "UNSUPPORTED_LOG");
  const dec = Number(decimals);
  const [underlying, paired, rewards, pair, managed, backing] = await Promise.all([
    token(assets[0].token), token(pairedAddr), read(stakingPool, STAKING, "POOL_REWARDS"),
    read(C.dexAdapter, ADAPTER, "getV2Pool", [a, pairedAddr]), read(a, LOG, "totalAssets", [assets[0].token]),
    read(a, LOG, "convertToAssets", [10n ** BigInt(dec)]),
  ]);
  let reserveLog = 0n, reservePaired = 0n, lpTotalSupply = 0n;
  const pairOk = pair && pair !== zeroAddress;
  if (pairOk) {
    const [t0, res, ts] = await Promise.all([read(pair, V2_PAIR, "token0"), read(pair, V2_PAIR, "getReserves"), read(pair, V2_PAIR, "totalSupply")]);
    [reserveLog, reservePaired] = same(t0, a) ? [res[0], res[1]] : [res[1], res[0]];
    lpTotalSupply = ts;
  }
  const [rewardTokens, deposited, totalStakers, rewardRouter, pendingPaired] = await Promise.all([
    read(rewards, REWARDS, "getAllRewardsTokens").catch(() => []), tryRead(rewards, REWARDS, "rewardsDeposited", [T.CHOP.address]),
    tryRead(rewards, REWARDS, "totalStakers"), tryRead(rewards, REWARDS, "rewardRouter"), tryRead(rewards, REWARDS, "pendingPairedRewards"),
  ]);
  return {
    address: a, name, symbol, decimals: dec, totalSupply, underlying, paired, stakingPool, rewards, pair: pairOk ? pair : null,
    fees: { burn: fees.burn, bond: fees.bond, debond: fees.debond, buy: fees.buy, sell: fees.sell, partner: fees.partner },
    feeSet: feeSetOf(fees), partner: config.partner, hasTransferTax: config.hasTransferTax, created: created ? Number(created) : null,
    q1: assets[0].q1, reserveLog, reservePaired, lpTotalSupply, hasLiquidity: reserveLog > 0n && reservePaired > 0n,
    managedUnderlying: managed, backingPerLog: totalSupply > 0n ? (managed * 10n ** BigInt(dec)) / totalSupply : null,
    unwrapPerLogBeforeFee: backing, rewardTokens, chopDepositedToFarmers: deposited, totalStakers,
    rewardRouter: rewardRouter && rewardRouter !== zeroAddress ? rewardRouter : null, pendingPairedRewards: pendingPaired,
  };
}
function feeSetOf(f) {
  for (const [id, s] of Object.entries(K.feeSets)) {
    if (id.startsWith("_") || typeof s !== "object" || id === "maxPartnerFee") continue;
    if (f.burn === s.burn && f.bond === s.bond && f.debond === s.debond && f.buy === s.buy && f.sell === s.sell) return id;
  }
  return "other";
}

// resolve --log by address, log symbol (chVRAX), or underlying symbol (VRAX); --paired disambiguates
// mode: "deposit" (must be fully eligible), "exit" (must at least be registered; exits stay open on delisted logs), "read"
async function resolveLog(o, { requireEligible = true, mode } = {}) {
  mode = mode ?? (requireEligible ? "deposit" : "read");
  const v = o.log ?? o._[0];
  if (!v || v === true) throw new UsageError("--log <address | chSYMBOL | SYMBOL> is required");
  let address;
  if (isAddress(v)) address = getAddress(v);
  else {
    const want = String(v).replace(/^\$/, "").toLowerCase();
    const rows = await registry();
    const matches = [];
    for (const r of rows) {
      if (!r.makePublic && !o["include-pending"]) continue;
      const [sym, assets, paired] = await Promise.all([tryRead(r.index, LOG, "symbol"), tryRead(r.index, LOG, "getAllAssets"), tryRead(r.index, LOG, "PAIRED_LP_TOKEN")]);
      const u = assets?.[0] ? await token(assets[0].token).catch(() => null) : null;
      const hit = sym && (sym.toLowerCase() === want || sym.toLowerCase() === "ch" + want || (u && u.symbol.toLowerCase() === want));
      if (hit) matches.push({ address: r.index, symbol: sym, underlying: u?.symbol, paired });
    }
    let m = matches;
    if (o.paired && o.paired !== true) {
      const p = await pairedAddress(o.paired);
      m = matches.filter((x) => same(x.paired, p));
    }
    if (m.length === 0) throw new ChopError(`No public log matches "${v}".`, "LOG_NOT_FOUND");
    if (m.length > 1) throw new ChopError(`"${v}" matches ${m.length} logs; pass --log <address> or --paired.`, "AMBIGUOUS_LOG", { matches: m });
    address = m[0].address;
  }
  const el = await eligibility(address);
  if (mode === "deposit" && !el.eligible) throw new ChopError(`Log ${address} is not eligible: ${el.reasons.join("; ")}.`, "LOG_NOT_ELIGIBLE", el);
  if (mode === "exit" && el.reasons.some((r) => r.startsWith("not registered"))) throw new ChopError(`${address} is not a registered Chop log.`, "LOG_NOT_REGISTERED", el);
  const log = await getLog(address);
  if (log.hasTransferTax) throw new ChopError("Logs with a transfer tax are not supported.", "UNSUPPORTED_LOG");
  return { ...log, eligibility: el };
}
async function pairedAddress(v) {
  const s = String(v).toUpperCase().replace(/^\$/, "");
  if (T[s]) return T[s].address;
  return addr(v, "paired");
}

// ------------------------------------------------------------------ prices (display + gap detection only; never used for minimum outputs)
const ONE = 10n ** 18n;
async function v4PriceInOther(ref, tokenDecimals) {
  const stateSlot = keccak256(encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [ref.poolId, 6n]));
  const liqSlot = `0x${(hexToBigInt(stateSlot) + 3n).toString(16).padStart(64, "0")}`;
  const [s0, liq] = await Promise.all([read(U.v4PoolManager, V4_PM, "extsload", [stateSlot]), read(U.v4PoolManager, V4_PM, "extsload", [liqSlot])]);
  const sqrtP = hexToBigInt(s0) & ((1n << 160n) - 1n); const L = hexToBigInt(liq) & ((1n << 128n) - 1n);
  if (sqrtP === 0n || L === 0n) return null;
  const tokenIs0 = BigInt(ref.token) < BigInt(ref.other);
  const [d0, d1] = tokenIs0 ? [tokenDecimals, ref.otherDecimals] : [ref.otherDecimals, tokenDecimals];
  const r = Number(sqrtP) / 2 ** 96; const p10 = r * r * 10 ** (d0 - d1);
  return { price: tokenIs0 ? p10 : 1 / p10, source: `uniswap-v4 ${ref.poolId.slice(0, 10)}…` };
}
async function v3Price(a, b, da, db) {
  let best = null;
  for (const fee of [100, 500, 3000, 10000]) {
    const pool = await tryRead(U.v3Factory, V3_FACTORY, "getPool", [a, b, fee]);
    if (!pool || pool === zeroAddress) continue;
    const [s0, L, t0] = await Promise.all([tryRead(pool, V3_POOL, "slot0"), tryRead(pool, V3_POOL, "liquidity"), tryRead(pool, V3_POOL, "token0")]);
    if (!s0 || !L || L === 0n) continue;
    const aIs0 = same(t0, a); const [d0, d1] = aIs0 ? [da, db] : [db, da];
    const r = Number(s0[0]) / 2 ** 96; const p10 = r * r * 10 ** (d0 - d1);
    const price = aIs0 ? p10 : 1 / p10;
    if (!best || L > best.L) best = { price, L, source: `uniswap-v3 ${pool} (${fee / 10000}%)` };
  }
  return best;
}
async function v2Price(a, b, da, db) {
  const pair = await tryRead(U.v2Factory, V2_FACTORY, "getPair", [a, b]);
  if (!pair || pair === zeroAddress) return null;
  const [t0, r] = await Promise.all([read(pair, V2_PAIR, "token0"), read(pair, V2_PAIR, "getReserves")]);
  const [ra, rb] = same(t0, a) ? [r[0], r[1]] : [r[1], r[0]];
  if (ra === 0n || rb === 0n) return null;
  return { price: Number(formatUnits(rb, db)) / Number(formatUnits(ra, da)), source: `uniswap-v2 ${pair}` };
}
const priceCache = new Map();
async function priceInWeth(t) {
  if (same(t.address, T.WETH.address)) return { price: 1, source: "identity" };
  const key = t.address.toLowerCase();
  if (priceCache.has(key)) return priceCache.get(key);
  const p = (async () => {
    const ref = K.v4PricePools.find((x) => same(x.token, t.address));
    if (ref) { const r = await v4PriceInOther(ref, t.decimals).catch(() => null); if (r) return r; }
    const v3 = await v3Price(t.address, T.WETH.address, t.decimals, 18).catch(() => null);
    if (v3) return { price: v3.price, source: v3.source };
    return v2Price(t.address, T.WETH.address, t.decimals, 18).catch(() => null);
  })();
  priceCache.set(key, p); return p;
}
async function priceIn(t, quote) {
  if (same(t.address, quote.address)) return { price: 1, source: "identity" };
  const direct = await v3Price(t.address, quote.address, t.decimals, quote.decimals).catch(() => null);
  const [a, b] = await Promise.all([priceInWeth(t), priceInWeth(quote)]);
  const viaWeth = a && b && b.price > 0 ? { price: a.price / b.price, source: `${a.source} / ${b.source}` } : null;
  if (direct && (!viaWeth || direct.L > 0n)) return { price: direct.price, source: direct.source };
  return viaWeth;
}

// ------------------------------------------------------------------ views
function logSummary(l, extra = {}) {
  const priceLog = l.hasLiquidity ? Number(formatUnits(l.reservePaired, l.paired.decimals)) / Number(formatUnits(l.reserveLog, l.decimals)) : null;
  return {
    log: l.address, symbol: l.symbol, name: l.name, underlying: l.underlying, paired: l.paired, feeSet: l.feeSet,
    feesBps: l.fees, verified: l.eligibility?.verified ?? extra.verified ?? null, eligible: l.eligibility?.eligible ?? null,
    stakingPool: l.stakingPool, rewards: l.rewards, pool: l.pair, hasLiquidity: l.hasLiquidity,
    reserves: { log: fmt(l.reserveLog, l.decimals), paired: fmt(l.reservePaired, l.paired.decimals) },
    logPriceInPaired: priceLog, poolValueInPaired: fmt(l.reservePaired * 2n, l.paired.decimals),
    totalSupply: fmt(l.totalSupply, l.decimals), underlyingHeld: fmt(l.managedUnderlying, l.underlying.decimals),
    backingPerLog: fmt(l.backingPerLog, l.underlying.decimals),
    unwrapValuePerLog: l.unwrapPerLogBeforeFee !== null ? fmt((l.unwrapPerLogBeforeFee * (DEN - BigInt(l.fees.debond))) / DEN, l.underlying.decimals) : null,
    chopPaidToFarmers: fmt(l.chopDepositedToFarmers, 18), totalStakers: l.totalStakers,
    rewardRoute: l.rewardRouter ? { router: l.rewardRouter, pendingPairedRewards: fmt(l.pendingPairedRewards, l.paired.decimals) } : null,
    created: l.created ? new Date(l.created * 1000).toISOString() : null, ...extra,
  };
}
async function yields(l) {
  const now = Math.floor(Date.now() / 1000); const elapsed = l.created ? now - l.created : 0;
  let farmerApr = null, chopInPaired = null;
  if (l.hasLiquidity && l.chopDepositedToFarmers && elapsed > 0) {
    chopInPaired = same(l.paired.address, T.CHOP.address) ? { price: 1, source: "identity" } : await priceIn(T.CHOP, l.paired).catch(() => null);
    if (chopInPaired) {
      const alloc = Number(formatUnits(l.chopDepositedToFarmers, 18)) * chopInPaired.price;
      const pool = Number(formatUnits(l.reservePaired * 2n, l.paired.decimals));
      farmerApr = pool > 0 ? (alloc / pool) * (YEAR / elapsed) * 100 : null;
    }
  }
  let backingApy = null;
  const init = l.q1 / Q96;
  if (l.backingPerLog && init > 0n && elapsed >= 86_400) {
    const years = elapsed / YEAR; backingApy = (Math.pow(Number(l.backingPerLog) / Number(init), 1 / years) - 1) * 100;
  }
  return {
    farmerAprHistorical: pct(farmerApr), backingApyHistorical: pct(backingApy), chopPriceInPaired: chopInPaired,
    note: "Backward-looking: cumulative $CHOP paid to farmers vs. current pool value, simply annualized since the log was created. Not a forecast; it moves with volume, volatility and the $CHOP price.",
  };
}

async function cmdLogs(o) {
  const rows = await registry();
  const res = [];
  for (const r of rows) {
    if (!r.makePublic && !o.all) continue;
    try {
      const l = await getLog(r.index);
      const el = await eligibility(r.index);
      const s = logSummary({ ...l, eligibility: el });
      if (o.yields) s.yields = await yields(l);
      res.push(s);
    } catch (e) { res.push({ log: r.index, error: e.shortMessage || e.message }); }
  }
  return { ok: true, chainId: CHAIN_ID, count: res.length, logs: res };
}
async function cmdLog(o) {
  const l = await resolveLog(o, { requireEligible: false });
  return { ok: true, chainId: CHAIN_ID, ...logSummary(l), eligibility: l.eligibility, yields: await yields(l) };
}
async function cmdPosition(o) {
  const w = wallet(o);
  const logs = o.log || o._[0] ? [await resolveLog(o, { requireEligible: false })]
    : await Promise.all((await registry()).filter((r) => r.makePublic).map((r) => getLog(r.index).catch(() => null))).then((x) => x.filter(Boolean));
  const positions = [];
  for (const l of logs) {
    const [logBal, uBal, pBal, staked, withdrawable, unpaid, claimable, rw, lpBal] = await Promise.all([
      read(l.address, LOG, "balanceOf", [w]), read(l.underlying.address, ERC20, "balanceOf", [w]), read(l.paired.address, ERC20, "balanceOf", [w]),
      read(l.stakingPool, STAKING, "balanceOf", [w]), tryRead(l.stakingPool, STAKING, "withdrawableStake", [w]),
      tryRead(l.rewards, REWARDS, "getUnpaid", [T.CHOP.address, w]), tryRead(l.rewards, REWARDS, "getClaimable", [T.CHOP.address, w]),
      tryRead(l.rewards, REWARDS, "rewards", [T.CHOP.address, w]), l.pair ? read(l.pair, ERC20, "balanceOf", [w]) : 0n,
    ]);
    if (!o.log && !o._[0] && logBal === 0n && staked === 0n && lpBal === 0n && !unpaid) continue;
    const share = (r) => (l.lpTotalSupply > 0n ? (staked * r) / l.lpTotalSupply : 0n);
    positions.push({
      log: l.address, symbol: l.symbol,
      wallet: { log: fmt(logBal, l.decimals), underlying: fmt(uBal, l.underlying.decimals), paired: fmt(pBal, l.paired.decimals), unstakedLp: fmt(lpBal, 18) },
      logTokensUnwrapValue: l.unwrapPerLogBeforeFee !== null ? fmt((logBal * l.unwrapPerLogBeforeFee * (DEN - BigInt(l.fees.debond))) / (DEN * 10n ** BigInt(l.decimals)), l.underlying.decimals) : null,
      farm: {
        stakedLp: fmt(staked, 18), stakedLpRaw: staked, withdrawableLp: fmt(withdrawable, 18), withdrawableLpRaw: withdrawable,
        poolSharePct: l.lpTotalSupply > 0n ? pct((Number(staked) / Number(l.lpTotalSupply)) * 100) : 0,
        underlyingLog: fmt(share(l.reserveLog), l.decimals), underlyingPaired: fmt(share(l.reservePaired), l.paired.decimals),
      },
      rewards: { token: "CHOP", unpaid: fmt(unpaid, 18), claimableNow: fmt(claimable, 18), claimedToDate: rw ? fmt(rw[1], 18) : null, rewardsContract: l.rewards },
    });
  }
  return { ok: true, chainId: CHAIN_ID, wallet: w, positions };
}

// ------------------------------------------------------------------ quotes
async function quoteSwap(l, side, amountIn) {
  if (!l.hasLiquidity) throw new ChopError("This log's pool has no liquidity yet.", "NO_LIQUIDITY");
  const feeBps = BigInt(side === "buy" ? l.fees.buy : l.fees.sell);
  const input = side === "sell" ? (amountIn * (DEN - feeBps)) / DEN : amountIn;
  const path = side === "sell" ? [l.address, l.paired.address] : [l.paired.address, l.address];
  const amounts = await read(U.v2Router, V2_ROUTER, "getAmountsOut", [input, path]);
  const gross = amounts[amounts.length - 1];
  const outAmt = side === "buy" ? (gross * (DEN - feeBps)) / DEN : gross;
  return { out: outAmt, path, logFee: side === "sell" ? amountIn - input : gross - outAmt };
}
async function cmdQuote(o) {
  const kind = o.type || o._[0];
  if (!kind) throw new UsageError("quote <wrap|unwrap|buy|sell|farm|farm-single> --log X --amount N");
  const l = await resolveLog({ ...o, log: o.log || o._[1], _: [] }, { requireEligible: false });
  let r;
  if (kind === "wrap") {
    const a = amount(o, l.underlying.decimals); const gross = await read(l.address, LOG, "convertToShares", [a]);
    r = { in: fmt(a, l.underlying.decimals) + " " + l.underlying.symbol, out: fmt((gross * (DEN - BigInt(l.fees.bond))) / DEN, l.decimals) + " " + l.symbol, feeBps: l.fees.bond };
  } else if (kind === "unwrap") {
    const a = amount(o, l.decimals); const gross = await read(l.address, LOG, "convertToAssets", [a]);
    r = { in: fmt(a, l.decimals) + " " + l.symbol, out: fmt((gross * (DEN - BigInt(l.fees.debond))) / DEN, l.underlying.decimals) + " " + l.underlying.symbol, feeBps: l.fees.debond, note: "The last holder out pays no unwrap fee." };
  } else if (kind === "buy" || kind === "sell") {
    const a = amount(o, kind === "buy" ? l.paired.decimals : l.decimals); const q = await quoteSwap(l, kind, a);
    r = kind === "buy"
      ? { in: fmt(a, l.paired.decimals) + " " + l.paired.symbol, out: fmt(q.out, l.decimals) + " " + l.symbol, logFeeBps: l.fees.buy, poolFeeBps: 30 }
      : { in: fmt(a, l.decimals) + " " + l.symbol, out: fmt(q.out, l.paired.decimals) + " " + l.paired.symbol, logFeeBps: l.fees.sell, poolFeeBps: 30 };
  } else if (kind === "farm") {
    if (!l.hasLiquidity) throw new ChopError("No liquidity yet: the first liquidity is added with `seed`.", "NO_LIQUIDITY");
    const a = amount(o, l.decimals); const need = (a * l.reservePaired) / l.reserveLog + 1n;
    r = { logTokens: fmt(a, l.decimals), pairedNeeded: fmt(need, l.paired.decimals) + " " + l.paired.symbol };
  } else if (kind === "farm-single") {
    const a = amount(o, l.paired.decimals);
    const [swapAmt, expected] = await read(C.indexUtils, UTILS, "previewAddLPAndStakeSingleSided", [l.address, l.paired.address, a]);
    r = { in: fmt(a, l.paired.decimals) + " " + l.paired.symbol, swappedIntoLog: fmt(swapAmt, l.paired.decimals), expectedLogFromSwap: fmt(expected, l.decimals) };
  } else throw new UsageError(`unknown quote type ${kind}`);
  return { ok: true, chainId: CHAIN_ID, log: l.address, symbol: l.symbol, quote: kind, ...r };
}

// ------------------------------------------------------------------ plans
function tx(step, description, to, abi, functionName, args, { value = 0n, gas = null } = {}) {
  const t = { step, description, to: getAddress(to), data: encodeFunctionData({ abi, functionName, args }), value: value.toString(), chainId: CHAIN_ID };
  if (gas) t.gas = gas.toString();
  return t;
}
async function approvals(w, needs) {
  const txs = [];
  for (const n of needs) {
    if (n.amount <= 0n) continue;
    const [bal, cur] = await Promise.all([read(n.token.address, ERC20, "balanceOf", [w]), read(n.token.address, ERC20, "allowance", [w, n.spender])]);
    if (bal < n.amount) throw new ChopError(`Wallet holds ${fmt(bal, n.token.decimals)} ${n.token.symbol}, needs ${fmt(n.amount, n.token.decimals)}.`, "INSUFFICIENT_BALANCE");
    if (cur >= n.amount) continue;
    if (cur > 0n) txs.push(tx("approve-reset", `Reset ${n.token.symbol} allowance for ${n.label} to 0`, n.token.address, ERC20, "approve", [n.spender, 0n]));
    txs.push(tx("approve", `Approve exactly ${fmt(n.amount, n.token.decimals)} ${n.token.symbol} to ${n.label}`, n.token.address, ERC20, "approve", [n.spender, n.amount]));
  }
  return txs;
}
function approvalPlan(action, w, l, txs, summary) {
  return {
    ok: true, status: "approval-required", action, chainId: CHAIN_ID, wallet: w, log: l ? { address: l.address, symbol: l.symbol } : null, summary,
    transactions: txs,
    next: "Submit these approvals in order with waitForConfirmation, then run the same command again. It will return the simulated final transaction.",
  };
}
function decodeRevert(e) {
  if (e instanceof BaseError) {
    const r = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (r) return r.data?.errorName ? `${r.data.errorName}(${(r.data.args ?? []).join(",")})` : r.reason || r.shortMessage;
    return e.shortMessage;
  }
  return e.message;
}
async function simulate(w, to, abi, functionName, args, value = 0n) {
  try {
    const r = await client.simulateContract({ account: w, address: to, abi: [...abi, ...ERRORS], functionName, args, value });
    return r.result;
  } catch (e) {
    throw new ChopError(`Simulation reverted: ${decodeRevert(e)}. Nothing to submit.`, "SIMULATION_REVERTED");
  }
}
function readyPlan(action, w, l, txs, summary, warnings = []) {
  return {
    ok: true, status: "ready", action, chainId: CHAIN_ID, wallet: w, log: l ? { address: l.address, symbol: l.symbol } : null,
    summary, transactions: txs, simulated: true, expiresAt: new Date((CHAIN_NOW + DEADLINE_SECONDS) * 1000).toISOString(),
    warnings, next: "Show the summary to the user, validate per references/TX-VALIDATION.md, then submit each transaction in order with waitForConfirmation. Rebuild if expiresAt passes.",
  };
}

// --- wrap / unwrap
async function buildWrap(o) {
  const w = wallet(o); const l = await resolveLog(o); const slip = bps(o, "slippage-bps", 50);
  const a = amount(o, l.underlying.decimals, "amount", await read(l.underlying.address, ERC20, "balanceOf", [w]));
  if (a <= 0n) throw new ChopError("Wrap amount must be greater than zero.", "ZERO_AMOUNT");
  const gross = await read(l.address, LOG, "convertToShares", [a]);
  const net = (gross * (DEN - BigInt(l.fees.bond))) / DEN; const minMint = minAfter(net, slip);
  if (minMint <= 0n) throw new ChopError("Amount too small to mint log tokens.", "AMOUNT_TOO_SMALL");
  const summary = { action: `Wrap ${fmt(a, l.underlying.decimals)} ${l.underlying.symbol} into ${l.symbol}`, expectedOut: `${fmt(net, l.decimals)} ${l.symbol}`, minOut: `${fmt(minMint, l.decimals)} ${l.symbol}`, wrapFee: `${l.fees.bond / 100}%`, slippageBps: slip };
  const ap = await approvals(w, [{ token: l.underlying, spender: l.address, amount: a, label: l.symbol }]);
  if (ap.length) return approvalPlan("wrap", w, l, ap, summary);
  const args = [l.underlying.address, a, minMint];
  await simulate(w, l.address, LOG, "bond", args);
  return readyPlan("wrap", w, l, [tx("wrap", summary.action, l.address, LOG, "bond", args)], summary);
}
async function buildUnwrap(o) {
  const w = wallet(o); const l = await resolveLog(o, { mode: "exit" });
  const bal = await read(l.address, LOG, "balanceOf", [w]);
  const a = amount(o, l.decimals, "amount", bal);
  if (a <= 0n) throw new ChopError("Nothing to unwrap.", "ZERO_AMOUNT");
  if (bal < a) throw new ChopError(`Wallet holds ${fmt(bal, l.decimals)} ${l.symbol}.`, "INSUFFICIENT_BALANCE");
  const gross = await read(l.address, LOG, "convertToAssets", [a]);
  const expected = (gross * (DEN - BigInt(l.fees.debond))) / DEN;
  if (expected <= 0n) throw new ChopError("Amount too small to return any tokens.", "AMOUNT_TOO_SMALL");
  const args = [a, [], []];
  await simulate(w, l.address, LOG, "debond", args);
  const summary = { action: `Unwrap ${fmt(a, l.decimals)} ${l.symbol} into ${l.underlying.symbol}`, expectedOut: `${fmt(expected, l.underlying.decimals)} ${l.underlying.symbol}`, unwrapFee: `${l.fees.debond / 100}%`, note: "Unwrap redeems at backing and does not use a pool price. debond() has no minimum-output argument, so the transaction was simulated just now; submit promptly." };
  const warn = l.eligibility.eligible ? [] : [`Log is not currently eligible for new deposits (${l.eligibility.reasons.join("; ")}); exits stay open.`];
  return readyPlan("unwrap", w, l, [tx("unwrap", summary.action, l.address, LOG, "debond", args)], summary, warn);
}

// --- buy / sell in the log's own V2 pool
async function buildSwap(o, side) {
  const w = wallet(o); const l = await resolveLog(o, { mode: side === "buy" ? "deposit" : "exit" }); const slip = bps(o, "slippage-bps", 100);
  const tIn = side === "buy" ? l.paired : { address: l.address, symbol: l.symbol, decimals: l.decimals };
  const a = amount(o, tIn.decimals, "amount", await read(tIn.address, ERC20, "balanceOf", [w]));
  if (a <= 0n) throw new ChopError("Amount must be greater than zero.", "ZERO_AMOUNT");
  const q = await quoteSwap(l, side, a); const minOut = minAfter(q.out, slip);
  if (minOut <= 0n) throw new ChopError("Amount too small to trade.", "AMOUNT_TOO_SMALL");
  const tOut = side === "buy" ? { symbol: l.symbol, decimals: l.decimals } : l.paired;
  const summary = { action: `${side === "buy" ? "Buy" : "Sell"} ${l.symbol}: ${fmt(a, tIn.decimals)} ${tIn.symbol} in`, expectedOut: `${fmt(q.out, tOut.decimals)} ${tOut.symbol}`, minOut: `${fmt(minOut, tOut.decimals)} ${tOut.symbol}`, logFee: `${(side === "buy" ? l.fees.buy : l.fees.sell) / 100}%`, poolFee: "0.3%", slippageBps: slip, venue: `Log/${l.paired.symbol} Uniswap V2 pool ${l.pair}` };
  const ap = await approvals(w, [{ token: tIn, spender: U.v2Router, amount: a, label: "Uniswap V2 router" }]);
  if (ap.length) return approvalPlan(side, w, l, ap, summary);
  const args = [a, minOut, q.path, w, deadline()];
  await simulate(w, U.v2Router, V2_ROUTER, "swapExactTokensForTokensSupportingFeeOnTransferTokens", args);
  return readyPlan(side, w, l, [tx(side, summary.action, U.v2Router, V2_ROUTER, "swapExactTokensForTokensSupportingFeeOnTransferTokens", args)], summary);
}

// --- farming
const lpPermille = (o) => { const b = bps(o, "slippage-bps", 100); return Math.min(100, Math.max(1, Math.round(b / 10))); };
async function buildFarm(o) {
  const w = wallet(o); const l = await resolveLog(o); const sp = lpPermille(o);
  if (!l.hasLiquidity) throw new ChopError("No liquidity yet, so there is no price to farm at.", "NO_LIQUIDITY");
  const logTok = { address: l.address, symbol: l.symbol, decimals: l.decimals };
  const a = amount(o, l.decimals, "amount", await read(l.address, LOG, "balanceOf", [w]));
  if (a <= 0n) throw new ChopError("Farm amount must be greater than zero.", "ZERO_AMOUNT");
  const quote = (a * l.reservePaired) / l.reserveLog + 1n;
  const pairedAmt = o["paired-amount"] ? amount(o, l.paired.decimals, "paired-amount") : quote;
  const summary = { action: `Farm ${l.symbol}: add ${fmt(a, l.decimals)} ${l.symbol} + ${fmt(pairedAmt, l.paired.decimals)} ${l.paired.symbol} as LP and stake it`, poolRatioQuote: `${fmt(quote, l.paired.decimals)} ${l.paired.symbol}`, lpSlippage: `${sp / 10}%`, note: "Unused tokens are refunded. Staked LP is locked for 10 minutes after staking. Farming has impermanent loss." };
  const ap = await approvals(w, [
    { token: logTok, spender: C.indexUtils, amount: a, label: "Chop IndexUtils" },
    { token: l.paired, spender: C.indexUtils, amount: pairedAmt, label: "Chop IndexUtils" },
  ]);
  if (ap.length) return approvalPlan("farm", w, l, ap, summary);
  const args = [l.address, a, l.paired.address, pairedAmt, 0n, BigInt(sp), deadline()];
  const lp = await simulate(w, C.indexUtils, UTILS, "addLPAndStake", args);
  summary.expectedStakedLp = fmt(lp, 18);
  return readyPlan("farm", w, l, [tx("farm", summary.action, C.indexUtils, UTILS, "addLPAndStake", args)], summary);
}
async function buildFarmSingle(o) {
  const w = wallet(o); const l = await resolveLog(o); const sp = lpPermille(o); const slipBps = sp * 10;
  if (!l.hasLiquidity) throw new ChopError("No liquidity yet, so there is no price to farm at.", "NO_LIQUIDITY");
  const a = amount(o, l.paired.decimals, "amount", await read(l.paired.address, ERC20, "balanceOf", [w]));
  if (a <= 0n) throw new ChopError("Deposit must be greater than zero.", "ZERO_AMOUNT");
  const [swapAmt, expected] = await read(C.indexUtils, UTILS, "previewAddLPAndStakeSingleSided", [l.address, l.paired.address, a]);
  const minSwap = minAfter(expected, slipBps);
  if (minSwap <= 0n) throw new ChopError("Deposit too small to swap into log tokens.", "AMOUNT_TOO_SMALL");
  const summary = { action: `Farm ${l.symbol} with only ${fmt(a, l.paired.decimals)} ${l.paired.symbol}`, swappedIntoLog: `${fmt(swapAmt, l.paired.decimals)} ${l.paired.symbol}`, expectedLogFromSwap: `${fmt(expected, l.decimals)} ${l.symbol}`, slippage: `${sp / 10}%`, note: `The swapped part pays the log's ${l.fees.buy / 100}% buy fee and the 0.3% pool fee. Large deposits move this pool's price. Staked LP is locked for 10 minutes.` };
  if (same(l.paired.address, T.WETH.address)) summary.tip = "Only WETH is accepted. Wrap native ETH first with `wrap-eth`.";
  const ap = await approvals(w, [{ token: l.paired, spender: C.indexUtils, amount: a, label: "Chop IndexUtils" }]);
  if (ap.length) return approvalPlan("farm-single", w, l, ap, summary);
  const dl = deadline();
  const params = (minLp) => ({ inputToken: l.paired.address, inputAmount: a, minSwapOutput: minSwap, minStakedLpOutput: minLp, liquiditySlippage: BigInt(sp), deadline: dl });
  const probe = await simulate(w, C.indexUtils, UTILS, "addLPAndStakeSingleSided", [l.address, params(1n)]);
  if (probe <= 0n) throw new ChopError("This deposit would not add any liquidity.", "AMOUNT_TOO_SMALL");
  const args = [l.address, params(minAfter(probe, slipBps))];
  await simulate(w, C.indexUtils, UTILS, "addLPAndStakeSingleSided", args);
  summary.expectedStakedLp = fmt(probe, 18); summary.minStakedLp = fmt(minAfter(probe, slipBps), 18);
  return readyPlan("farm-single", w, l, [tx("farm-single", summary.action, C.indexUtils, UTILS, "addLPAndStakeSingleSided", args)], summary);
}
async function buildUnfarm(o) {
  const w = wallet(o); const l = await resolveLog(o, { mode: "exit" }); const slip = bps(o, "slippage-bps", 100);
  const receipt = { address: l.stakingPool, symbol: `staked ${l.symbol} LP`, decimals: 18 };
  const [staked, withdrawable] = await Promise.all([read(l.stakingPool, STAKING, "balanceOf", [w]), read(l.stakingPool, STAKING, "withdrawableStake", [w])]);
  const a = amount(o, 18, "amount", withdrawable);
  if (a <= 0n) throw new ChopError(staked > 0n ? "Staked LP is still inside its 10-minute lock. Try again shortly." : "Nothing staked in this log.", staked > 0n ? "STAKE_WAIT" : "ZERO_AMOUNT");
  if (a > withdrawable) throw new ChopError(`Only ${fmt(withdrawable, 18)} of ${fmt(staked, 18)} staked LP is unlocked (10-minute lock after staking).`, "STAKE_WAIT");
  const share = (r) => (l.lpTotalSupply > 0n ? (a * r) / l.lpTotalSupply : 0n);
  const minLog = minAfter(share(l.reserveLog), slip), minPaired = minAfter(share(l.reservePaired), slip);
  const to = (o.to || "both").toLowerCase();
  const summary = { action: `Stop farming ${l.symbol}: remove ${fmt(a, 18)} staked LP`, expectedLog: `${fmt(share(l.reserveLog), l.decimals)} ${l.symbol}`, expectedPaired: `${fmt(share(l.reservePaired), l.paired.decimals)} ${l.paired.symbol}`, slippageBps: slip, note: "Pending $CHOP rewards stay claimable after exiting; run `claim`." };
  const ap = await approvals(w, [{ token: receipt, spender: C.indexUtils, amount: a, label: "Chop IndexUtils" }]);
  if (ap.length) return approvalPlan("unfarm", w, l, ap, summary);
  if (to === "both") {
    const args = [l.address, a, minLog, minPaired, deadline()];
    await simulate(w, C.indexUtils, UTILS, "unstakeAndRemoveLP", args);
    return readyPlan("unfarm", w, l, [tx("unfarm", summary.action, C.indexUtils, UTILS, "unstakeAndRemoveLP", args)], summary);
  }
  const outTok = to === "paired" || to === l.paired.symbol.toLowerCase() ? l.paired.address : to === "log" || to === l.symbol.toLowerCase() ? l.address : null;
  if (!outTok) throw new UsageError("--to must be both, paired or log");
  // estimate the swap of the unwanted side against post-removal reserves (0.3% pool fee + log fee)
  const rl = l.reserveLog - share(l.reserveLog), rp = l.reservePaired - share(l.reservePaired);
  const amm = (x, rin, rout) => (x * 997n * rout) / (rin * 1000n + x * 997n);
  let swapOut, total;
  if (same(outTok, l.paired.address)) {
    const sold = (share(l.reserveLog) * (DEN - BigInt(l.fees.sell))) / DEN; swapOut = amm(sold, rl, rp); total = share(l.reservePaired) + swapOut;
  } else {
    swapOut = (amm(share(l.reservePaired), rp, rl) * (DEN - BigInt(l.fees.buy))) / DEN; total = share(l.reserveLog) + swapOut;
  }
  const dl = deadline();
  const params = (minOut) => ({ outputToken: outTok, stakedLpAmount: a, minLogOutput: minLog, minPairedOutput: minPaired, minSwapOutput: minAfter(swapOut, slip), minOutput: minOut, deadline: dl });
  const probe = await simulate(w, C.indexUtils, UTILS, "unstakeAndRemoveLPSingleSided", [l.address, params(1n)]);
  const args = [l.address, params(minAfter(probe < total ? probe : total, slip))];
  await simulate(w, C.indexUtils, UTILS, "unstakeAndRemoveLPSingleSided", args);
  const od = same(outTok, l.paired.address) ? l.paired : { symbol: l.symbol, decimals: l.decimals };
  summary.action = `Stop farming ${l.symbol} into ${od.symbol} only`; summary.expectedOut = `${fmt(probe, od.decimals)} ${od.symbol}`;
  return readyPlan("unfarm", w, l, [tx("unfarm-single", summary.action, C.indexUtils, UTILS, "unstakeAndRemoveLPSingleSided", args)], summary);
}
async function buildStake(o) {
  const w = wallet(o); const l = await resolveLog(o);
  if (!l.pair) throw new ChopError("This log has no pool yet.", "NO_LIQUIDITY");
  const restriction = await read(l.stakingPool, STAKING, "stakeUserRestriction");
  if (restriction !== zeroAddress && !same(restriction, w)) throw new ChopError("Direct staking is restricted for this log; use `farm` instead.", "STAKE_RESTRICTED");
  const lpTok = { address: l.pair, symbol: `${l.symbol}/${l.paired.symbol} LP`, decimals: 18 };
  const a = amount(o, 18, "amount", await read(l.pair, ERC20, "balanceOf", [w]));
  if (a <= 0n) throw new ChopError("No LP tokens to stake.", "ZERO_AMOUNT");
  const summary = { action: `Stake ${fmt(a, 18)} ${lpTok.symbol} to farm $CHOP`, note: "Staked LP is locked for 10 minutes." };
  const ap = await approvals(w, [{ token: lpTok, spender: l.stakingPool, amount: a, label: `${l.symbol} staking pool` }]);
  if (ap.length) return approvalPlan("stake", w, l, ap, summary);
  await simulate(w, l.stakingPool, STAKING, "stake", [w, a]);
  return readyPlan("stake", w, l, [tx("stake", summary.action, l.stakingPool, STAKING, "stake", [w, a])], summary);
}
async function buildUnstake(o) {
  const w = wallet(o); const l = await resolveLog(o, { mode: "exit" });
  const withdrawable = await read(l.stakingPool, STAKING, "withdrawableStake", [w]);
  const a = amount(o, 18, "amount", withdrawable);
  if (a <= 0n || a > withdrawable) throw new ChopError(`Unlocked stake is ${fmt(withdrawable, 18)} (10-minute lock after staking).`, "STAKE_WAIT");
  await simulate(w, l.stakingPool, STAKING, "unstake", [a]);
  const summary = { action: `Unstake ${fmt(a, 18)} LP from ${l.symbol} (returns raw LP tokens; use unfarm to also remove liquidity)` };
  return readyPlan("unstake", w, l, [tx("unstake", summary.action, l.stakingPool, STAKING, "unstake", [a])], summary);
}
async function buildClaim(o) {
  const w = wallet(o); let logs;
  if (o.all || (!o.log && !o._[0])) {
    const rows = (await registry()).filter((r) => r.makePublic);
    logs = (await Promise.all(rows.map((r) => getLog(r.index).catch(() => null)))).filter(Boolean);
  } else logs = [await resolveLog(o, { mode: "exit" })];
  const claimable = [];
  for (const l of logs) {
    const [c, u] = await Promise.all([tryRead(l.rewards, REWARDS, "getClaimable", [T.CHOP.address, w]), tryRead(l.rewards, REWARDS, "getUnpaid", [T.CHOP.address, w])]);
    if ((c ?? 0n) > 0n) claimable.push({ l, c, u });
  }
  if (!claimable.length) throw new ChopError("No $CHOP rewards are claimable right now. Recently earned rewards may still be inside the 10-minute maturity lock.", "NOTHING_TO_CLAIM");
  const total = claimable.reduce((s, x) => s + x.c, 0n);
  const summary = { action: `Harvest ${fmt(total, 18)} $CHOP from ${claimable.map((x) => x.l.symbol).join(", ")}`, perLog: claimable.map((x) => ({ log: x.l.symbol, claimable: fmt(x.c, 18) })) };
  if (claimable.length === 1) {
    const r = claimable[0].l.rewards;
    await simulate(w, r, REWARDS, "claimReward", [w]);
    return readyPlan("claim", w, claimable[0].l, [tx("claim", summary.action, r, REWARDS, "claimReward", [w], { gas: HARVEST_GAS })], summary,
      ["Gas is pinned at 800,000: the rewards contract catches a failed payout, so a tight estimate can succeed while paying nothing."]);
  }
  const list = claimable.map((x) => x.l.rewards);
  await simulate(w, C.indexUtils, UTILS, "claimRewardsMulti", [list]);
  return readyPlan("claim", w, null, [tx("claim-multi", summary.action, C.indexUtils, UTILS, "claimRewardsMulti", [list], { gas: HARVEST_GAS * BigInt(list.length) })], summary,
    ["Gas is pinned at 800,000 per log for the same reason."]);
}
async function buildProcessFees(o) {
  const w = wallet(o); const l = await resolveLog(o);
  try { await simulate(w, l.address, LOG, "processFees", []); }
  catch (e) {
    if (/FeeOracle(NotReady|Stale)/.test(e.message)) throw new ChopError(`${e.message.replace(" Nothing to submit.", "")} The log's fee price oracle needs two observations 10 to 20 minutes apart: run update-oracle, wait about 11 minutes, run update-oracle again, then process-fees. The Chop keeper normally does this.`, "FEE_ORACLE_NOT_READY");
    throw e;
  }
  const summary = { action: `Process pending fees on ${l.symbol}`, note: "Permissionless upkeep: swaps accumulated log-token fees and sends them to farmers' rewards. It is rate-limited by a cooldown and only acts above a minimum size; you pay gas and earn nothing extra." };
  return readyPlan("process-fees", w, l, [tx("process-fees", summary.action, l.address, LOG, "processFees", [])], summary);
}
async function buildUpdateOracle(o) {
  const w = wallet(o); const l = await resolveLog(o);
  const matured = await simulate(w, l.address, LOG, "updateFeeOracle", []);
  const summary = { action: `Update the fee price oracle of ${l.symbol}`, willMature: matured, note: matured ? "This observation completes the averaging window; process-fees can run right after." : "This records an observation. Run it again 10 to 20 minutes later to mature the average." };
  return readyPlan("update-oracle", w, l, [tx("update-oracle", summary.action, l.address, LOG, "updateFeeOracle", [])], summary);
}
async function buildWrapEth(o, unwrapIt = false) {
  const w = wallet(o); const a = amount(o, 18);
  if (a <= 0n) throw new ChopError("Amount must be greater than zero.", "ZERO_AMOUNT");
  if (!unwrapIt) {
    const bal = await client.getBalance({ address: w });
    if (bal < a) throw new ChopError(`Wallet holds ${fmt(bal, 18)} ETH.`, "INSUFFICIENT_BALANCE");
    await simulate(w, T.WETH.address, WETH9, "deposit", [], a);
    const s = { action: `Wrap ${fmt(a, 18)} ETH into WETH`, note: "Keep some native ETH for gas." };
    return readyPlan("wrap-eth", w, null, [tx("wrap-eth", s.action, T.WETH.address, WETH9, "deposit", [], { value: a })], s);
  }
  await simulate(w, T.WETH.address, WETH9, "withdraw", [a]);
  const s = { action: `Unwrap ${fmt(a, 18)} WETH into ETH` };
  return readyPlan("unwrap-eth", w, null, [tx("unwrap-eth", s.action, T.WETH.address, WETH9, "withdraw", [a])], s);
}

// --- launching logs
function launchArgs(underlying, paired) {
  const f = K.feeSets.volatile; const sym = underlying.symbol.toUpperCase();
  const baseConfig = encodeAbiParameters(
    [{ type: "tuple", components: [{ name: "partner", type: "address" }, { name: "debondCooldown", type: "uint256" }, { name: "hasTransferTax", type: "bool" }, { name: "blacklistTKNpTKNPoolV2", type: "bool" }] },
     { type: "tuple", components: ["burn", "bond", "debond", "buy", "sell", "partner"].map((n) => ({ name: n, type: "uint16" })) },
     { type: "address[]" }, { type: "uint256[]" }, { type: "address" }, { type: "bool" }],
    [{ partner: zeroAddress, debondCooldown: 0n, hasTransferTax: false, blacklistTKNpTKNPoolV2: false }, f, [underlying.address], [10n ** 18n], zeroAddress, false]);
  let immutables = encodeAbiParameters(Array.from({ length: 7 }, () => ({ type: "address" })),
    [paired.address, T.CHOP.address, T.USDG.address, C.feeRouter, C.rewardsWhitelist, C.twapUtils, C.dexAdapter]);
  if (!same(paired.address, T.CHOP.address)) immutables = concatHex([immutables, encodeAbiParameters([{ type: "address" }], [C.v4RewardRouter])]);
  return { name: `Chop ${sym}`, symbol: `ch${sym}`, baseConfig, immutables };
}
async function launchChecks(underlying, paired) {
  if (same(underlying.address, paired.address)) throw new ChopError("Underlying and paired tokens must differ.", "INVALID_INPUT");
  if (underlying.decimals > 18 || paired.decimals > 18) throw new ChopError("Tokens with more than 18 decimals are not supported.", "INVALID_INPUT");
  const rows = await registry();
  for (const r of rows) {
    const [assets, p] = await Promise.all([tryRead(r.index, LOG, "getAllAssets"), tryRead(r.index, LOG, "PAIRED_LP_TOKEN")]);
    if (assets?.[0] && same(assets[0].token, underlying.address) && same(p, paired.address))
      throw new ChopError(`A log for ${underlying.symbol} paired with ${paired.symbol} already exists: ${r.index}.`, "DUPLICATE_LOG", { log: r.index });
  }
  if (!same(paired.address, T.CHOP.address)) {
    const [has, approved] = await Promise.all([tryRead(C.v4RewardRouter, V4_ROUTER, "hasRoute", [paired.address]), tryRead(C.indexManager, MANAGER, "approvedRewardRouters", [C.v4RewardRouter])]);
    if (!has || !approved) throw new ChopError(`${paired.symbol} has no reviewed $CHOP reward route. Pair with CHOP, WETH or USDG.`, "NO_REWARD_ROUTE");
  }
}
async function buildLaunch(o) {
  const w = wallet(o); const slip = bps(o, "slippage-bps", 100);
  const underlying = await token(addr(o.token, "token")); const paired = await token(await pairedAddress(o.paired || "CHOP"));
  await launchChecks(underlying, paired);
  const ua = amount(o, underlying.decimals, "amount"); const pa = amount(o, paired.decimals, "paired-amount");
  if (ua <= 0n || pa <= 0n) throw new ChopError("Seed amounts must be greater than zero.", "ZERO_AMOUNT");
  const pairedPerToken = (pa * 10n ** BigInt(underlying.decimals) + ua - 1n) / ua;
  const maxPaired = (pa * (DEN + BigInt(slip))) / DEN;
  const market = await priceIn(underlying, paired).catch(() => null);
  const seedPrice = Number(formatUnits(pa, paired.decimals)) / Number(formatUnits(ua, underlying.decimals));
  const warnings = [];
  if (market) { const dev = (seedPrice / market.price - 1) * 100; if (Math.abs(dev) > 3) warnings.push(`Seed price ${seedPrice} ${paired.symbol}/${underlying.symbol} is ${dev.toFixed(1)}% away from the market (${market.price}, ${market.source}). Arbitrageurs will take the difference from the seeder.`); }
  else warnings.push(`No market price found for ${underlying.symbol} in ${paired.symbol}; double-check the seed ratio.`);
  const la = launchArgs(underlying, paired);
  const summary = { action: `Launch ${la.symbol} (${la.name}) and seed it with ${fmt(ua, underlying.decimals)} ${underlying.symbol} + ~${fmt(pa, paired.decimals)} ${paired.symbol}`, feeSet: "volatile (wrap 1%, unwrap 1%, buy 0.5%, sell 0.5%, 15% of fees burned as log tokens)", rewards: "$CHOP", seedPrice: `${seedPrice} ${paired.symbol} per ${underlying.symbol}`, marketPrice: market, note: "The seeded LP is staked to the launching wallet. New logs start pending until the team reviews and publishes them." };
  const ap = await approvals(w, [{ token: underlying, spender: C.logSeeder, amount: ua, label: "Chop log seeder" }, { token: paired, spender: C.logSeeder, amount: maxPaired, label: "Chop log seeder" }]);
  if (ap.length) return approvalPlan("launch", w, null, ap, summary);
  const minLog = minAfter((ua * (DEN - BigInt(K.feeSets.volatile.bond))) / DEN, slip);
  const p = { underlyingAmount: ua, pairedPerToken, maxPaired, minLog, minStakedLp: 1n, deadline: deadline() };
  const draft = await simulate(w, C.logSeeder, SEEDER, "createAndSeed", [la.name, la.symbol, la.baseConfig, la.immutables, p]);
  const args = [la.name, la.symbol, la.baseConfig, la.immutables, { ...p, minStakedLp: minAfter(draft[1], slip) }];
  await simulate(w, C.logSeeder, SEEDER, "createAndSeed", args);
  summary.predictedLog = draft[0]; summary.expectedStakedLp = fmt(draft[1], 18);
  return readyPlan("launch", w, null, [tx("launch", summary.action, C.logSeeder, SEEDER, "createAndSeed", args)], summary, warnings);
}
async function buildCreate(o) {
  const w = wallet(o);
  const underlying = await token(addr(o.token, "token")); const paired = await token(await pairedAddress(o.paired || "CHOP"));
  await launchChecks(underlying, paired);
  const la = launchArgs(underlying, paired);
  const args = [la.name, la.symbol, la.baseConfig, la.immutables, w];
  const predicted = await simulate(w, C.indexManager, MANAGER, "deployNewIndex", args);
  const summary = { action: `Create ${la.symbol} without liquidity`, predictedLog: predicted, note: "Unfunded: nobody can trade or farm it until its first liquidity is added with `seed`. Prefer `launch`, which creates and seeds atomically." };
  return readyPlan("create", w, null, [tx("create", summary.action, C.indexManager, MANAGER, "deployNewIndex", args)], summary);
}
async function buildSeed(o) {
  const w = wallet(o); const l = await resolveLog({ ...o, "include-pending": true }, { requireEligible: false }); const slip = bps(o, "slippage-bps", 100);
  if (l.hasLiquidity || l.lpTotalSupply > 0n) throw new ChopError("This log already has liquidity. Use `farm` to add more.", "HAS_LIQUIDITY");
  const ua = amount(o, l.underlying.decimals, "amount"); const pa = amount(o, l.paired.decimals, "paired-amount");
  const pairedPerToken = (pa * 10n ** BigInt(l.underlying.decimals) + ua - 1n) / ua; const maxPaired = (pa * (DEN + BigInt(slip))) / DEN;
  const summary = { action: `Seed ${l.symbol} with ${fmt(ua, l.underlying.decimals)} ${l.underlying.symbol} + ~${fmt(pa, l.paired.decimals)} ${l.paired.symbol}`, note: "Funding rights are enforced by the seeder contract (the log's creator)." };
  const ap = await approvals(w, [{ token: l.underlying, spender: C.logSeeder, amount: ua, label: "Chop log seeder" }, { token: l.paired, spender: C.logSeeder, amount: maxPaired, label: "Chop log seeder" }]);
  if (ap.length) return approvalPlan("seed", w, l, ap, summary);
  const shares = await read(l.address, LOG, "convertToShares", [ua]).catch(() => 0n);
  const firstIn = (ua * 10n ** BigInt(l.decimals) / 10n ** BigInt(l.underlying.decimals) * (DEN - BigInt(l.fees.bond))) / DEN;
  const minLog = minAfter(shares > 0n ? shares : firstIn, slip); const dl = deadline();
  const draft = await simulate(w, C.logSeeder, SEEDER, "seed", [l.address, ua, pairedPerToken, maxPaired, minLog, 1n, dl]);
  const args = [l.address, ua, pairedPerToken, maxPaired, minLog, minAfter(draft, slip), dl];
  await simulate(w, C.logSeeder, SEEDER, "seed", args);
  return readyPlan("seed", w, l, [tx("seed", summary.action, C.logSeeder, SEEDER, "seed", args)], summary);
}

// ------------------------------------------------------------------ arbitrage
async function gapFor(l) {
  if (!l.hasLiquidity || !l.backingPerLog) return null;
  const ext = await priceIn(l.underlying, l.paired).catch(() => null);
  if (!ext) return { log: l.address, symbol: l.symbol, error: `no external ${l.underlying.symbol}/${l.paired.symbol} price` };
  const logPrice = Number(formatUnits(l.reservePaired, l.paired.decimals)) / Number(formatUnits(l.reserveLog, l.decimals));
  const backing = Number(formatUnits(l.backingPerLog, l.underlying.decimals));
  const fair = backing * ext.price; const gap = (logPrice / fair - 1) * 100;
  const extFee = 0.3;
  const cheapHurdle = (l.fees.buy + l.fees.debond) / 100 + 0.3 + extFee;
  const richHurdle = (l.fees.bond + l.fees.sell) / 100 + 0.3 + extFee;
  const dir = gap < 0 ? "log-cheap" : "log-rich";
  const edge = gap < 0 ? -gap - cheapHurdle : gap - richHurdle;
  return {
    log: l.address, symbol: l.symbol, underlying: l.underlying.symbol, paired: l.paired.symbol,
    logPriceInPaired: logPrice, fairValueInPaired: fair, gapPct: pct(gap), direction: dir,
    roundTripCostPct: pct(gap < 0 ? cheapHurdle : richHurdle), estEdgeBeforeImpactPct: pct(edge), actionable: edge > 0,
    route: gap < 0 ? "buy log in its pool → unwrap → sell underlying on the market" : "buy underlying on the market → wrap → sell log in its pool",
    externalPrice: ext,
  };
}
async function cmdGaps(o) {
  const logs = o.log || o._[0] ? [await resolveLog(o)] : (await Promise.all((await registry()).filter((r) => r.makePublic).map((r) => getLog(r.index).catch(() => null)))).filter(Boolean);
  const gaps = [];
  for (const l of logs) { const g = await gapFor(l).catch((e) => ({ log: l.address, error: e.message })); if (g) gaps.push(g); }
  gaps.sort((a, b) => (b.estEdgeBeforeImpactPct ?? -1e9) - (a.estEdgeBeforeImpactPct ?? -1e9));
  return { ok: true, chainId: CHAIN_ID, gaps, note: "Spot mid prices for detection only. Size, price impact, gas and the external leg's real fee decide profit; always quote each leg before acting. External fee assumed 0.3%." };
}
// Arb legs only ever spend what the previous leg acquired: each follow-up leg is `arb --leg <name> --since <raw>`,
// which reads the wallet's balance now, subtracts the balance recorded in the plan, re-quotes the rest of the
// route and returns a plan for exactly that delta. Pre-existing balances are never touched.
const ARB_LEGS = { unwrap: "log", "swap-out": "underlying", wrap: "underlying", sell: "log" };
const ARB_TOLERANCE_BPS = 200n; // acquired amount may exceed the plan's expectation by at most 2% (price drift)

async function arbBalances(l, w) {
  const [log, underlying, paired] = await Promise.all([
    read(l.address, LOG, "balanceOf", [w]), read(l.underlying.address, ERC20, "balanceOf", [w]), read(l.paired.address, ERC20, "balanceOf", [w])]);
  return { log, underlying, paired };
}
function arbCmd(l, w, leg, since, size, expect) {
  return `node scripts/chop.mjs arb --log ${l.address} --leg ${leg} --since ${since} --size ${size} --expect ${expect} --raw-size --wallet ${w}`;
}

async function cmdArb(o) {
  const w = wallet(o); const l = await resolveLog(o); const g = await gapFor(l);
  if (!g || g.error) throw new ChopError(g?.error ?? "No liquidity to arbitrage.", "NO_PRICE");
  if (getAddress(l.underlying.address) === getAddress(l.paired.address)) throw new ChopError("Underlying and paired token are the same; leg deltas would be ambiguous.", "UNSUPPORTED_LOG");
  if (o["raw-size"] && !/^\d+$/.test(String(o.size))) throw new UsageError("--size must be raw units with --raw-size");
  const size = o["raw-size"] ? BigInt(o.size) : amount(o, l.paired.decimals, "size");
  if (size <= 0n) throw new ChopError("Arb size must be greater than zero.", "ZERO_AMOUNT");
  const pnl = (outPaired) => Number(formatUnits(outPaired, l.paired.decimals)) - Number(formatUnits(size, l.paired.decimals));
  const extOut = (uAmt) => parseUnits((Number(formatUnits(uAmt, l.underlying.decimals)) * g.externalPrice.price * 0.997).toFixed(Math.min(l.paired.decimals, 12)), l.paired.decimals);

  if (o.leg) return arbLeg(o, w, l, g, size, pnl, extOut);

  const bal = await arbBalances(l, w);
  const steps = []; let est;
  if (g.direction === "log-cheap") {
    const q = await quoteSwap(l, "buy", size);
    const assets = (await read(l.address, LOG, "convertToAssets", [q.out]) * (DEN - BigInt(l.fees.debond))) / DEN;
    est = pnl(extOut(assets));
    steps.push({ n: 1, kind: "chop", command: `node scripts/chop.mjs buy --log ${l.address} --amount ${fmt(size, l.paired.decimals)} --wallet ${w}`, expect: `${fmt(q.out, l.decimals)} ${l.symbol}` });
    steps.push({ n: 2, kind: "chop", command: arbCmd(l, w, "unwrap", bal.log, size, q.out), expect: `${fmt(assets, l.underlying.decimals)} ${l.underlying.symbol}`, note: "Unwraps only the log tokens step 1 bought." });
    steps.push({ n: 3, kind: "chop", command: arbCmd(l, w, "swap-out", bal.underlying, size, assets), note: "Returns the exact Bankr swap prompt for only the underlying step 2 returned." });
  } else {
    const underlyingIn = Number(formatUnits(size, l.paired.decimals)) / g.externalPrice.price * 0.997;
    const uRaw = parseUnits(underlyingIn.toFixed(Math.min(l.underlying.decimals, 12)), l.underlying.decimals);
    const minted = (await read(l.address, LOG, "convertToShares", [uRaw]) * (DEN - BigInt(l.fees.bond))) / DEN;
    const q = await quoteSwap(l, "sell", minted);
    est = pnl(q.out);
    steps.push({ n: 1, kind: "bankr-swap", prompt: `Swap ${fmt(size, l.paired.decimals)} ${l.paired.symbol} (${l.paired.address}) to ${l.underlying.symbol} (${l.underlying.address}) on Robinhood Chain`, expect: `${fmt(uRaw, l.underlying.decimals)} ${l.underlying.symbol}` });
    steps.push({ n: 2, kind: "chop", command: arbCmd(l, w, "wrap", bal.underlying, size, uRaw), expect: `${fmt(minted, l.decimals)} ${l.symbol}`, note: "Wraps only the underlying step 1 bought." });
    steps.push({ n: 3, kind: "chop", command: arbCmd(l, w, "sell", bal.log, size, minted), expect: `${fmt(q.out, l.paired.decimals)} ${l.paired.symbol}`, note: "Sells only the log tokens step 2 minted." });
  }
  return {
    ok: true, status: "plan", action: "arb", chainId: CHAIN_ID, wallet: w, gap: g, size: `${fmt(size, l.paired.decimals)} ${l.paired.symbol}`,
    baseline: { log: bal.log.toString(), underlying: bal.underlying.toString(), paired: bal.paired.toString() },
    estimatedPnl: `${est >= 0 ? "+" : ""}${est.toFixed(6)} ${l.paired.symbol} (before gas; external leg priced at spot minus 0.3%)`, profitable: est > 0, steps,
    next: est > 0 ? "Confirm with the user, then run the steps in order, each only after the previous one confirms. Steps 2 and 3 measure what the previous leg acquired and re-quote; stop if they return status abort." : "Not profitable at this size after fees. Do not execute.",
    warnings: ["Legs are separate transactions: prices can move between them.", "Never exceed the wallet's Bankr spend limits; the external leg is a normal Bankr swap.",
      "Never replace a step with --amount all: that would include tokens the wallet held before the arb."],
  };
}

async function arbLeg(o, w, l, g, size, pnl, extOut) {
  const leg = String(o.leg); const which = ARB_LEGS[leg];
  if (!which) throw new UsageError(`--leg must be one of ${Object.keys(ARB_LEGS).join(", ")}`);
  if (o.since === undefined || !/^\d+$/.test(String(o.since))) throw new UsageError("--since <raw balance from the plan> is required with --leg");
  if (o.expect === undefined || !/^\d+$/.test(String(o.expect))) throw new UsageError("--expect <raw amount from the plan> is required with --leg");
  const since = BigInt(o.since), expect = BigInt(o.expect);
  const t = which === "log" ? { address: l.address, symbol: l.symbol, decimals: l.decimals } : l.underlying;
  const now = await read(t.address, ERC20, "balanceOf", [w]);
  const acquired = now > since ? now - since : 0n;
  if (acquired === 0n) throw new ChopError(`No ${t.symbol} acquired since the plan (balance ${fmt(now, t.decimals)}, baseline ${fmt(since, t.decimals)}). Wait for the previous leg to confirm.`, "NOTHING_ACQUIRED");
  const cap = (expect * (DEN + ARB_TOLERANCE_BPS)) / DEN;
  const use = acquired > cap ? cap : acquired;
  const warnings = acquired > cap ? [`${fmt(acquired, t.decimals)} ${t.symbol} arrived since the plan, more than this leg expected; using only ${fmt(use, t.decimals)}. The rest is not part of the arb.`] : [];
  let out;
  if (leg === "unwrap") out = extOut((await read(l.address, LOG, "convertToAssets", [use]) * (DEN - BigInt(l.fees.debond))) / DEN);
  else if (leg === "swap-out") out = extOut(use);
  else if (leg === "wrap") out = (await quoteSwap(l, "sell", (await read(l.address, LOG, "convertToShares", [use]) * (DEN - BigInt(l.fees.bond))) / DEN)).out;
  else out = (await quoteSwap(l, "sell", use)).out;
  const est = pnl(out);
  const meta = { leg, token: t.symbol, baseline: since.toString(), balanceNow: now.toString(), acquired: acquired.toString(), using: use.toString(),
    reQuotedPnl: `${est >= 0 ? "+" : ""}${est.toFixed(6)} ${l.paired.symbol}`, profitable: est > 0 };
  if (est <= 0) return { ok: true, status: "abort", action: "arb", chainId: CHAIN_ID, wallet: w, arb: meta, warnings,
    next: `Re-quote is no longer profitable. Stop the arb. The wallet now holds the ${fmt(use, t.decimals)} ${t.symbol} from earlier legs; ask the user what to do with it.` };
  if (leg === "swap-out") return { ok: true, status: "ready", action: "arb", chainId: CHAIN_ID, wallet: w, arb: meta, warnings,
    steps: [{ kind: "bankr-swap", prompt: `Swap ${fmt(use, t.decimals)} ${t.symbol} (${t.address}) to ${l.paired.symbol} (${l.paired.address}) on Robinhood Chain` }],
    next: "Submit this exact Bankr swap. Do not round up or swap the whole balance." };
  const sub = { ...o, log: l.address, amount: use.toString(), raw: true, wallet: w };
  const plan = leg === "unwrap" ? await buildUnwrap(sub) : leg === "wrap" ? await buildWrap(sub) : await buildSwap(sub, "sell");
  return { ...plan, arb: meta, warnings: [...(plan.warnings ?? []), ...warnings],
    next: plan.status === "approval-required" ? `Submit the approval, then re-run this same arb --leg ${leg} command.` : plan.next };
}

// ------------------------------------------------------------------ main
const HELP = `chop.mjs: Chop logs on Robinhood Chain (4663). Reads and Bankr-ready transaction plans; never signs.
Reads:   logs [--yields] [--all] · log <log> · position [<log>] --wallet W · quote <wrap|unwrap|buy|sell|farm|farm-single> --log L --amount N
         gaps [--log L] · arb --log L --size N --wallet W (plan) · arb --leg unwrap|swap-out|wrap|sell --since RAW --expect RAW ...
Writes:  wrap · unwrap · buy · sell · farm · farm-single · unfarm [--to both|paired|log] · stake · unstake · claim [--log L | --all]
         process-fees · update-oracle · wrap-eth · unwrap-eth · launch --token T --paired CHOP|WETH|USDG --amount N --paired-amount M · create · seed
Common:  --log <address|chSYMBOL|SYMBOL> [--paired X] · --wallet 0x… (or BANKR_WALLET_ADDRESS) · --amount N|all [--raw] · --slippage-bps N · --rpc URL`;
const CMDS = {
  logs: cmdLogs, log: cmdLog, position: cmdPosition, quote: cmdQuote, gaps: cmdGaps, arb: cmdArb,
  wrap: buildWrap, unwrap: buildUnwrap, buy: (o) => buildSwap(o, "buy"), sell: (o) => buildSwap(o, "sell"),
  farm: buildFarm, "farm-single": buildFarmSingle, unfarm: buildUnfarm, stake: buildStake, unstake: buildUnstake,
  claim: buildClaim, harvest: buildClaim, "process-fees": buildProcessFees, "update-oracle": buildUpdateOracle, "wrap-eth": (o) => buildWrapEth(o), "unwrap-eth": (o) => buildWrapEth(o, true),
  launch: buildLaunch, create: buildCreate, seed: buildSeed,
};
export { CMDS, launchArgs, makeClient, feeSetOf, minAfter };

async function main() {
  const { cmd, o } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help" || cmd === "--help") { process.stdout.write(HELP + "\n"); return 0; }
  const fn = CMDS[cmd];
  if (!fn) { out({ ok: false, code: "USAGE", error: `unknown command ${cmd}`, help: HELP }); return 2; }
  await makeClient(o);
  const id = await client.getChainId();
  if (id !== CHAIN_ID) throw new ChopError(`RPC is on chain ${id}, expected Robinhood Chain 4663.`, "WRONG_CHAIN");
  const head = await client.getBlock().catch(() => null);
  if (head) CHAIN_NOW = Math.max(Number(head.timestamp), Math.floor(Date.now() / 1000));
  out(await fn(o)); return 0;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().then((c) => process.exit(c)).catch((e) => {
    if (e instanceof UsageError) { out({ ok: false, code: "USAGE", error: e.message }); process.exit(2); }
    out({ ok: false, code: e.code || "ERROR", error: e instanceof BaseError ? e.shortMessage : e.message, ...(e.extra || {}) }); process.exit(1);
  });
}
