// Defensive, offline fixtures. No funded account, wallet API or broadcast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Wallet } from 'ethers';
import { validateGrant, buildReceivePaymentAuthorization, buildTransferPaymentAuthorization } from '@voidly/session';
import { createPaymentContext, checkSignRequest, checkSignResponse, checkRequestAgainstGrant, checkSubmitResponse } from '../scripts/preview-payment.mjs';
const CLI = fileURLToPath(new URL('../scripts/preview-payment.mjs', import.meta.url));
const payer = Wallet.createRandom();
const grantFor = (over = {}) => ({
  schema: 'voidly-task-grant/v1', hirer_did: 'did:voidly:mPJNnvvYiKrFuY96NeESb',
  provider_did: 'did:voidly:6rGTFa5apSnKNF14bGXZfu',
  provider_signing_pubkey_base64: 'L16pOb+7U0Qjgs43s61D8KiLi6KRAJ1CpqszP6FzCyE=',
  provider_enc_pubkey_base64: 'BC4/bHqUQHnwt593WsVhgz1loPpUyESJV/Oy6SU5h1k=',
  offer_hash: 'aa'.repeat(32), capsule_hash: 'bb'.repeat(32), brief_commitment: 'cc'.repeat(32),
  price_chain: 'eip155:8453', price_asset: 'eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  price_payer_account: `eip155:8453:${payer.address.toLowerCase()}`,
  price_payee_account: 'eip155:8453:0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912',
  price_min_amount: '50000', price_max_amount: '5000000', nonce: 'n'.repeat(24),
  issued_at: new Date(Date.now() - 60_000).toISOString(), expires_at: new Date(Date.now() + 540_000).toISOString(), ...over,
});
const invalids = {
  inverted: () => ({ issued_at: new Date(Date.now() + 600_000).toISOString() }),
  future: () => ({ issued_at: new Date(Date.now() + 3_600_000).toISOString(), expires_at: new Date(Date.now() + 4_200_000).toISOString() }),
  ttlLong: () => ({ expires_at: new Date(Date.now() + 48 * 3_600_000).toISOString() }),
  ttlShort: () => ({ issued_at: new Date(Date.now()).toISOString(), expires_at: new Date(Date.now() + 30_000).toISOString() }),
  providerKey: () => ({ provider_signing_pubkey_base64: 'a'.repeat(43) + '=' }),
  offerHash: () => ({ offer_hash: 'invalid' }),
  unknownNull: () => ({ unexpected: null }),
  issuedAt: () => ({ issued_at: 'invalid' }),
};
for (const [name, mutate] of Object.entries(invalids)) {
  test(`full-grant refusal before preview or signer: ${name}`, async (t) => {
    const grant = grantFor(mutate());
    assert.equal(validateGrant(grant, Date.now()).ok, false, 'fixture must reproduce the SDK validator refusal');
    let signerCalls = 0;
    for (const lane of ['a', 'b']) {
      const result = (await createPaymentContext({ grant, lane }));
      if (result.ok) signerCalls++;
      assert.equal(result.reason, 'grant_invalid');
    }
    assert.equal(signerCalls, 0);
    const dir = mkdtempSync(join(tmpdir(), 'context-refusal-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'grant.json');
    writeFileSync(path, JSON.stringify(grant), { mode: 0o600 });
    const out = spawnSync(process.execPath, [CLI, 'preview', '--grant', path], { encoding: 'utf8', timeout: 3000 });
    assert.equal(out.status, 1, out.stderr);
    assert.equal(out.stdout, '');
    assert.match(out.stderr, /^REFUSED\s+grant_invalid/);
  });
}
const typedFor = context => {
  const { domain, types, primaryType, message } = context.authorization;
  return structuredClone({ domain, types, primaryType, message });
};
test('context retains a frozen full grant; caller mutation, copies and overrides cannot retarget it', async () => {
  const grant = grantFor();
  const { context } = (await createPaymentContext({ grant, lane: 'b', amount: '60000' }));
  assert.ok(context);
  const before = typedFor(context);
  grant.price_payee_account = grant.price_payer_account;
  grant.offer_hash = 'dd'.repeat(32);
  assert.deepEqual(typedFor(context), before);
  assert.notEqual(context.grant.offer_hash, grant.offer_hash);
  for (const value of [context, context.grant, context.terms, context.terms.band, context.authorization.message, context.authorization.types.TransferWithAuthorization[0]]) assert.ok(Object.isFrozen(value));
  assert.throws(() => { context.amount = '5000000'; }, TypeError);
  for (const fake of [undefined, {}, { ...context }, structuredClone(context), context.terms]) {
    assert.equal(checkSignRequest({ context: fake, typedData: before }).reason, 'payment_context_required');
    assert.equal(checkSignResponse({ context: fake }).reason, 'payment_context_required');
    assert.equal(checkRequestAgainstGrant({ context: fake }).reason, 'payment_context_required');
  }
  for (const override of [{ amount: '5000000' }, { lane: 'a' }, { terms: context.terms }, { expiresAt: context.grant.expires_at }]) {
    for (const gate of [checkSignRequest, checkSignResponse, checkRequestAgainstGrant]) assert.equal(gate({ context, ...override }).reason, 'payment_context_override');
  }
  assert.equal(checkSignRequest({ context, typedData: before }).ok, true);
});

test('malformed signing requests are refused before the external signer is asked', async () => {
  const { context } = (await createPaymentContext({ grant: grantFor(), lane: 'b' }));
  const correct = typedFor(context);
  let asked = 0;
  const guardedSigner = typedData => {
    const checked = checkSignRequest({ context, typedData });
    if (!checked.ok) return checked;
    asked++;
    return { ok: true };
  };
  const changes = [
    td => { td.message.value = '5000000'; }, td => { td.message.to = payer.address; },
    td => { td.message.nonce = '0x' + 'ff'.repeat(32); }, td => { td.message.validBefore = '9999999999'; },
    td => { td.domain.chainId = 1; }, td => { td.domain.name = 'Other'; },
    td => { td.types.TransferWithAuthorization[0].type = 'bytes32'; },
    td => { td.primaryType = 'ReceiveWithAuthorization'; }, td => { td.extra = null; },
    td => { td.types.EIP712Domain = []; },
  ];
  for (const change of changes) {
    const typed = structuredClone(correct); change(typed);
    assert.equal(guardedSigner(typed).reason, 'sign_request_mismatch');
  }
  assert.equal(asked, 0);
  assert.equal(guardedSigner(correct).ok, true);
  assert.equal(asked, 1);
});

test('retained contexts expire at the signed second at every money boundary', async t => {
  const now = Date.now();
  const grant = grantFor({ issued_at: new Date(now - 60_000).toISOString(), expires_at: new Date(now + 60_999).toISOString() });
  const { context } = (await createPaymentContext({ grant, lane: 'b' }));
  const typed = typedFor(context);
  const deadline = Number(typed.message.validBefore) * 1000;
  t.mock.method(Date, 'now', () => deadline - 1);
  assert.equal(checkSignRequest({ context, typedData: typed }).ok, true);
  Date.now.mock.mockImplementation(() => deadline);
  assert.equal(checkSignRequest({ context, typedData: typed }).reason, 'grant_expired');
  assert.equal(checkSignResponse({ context, response: {} }).reason, 'grant_expired');
  assert.equal(checkRequestAgainstGrant({ context, request: {} }).reason, 'grant_expired');
});

test('historical submit responses require complete valid grants but remain checkable after expiry', async () => {
  const grant = grantFor({ issued_at: new Date(Date.now() - 600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() });
  const response = { success: true, transactionHash: '0x' + 'ab'.repeat(32), status: 'success', chainId: 8453, signer: payer.address };
  assert.equal((await createPaymentContext({ grant, lane: 'b' })).reason, 'grant_expired');
  assert.equal(checkSubmitResponse({ grant, response }).ok, true);
  assert.equal(checkSubmitResponse({ grant: { ...grant, offer_hash: 'invalid' }, response }).reason, 'grant_invalid');
});

test('accessor and hidden grant fields are rejected without executing a getter', async () => {
  const grant = grantFor(); let reads = 0;
  Object.defineProperty(grant, 'offer_hash', { enumerable: true, get() { reads++; return 'aa'.repeat(32); } });
  assert.equal((await createPaymentContext({ grant, lane: 'a' })).reason, 'grant_invalid');
  assert.equal(reads, 0);
  const hidden = grantFor(); Object.defineProperty(hidden, 'unexpected', { value: null });
  assert.equal((await createPaymentContext({ grant: hidden, lane: 'a' })).reason, 'grant_invalid');
});

for (const lane of ['a', 'b']) test(`locked grant builder uses retained context before offline signing: ${lane}`, async t => {
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('offline fixture'); });
  const { context } = (await createPaymentContext({ grant: grantFor(), lane }));
  let calls = 0;
  const sign = async typedData => {
    const admitted = checkSignRequest({ context, typedData });
    assert.equal(admitted.ok, true);
    typedData = admitted.typedData;
    calls++;
    const { EIP712Domain, ...types } = typedData.types;
    const signature = await payer.signTypedData(typedData.domain, types, typedData.message);
    const response = { success: true, signatureType: 'eth_signTypedData_v4', signer: payer.address, signature };
    assert.equal(checkSignResponse({ context, response }).ok, true);
    return signature;
  };
  const builder = lane === 'a' ? buildReceivePaymentAuthorization : buildTransferPaymentAuthorization;
  const result = await builder({ grant: context.grant, grantHash: context.terms.grantHash, sign, nowMs: Date.now() });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(calls, 1);
  assert.equal(network.mock.callCount(), 0);
});

test('accepted signing payload is a frozen snapshot and accessor requests are never evaluated', async () => {
  const { context } = (await createPaymentContext({ grant: grantFor(), lane: 'b' }));
  const input = typedFor(context);
  const admitted = checkSignRequest({ context, typedData: input });
  assert.equal(admitted.ok, true);
  input.message.value = '5000000';
  assert.equal(admitted.typedData.message.value, '50000');
  assert.ok(Object.isFrozen(admitted.typedData) && Object.isFrozen(admitted.typedData.message));
  let reads = 0;
  const changed = typedFor(context);
  Object.defineProperty(changed.message, 'value', { enumerable: true, get() { reads++; return '50000'; } });
  assert.equal(checkSignRequest({ context, typedData: changed }).reason, 'sign_request_mismatch');
  assert.equal(reads, 0);
});

test('signature response capture verifies and returns the same bytes; accessors cannot swap them', async () => {
  const { context } = (await createPaymentContext({ grant: grantFor(), lane: 'b' }));
  const { domain, types, message } = context.authorization;
  const signature = await payer.signTypedData(domain, types, message);
  const response = { success: true, signatureType: 'eth_signTypedData_v4', signer: payer.address, signature };
  const result = checkSignResponse({ context, response });
  assert.equal(result.signature, signature);
  response.signature = 'not the checked signature';
  assert.equal(result.signature, signature);
  let reads = 0;
  Object.defineProperty(response, 'signature', { enumerable: true, get() { reads++; return signature; } });
  assert.equal(checkSignResponse({ context, response }).reason, 'response_not_data');
  assert.equal(reads, 0);
});

test('API wrappers reject malformed or accessor inputs without evaluating them', async () => {
  for (const gate of [createPaymentContext, checkSignRequest, checkSignResponse, checkRequestAgainstGrant]) {
    for (const malformed of [null, [], 'text', 42]) assert.equal((await gate(malformed)).reason, 'payment_input_not_object');
    let reads = 0;
    const field = gate === createPaymentContext ? 'grant' : 'context';
    const input = Object.defineProperty({}, field, { enumerable: true, get() { reads++; return {}; } });
    assert.equal((await gate(input)).reason, 'payment_input_not_data');
    assert.equal(reads, 0);
  }
});

test('Bankr amount spelling is normalized once and Lane A stays outside raw submission', async () => {
  const grant = grantFor();
  const leading = await createPaymentContext({ grant, lane: 'b', amount: '00050000' });
  assert.equal(leading.ok, true);
  assert.equal(leading.context.amount, '50000');
  assert.equal((await createPaymentContext({ grant, lane: 'b', amount: null })).context.amount, '50000');
  for (const amount of [0, '0', '49999', '5000001', '1e5']) assert.equal((await createPaymentContext({ grant, lane: 'b', amount })).ok, false);
  const { context } = await createPaymentContext({ grant, lane: 'a' });
  assert.equal(checkRequestAgainstGrant({ context, request: {} }).reason, 'request_lane_mismatch');

});
