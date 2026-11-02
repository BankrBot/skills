// launch-v5 bonding-curve launches and Token Wars V6. Mirrors app/src/lv5.ts
// and v2/TokensPage.tsx / v2/WarsV5Page.tsx. Curve and war calls are NOT
// constant-gas (first buy ~526k, repeat ~164k, a locking buy auto-graduates at
// ~9.5M behind a gasleft() guard), so plans carry eth_estimateGas x1.2.
import { getAddress, parseUnits, zeroAddress } from 'viem';
import * as A from './abis.mjs';
import { K, NATIVE, DEFAULT_SLIPPAGE_BPS } from './contracts.mjs';
import { RC_POOL, launchShape, slippageLimit } from './encode.mjs';
import { client, call, approval, simulate, estimate, plan, fmt, api } from './plan.mjs';
import { quoteSingle } from './trade.mjs';

const L = K.launchV5;
const PAIRS = { ETH: 0, FLASH: 1, SUB: 1, STOCK: 2, PERP: 3 };
export const PAIR_NAMES = ['ETH', 'FLASH', 'STOCK', 'PERP'];
export const CURVE_PHASES = ['PENDING', 'TRADING', 'READY', 'GRADUATED', 'ABORTED'];
const WAR_PHASES = ['IDLE', 'TRADING', 'READY', 'LAUNCHED', 'ABORTED'];
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
export const wallet = (options) => {
  if (!options.wallet) throw new Error('--wallet is required');
  return getAddress(options.wallet);
};
export const slip = (options) => Number(options['slippage-bps'] ?? DEFAULT_SLIPPAGE_BPS);

export async function finish(account, action, summary, transactions, warnings = [], notes = []) {
  const simulation = await simulate(account, transactions);
  const last = transactions[transactions.length - 1];
  if (transactions.length === 1 && simulation.ok) {
    const gas = await estimate(account, last);
    if (gas) last.gas = (gas * 12n) / 10n > 16_777_216n ? 16_777_216n : (gas * 12n) / 10n;
  }
  return plan({ action, summary, transactions, simulation, warnings, notes });
}

/** FLASH the ETH leg delivers at least: an unattributed RC quote (6.9% fee) minus slippage; the router's vault is referred, so it gets more. */
export async function minFlashForEth(ethIn, bps) {
  const flash = await quoteSingle(RC_POOL, true, 'exactIn', ethIn);
  return { flash, minFlash: slippageLimit('exactIn', flash, bps) };
}

export function validateName(options) {
  const name = String(options.name || '').trim();
  const symbol = String(options.symbol || '').trim().toUpperCase();
  if (!name) throw new Error('--name is required');
  if (Buffer.byteLength(name, 'utf8') > 32) throw new Error('--name must be at most 32 bytes');
  if (!/^[A-Z0-9]{2,10}$/.test(symbol) || symbol === 'FLASH') throw new Error('--symbol must be 2-10 letters or digits, and not FLASH');
  return { name, symbol };
}

/** --pair ETH|FLASH|STOCK|PERP and, for STOCK / PERP, --quote <symbol|address>. */
export async function resolvePair(options) {
  const pairName = String(options.pair || 'ETH').toUpperCase();
  const pair = PAIRS[pairName];
  if (pair === undefined) throw new Error('--pair must be ETH, FLASH, STOCK or PERP');
  if (pair < 2) return { pair, quote: zeroAddress, quoteSymbol: pair === 0 ? 'WETH' : 'FLASH' };
  if (!options.quote) throw new Error(`--quote is required for a ${pairName} pair`);
  const want = String(options.quote).toLowerCase();
  if (pair === 2) {
    const stock = K.stocks.list.find((entry) => entry.symbol.toLowerCase() === want || entry.address.toLowerCase() === want);
    if (!stock) throw new Error(`Unknown stock quote. Use one of ${K.stocks.list.map((entry) => entry.symbol).join(', ')}`);
    const route = await read(L.config, A.launchConfig, 'quoteRouteOf', [stock.address]);
    if (route.pool === zeroAddress) throw new Error(`${stock.symbol} has no graduation route set (config.quoteRouteOf): it cannot graduate`);
    return { pair, quote: stock.address, quoteSymbol: stock.symbol };
  }
  const perp = K.perpMarkets.live.find((entry) => entry.symbol.toLowerCase() === want || entry.token.toLowerCase() === want);
  if (!perp) throw new Error(`Perp quotes are the live markets only: ${K.perpMarkets.live.map((entry) => entry.symbol).join(', ')}`);
  return { pair, quote: perp.token, quoteSymbol: perp.symbol };
}

// Registry ids (the launch form's labels). Unset = launchpad.defaultShape(), which is what the form starts on.
const MODE_NAMES = ['Medium', 'Degen', 'Deep'];
const PRESET_NAMES = ['Long-term', 'Fast burn', 'Soft'];

function shapeId(value, names, flag) {
  const text = String(value).toLowerCase().replace(/[\s_-]/g, '');
  const id = /^\d+$/.test(text) ? Number(text) : names.findIndex((name) => name.toLowerCase().replace(/\s/g, '') === text);
  if (!names[id]) throw new Error(`--${flag} must be one of: ${names.map((name, index) => `${index} ${name}`).join(', ')}`);
  return id;
}

export async function shapeOf(options, pair, quote) {
  const [defaultMode, defaultPreset] = await read(L.launchpad, A.launchpad, 'defaultShape');
  const mode = options.mode === undefined ? defaultMode : shapeId(options.mode, MODE_NAMES, 'mode');
  const preset = options.preset === undefined ? defaultPreset : shapeId(options.preset, PRESET_NAMES, 'preset');
  let reward = options.reward ? getAddress(options.reward) : zeroAddress;
  const pairDefault = pair === 0 ? K.tokens.WETH.address : pair === 1 ? K.tokens.FLASH.address : quote;
  if (reward.toLowerCase() === pairDefault.toLowerCase()) reward = zeroAddress;
  return { mode, preset, rewardAsset: reward, isDefault: mode === defaultMode && preset === defaultPreset, label: `${MODE_NAMES[mode]} + ${PRESET_NAMES[preset]}` };
}

/** Every liquidity depth and holder reward curve a launch can pick, read live from the registry. */
export async function launchShapes() {
  const pct = (bps) => bps / 100;
  const ids = MODE_NAMES.map((_, id) => id);
  const [[defaultMode, defaultPreset], modes, presets] = await Promise.all([
    read(L.launchpad, A.launchpad, 'defaultShape'),
    Promise.all(ids.map((id) => read(L.shapes, A.shapes, 'mode', [id]))),
    Promise.all(ids.map((id) => read(L.shapes, A.shapes, 'preset', [id]))),
  ]);
  return {
    ok: true, status: 'info', action: 'launch-shapes', registry: L.shapes,
    default: { mode: defaultMode, preset: defaultPreset, label: `${MODE_NAMES[defaultMode]} + ${PRESET_NAMES[defaultPreset]}` },
    modes: modes.map(([split, , enabled], id) => ({ id, name: MODE_NAMES[id], enabled, participantsPct: pct(split.participantBps), liquidityPct: pct(split.liquidityBps), creatorPct: pct(split.creatorChurnBps), protocolPct: pct(split.protocolChurnBps) })),
    presets: presets.map(([shape, stockpileBps, , enabled], id) => {
      const bins = shape.segments.slice(0, shape.count).reduce((sum, segment) => sum + segment.bins, 0);
      const multiple = (delta) => Number((1.0001 ** (delta * shape.widthTicks)).toPrecision(3));
      return { id, name: PRESET_NAMES[id], enabled, stockpilePct: pct(stockpileBps), bins, lowX: multiple(-shape.binsBelowLaunch), highX: multiple(bins - shape.binsBelowLaunch) };
    }),
  };
}

// ------------------------------------------------------------------ launches

export async function launchList() {
  const data = await api('/v1/stack/launches').catch(() => undefined);
  const length = await read(L.launchpad, A.launchpad, 'launchesLength');
  return { ok: true, status: 'info', action: 'launch-list', onChainCount: length.toString(), creationFeeFlash: fmt(await read(L.launchpad, A.launchpad, 'currentCreationFee')), api: data };
}

async function launchRecord(tokenText) {
  if (!tokenText) throw new Error('--token is required');
  const token = getAddress(tokenText);
  const record = await read(L.launchpad, A.launchpad, 'launchOf', [token]);
  if (record.curve === zeroAddress) throw new Error(`${token} has no bonding curve. Timed launch: timed-info --token ${token}. After launch or Skip graduation: swap --market ${token}. Creator income: launch-earnings --token ${token}`);
  return { token, record };
}

export async function launchInfo(options) {
  const { token, record } = await launchRecord(options.token);
  const c = record.curve;
  const [phase, spot, raised, goal, fees, sold] = await Promise.all([read(c, A.curve, 'phase'), read(c, A.curve, 'spotPrice'), read(c, A.curve, 'principalRaised'), read(c, A.curve, 'goalFlashNow'), read(c, A.curve, 'currentFeeBps'), read(c, A.curve, 'tokensSold')]);
  const out = {
    ok: true, status: 'info', action: 'launch-info', token, curve: c, name: record.name, symbol: record.symbol, creator: record.creator,
    pair: PAIR_NAMES[record.pair], quote: record.quote, phase: CURVE_PHASES[phase], spotPriceFlash: fmt(spot), raisedFlash: fmt(raised), goalFlash: fmt(goal),
    progressPct: goal ? Number((raised * 10_000n) / goal) / 100 : 0, buyFeeBps: Number(fees[0]), sellFeeBps: Number(fees[1]), tokensSold: fmt(sold), poolId: record.poolId,
    treasury: await read(K.treasuryV3.factory, A.treasuryFactory, 'predictTreasury', [token]),
  };
  if (options.wallet) {
    const account = getAddress(options.wallet);
    out.position = { claimableTokens: fmt(await read(c, A.curve, 'claimableTokensOf', [account])) };
    if (record.creator.toLowerCase() === account.toLowerCase()) out.position.creatorFeesFlash = fmt(await read(c, A.curve, 'creatorFeesOwed'));
  }
  return out;
}

export async function launchCreate(options) {
  const account = wallet(options);
  const input = { ...validateName(options) };
  const { pair, quote, quoteSymbol } = await resolvePair(options);
  const shape = await shapeOf(options, pair, quote);
  const shaped = !shape.isDefault || shape.rewardAsset !== zeroAddress;
  const warnings = [
    'Launches are permanent and public. Save the signed token profile with art before this transaction (LAUNCHES.md): the token takes its art from it.',
  ];
  if (pair === 0 || pair >= 2) warnings.push('ETH / STOCK / PERP launches graduate by selling backing through the FLASH/ETH pool; graduation waits until that pool has enough ETH depth.');
  if (!shaped) {
    if (!options.eth) throw new Error('--eth <amount> is required: the router converts it to FLASH, pays the creation fee and spends the rest as your first buy');
    const ethIn = parseUnits(String(options.eth), 18);
    const fee = await read(L.routerQ, A.launchRouter, 'currentCreationFee');
    const { flash, minFlash } = await minFlashForEth(ethIn, slip(options));
    if (minFlash <= fee) throw new Error(`--eth too small: it must buy more than the ${fmt(fee)} FLASH creation fee (it buys ~${fmt(flash)} FLASH)`);
    const tx = pair >= 2
      ? call({ to: L.routerQ, abi: A.launchRouter, functionName: 'createWithEthQuoted', args: [{ ...input, pair }, quote, minFlash, 0n, account], value: ethIn, description: `Launch ${input.symbol} (${PAIR_NAMES[pair]} pair, quote ${quoteSymbol}) with a first buy` })
      : call({ to: L.routerQ, abi: A.launchRouter, functionName: 'createWithEth', args: [{ ...input, pair }, minFlash, 0n, account], value: ethIn, description: `Launch ${input.symbol} (${PAIR_NAMES[pair]} pair) with a first buy` });
    return finish(account, 'launch-create', { ...input, pair: PAIR_NAMES[pair], quote: quoteSymbol, ethIn: fmt(ethIn), creationFeeFlash: fmt(fee), minFlashFromEth: fmt(minFlash), shape: shape.label, rewardAsset: 'pair default' }, [tx], warnings,
      ['The new token and curve addresses are in the launchpad LaunchCreated(token, curve, creator, pair, goalFlash0, flashUsd18) event of the receipt.']);
  }
  // A shaped launch (mode / preset / reward asset) goes straight to the launchpad, paying the fee in FLASH; no first buy.
  if (options.eth) warnings.push(`--eth ${options.eth} is not spent here: a shaped launch has no first buy. After this confirms, run launch-buy --token <new token> --eth ${options.eth}.`);
  const fee = await read(L.launchpad, A.launchpad, 'currentCreationFee');
  const budget = slippageLimit('exactOut', fee, 1_000); // +10% for the live FLASH price moving
  const flashBalance = await read(K.tokens.FLASH.address, A.erc20, 'balanceOf', [account]);
  if (flashBalance < fee) throw new Error(`A shaped launch pays the ${fmt(fee)} FLASH fee from the wallet; it holds ${fmt(flashBalance)} FLASH. Buy FLASH first (swap --market FLASH --side buy).`);
  const create = pair >= 2
    ? call({ to: L.launchpad, abi: A.launchpad, functionName: 'createLaunchQuoted', args: [{ ...input, pair }, quote, launchShape(shape)], description: `Launch ${input.symbol} (shaped, ${PAIR_NAMES[pair]} pair, quote ${quoteSymbol})` })
    : call({ to: L.launchpad, abi: A.launchpad, functionName: 'createLaunchShaped', args: [{ ...input, pair }, launchShape(shape)], description: `Launch ${input.symbol} (shaped, ${PAIR_NAMES[pair]} pair)` });
  return finish(account, 'launch-create', { ...input, pair: PAIR_NAMES[pair], quote: quoteSymbol, shape: shape.label, mode: shape.mode, preset: shape.preset, rewardAsset: shape.rewardAsset === zeroAddress ? 'pair default' : shape.rewardAsset, creationFeeFlash: fmt(fee) },
    [...await approval(account, K.tokens.FLASH.address, L.launchpad, budget > flashBalance ? flashBalance : budget, 'FLASH', 'the launchpad'), create], warnings,
    ['Make the first buy afterwards with launch-buy --token <new token> (the address is in the LaunchCreated event).']);
}

// Skip graduation (FlashDirectLaunchV5): no curve, one transaction. Mirrors app/src/directLaunch.ts: the payment is
// the fee part (ETH / USDC buy the FLASH fee with a 30% margin, the spare comes back) plus the first buy.
const DIRECT_PAY = { ETH: { decimals: 18 }, USDC: { address: K.tokens.USDC.address, decimals: 6 }, FLASH: { address: K.tokens.FLASH.address, decimals: 18 } };

export async function launchDirect(options) {
  const account = wallet(options);
  const input = validateName(options);
  const { pair, quote, quoteSymbol } = await resolvePair(options);
  const shape = await shapeOf(options, pair, quote);
  if (pair >= 2 && shape.rewardAsset !== zeroAddress) throw new Error('--reward only applies to ETH and FLASH pairs: a STOCK or PERP launch earns in its quote');
  const pay = String(options.pay || 'ETH').toUpperCase();
  const meta = DIRECT_PAY[pay];
  if (!meta) throw new Error('--pay must be ETH, USDC or FLASH');
  if (!options.amount) throw new Error('--amount is required: the first buy, in --pay units (the creation fee is added on top)');
  const buyIn = parseUnits(String(options.amount), meta.decimals);
  const [ethUsd, flashUsd, feeFlash, minUsd, paused] = await Promise.all([
    read(L.config, A.launchConfig, 'ethUsdPrice'), read(L.config, A.launchConfig, 'flashUsdPriceChecked'), read(L.config, A.launchConfig, 'entryFeeFlash'),
    read(L.direct, A.directLaunch, 'minFirstBuyUsd18'), read(L.direct, A.directLaunch, 'paused'),
  ]);
  if (paused) throw new Error('Skip graduation is paused');
  const buyUsd = pay === 'USDC' ? buyIn * 10n ** 12n : (buyIn * (pay === 'ETH' ? ethUsd : flashUsd)) / 10n ** 18n;
  if (buyUsd < minUsd) throw new Error(`The first buy is worth $${fmt(buyUsd)}; the minimum is $${fmt(minUsd)}`);
  const feeUsd = (feeFlash * flashUsd) / 10n ** 18n;
  const fee = pay === 'FLASH' || !feeFlash ? (pay === 'FLASH' ? feeFlash : 0n) : (((pay === 'ETH' ? (feeUsd * 10n ** 18n) / ethUsd : feeUsd / 10n ** 12n) * 13_000n) / 10_000n) + 1n;
  // ETH -> FLASH (a FLASH pair paid in ETH) is the one conversion with a pool quote: floor it like the router.
  const minQuote = pair === 1 && pay === 'ETH' ? (await minFlashForEth(buyIn, slip(options))).minFlash : 0n;
  const directInput = { ...input, pair, quote, shape: launchShape(shape) };
  const bounds = { feeIn: pay === 'FLASH' ? 0n : fee, minFeeFlash: 0n, minQuote, minTokens: 1n };
  const total = fee + buyIn;
  const summary = { ...input, pair: PAIR_NAMES[pair], quote: quoteSymbol, shape: shape.label, rewardAsset: shape.rewardAsset === zeroAddress ? 'pair default' : shape.rewardAsset, payWith: pay, firstBuy: fmt(buyIn, meta.decimals), feePart: fmt(fee, meta.decimals), total: fmt(total, meta.decimals), creationFeeFlash: fmt(feeFlash) };
  const warnings = ['Launches are permanent and public. Save the signed token profile with art before this transaction (LAUNCHES.md): the token takes its art from it.'];
  const notes = ['The new token is in DirectLaunch(token, creator, poolId, pair, quote, treasury, payWith, fee, quoteIn, tokensOut, targetCapUsd18). It trades right away: swap --market <token>.'];
  if (pay === 'ETH') {
    const args = [directInput, bounds];
    const predicted = await client.simulateContract({ address: L.direct, abi: A.directLaunch, functionName: 'launchWithEth', args, value: total, account }).then((sim) => sim.result).catch(() => undefined);
    return finish(account, 'launch-direct', { ...summary, ...(predicted ? { predictedToken: predicted } : {}) },
      [call({ to: L.direct, abi: A.directLaunch, functionName: 'launchWithEth', args, value: total, description: `Launch ${input.symbol} with no curve, first buy included` })], warnings, notes);
  }
  return finish(account, 'launch-direct', summary, [
    ...await approval(account, meta.address, L.direct, total, pay, 'the direct launcher'),
    call({ to: L.direct, abi: A.directLaunch, functionName: 'launchWithToken', args: [directInput, bounds, meta.address, total], description: `Launch ${input.symbol} with no curve, first buy included` }),
  ], warnings, notes);
}

export async function launchBuy(options) {
  const account = wallet(options);
  const { token, record } = await launchRecord(options.token);
  const phase = await read(record.curve, A.curve, 'phase');
  if (phase !== 1) throw new Error(`${record.symbol} is ${CURVE_PHASES[phase]}: curve trading is closed${phase === 3 ? ' (it graduated: swap --market ' + token + ')' : ''}`);
  const bps = slip(options);
  if (options.eth) {
    const ethIn = parseUnits(String(options.eth), 18);
    const { minFlash } = await minFlashForEth(ethIn, bps);
    const [, tokensOut] = await read(record.curve, A.curve, 'quoteBuy', [minFlash]);
    const minTokens = slippageLimit('exactIn', tokensOut, bps);
    return finish(account, 'launch-buy', { token: record.symbol, ethIn: fmt(ethIn), minFlash: fmt(minFlash), expectedTokens: fmt(tokensOut), minTokens: fmt(minTokens) },
      [call({ to: L.routerQ, abi: A.launchRouter, functionName: 'buyWithEth', args: [token, minFlash, minTokens, account], value: ethIn, description: `Buy ${record.symbol} on its curve with ETH` })]);
  }
  if (!options.flash) throw new Error('--eth <amount> or --flash <amount> is required');
  const flashIn = parseUnits(String(options.flash), 18);
  const [spent, tokensOut, refund] = await read(record.curve, A.curve, 'quoteBuy', [flashIn]);
  const minTokens = slippageLimit('exactIn', tokensOut, bps);
  return finish(account, 'launch-buy', { token: record.symbol, flashIn: fmt(flashIn), flashSpent: fmt(spent), refund: fmt(refund), expectedTokens: fmt(tokensOut), minTokens: fmt(minTokens) },
    [...await approval(account, K.tokens.FLASH.address, record.curve, flashIn, 'FLASH', `the ${record.symbol} curve`), call({ to: record.curve, abi: A.curve, functionName: 'buy', args: [flashIn, minTokens, account], description: `Buy ${record.symbol} on its curve with FLASH` })]);
}

export async function launchSell(options) {
  const account = wallet(options);
  const { record } = await launchRecord(options.token);
  const held = await read(record.curve, A.curve, 'claimableTokensOf', [account]);
  const amount = options.amount === 'all' || !options.amount ? held : parseUnits(String(options.amount), 18);
  if (!amount || amount > held) throw new Error(`Curve position: ${fmt(held)} ${record.symbol}`);
  const [, baseOut, quoteOut] = await read(record.curve, A.curve, 'quoteSell', [account, amount]);
  const minFlash = slippageLimit('exactIn', baseOut, slip(options));
  return finish(account, 'launch-sell', { token: record.symbol, amount: fmt(amount), expectedFlash: fmt(baseOut), quoteLeg: fmt(quoteOut), minFlash: fmt(minFlash) },
    [call({ to: record.curve, abi: A.curve, functionName: 'sell', args: [amount, minFlash, account], description: `Sell ${record.symbol} back to its curve` })],
    ['Curve positions are share-based: a sell redeems that slice of YOUR OWN churn account (what your FLASH converted into), less the sell fee.']);
}

async function curveCall(options, action, functionName, args, description, check) {
  const account = wallet(options);
  const { token, record } = await launchRecord(options.token);
  if (check) await check(account, record);
  return finish(account, action, { token: record.symbol, curve: record.curve }, [call({ to: record.curve, abi: A.curve, functionName, args: args(account, token), description })]);
}

export const launchClaim = (options) => curveCall(options, 'launch-claim', 'claim', (account) => [account], 'Claim graduated launch tokens', async (account, record) => {
  if (await read(record.curve, A.curve, 'phase') !== 3) throw new Error('Claims open after graduation');
  if (!(await read(record.curve, A.curve, 'claimableTokensOf', [account]))) throw new Error('Nothing to claim (an airdrop may already have paid it)');
});
export const launchRefund = (options) => curveCall(options, 'launch-refund', 'refundAborted', (account) => [account], 'Refund an aborted launch position', async (_account, record) => {
  if (await read(record.curve, A.curve, 'phase') !== 4) throw new Error('Refunds open only when the launch is ABORTED');
});
export const launchCreatorClaim = (options) => curveCall(options, 'launch-creator-claim', 'claimCreatorFees', (account) => [account], 'Claim curve creator fees (FLASH)', async (account, record) => {
  if (record.creator.toLowerCase() !== account.toLowerCase()) throw new Error(`Only the creator ${record.creator} can claim`);
});
export const launchPoke = (options) => curveCall(options, 'launch-poke', 'poke', () => [], 'Re-check the curve lock at the live price (permissionless)');
export const launchAirdrop = (options) => curveCall(options, 'launch-airdrop', 'airdrop', () => [BigInt(options.from || 0), BigInt(options.count || 200)], 'Airdrop graduated tokens to curve participants (permissionless batch)');

export async function launchGraduate(options) {
  const account = wallet(options);
  const { token, record } = await launchRecord(options.token);
  return finish(account, 'launch-graduate', { token: record.symbol }, [call({ to: L.launchpad, abi: A.launchpad, functionName: 'finalize', args: [token], description: `Graduate ${record.symbol} into its FlashV3 pool (permissionless once READY)` })],
    ['BelowGoal(...) means the graduation would realise less than the goal through the FLASH/ETH pool: it waits for ETH depth there.']);
}

// ------------------------------------------------------------------ Token Wars V6

const W = L.tokenWar;
export async function warStatus(options) {
  const warId = await read(W, A.tokenWar, 'currentWarId');
  const [fee, goal] = await Promise.all([read(W, A.tokenWar, 'currentEntryFee'), read(W, A.tokenWar, 'goalNow')]);
  if (!warId) return { ok: true, status: 'info', action: 'war-status', war: null, entryFeeFlash: fmt(fee), next: 'No war yet: the owner or a keeper opens the first one.' };
  const [state, page] = await Promise.all([read(W, A.tokenWar, 'warState', [warId]), read(W, A.tokenWar, 'candidatesPage', [warId, 0n, 50n])]);
  const account = options.wallet ? getAddress(options.wallet) : undefined;
  const candidates = [];
  for (const [index, entry] of page.entries()) {
    const id = BigInt(index + 1);
    const [pair, quote] = await read(W, A.tokenWar, 'candidatePairOf', [warId, id]);
    const row = { id: index + 1, name: entry.name, symbol: entry.symbol, creator: entry.creator, backingFlash: fmt(entry.principal), pair: PAIR_NAMES[pair], quote: quote === zeroAddress ? null : quote, buys: Number(entry.buyCount), sells: Number(entry.sellCount) };
    if (account) {
      const units = await read(W, A.tokenWar, 'unitsOf', [warId, id, account]);
      if (units) row.mine = { units: units.toString(), costBasisFlash: fmt(await read(W, A.tokenWar, 'costBasisOf', [warId, id, account])) };
    }
    candidates.push(row);
  }
  candidates.sort((a, b) => Number(b.backingFlash) - Number(a.backingFlash));
  const out = {
    ok: true, status: 'info', action: 'war-status', warId: warId.toString(), phase: WAR_PHASES[state.phase], goalFlash: fmt(state.goal), goalUsd: fmt(goal[0]), totalBackingFlash: fmt(state.totalPrincipal),
    progressPct: state.goal ? Number((state.totalPrincipal * 10_000n) / state.goal) / 100 : 0, entryFeeFlash: fmt(fee), winnerId: Number(state.winnerId), winnerToken: state.winnerToken === zeroAddress ? null : state.winnerToken, candidates,
  };
  if (account) {
    out.claimed = await read(W, A.tokenWar, 'hasClaimed', [warId, account]);
    out.creatorFeesFlash = fmt(await read(W, A.tokenWar, 'creatorFeesOf', [warId, account]));
  }
  return out;
}

export async function warEnter(options) {
  const account = wallet(options);
  const input = validateName(options);
  const { pair, quote, quoteSymbol } = await resolvePair(options);
  const picked = await shapeOf(options, pair, quote);
  const shape = launchShape(pair >= 2 ? { ...picked, rewardAsset: zeroAddress } : picked);
  const fee = await read(W, A.tokenWar, 'currentEntryFee');
  const pay = String(options.pay || 'ETH').toUpperCase();
  const summary = { ...input, pair: PAIR_NAMES[pair], quote: quoteSymbol, shape: picked.label, entryFeeFlash: fmt(fee) };
  if (pay === 'FLASH') {
    return finish(account, 'war-enter', summary, [
      ...await approval(account, K.tokens.FLASH.address, W, slippageLimit('exactOut', fee, DEFAULT_SLIPPAGE_BPS), 'FLASH', 'Token Wars'),
      call({ to: W, abi: A.tokenWar, functionName: 'registerCandidatePaired', args: [input, pair, pair >= 2 ? quote : zeroAddress, shape], description: `Enter ${input.symbol} in the Token War (FLASH entry fee)` }),
    ]);
  }
  // ETH: an exact-out quote of the FLASH fee, +5%; the router refunds the FLASH left over.
  const ethNeeded = slippageLimit('exactOut', await quoteSingle(RC_POOL, true, 'exactOut', fee), DEFAULT_SLIPPAGE_BPS);
  return finish(account, 'war-enter', { ...summary, ethIn: fmt(ethNeeded) },
    [call({ to: L.warRouter, abi: A.warRouter, functionName: 'submitWithEth', args: [input, pair, pair >= 2 ? quote : zeroAddress, shape, fee], value: ethNeeded, description: `Enter ${input.symbol} in the Token War (ETH pays the entry fee)` })],
    ['Leftover FLASH from the ETH leg is refunded to the wallet.']);
}

export async function warBack(options) {
  const account = wallet(options);
  const id = BigInt(options.id || 0);
  if (!id) throw new Error('--id <candidate id> is required (war-status)');
  const pay = String(options.pay || 'ETH').toUpperCase();
  const bps = slip(options);
  if (!options.amount) throw new Error('--amount is required');
  if (pay === 'FLASH') {
    const gross = parseUnits(String(options.amount), 18);
    const [units, q] = await Promise.all([read(W, A.tokenWar, 'quoteUnits', [id, gross]), read(W, A.tokenWar, 'quoteBuyV5', [id, gross])]);
    const minUnits = slippageLimit('exactIn', units, bps);
    return finish(account, 'war-back', { candidate: Number(id), flashIn: fmt(gross), feeBps: Number(q[2]), units: units.toString(), minUnits: minUnits.toString(), wouldLock: q[4] },
      [...await approval(account, K.tokens.FLASH.address, W, gross, 'FLASH', 'Token Wars'), call({ to: W, abi: A.tokenWar, functionName: 'buy', args: [id, gross, minUnits, account], description: `Back candidate ${id} with FLASH` })],
      q[4] ? ['This buy reaches the goal and locks the war.'] : []);
  }
  const isEth = pay === 'ETH';
  if (!isEth && pay !== 'USDC') throw new Error('--pay ETH|USDC|FLASH');
  const amount = parseUnits(String(options.amount), isEth ? 18 : 6);
  // FLASH the router's leg delivers: simulate the router call itself (unbounded), then apply slippage.
  const probe = isEth
    ? call({ to: L.warRouter, abi: A.warRouter, functionName: 'backWithEth', args: [id, 0n, 0n, account], value: amount })
    : call({ to: L.warRouter, abi: A.warRouter, functionName: 'backWithToken', args: [id, K.tokens.USDC.address, amount, 0n, 0n, account] });
  const pre = isEth ? [] : await approval(account, K.tokens.USDC.address, L.warRouter, amount, 'USDC', 'the war router');
  let flash;
  try {
    const { results } = await client.simulateCalls({ account, calls: [...pre, probe].map(({ to, data, value }) => ({ to, data, value })) });
    const last = results[results.length - 1];
    if (last.status !== 'success') throw last.error;
    flash = BigInt(`0x${last.data.slice(2, 66)}`);
  } catch (error) {
    throw new Error(`Could not size the ${pay} leg from this wallet (balance?): ${error.shortMessage || error.message}`.split('\n')[0]);
  }
  const minFlash = slippageLimit('exactIn', flash, bps);
  const units = await read(W, A.tokenWar, 'quoteUnits', [id, minFlash]);
  const minUnits = slippageLimit('exactIn', units, bps);
  const tx = isEth
    ? call({ to: L.warRouter, abi: A.warRouter, functionName: 'backWithEth', args: [id, minFlash, minUnits, account], value: amount, description: `Back candidate ${id} with ETH` })
    : call({ to: L.warRouter, abi: A.warRouter, functionName: 'backWithToken', args: [id, K.tokens.USDC.address, amount, minFlash, minUnits, account], description: `Back candidate ${id} with USDC` });
  return finish(account, 'war-back', { candidate: Number(id), pay, amount: options.amount, flashLeg: fmt(flash), minFlash: fmt(minFlash), minUnits: minUnits.toString() }, [...pre, tx]);
}

export async function warSell(options) {
  const account = wallet(options);
  const warId = await read(W, A.tokenWar, 'currentWarId');
  const id = BigInt(options.id || 0);
  const held = await read(W, A.tokenWar, 'unitsOf', [warId, id, account]);
  const units = options.units === 'all' || !options.units ? held : BigInt(options.units);
  if (!units || units > held) throw new Error(`Units held on candidate ${id}: ${held}`);
  const [, baseOut] = await read(W, A.tokenWar, 'quoteSell', [account, id, units]);
  const minFlash = slippageLimit('exactIn', baseOut, slip(options));
  return finish(account, 'war-sell', { candidate: Number(id), units: units.toString(), expectedFlash: fmt(baseOut), minFlash: fmt(minFlash) },
    [call({ to: W, abi: A.tokenWar, functionName: 'sell', args: [id, units, minFlash, account], description: `Cash out of candidate ${id}` })]);
}

export async function warJump(options) {
  const account = wallet(options);
  const warId = await read(W, A.tokenWar, 'currentWarId');
  const from = BigInt(options.from || 0);
  const to = BigInt(options.to || 0);
  const held = await read(W, A.tokenWar, 'unitsOf', [warId, from, account]);
  const units = options.units === 'all' || !options.units ? held : BigInt(options.units);
  const q = await read(W, A.tokenWar, 'quoteJump', [account, from, to, units]);
  if (!q[0]) throw new Error('This jump would revert now (quoteJump returned 0)');
  const minUnits = slippageLimit('exactIn', q[0], slip(options));
  return finish(account, 'war-jump', { from: Number(from), to: Number(to), units: units.toString(), unitsOut: q[0].toString(), minUnits: minUnits.toString(), feeBps: Number(q[4] + q[5]), wouldLock: q[6] },
    [call({ to: W, abi: A.tokenWar, functionName: 'jump', args: [from, to, units, minUnits], description: `Jump backing from candidate ${from} to ${to} (atomic sell + buy)` })]);
}

async function warSimple(options, action, functionName, args, description) {
  const account = wallet(options);
  return finish(account, action, {}, [call({ to: W, abi: A.tokenWar, functionName, args: await args(account), description })]);
}
const currentOr = async (options) => (options.war ? BigInt(options.war) : read(W, A.tokenWar, 'currentWarId'));
export const warClaim = (options) => warSimple(options, 'war-claim', 'claim', async (account) => [await currentOr(options), account], 'Claim the launched war token (winner and loser backers)');
export const warRefund = (options) => warSimple(options, 'war-refund', 'refundAborted', async (account) => [await currentOr(options), BigInt(options.id || 0), account], 'Refund backing from an aborted war');
export const warCreatorClaim = (options) => warSimple(options, 'war-creator-claim', 'claimCreatorFees', async (account) => [await currentOr(options), account], 'Claim candidate creator fees');
export const warOpen = (options) => warSimple(options, 'war-open', 'openWar', async () => [], 'Open the next Token War (permissionless once the last one launched or aborted)');
export const warPoke = (options) => warSimple(options, 'war-poke', 'poke', async () => [await currentOr(options)], 'Re-check the war lock at the live price (permissionless)');
export const warAirdrop = (options) => warSimple(options, 'war-airdrop', 'airdrop', async () => [await currentOr(options), BigInt(options.from || 0), BigInt(options.count || 200)], 'Airdrop the launched token to war backers (permissionless, at most 400 per call)');
export const warFinalize = (options) => warSimple(options, 'war-finalize', 'finalize', async () => [], 'Lock the war and launch the leader (permissionless once eligible)');

export { NATIVE };
