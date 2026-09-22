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
  createSelfSubmitter,
} from '@voidly/session';
import {
  createPaymentContext,
  checkSignRequest,
  checkSignResponse,
  checkRequestAgainstGrant,
  checkSubmitResponse,
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
      const prepared = (await createPaymentContext({ grant, lane, amount }));
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
      const local = context.authorization;
      assert.equal(local.ok, true);
      assert.deepEqual(structuredClone(local.domain), sdk.typedData.domain);
      assert.equal(local.primaryType, sdk.typedData.primaryType);
      assert.deepEqual(structuredClone(local.types[local.primaryType]), sdk.typedData.types[sdk.typedData.primaryType]);
      assert.deepEqual(structuredClone(local.message), sdk.typedData.message);

      const sign = lane === 'a' ? signReceiveAuthorization : signTransferAuthorization;
      let signApproved = false, walletSignCalls = 0;
      const walletSign = async payload => {
        walletSignCalls++;
        assert.deepEqual(Object.keys(payload).sort(), ['signatureType', 'typedData']);
        assert.equal(payload.signatureType, 'eth_signTypedData_v4');
        const { EIP712Domain: _domain, ...types } = payload.typedData.types;
        const signature = await wallet.signTypedData(payload.typedData.domain, types, payload.typedData.message);
        return { success: true, signatureType: payload.signatureType, signer: wallet.address,
          signature: '0x' + signature.slice(2).toUpperCase() };
      };
      const guardedSign = async typed => {
        const admitted = checkSignRequest({ context, typedData: typed });
        assert.equal(admitted.ok, true);
        if (!signApproved) throw new Error('explicit human signing consent absent');
        const response = await walletSign(Object.freeze({ signatureType: 'eth_signTypedData_v4', typedData: admitted.typedData }));
        const checked = checkSignResponse({ context, response });
        assert.equal(checked.ok, true);
        assert.equal(checked.signature, response.signature, 'original signature bytes are returned');
        return checked.signature;
      };
      assert.equal((await sign({ ...input, nowMs }, guardedSign)).ok, false);
      assert.equal(walletSignCalls, 0);
      signApproved = true;
      const signed = await sign({ ...input, nowMs }, guardedSign);
      assert.equal(signed.ok, true);
      const response = {
        success: true, signatureType: 'eth_signTypedData_v4',
        signer: wallet.address, signature: signed.signed.signature,
      };
      assert.equal(checkSignResponse({ response, context }).ok, true);
      assert.equal(checkSignResponse({ response, context: (await createPaymentContext({ grant, lane: lane === 'a' ? 'b' : 'a', amount })).context }).ok, false);
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
        for (const changed of [{ ...built.request, value: '0X0' },
          { ...built.request, data: '0X' + built.request.data.slice(2) }]) {
          assert.equal(checkRequestAgainstGrant({ context, request: changed, signResponse: response }).ok, false);
        }
        let submitApproved = false, walletSubmitCalls = 0;
        const txHash = '0x' + 'ab'.repeat(32);
        const submitter = createSelfSubmitter({ broadcast: async request => {
          const admitted = checkRequestAgainstGrant({ context, request, signResponse: response });
          assert.equal(admitted.ok, true);
          if (!submitApproved) throw new Error('explicit human submission consent absent');
          const { to, chainId, data } = admitted.request;
          const payload = Object.freeze({ transaction: Object.freeze({ to, chainId, data }), value: '0',
            waitForConfirmation: true, description: `Voidly grant ${context.terms.grantHash}` });
          walletSubmitCalls++;
          assert.deepEqual(Object.keys(payload).sort(), ['description', 'transaction', 'value', 'waitForConfirmation']);
          assert.deepEqual(Object.keys(payload.transaction).sort(), ['chainId', 'data', 'to']);
          assert.equal(payload.transaction.data, built.request.data);
          const result = checkSubmitResponse({ grant: context.grant, response: {
            success: true, transactionHash: txHash, chainId: 8453, signer: wallet.address, status: 'success' } });
          assert.equal(result.ok, true);
          return result.transactionHash;
        } });
        assert.equal((await submitter.submit(signed.signed)).ok, false);
        assert.equal(walletSubmitCalls, 0);
        submitApproved = true;
        assert.equal((await submitter.submit(signed.signed)).transactionHash, txHash);
        assert.equal(walletSubmitCalls, 1);
        let reads = 0;
        Object.defineProperty(candidate, 'data', { enumerable: true, get() { reads++; return checkedData; } });
        assert.equal(checkRequestAgainstGrant({ context, request: candidate, signResponse: response }).reason, 'request_not_data');
        assert.equal(reads, 0);
      }
      assert.equal(network.mock.callCount(), 0);
    });
  }
}
