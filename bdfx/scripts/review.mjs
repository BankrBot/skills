#!/usr/bin/env node
// Authenticated reviews and explicitly approved unfunded orders. No wallet tools or automatic retries.
import { constants, openSync, fstatSync, readSync, closeSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BdfxError, SKILL_REVISION, units, validateBitcoin, validateEvm } from './bdfx.mjs';

const ENDPOINT = 'https://bdfx.io/bankr-agent.php';
const responseContext = new WeakMap();
const need = (ok, code = 'INVALID_AGENT_RESPONSE') => { if (!ok) throw new BdfxError(code, code); };
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const timestamp = value => Number.isSafeInteger(value) && value > 0;
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const reviewId = value => typeof value === 'string' && /^provider-review-[a-f0-9]{32}$/.test(value);

export function normalizeFee(value) {
  need(typeof value === 'string' && /^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(value)
    && Number(value) <= 100, 'INVALID_FEE_SELECTION');
  return Number(value).toFixed(2);
}
function canonicalFee(value) {
  need(typeof value === 'string' && /^(0|[1-9]\d{0,2})\.\d{2}$/.test(value) && Number(value) <= 100);
  return value;
}
function privateToken(tokenFile) {
  need(typeof tokenFile === 'string' && isAbsolute(tokenFile), 'PRIVATE_TOKEN_FILE_REQUIRED');
  let fd;
  try {
    need(typeof constants.O_NOFOLLOW === 'number', 'PRIVATE_TOKEN_FILE_REQUIRED');
    fd = openSync(tokenFile, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    need(stat.isFile() && stat.nlink === 1 && stat.size <= 128 && [0o400, 0o600].includes(stat.mode & 0o7777)
      && (typeof process.getuid !== 'function' || stat.uid === process.getuid()), 'PRIVATE_TOKEN_FILE_REQUIRED');
    const bytes = Buffer.alloc(129); let length = 0;
    while (length < bytes.length) {
      const count = readSync(fd, bytes, length, bytes.length - length, null);
      if (count === 0) break;
      length += count;
    }
    need(length <= 128, 'INVALID_TOKEN_FILE');
    const token = bytes.subarray(0, length).toString('utf8').trim();
    need(/^[a-f0-9]{64}$/.test(token), 'INVALID_TOKEN_FILE');
    return token;
  } catch (error) {
    if (error instanceof BdfxError) throw error;
    throw new BdfxError('PRIVATE_TOKEN_FILE_REQUIRED', 'PRIVATE_TOKEN_FILE_REQUIRED');
  } finally { if (fd !== undefined) closeSync(fd); }
}
function injectedToken(value) {
  need(typeof value === 'string' && value.length > 0, 'REVIEW_CREDENTIAL_REQUIRED');
  need(value.length <= 128 && /^[a-f0-9]{64}$/.test(value.trim()), 'INVALID_TOKEN_SECRET');
  return value.trim();
}
function invalidResponse(response) {
  const error = new BdfxError('INVALID_AGENT_RESPONSE', 'INVALID_AGENT_RESPONSE');
  error.httpStatus = response.status;
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  error.responseType = ['application/json', 'text/html'].includes(type) ? type : type ? 'other' : 'missing';
  return error;
}
function feeOptions(data) {
  need(data && typeof data.enabled === 'boolean' && Array.isArray(data.percents)
    && data.rate === 'floating' && data.additional_fee_percent === '0');
  const percents = data.percents.map(canonicalFee);
  need(percents.every((fee, index) => index === 0 || Number(fee) > Number(percents[index - 1])));
  if (data.enabled) need(percents.length > 0 && percents.includes(canonicalFee(data.default_percent)));
  else need(percents.length === 0 && data.default_percent === null);
  return { enabled: data.enabled, percents, default_percent: data.default_percent,
    rate: 'floating', additional_fee_percent: '0' };
}
function registryVersion(data) {
  need(data && timestamp(data.generated_ts) && digest(data.content_hash)
    && Number.isSafeInteger(data.provider_count) && data.provider_count > 0);
  return { generated_ts: data.generated_ts, content_hash: data.content_hash, provider_count: data.provider_count };
}
function reviewResult(data, command, request) {
  need(data && reviewId(data.review_id) && digest(data.review_digest));
  if (request.review_id) need(data.review_id === request.review_id);
  if (request.review_digest) need(data.review_digest === request.review_digest);
  need(['reviewed', 'approved', 'cancelled', 'creating', 'create_unknown', 'provider_rejected', 'provider_observed'].includes(data.phase) && data.can_fund_live === false
    && data.chain_settlement_verified === false, 'UNEXPECTED_REVIEW_STATE');
  const attempted = ['creating', 'create_unknown', 'provider_rejected', 'provider_observed'].includes(data.phase);
  if (attempted) need(typeof data.attempt === 'string' && /^[a-f0-9]{32}$/.test(data.attempt)
    && timestamp(data.started_at) && timestamp(data.approved_at) && data.approved_at <= data.started_at, 'UNEXPECTED_REVIEW_STATE');
  else need(data.attempt === null && data.started_at === null && data.order === null && data.error === null
    && (data.phase === 'approved' ? timestamp(data.approved_at) : data.approved_at === null), 'UNEXPECTED_REVIEW_STATE');
  if (['creating', 'create_unknown', 'provider_rejected'].includes(data.phase)) need(data.order === null
    && (data.phase === 'creating' ? data.error === null : typeof data.error === 'string' && /^[A-Z_]{3,64}$/.test(data.error)), 'UNEXPECTED_REVIEW_STATE');
  if (data.phase === 'provider_observed') need(data.error === null, 'UNEXPECTED_REVIEW_STATE');
  if (command === 'cancel-review') need(data.phase === 'cancelled', 'UNEXPECTED_REVIEW_STATE');
  if (command === 'approve-review') need(data.phase === 'approved', 'UNEXPECTED_REVIEW_STATE');
  if (command === 'create-order') need(attempted, 'UNEXPECTED_REVIEW_STATE');
  if (['inspect-order', 'recover-order'].includes(command)) need(data.phase === 'provider_observed', 'UNEXPECTED_REVIEW_STATE');
  const review = data.review, funding = review?.funding, destination = review?.destination, quote = review?.quote;
  need(review?.from?.symbol === 'eth' && review.from.network === 'base'
    && review.to?.symbol === 'btc' && review.to.network === 'mainnet' && review.rate === 'floating');
  need(funding?.id === 'eth:base' && funding.type === 'native' && funding.chain === 'base'
    && funding.chain_id === 8453 && funding.contract === null && funding.decimals === 18
    && funding.live_execution_enabled === false);
  need(destination?.id === 'btc:mainnet' && destination.extra_id === null
    && destination.ownership_verified === false && destination.provider_acceptance_verified === false
    && destination.live_execution_enabled === false && review.refund?.extra_id === null);
  const btc = validateBitcoin(destination.address), refund = validateEvm(review.refund.address);
  units(review.amount, 18);
  const fee = canonicalFee(review.fee_percent);
  need(review.additional_fee_percent === '0' && timestamp(review.review_expires_at));
  if (data.approved_at !== null) need(data.approved_at < review.review_expires_at, 'UNEXPECTED_REVIEW_STATE');
  if (attempted) need(data.started_at < review.review_expires_at, 'UNEXPECTED_REVIEW_STATE');
  need(quote && positive(quote.estimated_btc) && positive(quote.min_amount)
    && (quote.max_amount === null || positive(quote.max_amount) && quote.max_amount >= quote.min_amount)
    && Number(review.amount) >= quote.min_amount && (quote.max_amount === null || Number(review.amount) <= quote.max_amount)
    && timestamp(quote.observed_at) && quote.observed_at < review.review_expires_at
    && quote.rate === 'floating' && quote.partner_fee_percent === fee && quote.additional_fee_percent === '0'
    && quote.funding_gas_included === false && quote.settlement_guaranteed === false);
  if (request.amount !== undefined) {
    need(review.amount === request.amount && btc === request.btc_address
      && refund.toLowerCase() === request.refund_address.toLowerCase());
    if (request.fee_percent !== undefined) need(fee === request.fee_percent);
  }
  const fundingRegistry = registryVersion(funding.registry), destinationRegistry = registryVersion(destination.registry);
  need(JSON.stringify(fundingRegistry) === JSON.stringify(destinationRegistry));
  const order = data.phase === 'provider_observed' ? orderResult(data.order, review) : null;
  // Expose the documented fields only; do not relay arbitrary upstream fields or instructions.
  return { review_id: data.review_id, review_digest: data.review_digest, phase: data.phase,
    review: { amount: review.amount, from: { symbol: 'eth', network: 'base' }, to: { symbol: 'btc', network: 'mainnet' },
      destination: { id: 'btc:mainnet', address: btc, extra_id: null, registry: destinationRegistry,
        ownership_verified: false, provider_acceptance_verified: false, live_execution_enabled: false },
      refund: { address: refund, extra_id: null },
      funding: { id: 'eth:base', type: 'native', chain: 'base', chain_id: 8453, contract: null, decimals: 18,
        registry: fundingRegistry, live_execution_enabled: false },
      rate: 'floating', fee_percent: fee, additional_fee_percent: '0', review_expires_at: review.review_expires_at,
      quote: { estimated_btc: quote.estimated_btc, min_amount: quote.min_amount, max_amount: quote.max_amount,
        observed_at: quote.observed_at, rate: 'floating', partner_fee_percent: fee, additional_fee_percent: '0',
        funding_gas_included: false, settlement_guaranteed: false } },
    attempt: data.attempt, started_at: data.started_at, order, error: data.error, approved_at: data.approved_at,
    can_fund_live: false, chain_settlement_verified: false };
}
function orderResult(order, review) {
  need(order && typeof order.id === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(order.id)
    && ['waiting', 'confirming', 'exchanging', 'sending', 'verifying', 'finished', 'failed', 'refunded', 'expired'].includes(order.status)
    && order.live_execution_enabled === false && order.requires_fresh_status_before_funding === true);
  const deposit = order.deposit, withdrawal = order.withdrawal;
  need(deposit?.symbol === 'eth' && deposit.network === 'base' && deposit.expected_amount === review.amount
    && deposit.extra_id === null && withdrawal?.symbol === 'btc' && withdrawal.network === 'mainnet'
    && withdrawal.address === review.destination.address && withdrawal.extra_id === null
    && order.refund_address === review.refund.address && order.refund_extra_id === null);
  const address = validateEvm(deposit.address);
  need(typeof order.created_at === 'string' && Number.isFinite(Date.parse(order.created_at))
    && (order.expires_at === null || typeof order.expires_at === 'string' && Number.isFinite(Date.parse(order.expires_at)))
    && (withdrawal.tx_hash === null || typeof withdrawal.tx_hash === 'string' && /^[a-fA-F0-9]{64}$/.test(withdrawal.tx_hash)));
  return { id: order.id, status: order.status,
    deposit: { symbol: 'eth', network: 'base', expected_amount: review.amount, address, extra_id: null },
    withdrawal: { symbol: 'btc', network: 'mainnet', address: withdrawal.address, extra_id: null, tx_hash: withdrawal.tx_hash },
    refund_address: order.refund_address, refund_extra_id: null, created_at: order.created_at, expires_at: order.expires_at,
    requires_fresh_status_before_funding: true, live_execution_enabled: false };
}
function confirmedIntent(options) {
  need(options['confirm-order'] === 'yes', 'EXPLICIT_ORDER_CONFIRMATION_REQUIRED');
  units(options.amount, 18);
  need(options['fee-percent'] !== undefined, 'EXPLICIT_FEE_REQUIRED');
  return { amount: options.amount, btc_address: validateBitcoin(options['btc-address']),
    refund_address: validateEvm(options['refund-address']), fee_percent: normalizeFee(options['fee-percent']) };
}
function requestFor(command, options) {
  if (command === 'fee-options') return { route: 'fee-options', body: {} };
  if (command === 'review') {
    units(options.amount, 18);
    need(typeof options.key === 'string' && /^[a-zA-Z0-9_-]{16,128}$/.test(options.key), 'IDEMPOTENCY_KEY_REQUIRED');
    const body = { amount: options.amount, btc_address: validateBitcoin(options['btc-address']),
      refund_address: validateEvm(options['refund-address']) };
    if (options['fee-percent'] !== undefined) body.fee_percent = normalizeFee(options['fee-percent']);
    return { route: 'reviews', body, key: options.key };
  }
  need(['inspect-review', 'cancel-review', 'approve-review', 'create-order', 'inspect-order', 'recover-order'].includes(command), 'COMMAND_DISABLED');
  need(reviewId(options['review-id']), 'INVALID_REVIEW_ID');
  const body = { review_id: options['review-id'] };
  if (command === 'inspect-review') return { route: 'inspect', body };
  if (command === 'inspect-order') return { route: 'status', body };
  if (command === 'recover-order') return { route: 'recover', body };
  need(digest(options['review-digest']), 'INVALID_REVIEW_DIGEST');
  if (['approve-review', 'create-order'].includes(command)) return {
    route: command === 'approve-review' ? 'approve' : 'create',
    body: { ...body, review_digest: options['review-digest'], ...(command === 'approve-review' ? { decision: 'approve' } : {}) },
    intent: confirmedIntent(options) };
  return { route: 'approve', body: { ...body, review_digest: options['review-digest'], decision: 'cancel' } };
}
export async function requestAuthenticated(route, payload, options, { tokenFile,
  fetchImpl = globalThis.fetch, key } = {}) {
  need(['fee-options','reviews','inspect','approve','create','status','recover',
    'funding-review','inspect-funding','claim-funding','record-funding','reconcile-funding'].includes(route), 'COMMAND_DISABLED');
  const credentialFile = options['token-file'] ?? tokenFile;
  // Public sessions never read an injected operator/pilot credential.
  need(credentialFile !== undefined, 'PRIVATE_TOKEN_FILE_REQUIRED');
  const token = privateToken(credentialFile);
  const url = new URL(ENDPOINT);
  url.searchParams.set('route', route);
  let response;
  try {
    response = await fetchImpl(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}`,
        ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(payload) });
  } catch { throw new BdfxError('AGENT_CONNECTION_FAILED', 'AGENT_CONNECTION_FAILED'); }
  if (!response.body) throw invalidResponse(response);
  const reader = response.body.getReader(), parts = []; let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 65536) { await reader.cancel(); throw new BdfxError('AGENT_RESPONSE_TOO_LARGE', 'AGENT_RESPONSE_TOO_LARGE'); }
      parts.push(value);
    }
  } catch (error) {
    if (error instanceof BdfxError) throw error;
    throw new BdfxError('AGENT_CONNECTION_FAILED', 'AGENT_CONNECTION_FAILED');
  } finally { reader.releaseLock(); }
  let body;
  try { body = JSON.parse(Buffer.concat(parts, length).toString('utf8')); }
  catch { throw invalidResponse(response); }
  const expectedDispatch = route === 'claim-funding' && body?.data?.dispatch_allowed === true;
  if (!body || typeof body !== 'object' || body.can_fund_live !== expectedDispatch || JSON.stringify(body).includes(token)) throw invalidResponse(response);
  if (!response.ok || body.ok !== true) {
    const code = typeof body.error === 'string' && /^[A-Z_]{3,64}$/.test(body.error) ? body.error : 'AGENT_REQUEST_REJECTED';
    throw new BdfxError(code, code);
  }
  responseContext.set(body, response);
  return body;
}
export async function requestReview(command, options, runtime = {}) {
  const request = requestFor(command, options);
  if (request.intent) {
    const inspected = await requestReview('inspect-review', { 'review-id': request.body.review_id,
      ...(options['token-file'] !== undefined ? { 'token-file': options['token-file'] } : {}) }, runtime);
    reviewResult(inspected.data, 'inspect-review', { ...request.body, ...request.intent });
    need(inspected.review_current, 'STALE_REVIEW');
    need(inspected.data.attempt === null, 'CREATE_ALREADY_ATTEMPTED');
    need(command === 'create-order' ? inspected.data.phase === 'approved'
      : ['reviewed', 'approved'].includes(inspected.data.phase), 'USER_APPROVAL_REQUIRED');
  }
  const body = await requestAuthenticated(request.route, request.body, options, { ...runtime, key: request.key });
  let data;
  try { data = command === 'fee-options' ? feeOptions(body.data) : reviewResult(body.data, command, { ...request.body, ...request.intent }); }
  catch (error) {
    if (error instanceof BdfxError && error.code === 'UNEXPECTED_REVIEW_STATE') throw error;
    throw invalidResponse(responseContext.get(body));
  }
  return { ok: true, mode: data.attempt || ['approve-review', 'create-order', 'inspect-order', 'recover-order'].includes(command)
    ? 'live_order_unfunded' : 'live_review_only', skill_revision: SKILL_REVISION, data, can_fund_live: false,
    ...(command !== 'fee-options' ? { review_current: ['reviewed', 'approved'].includes(data.phase)
      && Date.now() / 1000 < data.review.review_expires_at,
      recovery_required: ['creating', 'create_unknown'].includes(data.phase) } : {}) };
}
const HELP = `BDFX authenticated review client (Node 18+)
  node review.mjs fee-options [--token-file PRIVATE_PATH]
  node review.mjs review --amount AMOUNT --btc-address ADDRESS --refund-address ADDRESS --key KEY [--fee-percent PERCENT] [--token-file PRIVATE_PATH]
  node review.mjs inspect-review --review-id ID [--token-file PRIVATE_PATH]
  node review.mjs cancel-review --review-id ID --review-digest DIGEST [--token-file PRIVATE_PATH]
  node review.mjs approve-review --review-id ID --review-digest DIGEST --amount AMOUNT --btc-address ADDRESS --refund-address ADDRESS --fee-percent PERCENT --confirm-order yes
  node review.mjs create-order --review-id ID --review-digest DIGEST --amount AMOUNT --btc-address ADDRESS --refund-address ADDRESS --fee-percent PERCENT --confirm-order yes
  node review.mjs inspect-order --review-id ID [--token-file PRIVATE_PATH]
  node review.mjs recover-order --review-id ID [--token-file PRIVATE_PATH]
Every command requires --token-file PRIVATE_PATH from public wallet connection.
Injected operator/pilot credentials are not used by this public helper.
An explicit token file takes precedence; a file error never falls back to the injected secret.
Omitted fee uses the server default; retries retain the original fee. Save the key before requesting.
Approve/create require explicit user permission for the exact amount, Base ETH, BTC payout, refund and fee.
They inspect the stored review before writing. Creation submits once; inspect/recover the same review after uncertainty.
Cancellation changes a stored review only. Created orders cannot be cancelled here. Funding uses the separate funding.mjs handoff.`;
export async function main(argv, runtime = {}) {
  const [command = 'help', ...args] = argv;
  const allowed = { help: [], 'fee-options': ['token-file'],
    review: ['token-file', 'amount', 'btc-address', 'refund-address', 'key', 'fee-percent'],
    'inspect-review': ['token-file', 'review-id'], 'cancel-review': ['token-file', 'review-id', 'review-digest'],
    'approve-review': ['token-file', 'review-id', 'review-digest', 'amount', 'btc-address', 'refund-address', 'fee-percent', 'confirm-order'],
    'create-order': ['token-file', 'review-id', 'review-digest', 'amount', 'btc-address', 'refund-address', 'fee-percent', 'confirm-order'],
    'inspect-order': ['token-file', 'review-id'], 'recover-order': ['token-file', 'review-id'] };
  need(Object.hasOwn(allowed, command), 'COMMAND_DISABLED');
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index]?.startsWith('--') ? args[index].slice(2) : '';
    need(allowed[command].includes(name) && typeof args[index + 1] === 'string'
      && args[index + 1].length > 0 && !args[index + 1].startsWith('--') && !Object.hasOwn(options, name), 'INVALID_ARGUMENT');
    options[name] = args[index + 1];
  }
  if (command === 'help') return { ok: true, skill_revision: SKILL_REVISION, help: HELP };
  return requestReview(command, options, runtime);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(result => process.stdout.write(JSON.stringify(result, null, 2) + '\n')).catch(error => {
    const code = error instanceof BdfxError && /^[A-Z_]{3,64}$/.test(error.code) ? error.code : 'REVIEW_CLIENT_FAILED';
    const context = code === 'INVALID_AGENT_RESPONSE' && Number.isInteger(error.httpStatus)
      ? ` (HTTP ${error.httpStatus}; response ${error.responseType})` : '';
    process.stderr.write(code + context + '\n'); process.exitCode = 1;
  });
}
