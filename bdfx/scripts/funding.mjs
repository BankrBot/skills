#!/usr/bin/env node
// Bankr payment handoff and receipt tracking. This helper has no wallet or broadcast method.
import { pathToFileURL } from 'node:url';
import { BdfxError, SKILL_REVISION, units, validateBitcoin, validateEvm } from './bdfx.mjs';
import { normalizeFee, requestAuthenticated } from './review.mjs';

const need = (ok, code = 'INVALID_FUNDING_RESPONSE') => { if (!ok) throw new BdfxError(code, code); };
const reviewId = id => typeof id === 'string' && /^provider-review-[a-f0-9]{32}$/.test(id);
const digest = hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
const uint = value => typeof value === 'string' && /^(0|[1-9][0-9]{0,77})$/.test(value);
const timestamp = value => Number.isSafeInteger(value) && value > 0;
const evm = address => { need(typeof address === 'string'); return validateEvm(address).toLowerCase(); };
function request(command, options) {
  need(reviewId(options['review-id']), 'INVALID_REVIEW_ID');
  const body = { review_id: options['review-id'] };
  if (command === 'prepare-funding') {
    need(digest(options['review-digest']), 'INVALID_REVIEW_DIGEST');
    return { route: 'funding-review', body: { ...body, review_digest: options['review-digest'] } };
  }
  if (['inspect-funding','reconcile-funding'].includes(command)) return { route: command, body };
  if (command === 'record-funding') {
    need(typeof options.attempt === 'string' && /^[a-f0-9]{32}$/.test(options.attempt), 'INVALID_PAYMENT_ATTEMPT');
    need(typeof options['tx-hash'] === 'string' && /^0x[a-fA-F0-9]{64}$/.test(options['tx-hash']), 'INVALID_TRANSACTION_HASH');
    return { route: command, body: { ...body, attempt: options.attempt, transaction_hash: options['tx-hash'].toLowerCase() } };
  }
  need(command === 'claim-funding', 'COMMAND_DISABLED');
  need(options['confirm-transfer'] === 'yes', 'EXPLICIT_TRANSFER_CONFIRMATION_REQUIRED');
  need(typeof options['funding-id'] === 'string' && /^funding-review-[a-f0-9]{32}$/.test(options['funding-id'])
    && digest(options['funding-digest']), 'INVALID_FUNDING_REVIEW');
  units(options.amount, 18);
  need(options['fee-percent'] !== undefined, 'EXPLICIT_FEE_REQUIRED');
  return { route: command, body: { ...body, funding_id: options['funding-id'], funding_digest: options['funding-digest'],
    amount: options.amount, deposit_address: evm(options['deposit-address']), btc_address: validateBitcoin(options['btc-address']),
    refund_address: evm(options['refund-address']), fee_percent: normalizeFee(options['fee-percent']), confirm_transfer: 'yes' } };
}
function preflight(data, amountWei) {
  need(data?.chain_id === 8453 && typeof data.sufficient === 'boolean');
  for (const name of ['balance_wei','nonce','estimated_network_fee_wei','gas_reserve_wei','required_balance_wei']) need(uint(data[name]));
  need(BigInt(data.gas_reserve_wei) >= 100000000000000n
    && BigInt(data.required_balance_wei) === amountWei + BigInt(data.gas_reserve_wei)
    && data.sufficient === (BigInt(data.balance_wei) >= BigInt(data.required_balance_wei)));
  return { chain_id: 8453, balance_wei: data.balance_wei, nonce: data.nonce,
    estimated_network_fee_wei: data.estimated_network_fee_wei, gas_reserve_wei: data.gas_reserve_wei,
    required_balance_wei: data.required_balance_wei, sufficient: data.sufficient };
}
function decimal(number) {
  const text = String(number), match = text.match(/^(\d+)(?:\.(\d+))?e([+-]?\d+)$/);
  if (!match) return text;
  const digits = match[1] + (match[2] ?? ''), point = match[1].length + Number(match[3]);
  return point <= 0 ? '0.' + '0'.repeat(-point) + digits
    : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
}
function payment(row, input) {
  need(row && row.review_id === input.review_id && /^funding-review-[a-f0-9]{32}$/.test(row.funding_id)
    && digest(row.funding_digest) && ['prepared','payment_unknown','submitted','confirmed','failed'].includes(row.phase));
  const i = row.intent;
  need(i && i.review_id === input.review_id && digest(i.review_digest) && /^[a-zA-Z0-9_-]{4,128}$/.test(i.order_id)
    && i.asset === 'ETH' && i.chain === 'base' && i.chain_id === 8453 && i.type === 'native' && i.decimals === 18
    && i.source_policy === 'existing_base_eth_only' && i.additional_fee_percent === '0'
    && timestamp(i.observed_at) && timestamp(i.expires_at) && i.expires_at > i.observed_at);
  const amountWei = units(i.amount, 18); need(uint(i.amount_wei) && amountWei === BigInt(i.amount_wei));
  const deposit = evm(i.deposit_address), refund = evm(i.refund_address), wallet = evm(i.wallet_address), btc = validateBitcoin(i.btc_address);
  need(i.deposit_address === deposit && i.refund_address === refund && wallet === refund && i.fee_percent === normalizeFee(i.fee_percent));
  need(i.registry && timestamp(i.registry.generated_ts) && digest(i.registry.content_hash)
    && Number.isSafeInteger(i.registry.provider_count) && i.registry.provider_count > 0);
  const checked = preflight(i.preflight, amountWei);
  need(Array.isArray(row.blockers) && row.blockers.every(code => ['LIVE_FUNDING_DISABLED','INSUFFICIENT_BASE_ETH_AND_GAS'].includes(code)));
  if (input.review_digest !== undefined) need(i.review_digest === input.review_digest);
  if (input.funding_id !== undefined) {
    need(row.funding_id === input.funding_id && row.funding_digest === input.funding_digest);
    for (const key of ['amount','deposit_address','btc_address','refund_address','fee_percent']) need(i[key] === input[key]);
  }
  if (row.attempt === null) need(row.phase === 'prepared' && row.claimed_at === null && row.transaction_hash === null
    && row.eth_evidence === null && row.btc_evidence === null);
  else need(typeof row.attempt === 'string' && /^[a-f0-9]{32}$/.test(row.attempt) && timestamp(row.claimed_at)
    && row.claimed_at < i.expires_at && row.phase !== 'prepared');
  need(row.transaction_hash === null || typeof row.transaction_hash === 'string' && /^0x[a-f0-9]{64}$/.test(row.transaction_hash));
  if (input.attempt !== undefined) need(row.attempt === input.attempt && row.transaction_hash === input.transaction_hash);
  let eth = null, payout = null;
  if (row.eth_evidence !== null) {
    const e = row.eth_evidence;
    need(e && e.transaction_hash === row.transaction_hash && typeof e.chain_verified === 'boolean'
      && ['payment_unknown','submitted','confirmed','failed'].includes(e.phase)
      && (!e.chain_verified || e.phase === 'confirmed' && e.safe === true));
    eth = { phase: e.phase, transaction_hash: e.transaction_hash, chain_verified: e.chain_verified,
      ...(e.block_number === undefined ? {} : { block_number: e.block_number, safe: e.safe, finalized: e.finalized }) };
  }
  if (row.btc_evidence !== null) {
    const p = row.btc_evidence;
    need(p && /^[a-f0-9]{64}$/.test(p.transaction_hash) && typeof p.chain_verified === 'boolean'
      && Number.isSafeInteger(p.confirmations) && p.confirmations >= 0 && Number.isSafeInteger(p.paid_satoshis)
      && p.paid_satoshis >= 0 && p.paid_satoshis <= 2100000000000000
      && (!p.chain_verified || p.confirmations >= 6 && p.paid_satoshis > 0 && eth?.chain_verified === true));
    payout = { transaction_hash: p.transaction_hash, chain_verified: p.chain_verified, confirmations: p.confirmations, paid_satoshis: p.paid_satoshis };
  }
  return { review_id: row.review_id, funding_id: row.funding_id, funding_digest: row.funding_digest,
    phase: row.phase, blockers: row.blockers, attempt: row.attempt, claimed_at: row.claimed_at,
    transaction_hash: row.transaction_hash, eth_evidence: eth, btc_evidence: payout,
    intent: { review_id: i.review_id, review_digest: i.review_digest, order_id: i.order_id, asset: 'ETH', chain: 'base',
      chain_id: 8453, type: 'native', decimals: 18, wallet_address: wallet, deposit_address: deposit,
      amount: i.amount, amount_wei: i.amount_wei, btc_address: btc, refund_address: refund, fee_percent: i.fee_percent,
      additional_fee_percent: '0', source_policy: i.source_policy, observed_at: i.observed_at, expires_at: i.expires_at,
      registry: { generated_ts: i.registry.generated_ts, content_hash: i.registry.content_hash, provider_count: i.registry.provider_count }, preflight: checked },
    ...(row.claim_preflight === undefined ? {} : { claim_preflight: preflight(row.claim_preflight, amountWei) }) };
}
export async function requestFunding(command, options, runtime = {}) {
  const r = request(command, options), response = await requestAuthenticated(r.route, r.body, options, runtime), data = response.data;
  need(data?.review_id === r.body.review_id && typeof data.live_funding_enabled === 'boolean'
    && typeof data.dispatch_allowed === 'boolean' && typeof data.chain_settlement_verified === 'boolean'
    && data.can_fund_live === data.dispatch_allowed && response.can_fund_live === data.can_fund_live);
  const p = data.payment === null ? null : payment(data.payment, r.body);
  need(data.chain_settlement_verified === (p?.eth_evidence?.chain_verified === true && p?.btc_evidence?.chain_verified === true));
  const result = { review_id: data.review_id, live_funding_enabled: data.live_funding_enabled, payment: p,
    dispatch_allowed: data.dispatch_allowed, can_fund_live: data.can_fund_live, chain_settlement_verified: data.chain_settlement_verified };
  if (data.dispatch_allowed) {
    need(command === 'claim-funding' && r.body.confirm_transfer === 'yes' && data.live_funding_enabled
      && p?.phase === 'payment_unknown' && p.transaction_hash === null && p.blockers.length === 0
      && p.intent.expires_at > Date.now() / 1000 && p.claim_preflight?.sufficient === true && data.tool === 'transfer_tokens');
    const a = data.arguments, t = a?.transfers?.[0];
    need(a && Object.keys(a).join(',') === 'transfers' && a.transfers.length === 1
      && Object.keys(t).sort().join(',') === 'amount,asset,recipient'
      && t.recipient?.type === 'address' && t.recipient.value === p.intent.deposit_address
      && t.asset?.type === 'native' && t.asset.chain === 'base' && t.asset.token?.identifier_type === 'ticker' && t.asset.token.value === 'ETH'
      && t.amount?.type === 'exact' && typeof t.amount.value === 'number' && Number.isFinite(t.amount.value)
      && units(decimal(t.amount.value), 18) === BigInt(p.intent.amount_wei));
    // Reconstruct only schema fields; do not relay options/extra tool instructions.
    result.tool = 'transfer_tokens'; result.arguments = { transfers: [{
      recipient: { type: 'address', value: p.intent.deposit_address },
      asset: { type: 'native', chain: 'base', token: { identifier_type: 'ticker', value: 'ETH' } },
      amount: { type: 'exact', value: t.amount.value } }] };
  } else need(data.arguments === undefined && data.tool === undefined);
  return { ok: true, mode: 'live_funding_handoff', skill_revision: SKILL_REVISION,
    data: result, can_fund_live: result.can_fund_live, dispatch_allowed: result.dispatch_allowed,
    settlement_verified: result.chain_settlement_verified };
}
const HELP = `BDFX Base ETH funding handoff (Node 18+)
node funding.mjs prepare-funding --review-id ID --review-digest DIGEST
node funding.mjs inspect-funding --review-id ID
node funding.mjs claim-funding --review-id ID --funding-id ID --funding-digest DIGEST --amount AMOUNT --deposit-address ADDRESS --btc-address ADDRESS --refund-address ADDRESS --fee-percent PERCENT --confirm-transfer yes
node funding.mjs record-funding --review-id ID --attempt ATTEMPT --tx-hash HASH
node funding.mjs reconcile-funding --review-id ID
All commands require --token-file PRIVATE_PATH from public wallet connection.
Preparation is read-only at the provider/chain. Claim records one payment attempt before Bankr can send.
Only a NEW successful claim returns dispatch_allowed:true and transfer_tokens arguments.
This helper never signs or broadcasts. A retry/timeout/unknown result never authorizes another send.
Installation and deployment do not authorize payment. Read references/funding.md before a transfer.`;
export async function main(argv, runtime = {}) {
  const [command = 'help', ...args] = argv;
  if (command === 'help' && args.length === 0) { (runtime.stdout ?? process.stdout).write(JSON.stringify({ ok: true, skill_revision: SKILL_REVISION, help: HELP }) + '\n'); return; }
  const fields = { 'prepare-funding': ['review-id','review-digest'], 'inspect-funding': ['review-id'], 'reconcile-funding': ['review-id'],
    'record-funding': ['review-id','attempt','tx-hash'], 'claim-funding': ['review-id','funding-id','funding-digest','amount','deposit-address','btc-address','refund-address','fee-percent','confirm-transfer'] };
  need(Object.hasOwn(fields, command), 'COMMAND_DISABLED'); const options = {};
  for (let i = 0; i < args.length; i += 2) {
    need(args[i]?.startsWith('--') && args[i + 1] !== undefined && !args[i + 1].startsWith('--')
      && [...fields[command],'token-file'].includes(args[i].slice(2)) && !Object.hasOwn(options, args[i].slice(2)), 'INVALID_ARGUMENTS');
    options[args[i].slice(2)] = args[i + 1];
  }
  need(fields[command].every(field => options[field] !== undefined), 'INVALID_ARGUMENTS');
  const result = await requestFunding(command, options, runtime);
  (runtime.stdout ?? process.stdout).write(JSON.stringify(result, null, 2) + '\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(error => {
    process.stderr.write((/^[A-Z_]{3,64}$/.test(error.code) ? error.code : 'FUNDING_CLIENT_FAILED') + '\n'); process.exitCode = 1;
  });
}
