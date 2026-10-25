#!/usr/bin/env node
// Read-only validation of this skill's contract data against Base mainnet.
//   1. every address in known-contracts.json has code
//   2. every pool id equals keccak256(abi.encode(poolKey))
//   3. every write selector the skill builds is present in the target's code
//      (the proxy's implementation, its facets / rule modules, or, for curves
//      created later, the factory that deploys them)
//   4. a battery of view calls decodes against the live contracts
// Only eth_getCode / eth_getStorageAt / eth_call. Never sends anything.
// Usage: node check-contracts.mjs [--rpc https://base-rpc.publicnode.com]
import { createPublicClient, http, encodeAbiParameters, keccak256, toFunctionSelector, getAddress, zeroAddress, parseAbiParameters } from 'viem';
import { base } from 'viem/chains';
import * as A from './lib/abis.mjs';
import { K } from './lib/contracts.mjs';

const rpcArg = process.argv.indexOf('--rpc');
const RPC = rpcArg > 0 ? process.argv[rpcArg + 1] : (process.env.FLASH_RPC_URL || 'https://base-rpc.publicnode.com');
const client = createPublicClient({ chain: base, transport: http(RPC, { retryCount: 3, timeout: 30_000 }), batch: { multicall: false } });

const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';
const BEACON_SLOT = '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50';
const results = { codeMissing: [], poolIdMismatch: [], selectorMissing: [], viewFailed: [], ok: { code: 0, poolIds: 0, selectors: 0, views: 0 } };

function collectAddresses(node, path = [], out = new Map()) {
  if (typeof node === 'string' && /^0x[0-9a-fA-F]{40}$/.test(node)) out.set(getAddress(node), path.join('.'));
  else if (Array.isArray(node)) node.forEach((entry, index) => collectAddresses(entry, [...path, index], out));
  else if (node && typeof node === 'object') for (const [key, value] of Object.entries(node)) collectAddresses(value, [...path, key], out);
  return out;
}

const codeCache = new Map();
async function code(address) {
  const key = address.toLowerCase();
  if (!codeCache.has(key)) codeCache.set(key, (await client.getCode({ address })) || '0x');
  return codeCache.get(key);
}
async function slotAddress(address, slot) {
  const raw = await client.getStorageAt({ address, slot });
  if (!raw || /^0x0*$/.test(raw)) return undefined;
  return getAddress(`0x${raw.slice(-40)}`);
}
/** The bytecode an address dispatches into: itself, its ERC-1967 implementation or beacon implementation. */
async function codeChain(address, extra = []) {
  const chain = [address, ...extra];
  const impl = await slotAddress(address, IMPL_SLOT);
  if (impl) chain.push(impl);
  const beacon = await slotAddress(address, BEACON_SLOT);
  if (beacon) {
    const beaconImpl = await client.readContract({ address: beacon, abi: [{ type: 'function', name: 'implementation', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' }], functionName: 'implementation' }).catch(() => undefined);
    if (beaconImpl) chain.push(beaconImpl);
  }
  return Promise.all(chain.map(code));
}

// 1. code at every address (native ETH sentinel excluded)
const addresses = collectAddresses(K);
for (const [address, path] of addresses) {
  if (address === zeroAddress) continue;
  const bytecode = await code(address);
  if (bytecode === '0x') results.codeMissing.push(`${path} ${address}`);
  else results.ok.code += 1;
}

// 2. pool ids
const keyType = parseAbiParameters('(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)');
const poolId = (key) => keccak256(encodeAbiParameters(keyType, [key]));
for (const [name, pool] of Object.entries(K.pools)) {
  if (!pool.id) continue;
  if (poolId(pool.key).toLowerCase() === pool.id.toLowerCase()) results.ok.poolIds += 1;
  else results.poolIdMismatch.push(name);
}
for (const market of [...K.perpMarkets.live, ...K.perpMarkets.exitOnly]) {
  const key = { currency0: K.tokens.USDC.address, currency1: market.token, fee: 0x800000, tickSpacing: 1, hooks: K.perps.hook };
  if (poolId(key).toLowerCase() === market.poolId.toLowerCase()) results.ok.poolIds += 1;
  else results.poolIdMismatch.push(market.symbol);
}

// 3. write selectors in the dispatch chain
/** solc pushes a selector with PUSH4, or a shorter PUSH when it has leading zero bytes. */
function hasSelector(bytecode, selector) {
  let hex = selector;
  while (hex.startsWith('00') && hex.length > 2) hex = hex.slice(2);
  const op = (0x5f + hex.length / 2).toString(16);
  return bytecode.toLowerCase().includes(op + hex);
}
const churnFacets = ['0xA70AeeD6Fee9278A79bE0C907e2c84664De47FEb', '0x492ec88d03A1733ECe5e570D02e9c96755971Ef7', '0xcC56F6b82cf5375d0a70Df502A22fb7d57a45d42', '0x292c099f92ea7353F58087f2252d6Fa054cBa696', '0x83FCB6f9FB8a50C319D098086b088F69441ccB7B', '0xe9cB60467c963Ca9b75aFc097BaC5140F2896D0c', '0xbd5868c49536B47b66cc3F7BDbd7AbB0f6E37027', '0xd91FC9129ef370a3Ae68E64babaC98Cb22F7968D', '0x831EdbD3d6a787005F29c728e08B20bd806d02a0', '0xD7dEbA4632B73BEf6064d834Da2A1430Ccdb46a8', '0x4B588a57219927f0704847c928aA6eD848097d7a'];
const warModules = ['0x779c45515420AC8D38bE67Aa019382D1977A4d0B', '0xD183Aeb06Dc6dfa5a4c6E04672a6c4DDE1843eFe'];
const writes = [
  [K.uniswap.universalRouter, A.universalRouter, ['execute'], []],
  [K.uniswap.permit2, A.permit2, ['approve'], []],
  [K.referralCoin.registry, A.rcRegistry, ['bind', 'bindWithSig', 'claim', 'distributeTop100'], []],
  [K.referralCoin.koth, A.rcKoth, ['settle'], []],
  [K.flashV3.ledger, A.v3Ledger, ['sweep'], []],
  [K.perps.issuer, A.perpsIssuer, ['unwind'], []],
  [K.perps.limitOrders, A.perpOrders, ['place', 'placePair', 'update', 'cancel'], []],
  [K.churn.core, A.churn, ['deposit', 'withdraw', 'claim', 'depositLevel', 'depositLevels', 'withdrawLevel', 'claimLevels', 'openLattice', 'withdrawLattice', 'withdrawLatticeAmount', 'reformatLattice', 'transferLattice'], churnFacets],
  [K.launchV5.launchpad, A.launchpad, ['createLaunchShaped', 'createLaunchQuoted', 'finalize'], []],
  [K.launchV5.routerQ, A.launchRouter, ['createWithEth', 'createWithEthQuoted', 'buyWithEth'], []],
  // curves are deployed per launch by the factory: their runtime code is embedded in the factory
  [K.launchV5.tokenWar, A.tokenWar, ['registerCandidatePaired', 'buy', 'sell', 'jump', 'openWar', 'finalize', 'claim', 'claimCreatorFees', 'refundAborted'], warModules],
  [K.launchV5.warRouter, A.warRouter, ['submitWithEth', 'submitWithToken', 'backWithEth', 'backWithToken'], []],
  [K.revenueShare.v3, A.revenueShareV3, ['deposit', 'claim', 'withdraw', 'flush', 'harvest', 'flashLoan'], []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, ['withdraw', 'claimQuoteRewards', 'claimRewards', 'claimTokenRewards'], []],
];
const curveCode = await client.readContract({ address: K.launchV5.curveFactory, abi: [{ type: 'function', name: 'creationCode', inputs: [], outputs: [{ type: 'bytes' }], stateMutability: 'view' }], functionName: 'creationCode' });
for (const name of ['buy', 'sell', 'poke', 'claim', 'airdrop', 'refundAborted', 'claimCreatorFees', 'quoteBuy', 'quoteSell', 'claimableTokensOf', 'creatorFeesOwed', 'phase']) {
  const item = A.curve.find((entry) => entry.type === 'function' && entry.name === name);
  const selector = toFunctionSelector(item).slice(2).toLowerCase();
  if (hasSelector(curveCode, selector)) results.ok.selectors += 1;
  else results.selectorMissing.push(`curve.${name} 0x${selector} (factory creationCode)`);
}
// Tokens whose code sits behind a non-ERC-1967 proxy (USDC) or a B20 shim: prove approve by simulation.
for (const token of [K.tokens.FLASH.address, K.tokens.USDC.address, K.tokens.QUANT.address, K.perpMarkets.live[0].token, K.stocks.list[0].address]) {
  try {
    await client.simulateContract({ account: K.owner.treasury, address: token, abi: A.erc20, functionName: 'approve', args: [K.uniswap.permit2, 1n] });
    results.ok.selectors += 1;
  } catch (error) {
    results.selectorMissing.push(`approve simulation @ ${token}: ${(error.shortMessage || error.message).split('\n')[0]}`);
  }
}
for (const [address, abi, names, extra] of writes) {
  const codes = await codeChain(address, extra);
  for (const name of names) {
    const item = abi.find((entry) => entry.type === 'function' && entry.name === name);
    const selector = toFunctionSelector(item).slice(2).toLowerCase();
    const found = codes.some((bytecode) => hasSelector(bytecode, selector));
    if (found) results.ok.selectors += 1;
    else results.selectorMissing.push(`${name} 0x${selector} @ ${address}`);
  }
}

// 4. view battery
const who = K.owner.treasury;
const F = K.pools['FLASH/ETH'];
const Q = K.pools['QUANT/FLASH'];
const m6 = K.perpMarkets.live[0];
const views = [
  [K.referralCoin.hook, A.rcHook, 'BIND_MAGIC', []],
  [K.referralCoin.hook, A.rcHook, 'poolState', []],
  [K.referralCoin.policy, A.rcPolicy, 'gasFloor', []],
  [K.referralCoin.policy, A.rcPolicy, 'FEE_REFERRED_BPS', []],
  [K.referralCoin.policy, A.rcPolicy, 'FEE_UNREFERRED_BPS', []],
  [K.referralCoin.policy, A.rcPolicy, 'MAX_TOTAL_BPS', []],
  [K.referralCoin.policy, A.rcPolicy, 'quoteSellTax', [10n ** 18n, true]],
  [K.referralCoin.registry, A.rcRegistry, 'bindingOf', [who]],
  [K.referralCoin.registry, A.rcRegistry, 'codeOf', [who]],
  [K.referralCoin.registry, A.rcRegistry, 'ownerOfCode', [1n]],
  [K.referralCoin.registry, A.rcRegistry, 'codeThreshold', []],
  [K.referralCoin.registry, A.rcRegistry, 'codesIssued', []],
  [K.referralCoin.registry, A.rcRegistry, 'previewClaim', [who]],
  [K.referralCoin.registry, A.rcRegistry, 'top100Sorted', []],
  [K.referralCoin.registry, A.rcRegistry, 'sortedRankOf', [who]],
  [K.referralCoin.registry, A.rcRegistry, 'bindNonce', [who]],
  [K.referralCoin.registry, A.rcRegistry, 'airdropThreshold', []],
  [K.referralCoin.koth, A.rcKoth, 'game', []],
  [K.referralCoin.koth, A.rcKoth, 'nextTrigger', []],
  [K.referralCoin.koth, A.rcKoth, 'totals', []],
  [K.flashV3.hook, A.v3Hook, 'poolState', [Q.key]],
  [K.flashV3.hook, A.v3Hook, 'poolInfoOf', [Q.id]],
  [K.flashV3.registry, A.v3Registry, 'poolOfToken', [K.tokens.QUANT.address]],
  [K.perps.issuer, A.perpsIssuer, 'navPerToken', [6n]],
  [K.perps.issuer, A.perpsIssuer, 'buyCapacityUsdc', [6n]],
  [K.perps.issuer, A.perpsIssuer, 'positionOf', [6n, who]],
  [K.perps.issuer, A.perpsIssuer, 'quantMinted', []],
  [K.perps.issuer, A.perpsIssuer, 'memeRoutes', [Q.id]],
  [K.perps.hook, A.perpsHook, 'pools', [m6.poolId]],
  [K.perps.limitOrders, A.perpOrders, 'minOrderUsdc', []],
  [K.perps.limitOrders, A.perpOrders, 'paused', []],
  [K.perps.limitOrders, A.perpOrders, 'takeProfitOut', [10n ** 18n, 1_000_000n]],
  [K.perps.lens, A.perpsLens, 'globalKpi', []],
  [K.perps.lens, A.perpsLens, 'quantRateNow', []],
  [K.perps.lens, A.perpsLens, 'previewQuant', [100_000_000n]],
  [K.perps.lens, A.perpsLens, 'accountKpi', [who]],
  [K.perps.lens, A.perpsLens, 'marketKpi', [6n]],
  [K.churn.core, A.churn, 'marketAccounting', [K.churn.markets['FLASH/ETH']]],
  [K.churn.core, A.churn, 'marketConfig', [K.churn.markets['FLASH/ETH']]],
  [K.churn.core, A.churn, 'levelConfig', [K.churn.markets['FLASH/ETH']]],
  [K.churn.core, A.churn, 'levels', [K.churn.markets['FLASH/ETH'], -887272, 8n]],
  [K.churn.core, A.churn, 'positions', [K.churn.markets['QUANT/FLASH'], who, 0]],
  [K.churn.core, A.churn, 'latticesOf', [K.churn.markets['QUANT/FLASH']]],
  [K.churn.core, A.churn, 'isLatticeOpener', [who]],
  [K.launchV5.launchpad, A.launchpad, 'launchesLength', []],
  [K.launchV5.launchpad, A.launchpad, 'currentCreationFee', []],
  [K.launchV5.routerQ, A.launchRouter, 'currentCreationFee', []],
  [K.launchV5.shapes, A.shapes, 'mode', [0]],
  [K.launchV5.shapes, A.shapes, 'preset', [0]],
  [K.launchV5.config, A.launchConfig, 'quoteRouteOf', [K.stocks.list[0].address]],
  [K.launchV5.executorQ, A.launchExecutor, 'poolKeyForQuote', [K.tokens.QUANT.address, K.tokens.FLASH.address]],
  [K.launchV5.tokenWar, A.tokenWar, 'currentWarId', []],
  [K.launchV5.tokenWar, A.tokenWar, 'currentEntryFee', []],
  [K.launchV5.tokenWar, A.tokenWar, 'warState', [1n]],
  [K.launchV5.tokenWar, A.tokenWar, 'candidatesPage', [1n, 0n, 5n]],
  [K.launchV5.tokenWar, A.tokenWar, 'candidatePairOf', [1n, 1n]],
  [K.launchV5.tokenWar, A.tokenWar, 'goalNow', []],
  [K.launchV5.tokenWar, A.tokenWar, 'unitsOf', [1n, 1n, who]],
  [K.launchV5.tokenWar, A.tokenWar, 'hasClaimed', [1n, who]],
  [K.launchV5.tokenWar, A.tokenWar, 'creatorFeesOf', [1n, who]],
  [K.launchV5.tokenWar, A.tokenWar, 'quoteBuyV5', [1n, 10n ** 18n]],
  [K.launchV5.tokenWar, A.tokenWar, 'quoteUnits', [1n, 10n ** 18n]],
  [K.launchV5.tokenWar, A.tokenWar, 'quoteSell', [who, 1n, 1n]],
  [K.launchV5.tokenWar, A.tokenWar, 'quoteJump', [who, 1n, 2n, 1n]],
  [K.launchV5.warRouter, A.warRouter, 'currentEntryFee', []],
  [K.treasuryV3.factory, A.treasuryFactory, 'predictTreasury', [K.tokens.QUANT.address]],
  [K.treasuryV3.factory, A.treasuryFactory, 'isTreasury', [K.treasuryV3.quantTreasury]],
  [K.treasuryV3.quantTreasury, A.treasury, 'token', []],
  [K.treasuryV3.quantTreasury, A.treasury, 'rewardAsset', []],
  [K.treasuryV3.quantTreasury, A.treasury, 'controller', []],
  [K.revenueShare.v3, A.revenueShareV3, 'flash', []],
  [K.revenueShare.v3, A.revenueShareV3, 'weth', []],
  [K.revenueShare.v3, A.revenueShareV3, 'churn', []],
  [K.revenueShare.v3, A.revenueShareV3, 'marketId', []],
  [K.revenueShare.v3, A.revenueShareV3, 'owner', []],
  [K.revenueShare.v3, A.revenueShareV3, 'MIN_DEPOSIT', []],
  [K.revenueShare.v3, A.revenueShareV3, 'totals', []],
  [K.revenueShare.v3, A.revenueShareV3, 'accountOf', [who]],
  [K.revenueShare.v3, A.revenueShareV3, 'pendingEth', [who]],
  [K.revenueShare.v3, A.revenueShareV3, 'flashOf', [who]],
  [K.revenueShare.v3, A.revenueShareV3, 'previewDeposit', [10n ** 18n]],
  [K.revenueShare.v3, A.revenueShareV3, 'version', []],
  [K.revenueShare.v3, A.revenueShareV3, 'revenue', []],
  [K.revenueShare.v3, A.revenueShareV3, 'flashFeeBps', []],
  [K.revenueShare.v3, A.revenueShareV3, 'flashFee', [10n ** 18n]],
  [K.revenueShare.v3, A.revenueShareV3, 'maxFlashLoan', [K.tokens.FLASH.address]],
  [K.revenueShare.v3, A.revenueShareV3, 'availableLiquidity', []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'token', []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'quoteToken', []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'totalAssets', []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'totalShares', []],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'sharesOf', [who]],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'claimableQuoteRewards', [who]],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'claimableRewards', [who]],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'claimableTokenRewards', [who]],
  [K.revenueShare.retired.flashPoolStaking, A.revenueShareRetired, 'convertToAssets', [10n ** 18n]],
  [K.uniswap.v4Quoter, A.v4Quoter, 'quoteExactInputSingle', [{ poolKey: F.key, zeroForOne: true, exactAmount: 10n ** 15n, hookData: '0x' }], true],
];
const json = (value) => JSON.stringify(value, (_key, entry) => (typeof entry === 'bigint' ? entry.toString() : entry));
const samples = {};
for (const [address, abi, functionName, args, simulate] of views) {
  try {
    const result = simulate
      ? (await client.simulateContract({ address, abi, functionName, args, gas: 12_000_000n })).result
      : await client.readContract({ address, abi, functionName, args });
    results.ok.views += 1;
    samples[`${functionName}@${address.slice(0, 8)}`] = json(result).slice(0, 160);
  } catch (error) {
    results.viewFailed.push(`${functionName} @ ${address}: ${(error.shortMessage || error.message).split('\n')[0]}`);
  }
}

const failed = results.codeMissing.length + results.poolIdMismatch.length + results.selectorMissing.length + results.viewFailed.length;
console.log(JSON.stringify({ ok: failed === 0, rpc: RPC, block: (await client.getBlockNumber()).toString(), ...results, samples }, null, 2));
process.exit(failed === 0 ? 0 : 1);
