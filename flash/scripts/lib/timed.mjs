// Timed launches (FlashTimedLaunchV5) and what a launch pays its creator. Mirrors app/src/timedLaunch.ts and
// v2/TimedDesk.tsx. The token exists from creation; entries until `launchAt` become one first buy, shared pro rata.
import { getAddress, parseUnits, zeroAddress } from 'viem';
import * as A from './abis.mjs';
import { K } from './contracts.mjs';
import { launchShape } from './encode.mjs';
import { client, call, approval, fmt } from './plan.mjs';
import { finish, minFlashForEth, resolvePair, shapeOf, slip, validateName, wallet, PAIR_NAMES, CURVE_PHASES } from './launch.mjs';

const T = K.launchV5.timed;
const CONFIG = K.launchV5.config;
const FLASH = K.tokens.FLASH.address;
const USDC = K.tokens.USDC.address;
const STATUS = ['NONE', 'OPEN', 'LAUNCHED', 'ABORTED'];
const OPEN = 1;
const LAUNCHED = 2;
const ABORTED = 3;
const BPS = 10_000n;
// The ETH fee swap overshoots by 30 % (oracle vs pool); the spare FLASH comes back. Same margin as the app.
const FEE_MARGIN_BPS = 13_000n;
// USDC -> FLASH has no pool quote here and a FLASH pair has no spot check on-chain: floor it on the oracle price.
const USDC_TOLERANCE_BPS = 1_500n;

const read = (address, abi, functionName, args = []) => client.readContract({ address, abi, functionName, args });
const readT = (functionName, args = []) => read(T, A.timedLaunch, functionName, args);
const nowS = () => Math.floor(Date.now() / 1000);
const iso = (seconds) => new Date(Number(seconds) * 1000).toISOString();
const usd = (wad) => Number(wad) / 1e18;
const prices = async () => {
  const [ethUsd, flashUsd] = await Promise.all([read(CONFIG, A.launchConfig, 'ethUsdPrice'), read(CONFIG, A.launchConfig, 'flashUsdPriceChecked')]);
  return { ethUsd, flashUsd };
};

async function timedRecord(tokenText) {
  if (!tokenText) throw new Error('--token is required');
  const token = getAddress(tokenText);
  const record = await readT('launchOf', [token]);
  return { token, record, known: record.status !== 0 };
}

async function requireTimed(options) {
  const found = await timedRecord(options.token);
  if (!found.known) throw new Error(`${found.token} is not a timed launch (timed-list)`);
  return found;
}

/** launch-info / launch-claim / ... work on any launch: a timed token goes to its timed handler. */
export const forTimed = (timedHandler, curveHandler) => async (options) => (options.token && (await timedRecord(options.token)).known ? timedHandler(options) : curveHandler(options));

function nextSteps(token, record, position, abortable, keeperWindow) {
  const at = Number(record.launchAt);
  if (record.status === OPEN && nowS() < at) return [`timed-enter --token ${token} --pay ETH|USDC|FLASH --amount N (until ${iso(at)})`];
  if (record.status === OPEN) {
    if (abortable) return [`timed-abort --token ${token}, then timed-refund --token ${token} for each entrant`];
    return [`Flash keepers launch it. Anyone can after ${iso(at + Number(keeperWindow))}: timed-launch --token ${token}`];
  }
  if (record.status === ABORTED) return position?.entered && !position.settled ? [`timed-refund --token ${token}`] : [];
  const steps = [`swap --market ${token} --side buy|sell --amount N`, `launch-earnings --token ${token}`];
  if (position?.canClaim) steps.unshift(`timed-claim --token ${token} (keepers also airdrop it)`);
  return steps;
}

export async function timedList() {
  const length = Number(await readT('launchesLength'));
  const tokens = await Promise.all(Array.from({ length: Math.min(length, 50) }, (_, offset) => readT('launchAt', [BigInt(length - 1 - offset)])));
  const rows = await Promise.all(tokens.map((token) => readT('launchOf', [token]).then((record) => ({ token, name: record.name, symbol: record.symbol, creator: record.creator, status: STATUS[record.status], launchAt: iso(record.launchAt), pair: PAIR_NAMES[record.pair], raisedFlash: fmt(record.raised) }))));
  return { ok: true, status: 'info', action: 'timed-list', contract: T, count: length, creationFeeFlash: fmt(await readT('currentCreationFee')), launches: rows };
}

export async function timedInfo(options) {
  const { token, record } = await requireTimed(options);
  const [entrants, abortable, keeperWindow, abortDelay, { flashUsd }] = await Promise.all([readT('participantsLength', [token]), readT('abortable', [token]), readT('keeperWindow'), readT('abortDelay'), prices()]);
  const out = {
    ok: true, status: 'info', action: 'timed-info', token, name: record.name, symbol: record.symbol, creator: record.creator, launchStatus: STATUS[record.status],
    launchAt: iso(record.launchAt), secondsToLaunch: Math.max(0, Number(record.launchAt) - nowS()), pair: PAIR_NAMES[record.pair], quote: record.quote === zeroAddress ? null : record.quote,
    entrants: Number(entrants), raisedFlash: fmt(record.raised), raisedUsd: usd(record.raised) * usd(flashUsd), creatorFlash: fmt(record.creatorFlash), firstBuyTokens: fmt(record.tokensOut), leftoverFlash: fmt(record.leftoverFlash),
    poolId: record.status === LAUNCHED ? record.poolId : null, treasury: record.status === LAUNCHED ? record.treasury : null, abortable, keeperWindowSeconds: Number(keeperWindow), abortDelaySeconds: Number(abortDelay),
  };
  let position;
  if (options.wallet) {
    const account = getAddress(options.wallet);
    const [entered, claimable, leftover, leftoverQuote, settled] = await Promise.all([readT('enteredOf', [token, account]), readT('claimableOf', [token, account]), readT('leftoverOf', [token, account]), readT('leftoverQuoteOf', [token, account]), readT('settled', [token, account])]);
    position = { entered: entered > 0n, settled, canClaim: claimable > 0n || leftover > 0n || leftoverQuote > 0n };
    out.position = { enteredFlash: fmt(entered), sharePct: record.raised ? Number((entered * 1_000_000n) / record.raised) / 10_000 : 0, claimableTokens: fmt(claimable), leftoverFlash: fmt(leftover), leftoverQuoteWei: leftoverQuote.toString(), settled };
  }
  out.next = nextSteps(token, record, position, abortable, keeperWindow);
  return out;
}

function launchTime(options, minDelay, maxDelay) {
  let at;
  if (options['in-minutes'] !== undefined) at = nowS() + Math.round(Number(options['in-minutes']) * 60);
  else if (options.at !== undefined) at = /^\d+$/.test(String(options.at)) ? Number(options.at) : Math.floor(Date.parse(String(options.at)) / 1000);
  else throw new Error('--at <unix seconds or ISO time> or --in-minutes N is required');
  if (!Number.isFinite(at)) throw new Error('--at must be unix seconds or an ISO time');
  // A minute of room for the transaction to mine inside the contract's window.
  if (at < nowS() + Number(minDelay) + 60 || at > nowS() + Number(maxDelay) - 60) throw new Error(`The launch time must be ${Number(minDelay) / 60} minutes to ${Number(maxDelay) / 86_400} days ahead, with a minute to mine`);
  return at;
}

export async function timedCreate(options) {
  const account = wallet(options);
  const identity = validateName(options);
  const { pair, quote, quoteSymbol } = await resolvePair(options);
  const [minDelay, maxDelay, fee, { ethUsd, flashUsd }] = await Promise.all([readT('minDelay'), readT('maxDelay'), readT('currentCreationFee'), prices()]);
  const at = launchTime(options, minDelay, maxDelay);
  const shape = await shapeOf(options, pair, quote);
  const input = { ...identity, pair, quote, shape: launchShape(shape), launchAt: BigInt(at) };
  const pay = String(options.pay || 'ETH').toUpperCase();
  const summary = { ...identity, pair: PAIR_NAMES[pair], quote: quoteSymbol, launchAt: iso(at), creationFeeFlash: fmt(fee), shape: shape.label, mode: shape.mode, preset: shape.preset, rewardAsset: shape.rewardAsset === zeroAddress ? 'pair default' : shape.rewardAsset };
  const warnings = ['Launches are permanent and public. Save the signed token profile with art first (LAUNCHES.md).'];
  const notes = ['The token address is in TimedLaunchCreated(token, creator, pair, quote, launchAt, fee, salt) and can be shared right away.', 'After the launch time keepers launch it. Half of all entries is paid to the creator then.'];
  if (pay === 'FLASH') {
    const tx = call({ to: T, abi: A.timedLaunch, functionName: 'create', args: [input], description: `Create timed launch ${identity.symbol} (FLASH fee)` });
    const budget = (fee * 11n) / 10n; // +10% for the live FLASH price moving
    return finish(account, 'timed-create', { ...summary, payWith: 'FLASH' }, [...await approval(account, FLASH, T, budget, 'FLASH', 'the timed launch contract'), tx], warnings, notes);
  }
  if (pay !== 'ETH') throw new Error('--pay ETH|FLASH');
  const value = ((fee * flashUsd) / ethUsd) * FEE_MARGIN_BPS / BPS + 1n;
  const args = [input, fee];
  const predicted = await client.simulateContract({ address: T, abi: A.timedLaunch, functionName: 'createWithEth', args, value, account }).then((sim) => sim.result).catch(() => undefined);
  const tx = call({ to: T, abi: A.timedLaunch, functionName: 'createWithEth', args, value, description: `Create timed launch ${identity.symbol} (ETH buys the FLASH fee)` });
  return finish(account, 'timed-create', { ...summary, payWith: 'ETH', ethIn: fmt(value), ...(predicted ? { predictedToken: predicted } : {}) }, [tx], warnings, notes);
}

export async function timedEnter(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (record.status !== OPEN || nowS() >= Number(record.launchAt)) throw new Error(`${record.symbol} is closed to entries (${STATUS[record.status]}, launch time ${iso(record.launchAt)})`);
  if (!options.amount) throw new Error('--amount is required');
  const pay = String(options.pay || 'ETH').toUpperCase();
  if (!['ETH', 'USDC', 'FLASH'].includes(pay)) throw new Error('--pay ETH|USDC|FLASH');
  const amount = parseUnits(String(options.amount), pay === 'USDC' ? 6 : 18);
  const [{ ethUsd, flashUsd }, minEntry] = await Promise.all([prices(), readT('minEntryUsd18')]);
  const valueUsd = pay === 'USDC' ? amount * 10n ** 12n : (amount * (pay === 'ETH' ? ethUsd : flashUsd)) / 10n ** 18n;
  if (valueUsd < minEntry) throw new Error(`The minimum entry is $${usd(minEntry)}; this is about $${usd(valueUsd).toFixed(2)}`);
  const notes = ['The token share is proportional to the FLASH entered. Half funds the first buy, half goes to the creator at launch.'];
  if (pay === 'ETH') {
    const { flash, minFlash } = await minFlashForEth(amount, slip(options));
    return finish(account, 'timed-enter', { token: record.symbol, ethIn: fmt(amount), expectedFlash: fmt(flash), minFlash: fmt(minFlash) },
      [call({ to: T, abi: A.timedLaunch, functionName: 'enterWithEth', args: [token, minFlash], value: amount, description: `Enter ${record.symbol} with ETH` })], [], notes);
  }
  const tokenIn = pay === 'USDC' ? USDC : FLASH;
  const minFlash = pay === 'USDC' ? ((amount * 10n ** 30n) / flashUsd) * (BPS - USDC_TOLERANCE_BPS) / BPS : 0n;
  return finish(account, 'timed-enter', { token: record.symbol, pay, amount: String(options.amount), minFlash: fmt(minFlash) },
    [...await approval(account, tokenIn, T, amount, pay, 'the timed launch contract'), call({ to: T, abi: A.timedLaunch, functionName: 'enterWithToken', args: [token, tokenIn, amount, minFlash], description: `Enter ${record.symbol} with ${pay}` })], [], notes);
}

export async function timedLaunchNow(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (record.status !== OPEN) throw new Error(`${record.symbol} is ${STATUS[record.status]}`);
  const at = Number(record.launchAt);
  if (nowS() < at) throw new Error(`${record.symbol} launches at ${iso(at)}: it cannot launch before then`);
  const keeperWindow = Number(await readT('keeperWindow'));
  const warnings = nowS() < at + keeperWindow ? [`Only Flash keepers can launch until ${iso(at + keeperWindow)}: this reverts NotKeeper from any other wallet.`] : [];
  return finish(account, 'timed-launch', { token: record.symbol, raisedFlash: fmt(record.raised) }, [call({ to: T, abi: A.timedLaunch, functionName: 'launch', args: [token, BigInt(options['min-quote'] || 0), BigInt(options['min-tokens'] || 0)], description: `Launch ${record.symbol} (one first buy from every entry)` })], warnings,
    ['A revert here can mean the FLASH/ETH pool cannot take the whole sale now. Keepers then use launchPartial; the unsold FLASH goes back to entrants with their tokens.']);
}

export async function timedAbort(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (!(await readT('abortable', [token]))) throw new Error(`${record.symbol} is not abortable: only an open launch past its time with a first buy under the minimum, or one still not launched after the abort delay`);
  return finish(account, 'timed-abort', { token: record.symbol }, [call({ to: T, abi: A.timedLaunch, functionName: 'abort', args: [token], description: `Abort ${record.symbol}` })], [], [`Entrants then get their money back: timed-refund --token ${token}.`]);
}

export async function timedClaim(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (record.status !== LAUNCHED) throw new Error(`Claims open after launch; ${record.symbol} is ${STATUS[record.status]}${record.status === ABORTED ? ' (use timed-refund)' : ''}`);
  const [tokens, flash, quote] = await Promise.all([readT('claimableOf', [token, account]), readT('leftoverOf', [token, account]), readT('leftoverQuoteOf', [token, account])]);
  if (!tokens && !flash && !quote) throw new Error('Nothing to claim (an airdrop may already have paid it)');
  return finish(account, 'timed-claim', { token: record.symbol, tokens: fmt(tokens), leftoverFlash: fmt(flash), leftoverQuoteWei: quote.toString() }, [call({ to: T, abi: A.timedLaunch, functionName: 'claim', args: [token], description: `Claim ${record.symbol} and any leftovers` })]);
}

export async function timedRefund(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (record.status !== ABORTED) throw new Error(`Refunds open only when the launch is ABORTED; ${record.symbol} is ${STATUS[record.status]}`);
  const who = options.account ? getAddress(options.account) : account;
  const [entered, settled] = await Promise.all([readT('enteredOf', [token, who]), readT('settled', [token, who])]);
  if (!entered || settled) throw new Error(`${who} has nothing to refund`);
  return finish(account, 'timed-refund', { token: record.symbol, account: who, enteredFlash: fmt(entered) }, [call({ to: T, abi: A.timedLaunch, functionName: 'refund', args: [token, who], description: `Refund ${who} from aborted ${record.symbol} (permissionless)` })]);
}

export async function timedAirdrop(options) {
  const account = wallet(options);
  const { token, record } = await requireTimed(options);
  if (record.status !== LAUNCHED) throw new Error(`${record.symbol} is ${STATUS[record.status]}: airdrops open after launch`);
  const count = BigInt(options.count || 100);
  return finish(account, 'timed-airdrop', { token: record.symbol, entrants: Number(await readT('participantsLength', [token])) }, [call({ to: T, abi: A.timedLaunch, functionName: 'airdrop', args: [token, BigInt(options.from || 0), count], description: `Airdrop ${record.symbol} to entrants (permissionless, 100 per call)` })]);
}

// ------------------------------------------------------------- what a launch pays its creator

async function treasuryCut(token) {
  const address = await read(K.treasuryV3.factory, A.treasuryFactory, 'predictTreasury', [token]);
  if (!(await read(K.treasuryV3.factory, A.treasuryFactory, 'isTreasury', [address]))) return { treasury: address, deployed: false };
  const [[rewardBps, lpBps, recipient, custom], controller] = await Promise.all([read(K.treasuryV3.shares, A.treasuryShares, 'sharesOf', [address]), read(address, A.treasury, 'controller')]);
  return { treasury: address, deployed: true, controller, recipient: recipient === zeroAddress ? controller : recipient, lpSharePct: Number(lpBps) / 100, rewardSharePct: Number(rewardBps) / 100, custom };
}

/** Everything a launch pays its creator, for any launch kind, with how each one arrives. */
export async function launchEarnings(options) {
  if (!options.token) throw new Error('--token is required');
  const token = getAddress(options.token);
  const account = options.wallet ? getAddress(options.wallet) : undefined;
  const [curveRecord, directRecord, timed] = await Promise.all([read(K.launchV5.launchpad, A.launchpad, 'launchOf', [token]), read(K.launchV5.direct, A.directLaunch, 'launchOf', [token]), readT('launchOf', [token])]);
  const kind = curveRecord.curve !== zeroAddress ? 'curve' : directRecord.creator !== zeroAddress ? 'direct' : timed.status !== 0 ? 'timed' : undefined;
  if (!kind) throw new Error(`${token} is not a Flash launch`);
  const creator = kind === 'curve' ? curveRecord.creator : kind === 'direct' ? directRecord.creator : timed.creator;
  const items = [];
  if (kind === 'timed') {
    const arrives = timed.status === LAUNCHED ? 'Paid to the creator at launch' : timed.status === ABORTED ? 'Returned to entrants' : `Paid to the creator automatically at launch (${iso(timed.launchAt)})`;
    items.push({ what: 'Half of the raise, in FLASH', flash: fmt(timed.creatorFlash), arrives, command: null });
    if (account) {
      const [tokens, flash] = await Promise.all([readT('claimableOf', [token, account]), readT('leftoverOf', [token, account])]);
      if (tokens || flash) items.push({ what: 'Your share of the first buy', tokens: fmt(tokens), leftoverFlash: fmt(flash), arrives: 'Keeper airdrop, or claim it', command: `timed-claim --token ${token}` });
    }
  }
  if (kind === 'curve') {
    const owed = await read(curveRecord.curve, A.curve, 'creatorFeesOwed');
    items.push({ what: 'Curve creator fees, in FLASH', flash: fmt(owed), arrives: 'Claim them', command: `launch-creator-claim --token ${token}` });
    if (account) {
      const tokens = await read(curveRecord.curve, A.curve, 'claimableTokensOf', [account]);
      if (tokens) items.push({ what: 'Your curve position', tokens: fmt(tokens), arrives: 'After graduation: keeper airdrop, or claim it', command: `launch-claim --token ${token}` });
    }
  }
  const cut = await treasuryCut(token);
  items.push({ what: 'Creator cut of swap fees and treasury income', ...(cut.deployed ? { lpSharePct: cut.lpSharePct, rewardSharePct: cut.rewardSharePct, recipient: cut.recipient } : {}), arrives: 'Keepers pay it to the recipient. There is nothing to claim.', command: `treasury-shares --token ${token} --reward-bps N --lp-bps N [--recipient 0x...]` });
  const poolId = await read(K.flashV3.registry, A.v3Registry, 'poolOfToken', [token]);
  if (!/^0x0+$/.test(poolId)) {
    const info = await read(K.flashV3.hook, A.v3Hook, 'poolInfoOf', [poolId]);
    if (info.kind === 4) {
      const route = await read(K.perps.issuer, A.perpsIssuer, 'memeRoutes', [poolId]);
      items.push({ what: 'QUANT from a PERP pair', quant: fmt(route[1] > 1n ? route[1] - 1n : 0n), arrives: 'Minted to the creator on a sweep', command: `quant-sweep --token ${token}` });
    }
  }
  const out = { ok: true, status: 'info', action: 'launch-earnings', token, kind, creator, treasury: cut, items };
  if (kind === 'curve') out.phase = CURVE_PHASES[await read(curveRecord.curve, A.curve, 'phase')];
  if (kind === 'timed') out.launchStatus = STATUS[timed.status];
  if (account) out.isCreator = creator.toLowerCase() === account.toLowerCase();
  return out;
}

export async function treasurySharesSet(options) {
  const account = wallet(options);
  if (!options.token) throw new Error('--token is required');
  const token = getAddress(options.token);
  const cut = await treasuryCut(token);
  if (!cut.deployed) throw new Error(`The treasury of ${token} is not deployed yet: it appears at launch`);
  if (cut.controller.toLowerCase() !== account.toLowerCase()) throw new Error(`Only the treasury controller ${cut.controller} can change the creator cut`);
  if (options.clear) return finish(account, 'treasury-shares', { treasury: cut.treasury, shares: 'default (5% rewards, 80% LP)' }, [call({ to: K.treasuryV3.shares, abi: A.treasuryShares, functionName: 'clearShares', args: [cut.treasury], description: 'Reset the creator cut to the defaults' })]);
  const rewardBps = Number(options['reward-bps']);
  const lpBps = Number(options['lp-bps']);
  if (!Number.isInteger(rewardBps) || rewardBps < 0 || rewardBps > 1000) throw new Error('--reward-bps must be 0-1000 (0-10%)');
  if (!Number.isInteger(lpBps) || lpBps < 0 || lpBps > 8000) throw new Error('--lp-bps must be 0-8000 (0-80%)');
  // Unset keeps a custom recipient the controller already chose (0 = paid to the controller).
  const recipient = options.recipient ? getAddress(options.recipient) : cut.recipient.toLowerCase() === cut.controller.toLowerCase() ? zeroAddress : cut.recipient;
  return finish(account, 'treasury-shares', { treasury: cut.treasury, rewardSharePct: rewardBps / 100, lpSharePct: lpBps / 100, recipient: recipient === zeroAddress ? 'the controller' : recipient },
    [call({ to: K.treasuryV3.shares, abi: A.treasuryShares, functionName: 'setShares', args: [cut.treasury, rewardBps, lpBps, recipient], description: 'Set the creator cut and who receives it' })]);
}
