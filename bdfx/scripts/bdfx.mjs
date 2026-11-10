#!/usr/bin/env node
// BDFX private prototype: live quotes only; all order/payment operations are offline.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

export class BdfxError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export const SKILL_REVISION = '2026-10-05.4';
function requireThat(condition, code, message) {
  if (!condition) throw new BdfxError(code, message);
}
const sha = value => createHash('sha256').update(value).digest();
const digest = value => sha(JSON.stringify(value)).toString('hex');
export const SOURCES = Object.freeze({
  'usdc:matic': { label: 'USDC on Polygon', decimals: 6, contractVerified: false },
  'usdc:arbitrum': { label: 'USDC on Arbitrum', decimals: 6, contractVerified: false },
  'usdc:eth': { label: 'USDC on Ethereum', decimals: 6, contractVerified: false },
  'eth:mainnet': { label: 'Native ETH on Ethereum', decimals: 18, contractVerified: true },
});
const BANKR_SOURCE_NETWORKS = Object.freeze({
  eth: { bankrChain: 'mainnet', transferPath: 'evm_direct_candidate' },
  bsc: { bankrChain: 'bnb', transferPath: 'evm_direct_candidate' },
  base: { bankrChain: 'base', transferPath: 'evm_direct_candidate' },
  arbitrum: { bankrChain: 'arbitrum', transferPath: 'evm_direct_candidate' },
  matic: { bankrChain: 'polygon', transferPath: 'evm_direct_candidate' },
  robinhood: { bankrChain: 'robinhood', transferPath: 'evm_direct_candidate' },
  arc: { bankrChain: 'arc', transferPath: 'evm_direct_candidate' },
  sol: { bankrChain: 'solana', transferPath: 'agent_or_svm_path_unverified' },
});
const BANKR_NATIVE_SOURCES = Object.freeze({
  'eth:mainnet': { bankrChain: 'mainnet', transferPath: 'evm_direct_candidate' },
  'pol:mainnet': { bankrChain: 'polygon', transferPath: 'evm_direct_candidate' },
  'sol:mainnet': { bankrChain: 'solana', transferPath: 'agent_or_svm_path_unverified' },
});
const LIVE_ACTIONS = new Set(['catalog', 'range', 'estimate']);
const PROVIDER_STATES = new Set(['waiting', 'confirming', 'exchanging', 'sending', 'verifying', 'finished', 'failed', 'refunded', 'expired']);
const DEMO_BTC = '1BoatSLRHtKNngkdXEeobR76b53LETtpyT';
const DEMO_REFUND = '0x1111111111111111111111111111111111111111';
const DEMO_DEPOSIT = '0x2222222222222222222222222222222222222222';

export function units(value, decimals = 18) {
  requireThat(typeof value === 'string' && /^(0|[1-9]\d{0,17})(\.\d+)?$/.test(value), 'INVALID_AMOUNT', 'Use a positive plain decimal string, without commas or exponent notation.');
  const [whole, fraction = ''] = value.split('.');
  requireThat(fraction.length <= decimals, 'INVALID_PRECISION', `Amount has more than ${decimals} decimal places.`);
  const result = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  requireThat(result > 0n, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  return result;
}
function positiveResponseNumber(value, field) {
  requireThat(typeof value === 'number' && Number.isFinite(value) && value > 0, 'INVALID_RESPONSE', `Invalid ${field} from BDFX.`);
  return value;
}
export function validateBitcoin(address) {
  requireThat(typeof address === 'string' && address.length >= 14 && address.length <= 90 && address === address.trim(), 'INVALID_BTC_ADDRESS', 'Enter a Bitcoin mainnet address without whitespace.');
  if (/^bc1/i.test(address)) {
    requireThat(address === address.toLowerCase() || address === address.toUpperCase(), 'INVALID_BTC_ADDRESS', 'Mixed-case witness address.');
    const text = address.toLowerCase();
    const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const words = [...text.slice(3)].map(c => alphabet.indexOf(c));
    requireThat(words.length >= 7 && words.every(v => v >= 0), 'INVALID_BTC_ADDRESS', 'Invalid witness encoding.');
    const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
    let chk = 1;
    for (const value of [3, 3, 0, 2, 3, ...words]) {
      const top = chk >>> 25;
      chk = ((chk & 0x1ffffff) << 5) ^ value;
      for (let j = 0; j < 5; j++) if ((top >>> j) & 1) chk ^= generators[j];
    }
    const version = words[0];
    requireThat(version <= 16 && (chk >>> 0) === (version === 0 ? 1 : 0x2bc830a3), 'INVALID_BTC_ADDRESS', 'Invalid witness version or checksum.');
    let accumulator = 0, bits = 0;
    const program = [];
    for (const value of words.slice(1, -6)) {
      accumulator = ((accumulator << 5) | value) & 0xffff;
      bits += 5;
      while (bits >= 8) { bits -= 8; program.push((accumulator >>> bits) & 255); }
    }
    requireThat(bits < 5 && ((accumulator << (8 - bits)) & 255) === 0, 'INVALID_BTC_ADDRESS', 'Invalid witness padding.');
    requireThat(program.length >= 2 && program.length <= 40 && (version !== 0 || [20, 32].includes(program.length)), 'INVALID_BTC_ADDRESS', 'Invalid witness program length.');
    // This initial payout integration only enables established witness forms.
    requireThat(version === 0 || (version === 1 && program.length === 32), 'UNSUPPORTED_BTC_ADDRESS', 'Prototype supports legacy, SegWit v0, and Taproot addresses.');
    return text;
  }
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  requireThat(address.length <= 35 && /^[13]/.test(address), 'INVALID_BTC_ADDRESS', 'A Bitcoin mainnet address is required.');
  let value = 0n;
  for (const c of address) {
    const n = alphabet.indexOf(c);
    requireThat(n >= 0, 'INVALID_BTC_ADDRESS', 'Invalid Base58 character.');
    value = value * 58n + BigInt(n);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = Buffer.concat([Buffer.alloc(address.match(/^1*/)[0].length), Buffer.from(hex, 'hex')]);
  requireThat(bytes.length === 25 && [0, 5].includes(bytes[0]) && sha(sha(bytes.subarray(0, 21))).subarray(0, 4).equals(bytes.subarray(21)), 'INVALID_BTC_ADDRESS', 'Invalid Bitcoin address checksum.');
  return address;
}
export function validateEvm(address) {
  requireThat(typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address) && !/^0x0{40}$/i.test(address), 'INVALID_EVM_ADDRESS', 'Expected a nonzero EVM address.');
  // Format validation only; this version cannot authorize any real transfer.
  return address;
}
function routeId(value, field) {
  requireThat(typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,31}:[a-z0-9][a-z0-9_-]{0,31}$/.test(value), 'INVALID_ROUTE', `Invalid ${field} asset/network identifier.`);
  return value;
}
function sourceProfile(id) {
  const native = BANKR_NATIVE_SOURCES[id];
  if (native) return native;
  const [, network] = id.split(':');
  requireThat(Object.hasOwn(BANKR_SOURCE_NETWORKS, network), 'UNSUPPORTED_SOURCE_NETWORK', 'The source is not on a Bankr-listed funding network.');
  return BANKR_SOURCE_NETWORKS[network];
}

export async function liveRequest(action, payload, fetcher = globalThis.fetch) {
  requireThat(LIVE_ACTIONS.has(action), 'LIVE_WRITE_DISABLED', 'This build can only request live ranges and estimates.');
  if (action === 'catalog') {
    let response;
    try {
      response = await fetcher('https://bdfx.io/?action=currencies', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
        headers: { Accept: 'application/json' },
      });
    } catch { throw new BdfxError('NETWORK_ERROR', 'BDFX catalogue request failed or timed out.'); }
    let body; try { body = await response.json(); } catch { throw new BdfxError('INVALID_RESPONSE', 'BDFX did not return JSON.'); }
    requireThat(response.ok && body?.ok === true && Array.isArray(body.data), 'CATALOG_UNAVAILABLE', typeof body?.error === 'string' ? body.error.slice(0, 500) : 'BDFX catalogue unavailable.');
    const assets = body.data.filter(x => x && typeof x.symbol === 'string' && typeof x.network === 'string').map(x => ({
      id: `${x.symbol}:${x.network}`, symbol: x.symbol, network: x.network, name: x.name ?? null,
      rates: Array.isArray(x.rates) ? x.rates : [], precision: x.precision ?? null, extra_id: x.extra_id ?? null,
      address_regex: x.address_regex ?? null, contract_address: x.contract_address ?? null,
    }));
    const network = payload?.network;
    return { mode: 'live_catalog', skill_revision: SKILL_REVISION, observed_at: new Date().toISOString(), count: assets.length,
      assets: network ? assets.filter(x => x.network === network) : assets,
      note: 'Current BDFX catalogue metadata; not proof of a live pair, Bankr balance, token ownership or funding permission.' };
  }
  const from = routeId(payload.from, 'source');
  const to = routeId(payload.to, 'destination');
  requireThat(from !== to, 'UNSUPPORTED_ROUTE', 'Source and destination must differ.');
  const funding = sourceProfile(from);
  const clean = { from, to, rate: 'floating', estimation: 'direct', additional_fee_percent: 0, fee_percent: '0.10' };
  if (action === 'estimate') {
    units(payload.amount, 18);
    clean.amount = payload.amount;
  }
  let response;
  try {
    response = await fetcher(`https://bdfx.io/?action=${action}`, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(25000),
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(clean),
    });
  } catch {
    throw new BdfxError('NETWORK_ERROR', 'BDFX quote request failed or timed out. No order was created.');
  }
  let body;
  try { body = await response.json(); } catch { throw new BdfxError('INVALID_RESPONSE', 'BDFX did not return JSON.'); }
  requireThat(response.ok && body?.ok === true, 'QUOTE_UNAVAILABLE', typeof body?.error === 'string' ? body.error.slice(0, 500) : `BDFX returned HTTP ${response.status}.`);
  const range = action === 'range' ? body.data : body.data?.range;
  const minimum = positiveResponseNumber(range?.min_amount, 'minimum amount');
  const maximum = range?.max_amount == null ? null : positiveResponseNumber(range.max_amount, 'maximum amount');
  requireThat(maximum === null || maximum >= minimum, 'INVALID_RESPONSE', 'BDFX returned inconsistent limits.');
  const result = {
    mode: 'live_quote_only', skill_revision: SKILL_REVISION, from, to,
    rate: 'floating', fee_percent: '0.10', additional_fee_percent: '0',
    min_amount: String(minimum), max_amount: maximum === null ? null : String(maximum),
    observed_at: new Date().toISOString(),
    bankr_chain_candidate: funding.bankrChain,
    bankr_transfer_path: funding.transferPath,
    source_identity_verified_for_funding: false,
    can_create: false, can_fund: false,
    note: 'Floating estimate, not a guaranteed payout. Funding gas is separate. No exchange has been created.',
  };
  if (action === 'estimate') {
    requireThat(Number(payload.amount) >= minimum && (maximum === null || Number(payload.amount) <= maximum), 'INVALID_RESPONSE', 'Quote amount is outside returned limits.');
    result.amount = payload.amount;
    result.estimated_output = String(positiveResponseNumber(body.data?.estimate?.estimated_amount, 'estimated output amount'));
    if (to === 'btc:mainnet') result.estimated_btc = result.estimated_output;
  }
  return result;
}

function readState(path) {
  const state = JSON.parse(readFileSync(path, 'utf8'));
  requireThat(state?.schema === 1 && state.simulation === true && state.id?.startsWith('sim-'), 'INVALID_STATE', 'Not a BDFX simulation state.');
  return state;
}
function writeState(path, state) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    renameSync(temp, path);
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}
function locked(path, work) {
  const lock = `${path}.lock`;
  try { mkdirSync(lock, { mode: 0o700 }); }
  catch (error) {
    if (error.code === 'EEXIST') throw new BdfxError('STATE_BUSY', 'Another operation owns this state. A leftover lock requires inspection; do not automatically retry payment.');
    throw error;
  }
  try { return work(); } finally { rmdirSync(lock); }
}
export class Simulation {
  constructor(path, clock = () => Date.now()) { this.path = resolve(path); this.clock = clock; }
  snapshot() { return readState(this.path); }
  update(work) {
    return locked(this.path, () => {
      const state = readState(this.path);
      work(state);
      state.updated_at = this.clock();
      writeState(this.path, state);
      return state;
    });
  }
  begin({ amount = '100', btc = DEMO_BTC, refund = DEMO_REFUND } = {}) {
    units(amount, 6);
    requireThat(units(amount, 6) >= 35000000n && units(amount, 6) <= 100000000n, 'SIMULATION_LIMIT', 'Simulation accepts 35–100 fictitious USDC. Live limits are separate.');
    validateBitcoin(btc); validateEvm(refund);
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 });
    return locked(this.path, () => {
      requireThat(!existsSync(this.path), 'STATE_EXISTS', 'State already exists. Inspect/resume it instead of replacing it.');
      const state = {
        schema: 1, simulation: true, id: `sim-${randomUUID()}`, phase: 'quoted',
        intent: { from: 'usdc:matic', chain: 'polygon', chain_id: 137, token_contract: '0x3333333333333333333333333333333333333333', decimals: 6, amount, to: 'btc:mainnet', btc: validateBitcoin(btc), refund },
        quote: { estimated_btc: '0.001', rate: 'floating', fee_percent: '0.10', additional_fee_percent: '0', review_until: this.clock() + 120000 },
        order: null, payment: null, create_attempts: 0, payment_attempts: 0, history: ['quoted'],
      };
      state.review_id = digest({ intent: state.intent, quote: state.quote });
      writeState(this.path, state);
      return state;
    });
  }
  move(state, phase) { state.phase = phase; state.history.push(phase); }
  accept(reviewId) {
    return this.update(state => {
      requireThat(state.phase === 'quoted', 'INVALID_PHASE', 'A current quote is required.');
      requireThat(this.clock() < state.quote.review_until, 'STALE_QUOTE', 'Refresh and review the quote before creating an order.');
      requireThat(reviewId === state.review_id && reviewId === digest({ intent: state.intent, quote: state.quote }), 'REVIEW_MISMATCH', 'The accepted details do not match the review.');
      this.move(state, 'accepted');
    });
  }
  create(scenario = 'ok') {
    requireThat(['ok', 'timeout', 'mismatch'].includes(scenario), 'INVALID_SCENARIO', 'Unknown simulated create outcome.');
    this.update(state => {
      requireThat(state.phase === 'accepted' && state.create_attempts === 0, 'CREATE_BLOCKED', 'Creation was already attempted or the quote has not been accepted.');
      requireThat(this.clock() < state.quote.review_until, 'STALE_QUOTE', 'Quote review expired before creation.');
      requireThat(state.review_id === digest({ intent: state.intent, quote: state.quote }), 'REVIEW_MISMATCH', 'Reviewed details changed.');
      state.create_attempts++;
      this.move(state, 'creating'); // persisted before the simulated external operation
    });
    return this.update(state => {
      requireThat(state.phase === 'creating', 'INVALID_PHASE', 'No creation in progress.');
      if (scenario === 'timeout') { this.move(state, 'create_unknown'); return; }
      state.order = {
        id: `sim-order-${randomUUID()}`, status: 'waiting',
        deposit: { symbol: 'usdc', network: 'matic', expected_amount: state.intent.amount, address: DEMO_DEPOSIT, extra_id: null },
        withdrawal: { symbol: 'btc', network: 'mainnet', address: scenario === 'mismatch' ? 'wrong-address' : state.intent.btc, tx_hash: null },
        refund_address: state.intent.refund,
      };
      if (!this.orderMatches(state)) { this.move(state, 'rejected_deposit'); return; }
      state.transfer_review_id = digest(this.transferDetails(state));
      this.move(state, 'awaiting_transfer');
    });
  }
  orderMatches(state) {
    const { intent, order } = state;
    return order?.deposit?.network === 'matic' && order.deposit.symbol === 'usdc'
      && order.deposit.expected_amount === intent.amount && !order.deposit.extra_id
      && order.withdrawal?.address === intent.btc && order.withdrawal.symbol === 'btc'
      && order.withdrawal.network === 'mainnet' && order.refund_address === intent.refund
      && /^0x[0-9a-f]{40}$/.test(order.deposit.address) && !/^0x0{40}$/.test(order.deposit.address);
  }
  transferDetails(state) {
    return { simulation: true, order_id: state.order.id, ...state.intent,
      deposit_address: state.order.deposit.address, amount_units: units(state.order.deposit.expected_amount, state.intent.decimals).toString() };
  }
  approveTransfer(reviewId) {
    return this.update(state => {
      requireThat(state.phase === 'awaiting_transfer' && this.orderMatches(state), 'TRANSFER_BLOCKED', 'No validated deposit to approve.');
      requireThat(reviewId === state.transfer_review_id && reviewId === digest(this.transferDetails(state)), 'REVIEW_MISMATCH', 'Transfer details changed after review.');
      this.move(state, 'transfer_approved');
    });
  }
  fund(scenario = 'ok') {
    requireThat(['ok', 'timeout'].includes(scenario), 'INVALID_SCENARIO', 'Unknown simulated payment outcome.');
    this.update(state => {
      requireThat(state.phase === 'transfer_approved' && state.payment_attempts === 0, 'PAYMENT_BLOCKED', 'Payment needs approval and must not have been attempted.');
      requireThat(this.orderMatches(state) && state.transfer_review_id === digest(this.transferDetails(state)), 'REVIEW_MISMATCH', 'Transfer changed after approval.');
      state.payment_attempts++;
      state.payment = { attempt_id: `sim-payment-${randomUUID()}`, tx_hash: null };
      this.move(state, 'funding'); // persisted before any simulated broadcast
    });
    return this.update(state => {
      requireThat(state.phase === 'funding', 'INVALID_PHASE', 'No payment in progress.');
      if (scenario === 'timeout') { this.move(state, 'funding_unknown'); return; }
      state.payment.tx_hash = `sim-evm-${digest(state.payment.attempt_id)}`;
      this.move(state, 'funded');
    });
  }
  reconcileSimulation() {
    return this.update(state => {
      requireThat(['funding', 'funding_unknown'].includes(state.phase), 'RECONCILIATION_BLOCKED', 'Only a simulated unknown payment can be reconciled by this command.');
      state.payment.tx_hash = `sim-evm-${digest(state.payment.attempt_id)}`;
      this.move(state, 'funded');
    });
  }
  status(providerStatus, payoutHash = null) {
    requireThat(PROVIDER_STATES.has(providerStatus), 'INVALID_STATUS', 'Unknown provider status.');
    return this.update(state => {
      requireThat(['funded', 'provider_pending', 'payout_unverified'].includes(state.phase), 'STATUS_BLOCKED', 'This simulation needs a recorded funding transaction.');
      state.order.status = providerStatus;
      if (['failed', 'refunded', 'expired'].includes(providerStatus)) this.move(state, providerStatus);
      else if (providerStatus === 'finished') {
        requireThat(payoutHash === null || /^[a-f0-9]{64}$/.test(payoutHash), 'INVALID_PAYOUT', 'Invalid simulated Bitcoin transaction hash.');
        state.order.withdrawal.tx_hash = payoutHash;
        this.move(state, payoutHash ? 'complete' : 'payout_unverified');
      } else this.move(state, 'provider_pending');
    });
  }
  cancel() {
    return this.update(state => {
      requireThat(['quoted', 'accepted', 'awaiting_transfer', 'transfer_approved'].includes(state.phase) && state.payment_attempts === 0, 'CANCEL_BLOCKED', 'A payment may exist. Resume/reconcile instead of cancelling locally.');
      this.move(state, 'cancelled');
    });
  }
}

export function runDemo(scenario = 'happy', path = resolve(tmpdir(), `bdfx-simulation-${randomUUID()}.json`)) {
  requireThat(['happy', 'create-timeout', 'transfer-timeout', 'deposit-mismatch', 'expired-quote', 'cancelled', 'refunded', 'failed', 'verifying'].includes(scenario), 'INVALID_SCENARIO', 'Unknown demo scenario.');
  let now = Date.now();
  const flow = new Simulation(path, () => now);
  const initial = flow.begin();
  if (scenario === 'expired-quote') now += 120001;
  let stopped = null;
  try {
    flow.accept(initial.review_id);
    flow.create(scenario === 'create-timeout' ? 'timeout' : scenario === 'deposit-mismatch' ? 'mismatch' : 'ok');
    if (flow.snapshot().phase === 'awaiting_transfer') {
      if (scenario === 'cancelled') flow.cancel();
      else {
        flow.approveTransfer(flow.snapshot().transfer_review_id);
        flow.fund(scenario === 'transfer-timeout' ? 'timeout' : 'ok');
        if (flow.snapshot().phase === 'funded') {
          flow.status('confirming');
          if (['refunded', 'failed', 'verifying'].includes(scenario)) flow.status(scenario);
          else { flow.status('exchanging'); flow.status('sending'); flow.status('finished', 'a'.repeat(64)); }
        }
      }
    }
  } catch (error) {
    if (!(error instanceof BdfxError)) throw error;
    stopped = { code: error.code, message: error.message };
  }
  return { mode: 'simulation', no_network_calls: true, scenario, state_file: resolve(path), stopped, ...summary(flow.snapshot()) };
}
function summary(state) {
  return { simulation: true, id: state.id, phase: state.phase, history: state.history,
    create_attempts: state.create_attempts, payment_attempts: state.payment_attempts,
    note: 'Fictitious assets, addresses, quotes and receipts. Never fund these instructions. No provider or wallet was contacted.' };
}
const HELP = `BDFX public discovery and offline rehearsal (Node 18+; no packages or credentials)
  node bdfx.mjs routes
  node bdfx.mjs catalog [--network matic]
  node bdfx.mjs range --from usdc:matic [--to btc:mainnet]
  node bdfx.mjs quote --from usdc:matic --to ltc:mainnet --amount 100
  node bdfx.mjs validate-btc --address ADDRESS
  node bdfx.mjs demo [--scenario happy|create-timeout|transfer-timeout|deposit-mismatch|expired-quote|cancelled|refunded|failed|verifying] [--state-file PATH]
  node bdfx.mjs inspect --state-file PATH
  node bdfx.mjs resume-demo --state-file PATH
Only range and quote contact bdfx.io. All order/payment operations are simulations.
Live create, fund, sign and transfer commands are unavailable.`;
export async function main(argv) {
  const [command = 'help', ...args] = argv;
  const options = {};
  const allowedOptions = {
    routes: [], catalog: ['network'], help: [], range: ['from', 'to'], quote: ['from', 'to', 'amount'], 'validate-btc': ['address'],
    demo: ['scenario', 'state-file'], inspect: ['state-file'], 'resume-demo': ['state-file'],
  };
  requireThat(Object.hasOwn(allowedOptions, command), 'COMMAND_DISABLED', 'Unsupported command. Live order creation and payments are not implemented in this build.');
  for (let i = 0; i < args.length; i += 2) {
    const name = args[i].startsWith('--') ? args[i].slice(2) : '';
    requireThat(allowedOptions[command].includes(name) && args[i + 1] !== undefined && !Object.hasOwn(options, name), 'INVALID_ARGUMENT', `Invalid or repeated option: ${args[i]}`);
    options[name] = args[i + 1];
  }
  if (command === 'help') return { help: HELP };
  if (command === 'catalog') return liveRequest('catalog', { network: options.network });
  if (command === 'routes') return { mode: 'live_quote_only', skill_revision: SKILL_REVISION, source_networks: BANKR_SOURCE_NETWORKS, native_sources: BANKR_NATIVE_SOURCES,
    example_sources: SOURCES, destination: 'Any syntactically valid BDFX asset:network with a currently available pair.',
    note: 'Network overlap enables quoting only. Funding still requires an exact provider contract/native identity match against the Bankr portfolio.' };
  if (command === 'range' || command === 'quote') return liveRequest(command === 'quote' ? 'estimate' : 'range', { from: options.from, to: options.to ?? 'btc:mainnet', amount: options.amount });
  if (command === 'validate-btc') return { address: validateBitcoin(options.address), network: 'bitcoin-mainnet', checksum_valid: true, ownership_verified: false, provider_acceptance_verified: false };
  if (command === 'demo') return runDemo(options.scenario, options['state-file']);
  requireThat(options['state-file'], 'INVALID_ARGUMENT', 'Specify --state-file.');
  const flow = new Simulation(options['state-file']);
  if (command === 'resume-demo') {
    flow.reconcileSimulation();
    flow.status('finished', 'a'.repeat(64));
  }
  return { state_file: flow.path, ...summary(flow.snapshot()) };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => console.log(JSON.stringify({ ok: true, ...result }, null, 2))).catch(error => {
    console.error(JSON.stringify({ ok: false, code: error.code || 'LOCAL_ERROR', error: error.message }));
    process.exitCode = 1;
  });
}
