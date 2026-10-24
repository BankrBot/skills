// Referrals (codes, binding, claims, top-100), King of the Hill, QUANT,
// perps positions / unwind, Revenue Share and treasuries.
import { getAddress, parseUnits, zeroAddress, maxUint256 } from 'viem';
import * as A from './abis.mjs';
import { K } from './contracts.mjs';
import { bindTypedData, slippageLimit } from './encode.mjs';
import { client, call, approval, simulate, estimate, plan, fmt, api } from './plan.mjs';
import { swapCommand } from './trade.mjs';

const R = K.referralCoin.registry;
const wallet = (options) => {
  if (!options.wallet) throw new Error('--wallet is required');
  return getAddress(options.wallet);
};
const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });

async function finish(account, action, summary, transactions, warnings = [], notes = []) {
  const simulation = await simulate(account, transactions);
  if (transactions.length === 1 && simulation.ok) {
    const gas = await estimate(account, transactions[0]);
    if (gas) transactions[0].gas = (gas * 12n) / 10n;
  }
  return plan({ action, summary, transactions, simulation, warnings, notes });
}

// ------------------------------------------------------------------ referrals

export async function referralStatus(options) {
  const account = wallet(options);
  const [binding, code, referees, rank, bucket, earned, preview, threshold] = await Promise.all([
    read(R, A.rcRegistry, 'bindingOf', [account]),
    read(R, A.rcRegistry, 'codeOf', [account]),
    read(R, A.rcRegistry, 'refereeCount', [account]),
    read(R, A.rcRegistry, 'sortedRankOf', [account]),
    read(R, A.rcRegistry, 'bucketOf', [account]),
    read(R, A.rcRegistry, 'lifetimeEarned', [account]),
    read(R, A.rcRegistry, 'previewClaim', [account]),
    read(R, A.rcRegistry, 'codeThreshold'),
  ]);
  return {
    ok: true, status: 'info', action: 'referral-status',
    account,
    referred: binding[0] !== zeroAddress,
    referrer: binding[0],
    explicitlyBound: binding[1],
    feeOnFlash: binding[0] !== zeroAddress ? '1.69%' : '6.9%',
    code: code ? code.toString() : null,
    referralLink: code ? `https://tryflash.app/?ref=${code}` : null,
    howToGetACode: code ? undefined : `While referred, make one FLASH buy of at least ${fmt(threshold)} ETH: the registry issues this wallet its own code.`,
    referees: referees.toString(),
    top100Rank: rank ? rank.toString() : 'not ranked (the board updates on claim)',
    bucket: { eth: fmt(bucket[0]), flash: fmt(bucket[1]) },
    lifetimeEarned: { eth: fmt(earned[0]), flash: fmt(earned[1]) },
    claimNow: { eth: fmt(preview[0]), flash: fmt(preview[1]), cascadesToParent: { parent: preview[2], eth: fmt(preview[3]), flash: fmt(preview[4]) } },
  };
}

export async function referralBind(options) {
  const account = wallet(options);
  if (!options.code) throw new Error('--code is required (a positive integer; a link ?ref=<code> carries it)');
  const code = BigInt(String(options.code).replace(/^#/, ''));
  const [binding, owner, bytecode] = await Promise.all([
    read(R, A.rcRegistry, 'bindingOf', [account]),
    read(R, A.rcRegistry, 'ownerOfCode', [code]),
    client.getCode({ address: account }),
  ]);
  if (binding[0] !== zeroAddress) throw new Error(`Already bound to ${binding[0]}: binding is permanent`);
  if (owner === zeroAddress) throw new Error(`Code ${code} does not exist`);
  if (owner.toLowerCase() === account.toLowerCase()) throw new Error('That is this wallet\'s own code');
  const smart = Boolean(bytecode && bytecode !== '0x') || options['smart-wallet'];
  if (!smart && !options.signature) {
    return finish(account, 'referral-bind', { code: code.toString(), codeOwner: owner, method: 'bind(code) from an EOA' },
      [call({ to: R, abi: A.rcRegistry, functionName: 'bind', args: [code], description: `Bind referral code ${code}` })],
      [], ['A plain EOA binds with one transaction. Binding is permanent and cuts the FLASH fee from 6.9% to 1.69%.']);
  }
  if (!options.signature) {
    const nonce = await read(R, A.rcRegistry, 'bindNonce', [account]);
    const ddl = BigInt(Math.floor(Date.now() / 1000) + 3600);
    return {
      ok: true, status: 'needs-signature', action: 'referral-bind',
      summary: { code: code.toString(), codeOwner: owner, method: 'EIP-712 Bind signature (smart wallet / 7702 / ERC-6492)' },
      typedData: bindTypedData(account, code, nonce, ddl),
      deadline: ddl.toString(),
      next: `Sign typedData with the wallet (eth_signTypedData_v4; Base MCP: sign), then re-run with --signature <0x...> --deadline ${ddl}. The same signature can instead ride inside a FLASH swap: swap --ref-code ${code} --ref-signature <sig> --ref-deadline ${ddl}.`,
    };
  }
  if (!options.deadline) throw new Error('--deadline (from the typed data) is required with --signature');
  return finish(account, 'referral-bind', { code: code.toString(), codeOwner: owner, method: 'bindWithSig' },
    [call({ to: R, abi: A.rcRegistry, functionName: 'bindWithSig', args: [account, code, BigInt(options.deadline), options.signature], description: `Bind referral code ${code} by signature` })]);
}

export async function referralClaim(options) {
  const account = wallet(options);
  const preview = await read(R, A.rcRegistry, 'previewClaim', [account]);
  const warnings = [];
  if (preview[0] === 0n && preview[1] === 0n) warnings.push('Nothing to claim right now. A zero claim still costs gas but it does enter / update the top-100 board rank.');
  warnings.push('Each claim passes 33% one level up the referral chain (shown as cascadesToParent).');
  return finish(account, 'referral-claim', { eth: fmt(preview[0]), flash: fmt(preview[1]), cascadesToParent: { parent: preview[2], eth: fmt(preview[3]), flash: fmt(preview[4]) } },
    [call({ to: R, abi: A.rcRegistry, functionName: 'claim', description: 'Claim referral earnings (ETH + FLASH)' })], warnings);
}

export async function referralBoard() {
  const [[accounts, scores], pool, flashPool, threshold, flashThreshold] = await Promise.all([
    read(R, A.rcRegistry, 'top100Sorted'), read(R, A.rcRegistry, 'top100Pool'), read(R, A.rcRegistry, 'top100FlashPool'), read(R, A.rcRegistry, 'airdropThreshold'), read(R, A.rcRegistry, 'flashAirdropThreshold'),
  ]);
  return {
    ok: true, status: 'info', action: 'referral-board',
    top100PoolEth: fmt(pool), top100PoolFlash: fmt(flashPool), payoutThresholds: { eth: fmt(threshold), flash: fmt(flashThreshold) },
    board: accounts.map((account, index) => ({ rank: index + 1, account, score: fmt(scores[index]) })),
    note: 'Weighted by rank (#1 gets 6.9x what #100 gets). The board only re-ranks inside claim(); distributeTop100() pays the pool out (permissionless).',
  };
}

export async function referralDistribute(options) {
  const account = wallet(options);
  return finish(account, 'referral-distribute', { top100PoolEth: fmt(await read(R, A.rcRegistry, 'top100Pool')) },
    [call({ to: R, abi: A.rcRegistry, functionName: 'distributeTop100', description: 'Distribute the top-100 pool to the board (permissionless)' })]);
}

// ------------------------------------------------------------------ King of the Hill

export async function kothStatus() {
  const [g, trigger, totals] = await Promise.all([read(K.referralCoin.koth, A.rcKoth, 'game'), read(K.referralCoin.koth, A.rcKoth, 'nextTrigger'), read(K.referralCoin.koth, A.rcKoth, 'totals')]);
  const nowS = Math.floor(Date.now() / 1000);
  const leading = g.leader !== zeroAddress;
  return {
    ok: true, status: 'info', action: 'koth-status',
    round: g.round.toString(), leader: leading ? g.leader : null, leaderBidEth: fmt(g.leaderBid),
    secondsLeft: leading ? Math.max(0, Number(g.expiresAt) - nowS) : null,
    expired: leading && Number(g.expiresAt) <= nowS,
    potEth: fmt(g.pot), winnerTakesEth: fmt((g.pot * 6900n) / 10_000n + g.held), leaderHeldEth: fmt(g.held),
    nextTriggerEth: fmt(trigger), durationSeconds: g.duration, incrementBps: g.incrementBps, startBidEth: fmt(g.startBid),
    lifetime: { ethIn: fmt(totals[0]), flashIn: fmt(totals[2]) },
    rules: 'One FLASH buy whose gross ETH input is >= nextTrigger takes the throne and restarts the clock; the trigger then steps +incrementBps from the trigger (not from the bid). Hold for durationSeconds and the pot pays out in ETH on the next trade (or settle()): 69% to the winner plus the share held while leading, 31% to the protocol. Selling FLASH while leading forfeits the leader share.',
  };
}

export async function kothBuy(options) {
  const trigger = await read(K.referralCoin.koth, A.rcKoth, 'nextTrigger');
  const unit = 1_000_000_000_000n;
  const minimum = ((trigger + unit - 1n) / unit) * unit;
  const amount = options.amount ? parseUnits(String(options.amount), 18) : minimum;
  if (amount < trigger) throw new Error(`The throne needs one buy of at least ${fmt(trigger)} ETH`);
  const result = await swapCommand({ ...options, market: 'FLASH', side: 'buy', amount: fmt(amount, 18, 18), pay: 'ETH' });
  result.action = 'koth-buy';
  result.summary = { ...result.summary, kothTriggerEth: fmt(trigger) };
  return result;
}

export async function kothSettle(options) {
  const account = wallet(options);
  const expired = await read(K.referralCoin.koth, A.rcKoth, 'expired');
  if (!expired) throw new Error('No expired round to settle (the next trade settles it anyway)');
  return finish(account, 'koth-settle', {}, [call({ to: K.referralCoin.koth, abi: A.rcKoth, functionName: 'settle', description: 'Pay out the expired King of the Hill round (permissionless)' })]);
}

// ------------------------------------------------------------------ perps + QUANT

export async function perpPositions(options) {
  const account = wallet(options);
  const markets = [...K.perpMarkets.live, ...K.perpMarkets.exitOnly];
  const rows = await Promise.all(markets.map(async (market) => {
    const balance = await read(market.token, A.erc20, 'balanceOf', [account]);
    if (!balance) return undefined;
    const [nav, position] = await Promise.all([read(K.perps.issuer, A.perpsIssuer, 'navPerToken', [BigInt(market.id)]), read(K.perps.issuer, A.perpsIssuer, 'positionOf', [BigInt(market.id), account])]);
    const value = (balance * nav) / 10n ** 18n;
    return { id: market.id, symbol: market.symbol, exitOnly: Boolean(market.exit), balance: fmt(balance), navUsdc: fmt(nav, 6), valueUsdc: fmt(value, 6), basisUsdc: fmt(position[1], 6), pnlUsdc: fmt(value - position[1], 6) };
  }));
  return { ok: true, status: 'info', action: 'perp-positions', account, positions: rows.filter(Boolean), note: 'PnL here = balance x NAV - issuer basis. The backend ledger (GET /v1/stack/perps/positions/:account) adds trade history.' };
}

export async function perpUnwind(options) {
  const account = wallet(options);
  const market = K.perpMarkets.exitOnly.find((entry) => entry.symbol.toUpperCase() === String(options.market || '').toUpperCase());
  if (!market) throw new Error(`perp-unwind is for the exit-only markets: ${K.perpMarkets.exitOnly.filter((entry) => entry.exit === 'issuer.unwind').map((entry) => entry.symbol).join(', ')}. Live markets sell with swap --side sell.`);
  if (market.exit !== 'issuer.unwind') throw new Error(`${market.symbol} exits by selling on its pool: swap --market ${market.symbol} --side sell`);
  const balance = await read(market.token, A.erc20, 'balanceOf', [account]);
  const amount = options.amount === 'all' || !options.amount ? balance : parseUnits(String(options.amount), 18);
  if (!amount || amount > balance) throw new Error(`Balance ${fmt(balance)} ${market.symbol}`);
  const nav = await read(K.perps.issuer, A.perpsIssuer, 'navPerToken', [BigInt(market.id)]);
  const expected = (amount * nav) / 10n ** 18n;
  const minOut = slippageLimit('exactIn', expected, Number(options['slippage-bps'] ?? 500));
  return finish(account, 'perp-unwind', { market: market.symbol, amount: fmt(amount), expectedUsdc: fmt(expected, 6), minUsdc: fmt(minOut, 6) },
    [...await approval(account, market.token, K.perps.issuer, amount, market.symbol, 'the perps issuer'), call({ to: K.perps.issuer, abi: A.perpsIssuer, functionName: 'unwind', args: [BigInt(market.id), amount, minOut, account], description: `Unwind ${market.symbol} to USDC through the issuer` })]);
}

// ------------------------------------------------------------------ perps take-profit / stop-loss

const ORDERS = K.perps.limitOrders;
const liveMarket = (symbol) => {
  const market = K.perpMarkets.live.find((entry) => entry.symbol.toUpperCase() === String(symbol || '').toUpperCase());
  if (!market) throw new Error(`--market must be a live perp: ${K.perpMarkets.live.map((entry) => entry.symbol).join(', ')}`);
  return market;
};
/** Human USDC-per-token NAV (e.g. 1.25) to issuer units (USDC 6 dp per 1e18 tokens). */
const navUnits = (value, flag) => {
  const nav = parseUnits(String(value), 6);
  if (nav <= 0n) throw new Error(`${flag} must be a positive NAV in USDC per token`);
  return nav;
};

export async function perpOrdersList(options) {
  const account = wallet(options);
  const [config, book, minOrder] = await Promise.all([
    api('/v1/stack/perps/orders'),
    api(`/v1/stack/perps/orders/${account}${options.status ? `?status=${encodeURIComponent(options.status)}` : ''}`),
    read(ORDERS, A.perpOrders, 'minOrderUsdc'),
  ]);
  const symbolOf = (id) => [...K.perpMarkets.live, ...K.perpMarkets.exitOnly].find((m) => m.id === id)?.symbol;
  return {
    ok: true, status: 'info', action: 'perp-orders', account, contract: ORDERS, live: config.live, feePct: 0.1, minOrderUsdc: fmt(minOrder, 6),
    orders: (book.orders || []).map((o) => ({ ...o, symbol: symbolOf(o.marketId), qtyTokens: fmt(BigInt(o.qty)), triggerNavUsdc: fmt(BigInt(o.triggerNav), 6), minOutUsdc: fmt(BigInt(o.minOut), 6) })),
  };
}

export async function perpTpSl(options) {
  const account = wallet(options);
  const market = liveMarket(options.market);
  const id = BigInt(market.id);
  if (!options.tp && !options.sl) throw new Error('--tp <NAV> and/or --sl <NAV> (USDC per token) is required');
  const [balance, nav, minOrder, paused, book] = await Promise.all([
    read(market.token, A.erc20, 'balanceOf', [account]),
    read(K.perps.issuer, A.perpsIssuer, 'navPerToken', [id]),
    read(ORDERS, A.perpOrders, 'minOrderUsdc'),
    read(ORDERS, A.perpOrders, 'paused'),
    api(`/v1/stack/perps/orders/${account}?status=open`).catch(() => ({ orders: [] })),
  ]);
  if (paused) throw new Error('Perp orders are paused right now (cancelling still works).');
  const qty = options.amount === 'all' || !options.amount ? balance : parseUnits(String(options.amount), 18);
  if (!qty || qty > balance) throw new Error(`Balance ${fmt(balance)} ${market.symbol}`);
  const tp = options.tp ? navUnits(options.tp, '--tp') : 0n;
  const sl = options.sl ? navUnits(options.sl, '--sl') : 0n;
  if (tp && sl && sl >= tp) throw new Error('--sl must be below --tp');
  const valueAt = (price) => (qty * price) / 10n ** 18n;
  for (const [price, flag] of [[tp, '--tp'], [sl, '--sl']]) {
    if (price && valueAt(price) < minOrder) throw new Error(`${flag}: the order is worth ${fmt(valueAt(price), 6)} USDC at its trigger; the minimum is ${fmt(minOrder, 6)} USDC`);
  }
  // SL floor: the app's default is 2% under the stop's own value; never above it.
  const slMin = sl ? (options['sl-min'] !== undefined ? parseUnits(String(options['sl-min']), 6) : (valueAt(sl) * 9_800n) / 10_000n) : 0n;
  if (sl && slMin > valueAt(sl)) throw new Error('--sl-min cannot exceed qty x stop NAV');
  const expiry = options['expiry-days'] ? BigInt(Math.floor(Date.now() / 1000) + Math.round(Number(options['expiry-days']) * 86_400)) : 0n;
  // The contract pulls the tokens at fill time: the allowance must cover this order AND the account's other open orders on this token (a linked pair shares one qty).
  const seen = new Set();
  let reserved = 0n;
  for (const o of book.orders || []) {
    if (o.marketId !== market.id || o.status !== 'open' || o.expired || seen.has(o.id)) continue;
    seen.add(o.id);
    if (o.sibling && o.sibling !== '0') seen.add(o.sibling);
    reserved += BigInt(o.qty);
  }
  const allowanceNeeded = qty + reserved;
  const warnings = [];
  if (tp && nav >= tp) warnings.push(`The take-profit ${fmt(tp, 6)} is at or below the current NAV ${fmt(nav, 6)}: a keeper can fill it right away.`);
  if (sl && nav <= sl) warnings.push(`The stop-loss ${fmt(sl, 6)} is at or above the current NAV ${fmt(nav, 6)}: a keeper can fill it right away.`);
  if (allowanceNeeded > balance) warnings.push(`Open orders on ${market.symbol} add up to more than the balance: whichever fills first may leave the others unfillable.`);
  const action = tp && sl
    ? call({ to: ORDERS, abi: A.perpOrders, functionName: 'placePair', args: [id, qty, tp, sl, slMin, expiry], description: `List a linked take-profit at ${fmt(tp, 6)} and stop-loss at ${fmt(sl, 6)} USDC NAV for ${fmt(qty)} ${market.symbol}` })
    : call({ to: ORDERS, abi: A.perpOrders, functionName: 'place', args: [id, tp ? 0 : 1, qty, tp || sl, slMin, expiry], description: `List a ${tp ? 'take-profit' : 'stop-loss'} at ${fmt(tp || sl, 6)} USDC NAV for ${fmt(qty)} ${market.symbol}` });
  return finish(account, 'perp-tpsl', {
    market: market.symbol, qty: fmt(qty), navNowUsdc: fmt(nav, 6),
    takeProfit: tp ? { triggerNav: fmt(tp, 6), youReceiveUsdc: fmt(await read(ORDERS, A.perpOrders, 'takeProfitOut', [qty, tp]), 6) } : undefined,
    stopLoss: sl ? { triggerNav: fmt(sl, 6), minUsdc: fmt(slMin, 6) } : undefined,
    expiry: expiry ? new Date(Number(expiry) * 1000).toISOString() : 'good till cancelled', feePct: 0.1, allowanceNeeded: fmt(allowanceNeeded),
  }, [...await approval(account, market.token, ORDERS, allowanceNeeded, market.symbol, 'the perps orders contract'), action], warnings,
  ['Tokens stay in the wallet. An allowlisted keeper sells them in the perps pool when the issuer NAV meets the trigger; a linked TP/SL cancels its sibling when one fills. Keep the balance and the allowance in place until then.']);
}

export async function perpOrderCancel(options) {
  const account = wallet(options);
  const ids = String(options.ids || options.id || '').split(',').map((part) => part.trim()).filter(Boolean).map((part) => BigInt(part));
  if (!ids.length) throw new Error('--ids 12,13 is required (see perp-orders)');
  return finish(account, 'perp-order-cancel', { ids: ids.map(String) },
    [call({ to: ORDERS, abi: A.perpOrders, functionName: 'cancel', args: [ids], description: `Cancel perp order${ids.length > 1 ? 's' : ''} ${ids.join(', ')}` })]);
}

export async function quantStatus(options) {
  const live = await api('/v1/stack/quant').catch(() => undefined);
  const LENS = K.perps.lens;
  const [minted, kpi, rate, preview] = await Promise.all([
    read(K.perps.issuer, A.perpsIssuer, 'quantMinted'),
    read(LENS, A.perpsLens, 'globalKpi'),
    read(LENS, A.perpsLens, 'quantRateNow'),
    read(LENS, A.perpsLens, 'previewQuant', [100_000_000n]),
  ]);
  const out = {
    ok: true, status: 'info', action: 'quant-status', quant: K.tokens.QUANT.address, pool: K.pools['QUANT/FLASH'].id, issuerMinted: fmt(minted),
    lens: { address: LENS, realizedProfitUsdc: fmt(kpi[0], 6), realizedLossUsdc: fmt(kpi[1], 6), quantMinted: fmt(kpi[2]), quantLive: kpi[3], quantPerUsdLossNow: fmt(rate), per100UsdLoss: { trader: fmt(preview[0]), protocol: fmt(preview[1]) } },
    api: live,
  };
  if (options.wallet) {
    const account = getAddress(options.wallet);
    const [balance, mine] = await Promise.all([read(K.tokens.QUANT.address, A.erc20, 'balanceOf', [account]), read(LENS, A.perpsLens, 'accountKpi', [account])]);
    out.balance = fmt(balance);
    out.account = { realizedProfitUsdc: fmt(mine[0], 6), realizedLossUsdc: fmt(mine[1], 6), quantReceived: fmt(mine[2]) };
  }
  out.howQuantIsEarned = 'Traders: sell (or unwind) a perp token at a realized loss and the issuer mints QUANT to you in that same transaction (80% you / 20% protocol; a Lomax curve of cumulative protocol-wide loss sets the rate). Creators of PERP-paired launches: 50% of the QUANT from losses realized in their pool accrues to the pool and is minted to the pool creator by quant-sweep (or any fee sweep).';
  return out;
}

export async function quantSweep(options) {
  const account = wallet(options);
  let poolId = options.pool;
  if (!poolId && options.token) poolId = await read(K.flashV3.registry, A.v3Registry, 'poolOfToken', [getAddress(options.token)]);
  if (!poolId || /^0x0+$/.test(poolId)) throw new Error('--pool <FlashV3 pool id> or --token <launched token> is required');
  const [route, info] = await Promise.all([read(K.perps.issuer, A.perpsIssuer, 'memeRoutes', [poolId]), read(K.flashV3.hook, A.v3Hook, 'poolInfoOf', [poolId])]);
  const owed = route[1] > 1n ? route[1] - 1n : 0n;
  const warnings = [];
  if (info.kind !== 4) warnings.push(`Pool kind ${info.kind} is not PERP (4): it accrues no creator QUANT; the sweep still routes its fees.`);
  if (!owed) warnings.push('No QUANT owed to this pool right now.');
  return finish(account, 'quant-sweep', { poolId, creator: info.creator, quantOwed: fmt(owed) },
    [call({ to: K.flashV3.ledger, abi: A.v3Ledger, functionName: 'sweep', args: [poolId], description: 'Sweep FlashV3 pool fees and mint its owed QUANT to the pool creator (permissionless)' })], warnings);
}

// ------------------------------------------------------------------ Revenue Share (FLASH)

const V = K.revenueShare.flashVault;
export async function revshareStatus(options) {
  const [assets, shares, feeBps] = await Promise.all([read(V, A.revenueShare, 'totalAssets'), read(V, A.revenueShare, 'totalShares'), read(V, A.revenueShare, 'flashFeeBps')]);
  const out = { ok: true, status: 'info', action: 'revshare-status', vault: V, token: 'FLASH', rewardQuote: 'WETH', totalFlash: fmt(assets), totalShares: fmt(shares), flashLoanFeeBps: Number(feeBps), note: 'Deposit FLASH, earn protocol revenue (WETH quote rewards + FLASH rewards) and flash-loan fees. No lockup.' };
  if (options.wallet) {
    const account = getAddress(options.wallet);
    const [mine, principal, quote, rewards, tokenRewards] = await Promise.all([read(V, A.revenueShare, 'sharesOf', [account]), read(V, A.revenueShare, 'principalOf', [account]), read(V, A.revenueShare, 'claimableQuoteRewards', [account]), read(V, A.revenueShare, 'claimableRewards', [account]), read(V, A.revenueShare, 'claimableTokenRewards', [account])]);
    out.position = { shares: fmt(mine), valueFlash: fmt(await read(V, A.revenueShare, 'convertToAssets', [mine])), principalFlash: fmt(principal), claimable: { weth: fmt(quote), flashRewards: fmt(rewards), tokenRewards: fmt(tokenRewards) } };
  }
  return out;
}

export async function revshareDeposit(options) {
  const account = wallet(options);
  const amount = options.amount === 'all' ? await read(K.tokens.FLASH.address, A.erc20, 'balanceOf', [account]) : parseUnits(String(options.amount || ''), 18);
  if (!amount) throw new Error('--amount is required');
  const txs = [...await approval(account, K.tokens.FLASH.address, V, amount, 'FLASH', 'Revenue Share'), call({ to: V, abi: A.revenueShare, functionName: 'deposit', args: [amount, account], description: `Deposit ${fmt(amount)} FLASH into Revenue Share` })];
  return finish(account, 'revshare-deposit', { amount: fmt(amount), expectedShares: fmt(await read(V, A.revenueShare, 'convertToShares', [amount])) }, txs);
}

export async function revshareWithdraw(options) {
  const account = wallet(options);
  const held = await read(V, A.revenueShare, 'sharesOf', [account]);
  const shares = options.shares === 'all' || !options.shares ? held : parseUnits(String(options.shares), 18);
  if (!shares || shares > held) throw new Error(`Shares held: ${fmt(held)}`);
  return finish(account, 'revshare-withdraw', { shares: fmt(shares), expectedFlash: fmt(await read(V, A.revenueShare, 'convertToAssets', [shares])) },
    [call({ to: V, abi: A.revenueShare, functionName: 'withdraw', args: [shares, account], description: 'Withdraw from Revenue Share' })]);
}

export async function revshareClaim(options) {
  const account = wallet(options);
  const [quote, rewards, tokenRewards] = await Promise.all([read(V, A.revenueShare, 'claimableQuoteRewards', [account]), read(V, A.revenueShare, 'claimableRewards', [account]), read(V, A.revenueShare, 'claimableTokenRewards', [account])]);
  const txs = [];
  if (quote) txs.push(call({ to: V, abi: A.revenueShare, functionName: 'claimQuoteRewards', args: [account], description: `Claim ${fmt(quote)} WETH` }));
  if (rewards) txs.push(call({ to: V, abi: A.revenueShare, functionName: 'claimRewards', args: [account], description: `Claim ${fmt(rewards)} FLASH rewards` }));
  if (tokenRewards) txs.push(call({ to: V, abi: A.revenueShare, functionName: 'claimTokenRewards', args: [account], description: `Claim ${fmt(tokenRewards)} token rewards` }));
  if (!txs.length) return { ok: true, status: 'info', action: 'revshare-claim', summary: 'Nothing claimable' };
  return finish(account, 'revshare-claim', { weth: fmt(quote), flash: fmt(rewards), token: fmt(tokenRewards) }, txs);
}

// ------------------------------------------------------------------ treasuries

export async function treasuryInfo(options) {
  if (!options.token) throw new Error('--token is required');
  const token = getAddress(options.token);
  const address = await read(K.treasuryV3.factory, A.treasuryFactory, 'predictTreasury', [token]);
  const exists = await read(K.treasuryV3.factory, A.treasuryFactory, 'isTreasury', [address]);
  if (!exists) return { ok: true, status: 'info', action: 'treasury', token, treasury: address, deployed: false };
  const [quote, controller, mode, reward] = await Promise.all([read(address, A.treasury, 'quote'), read(address, A.treasury, 'controller'), read(address, A.treasury, 'mode'), read(address, A.treasury, 'rewardAsset')]);
  return { ok: true, status: 'info', action: 'treasury', token, treasury: address, deployed: true, quote, controller, mode: Number(mode), rewardAsset: reward, note: 'Per-token treasury (treasury-v3): swap fees reach it inside swaps; keepers convert and distribute. Controller-only settings are out of scope for this skill.' };
}

export { maxUint256 };
