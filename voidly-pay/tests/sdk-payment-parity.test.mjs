// Compatibility proof against the exact locked public SDK, not a second copy
// of our own typed-data builder. Disposable offline-only wallet, no RPC/API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import {
  buildReceiveAuthorizationTypedData,
  buildTransferAuthorizationTypedData,
  signReceiveAuthorization,
  signTransferAuthorization,
  buildTransferWithAuthorizationCalldata,
} from '@voidly/session';
import {
  typedAuthorizationFor,
  createPaymentContext,
  checkSignRequest,
  checkSignResponse,
  checkRequestAgainstGrant,
} from '../scripts/preview-payment.mjs';

for (const lane of ['a', 'b']) {
  for (const amount of ['50000', '5000000']) {
    test(`locked SDK and local gate agree: lane ${lane}, amount ${amount}`, async (t) => {
      const network = t.mock.method(globalThis, 'fetch', () => {
        throw new Error('Network is forbidden in SDK parity fixtures');
      });
      const wallet = Wallet.createRandom();
      const nowMs = Date.now();
      const initial = {
        payer: wallet.address.toLowerCase(),
        payee: '0xb0b3fca940e04f99367f08e665e1c2cb4ebd4912',
        band: { min: '50000', max: '5000000' },
        grantHash: 'ab'.repeat(32),
        expiresAt: new Date(nowMs + 600_000).toISOString(),
      };
      const grant = {
        schema: 'voidly-task-grant/v1', hirer_did: 'did:voidly:mPJNnvvYiKrFuY96NeESb',
        provider_did: 'did:voidly:6rGTFa5apSnKNF14bGXZfu',
        provider_signing_pubkey_base64: 'L16pOb+7U0Qjgs43s61D8KiLi6KRAJ1CpqszP6FzCyE=',
        provider_enc_pubkey_base64: 'BC4/bHqUQHnwt593WsVhgz1loPpUyESJV/Oy6SU5h1k=',
        offer_hash: 'aa'.repeat(32), capsule_hash: 'bb'.repeat(32), brief_commitment: 'cc'.repeat(32),
        price_chain: 'eip155:8453', price_asset: 'eip155:8453/erc20:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        price_payer_account: `eip155:8453:${initial.payer}`, price_payee_account: `eip155:8453:${initial.payee}`,
        price_min_amount: '50000', price_max_amount: '5000000', nonce: 'n'.repeat(24),
        issued_at: new Date(nowMs - 60_000).toISOString(), expires_at: initial.expiresAt,
      };
      const prepared = createPaymentContext({ grant, lane, amount });
      assert.equal(prepared.ok, true, JSON.stringify(prepared));
      const { context } = prepared;
      const { terms } = context;
      const input = {
        chain: 'eip155:8453',
        from: `eip155:8453:${terms.payer}`,
        to: `eip155:8453:${terms.payee}`,
        value: amount,
        validAfter: 0,
        validBefore: Math.floor(Date.parse(terms.expiresAt) / 1000),
        grantHash: terms.grantHash,
      };
      const build = lane === 'a' ? buildReceiveAuthorizationTypedData : buildTransferAuthorizationTypedData;
      const sdk = await build(input);
      assert.equal(sdk.ok, true);
      const local = typedAuthorizationFor(terms, terms.expiresAt, lane, amount);
      assert.equal(local.ok, true);
      assert.deepEqual(local.domain, sdk.typedData.domain);
      assert.equal(local.primaryType, sdk.typedData.primaryType);
      assert.deepEqual(local.types[local.primaryType], sdk.typedData.types[sdk.typedData.primaryType]);
      assert.deepEqual(local.message, sdk.typedData.message);

      const sign = lane === 'a' ? signReceiveAuthorization : signTransferAuthorization;
      const signed = await sign({ ...input, nowMs }, async typed => {
        const admitted = checkSignRequest({ context, typedData: typed });
        assert.equal(admitted.ok, true);
        typed = admitted.typedData;
        // Ethers derives EIP712Domain itself. No provider is attached, so this
        // signs only an in-memory synthetic fixture, never a wallet request.
        const { EIP712Domain: _domain, ...types } = typed.types;
        return wallet.signTypedData(typed.domain, types, typed.message);
      });
      assert.equal(signed.ok, true);
      const response = {
        success: true, signatureType: 'eth_signTypedData_v4',
        signer: wallet.address, signature: signed.signed.signature,
      };
      assert.equal(checkSignResponse({ response, context }).ok, true);
      assert.equal(checkSignResponse({ response, context: createPaymentContext({ grant, lane: lane === 'a' ? 'b' : 'a', amount }).context }).ok, false);
      if (lane === 'b') {
        const built = buildTransferWithAuthorizationCalldata(signed.signed);
        assert.equal(built.ok, true);
        const candidate = { ...built.request, unreviewedTransactionField: "must not be forwarded" };
        const checked = checkRequestAgainstGrant({
          request: candidate, context, signResponse: response,
        });
        assert.equal(checked.ok, true);
        assert.equal(checked.decoded.value, amount);
        assert.deepEqual(Object.keys(checked.request).sort(), ['chainId', 'data', 'to', 'value']);
        assert.ok(Object.isFrozen(checked.request));
        const checkedData = checked.request.data;
        candidate.data = '0x';
        assert.equal(checked.request.data, checkedData);
        let reads = 0;
        Object.defineProperty(candidate, 'data', { enumerable: true, get() { reads++; return checkedData; } });
        assert.equal(checkRequestAgainstGrant({ context, request: candidate, signResponse: response }).reason, 'request_not_data');
        assert.equal(reads, 0);
      }
      assert.equal(network.mock.callCount(), 0);
    });
  }
}
