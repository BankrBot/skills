// Limit orders on the churn ("bins" / levels): a level holds tokens that only
// sell at or above its floor price, filled inside other people's buys as the
// price crosses it. A curve order is many levels in one depositLevels().
// Full range = fills at any price. Lattices = bounded limit-order curves
// opened by creators / treasuries / approved openers (owner-managed).
import { getAddress, parseUnits } from 'viem';
import * as A from './abis.mjs';
import { K } from './contracts.mjs';
import { CHURN_CLASS_PUBLIC } from './abis.mjs';
import { priceToLevelTick, tickToPrice, curveBins } from './encode.mjs';
import { client, call, approval, simulate, estimate, plan, fmt } from './plan.mjs';

const C = K.churn.core;
const MIN_TICK = -887_272;
const MAX_LEVELS = 48;
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const wallet = (options) => {
  if (!options.wallet) throw new Error('--wallet is required');
  return getAddress(options.wallet);
};

/** FLASH/ETH: FLASH is currency1 of the RC pool, so the token tick is -poolTick. QUANT is currency0: tick as is. */
const MARKETS = {
  FLASH: { id: K.churn.markets['FLASH/ETH'], token: K.tokens.FLASH.address, tokenSymbol: 'FLASH', quoteSymbol: 'ETH', tick: async () => -Number((await read(K.referralCoin.hook, A.rcHook, 'poolState'))[1]) },
  QUANT: { id: K.churn.markets['QUANT/FLASH'], token: K.tokens.QUANT.address, tokenSymbol: 'QUANT', quoteSymbol: 'FLASH', tick: async () => Number((await read(K.flashV3.hook, A.v3Hook, 'poolState', [K.pools['QUANT/FLASH'].key]))[1]) },
};

function market(options) {
  const key = String(options.market || '').toUpperCase();
  const m = MARKETS[key];
  if (!m) throw new Error('--market FLASH|QUANT is required (the churn markets the app trades)');
  return m;
}

async function finish(account, action, summary, transactions, warnings = []) {
  const simulation = await simulate(account, transactions);
  if (transactions.length === 1 && simulation.ok) {
    const gas = await estimate(account, transactions[0]);
    if (gas) transactions[0].gas = (gas * 12n) / 10n;
  }
  return plan({ action, summary, transactions, simulation, warnings });
}

export async function limitMarkets() {
  const out = [];
  for (const [name, m] of Object.entries(MARKETS)) {
    const [acc, cfg, lc, levels, tick] = await Promise.all([read(C, A.churn, 'marketAccounting', [m.id]), read(C, A.churn, 'marketConfig', [m.id]), read(C, A.churn, 'levelConfig', [m.id]), read(C, A.churn, 'levels', [m.id, MIN_TICK, 64n]), m.tick()]);
    out.push({
      market: name, marketId: m.id, pair: `${m.tokenSymbol}/${m.quoteSymbol}`, priceNow: `${tickToPrice(tick).toPrecision(6)} ${m.quoteSymbol} per ${m.tokenSymbol}`, tokenTick: tick,
      levelsEnabled: lc.configured, stepTicks: lc.stepTicks, minDeposit: fmt(lc.minDeposit), sellerFeeBps: cfg.sellerFeeBps, fullRangeInventory: fmt(acc[1]), quoteFilledTotal: fmt(acc[3]),
      openLevels: levels.map((level) => ({ tick: level, price: tickToPrice(level).toPrecision(6) })),
    });
  }
  return { ok: true, status: 'info', action: 'limit-markets', markets: out, note: 'Prices are quote per token (both 18 decimals). A level fills only at or above its floor, inside buys that cross it; the depositor keeps 69% of any fill surplus above the floor.' };
}

export async function limitOrders(options) {
  const account = wallet(options);
  const out = [];
  for (const [name, m] of Object.entries(MARKETS)) {
    const [levels, full, fullClaim] = await Promise.all([read(C, A.churn, 'levels', [m.id, MIN_TICK, 64n]), read(C, A.churn, 'positions', [m.id, account, CHURN_CLASS_PUBLIC]), read(C, A.churn, 'previewClaim', [m.id, account, CHURN_CLASS_PUBLIC])]);
    const rows = [];
    for (const level of levels) {
      const [position, unsold, claimable] = await Promise.all([read(C, A.churn, 'levelPosition', [m.id, level, account]), read(C, A.churn, 'previewLevelTokens', [m.id, level, account]), read(C, A.churn, 'previewLevelClaim', [m.id, level, account])]);
      if (position[1] || claimable) rows.push({ level, floorPrice: tickToPrice(level).toPrecision(6), shares: position[1].toString(), unsoldTokens: fmt(unsold), claimableQuote: fmt(claimable) });
    }
    out.push({ market: name, marketId: m.id, fullRange: { shares: full[1].toString(), claimableQuote: fmt(fullClaim) }, levels: rows });
  }
  return { ok: true, status: 'info', action: 'limit-orders', account, markets: out };
}

export async function limitPlace(options) {
  const account = wallet(options);
  const m = market(options);
  const lc = await read(C, A.churn, 'levelConfig', [m.id]);
  if (!lc.configured) throw new Error(`Levels are not enabled on ${m.tokenSymbol}/${m.quoteSymbol}`);
  const balance = await read(m.token, A.erc20, 'balanceOf', [account]);
  const amount = options.amount === 'all' ? balance : parseUnits(String(options.amount || ''), 18);
  if (!amount) throw new Error('--amount is required (token units to sell)');
  if (amount > balance) throw new Error(`Balance ${fmt(balance)} ${m.tokenSymbol}`);
  const tick = await m.tick();
  const current = tickToPrice(tick);
  const warnings = [];
  let bins;
  if (options.price) {
    bins = [{ tick: priceToLevelTick(Number(options.price), lc.stepTicks), amount }];
  } else if (options.low && options.high) {
    const count = Math.min(MAX_LEVELS, Math.max(1, Number(options.bins || 16)));
    bins = curveBins(amount, Number(options.low), Number(options.high), count, lc.stepTicks, options.shape || 'exp');
  } else if (options['low-mult'] && options['high-mult']) {
    const count = Math.min(MAX_LEVELS, Math.max(1, Number(options.bins || 16)));
    bins = curveBins(amount, current * Number(options['low-mult']), current * Number(options['high-mult']), count, lc.stepTicks, options.shape || 'exp');
  } else {
    throw new Error('Give --price P (one level), or a curve: --low P --high P (or --low-mult x --high-mult y) [--bins n] [--shape flat|front|back|exp]');
  }
  if (bins.some((bin) => bin.amount < lc.minDeposit)) throw new Error(`Each level needs at least ${fmt(lc.minDeposit)} ${m.tokenSymbol}`);
  if (bins.some((bin) => tickToPrice(bin.tick) <= current)) warnings.push(`Some floors are at or below the current price (${current.toPrecision(6)}): those levels fill on the next buy at market or better.`);
  const total = bins.reduce((sum, bin) => sum + bin.amount, 0n);
  const order = bins.length === 1
    ? call({ to: C, abi: A.churn, functionName: 'depositLevel', args: [m.id, bins[0].tick, bins[0].amount, account], description: `Sell limit: ${fmt(bins[0].amount)} ${m.tokenSymbol} at >= ${tickToPrice(bins[0].tick).toPrecision(6)} ${m.quoteSymbol}` })
    : call({ to: C, abi: A.churn, functionName: 'depositLevels', args: [m.id, bins.map((bin) => bin.tick), bins.map((bin) => bin.amount), account], description: `Sell curve: ${fmt(total)} ${m.tokenSymbol} over ${bins.length} levels` });
  const txs = [...await approval(account, m.token, C, total, m.tokenSymbol, 'the churn'), order];
  const gross = bins.reduce((sum, bin) => sum + Number(bin.amount) / 1e18 * tickToPrice(bin.tick), 0);
  return finish(account, 'limit-place', {
    market: `${m.tokenSymbol}/${m.quoteSymbol}`, currentPrice: current.toPrecision(6), total: fmt(total),
    levels: bins.map((bin) => ({ tick: bin.tick, floorPrice: tickToPrice(bin.tick).toPrecision(6), amount: fmt(bin.amount) })),
    minimumProceedsIfAllFill: `${gross.toPrecision(6)} ${m.quoteSymbol} before the seller fee`,
  }, txs, warnings);
}

export async function limitCancel(options) {
  const account = wallet(options);
  const m = market(options);
  if (options.level === undefined) throw new Error('--level <tick> is required (see limit-orders)');
  const level = Number(options.level);
  const position = await read(C, A.churn, 'levelPosition', [m.id, level, account]);
  const shares = options.shares && options.shares !== 'all' ? BigInt(options.shares) : BigInt(position[1]);
  if (!shares) throw new Error('No shares at that level');
  return finish(account, 'limit-cancel', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, level, shares: shares.toString(), unsoldTokensBack: fmt(await read(C, A.churn, 'previewLevelTokens', [m.id, level, account])) },
    [call({ to: C, abi: A.churn, functionName: 'withdrawLevel', args: [m.id, level, shares, account], description: `Cancel the level ${level} order (unsold ${m.tokenSymbol} back)` })],
    ['Claim filled proceeds with limit-claim (withdrawLevel returns the unsold tokens).']);
}

export async function limitClaim(options) {
  const account = wallet(options);
  const m = market(options);
  let levels = options.levels ? String(options.levels).split(',').map(Number) : undefined;
  if (!levels) {
    const all = await read(C, A.churn, 'levels', [m.id, MIN_TICK, 64n]);
    levels = [];
    for (const level of all) if (await read(C, A.churn, 'previewLevelClaim', [m.id, level, account])) levels.push(level);
  }
  if (!levels.length) throw new Error('Nothing claimable on any level');
  let total = 0n;
  for (const level of levels) total += await read(C, A.churn, 'previewLevelClaim', [m.id, level, account]);
  return finish(account, 'limit-claim', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, levels, claimable: `${fmt(total)} ${m.quoteSymbol === 'ETH' ? 'WETH' : m.quoteSymbol}` },
    [call({ to: C, abi: A.churn, functionName: 'claimLevels', args: [m.id, levels, account], description: 'Claim limit-order proceeds' })]);
}

export async function fullRange(options, verb) {
  const account = wallet(options);
  const m = market(options);
  if (verb === 'deposit') {
    const amount = parseUnits(String(options.amount || ''), 18);
    if (!amount) throw new Error('--amount is required');
    return finish(account, 'fullrange-deposit', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, amount: fmt(amount) },
      [...await approval(account, m.token, C, amount, m.tokenSymbol, 'the churn'), call({ to: C, abi: A.churn, functionName: 'deposit', args: [m.id, amount, account], description: `Full-range churn deposit of ${fmt(amount)} ${m.tokenSymbol} (fills at any price, up to the market's fill cap)` })],
      ['Full range sells at whatever price buyers pay (no floor). Use limit-place for a price floor.']);
  }
  if (verb === 'withdraw') {
    const position = await read(C, A.churn, 'positions', [m.id, account, CHURN_CLASS_PUBLIC]);
    const shares = options.shares && options.shares !== 'all' ? BigInt(options.shares) : position[1];
    if (!shares) throw new Error('No full-range shares');
    return finish(account, 'fullrange-withdraw', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, shares: shares.toString() },
      [call({ to: C, abi: A.churn, functionName: 'withdraw', args: [m.id, shares, account], description: 'Withdraw unsold full-range tokens' })]);
  }
  const claimable = await read(C, A.churn, 'previewClaim', [m.id, account, CHURN_CLASS_PUBLIC]);
  if (!claimable) throw new Error('Nothing claimable');
  return finish(account, 'fullrange-claim', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, claimable: fmt(claimable) },
    [call({ to: C, abi: A.churn, functionName: 'claim', args: [m.id, account], description: 'Claim full-range proceeds' })]);
}

// ------------------------------------------------------------------ Lattices

export async function latticeList(options) {
  const m = market(options);
  const heads = await read(C, A.churn, 'latticesOf', [m.id]);
  const rows = [];
  for (const head of heads) {
    const view = await read(C, A.churn, 'latticeOf', [head.positionId]);
    rows.push({ positionId: head.positionId.toString(), owner: view.owner, startTick: view.params.startTick, startPrice: tickToPrice(view.params.startTick).toPrecision(6), widthTicks: view.params.widthTicks, bins: view.bins.toString(), filledBins: head.next, total: fmt(view.params.total), unreleased: fmt(view.unreleased) });
  }
  return { ok: true, status: 'info', action: 'lattice-list', market: `${m.tokenSymbol}/${m.quoteSymbol}`, lattices: rows, note: 'A Lattice is a limit-order curve: bins widthTicks wide from startTick upward, released lowest first as buys cross them. Proceeds are pushed to the owner inside each fill (no claim).' };
}

export async function latticeShow(options) {
  if (!options.id) throw new Error('--id <positionId> is required');
  const view = await read(C, A.churn, 'latticeOf', [BigInt(options.id)]);
  return { ok: true, status: 'info', action: 'lattice-show', positionId: options.id, owner: view.owner, marketId: view.marketId, params: JSON.parse(JSON.stringify(view.params, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))), cursor: { next: view.state.next, soldInNext: view.state.soldInNext.toString() }, unreleased: fmt(view.unreleased), bins: view.bins.toString() };
}

async function ownLattice(options) {
  const account = wallet(options);
  if (!options.id) throw new Error('--id <positionId> is required');
  const view = await read(C, A.churn, 'latticeOf', [BigInt(options.id)]);
  if (view.owner.toLowerCase() !== account.toLowerCase()) throw new Error(`Lattice ${options.id} is owned by ${view.owner}; only its owner can change it`);
  return { account, view };
}

export async function latticeWithdraw(options) {
  const { account, view } = await ownLattice(options);
  const tx = options.amount && options.amount !== 'all'
    ? call({ to: C, abi: A.churn, functionName: 'withdrawLatticeAmount', args: [BigInt(options.id), parseUnits(String(options.amount), 18), account], description: `Withdraw ${options.amount} unreleased tokens from Lattice ${options.id} (same shape, rescaled)` })
    : call({ to: C, abi: A.churn, functionName: 'withdrawLattice', args: [BigInt(options.id), account], description: `Close Lattice ${options.id}: every unreleased token back` });
  return finish(account, 'lattice-withdraw', { positionId: options.id, unreleased: fmt(view.unreleased) }, [tx]);
}

export async function latticeTransfer(options) {
  const { account } = await ownLattice(options);
  if (!options.to) throw new Error('--to is required');
  return finish(account, 'lattice-transfer', { positionId: options.id, to: getAddress(options.to) },
    [call({ to: C, abi: A.churn, functionName: 'transferLattice', args: [BigInt(options.id), getAddress(options.to)], description: `Transfer Lattice ${options.id}` })],
    ['The new owner receives every future fill proceed and controls withdraw / reformat.']);
}

function latticeParams(json) {
  const p = JSON.parse(json);
  const segments = Array.from({ length: 8 }, (_, index) => p.segments?.[index] || { bins: 0, exponentTicks: 0, sharePpm: 0 });
  return { startTick: Number(p.startTick), widthTicks: Number(p.widthTicks), count: Number(p.count), total: BigInt(p.total), segments: segments.map((s) => ({ bins: Number(s.bins), exponentTicks: Number(s.exponentTicks), sharePpm: Number(s.sharePpm) })) };
}

export async function latticeReformat(options) {
  const { account, view } = await ownLattice(options);
  if (!options.params) throw new Error('--params <JSON LatticeParams: {startTick,widthTicks,count,total (wei),segments:[{bins,exponentTicks,sharePpm}]}> is required');
  const p = latticeParams(options.params);
  const m = Object.values(MARKETS).find((entry) => entry.id.toLowerCase() === view.marketId.toLowerCase());
  const extra = p.total > view.unreleased ? p.total - view.unreleased : 0n;
  const txs = [...(extra && m ? await approval(account, m.token, C, extra, m.tokenSymbol, 'the churn') : []), call({ to: C, abi: A.churn, functionName: 'reformatLattice', args: [BigInt(options.id), p], description: `Reformat Lattice ${options.id}` })];
  return finish(account, 'lattice-reformat', { positionId: options.id, unreleasedBefore: fmt(view.unreleased), newTotal: fmt(p.total), pulled: fmt(extra) }, txs,
    ['sharePpm across the used segments must sum to 1,000,000; the churn validates the shape and reverts otherwise.']);
}

export async function latticeOpen(options) {
  const account = wallet(options);
  const m = market(options);
  if (!options.params) throw new Error('--params <JSON LatticeParams> is required');
  const p = latticeParams(options.params);
  const [opener, cfg] = await Promise.all([read(C, A.churn, 'isLatticeOpener', [account]), read(C, A.churn, 'marketConfig', [m.id])]);
  const allowed = opener || [cfg.creator, cfg.treasury].some((entry) => entry.toLowerCase() === account.toLowerCase());
  if (!allowed) throw new Error(`openLattice is restricted to churn operators, approved openers, the churn owner, and this market's creator (${cfg.creator}) / treasury (${cfg.treasury}). Wallets use limit-place --low/--high for a curve order instead.`);
  const owner = options.owner ? getAddress(options.owner) : account;
  return finish(account, 'lattice-open', { market: `${m.tokenSymbol}/${m.quoteSymbol}`, owner, total: fmt(p.total) },
    [...await approval(account, m.token, C, p.total, m.tokenSymbol, 'the churn'), call({ to: C, abi: A.churn, functionName: 'openLattice', args: [m.id, p, owner], description: 'Open a Lattice (limit-order curve)' })]);
}

