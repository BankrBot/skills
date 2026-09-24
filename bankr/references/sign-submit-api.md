# Sign and Submit API Reference

`POST /wallet/sign` and `POST /wallet/submit` are synchronous Wallet API endpoints. The first signs without broadcasting; the second signs and broadcasts a transaction you built. Request and response schemas are in the OpenAPI spec (`https://docs.bankr.bot/openapi/api.yaml`) and at [docs.bankr.bot/wallet-api/sign](https://docs.bankr.bot/wallet-api/sign) and [docs.bankr.bot/wallet-api/submit](https://docs.bankr.bot/wallet-api/submit). This page covers the behavior an integration has to handle.

Both endpoints need `walletApiEnabled` on a read-write key, and answer `403 Wallet API access not enabled` or `403 Read-only API key` otherwise. They also enforce the key's IP allowlist and share the Wallet API write limit of 10 requests per minute per IP. The old `/agent/sign` and `/agent/submit` endpoints are gone. From the CLI, use `bankr wallet sign` and `bankr wallet submit`.

## POST /wallet/sign

| `signatureType` | Payload field | Use it for |
|-----------------|---------------|------------|
| `personal_sign` | `message`, a non-empty string | Sign-in and ownership proofs |
| `eth_signTypedData_v4` | `typedData`: `domain`, `types`, `primaryType`, `message` | EIP-2612 permits and off-chain orders |
| `eth_signTransaction` | `transaction`, with the same fields as submit | A signed transaction you broadcast yourself |

```bash
curl -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "personal_sign", "message": "Sign in to MyApp\nNonce: abc123"}'
```

A success returns `{ "success": true, "signature", "signer", "signatureType" }`. A key with a recipient allowlist can only use `personal_sign`. The other two types answer `403 Restricted API key`, because recipients can't be verified from calldata or typed data.

## POST /wallet/submit

```bash
curl -X POST "https://api.bankr.bot/wallet/submit" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "chainId": 8453,
      "value": "0",
      "data": "0xa9059cbb..."
    },
    "description": "Transfer USDC",
    "waitForConfirmation": true
  }'
```

- `transaction` needs `to` and `chainId`: 1 (Ethereum), 8453 (Base), 137 (Polygon), 130 (Unichain), 480 (World Chain), 42161 (Arbitrum), 56 (BNB Chain), 4663 (Robinhood Chain) or 5042 (Arc). Optional fields are `value` (wei, as a decimal or `0x` hex string), `data`, `gas`, `gasPrice` and `nonce`. `maxFeePerGas` and `maxPriorityFeePerGas` are accepted but currently ignored; fees come from the network.
- `description` is a human-readable label stored with the transaction's activity record.
- **The wallet pays the gas.** Raw submissions aren't gas-sponsored, and a wallet short of native gas gets a `400` with `success: false` whose `error` message names the gas shortfall (there is no stable code for it).

### Confirmation and failures

- `waitForConfirmation` defaults to `true`. The call then waits for the receipt and returns `status: "success"` with `blockNumber` and `gasUsed`, which can take minutes on a congested chain. With `false` it returns `status: "pending"` right after broadcast, and you track the hash yourself.
- A transaction that mines but reverts answers **`400`** with `success: false`, `status: "reverted"` and the `transactionHash`. Its gas is spent.
- **Any failure body that carries a `transactionHash` was broadcast.** This endpoint takes no idempotency key, so look the hash up before resubmitting; a blind retry can execute twice.

### Wallet security settings apply

Raw submissions are checked against the wallet's security settings (see [safety.md](safety.md)), and a blocked one is rejected **before** anything is broadcast:

- The native `value` is priced in USD and checked against the **per-transaction** and **daily** limits, and a submitted transaction counts toward the rolling daily total.
- The wallet's **permitted-recipients** list is enforced on `to`, but only when `value > 0`. Calldata with no native value counts as **$0** and isn't recipient-checked, because the recipient can't be read out of arbitrary calldata.
- **"Enable arbitrary contract calls" must be on.** While it's off, `/wallet/submit` is blocked outright.

**A `403` comes back in one of two shapes, so handle both.** Key checks and the pause and arbitrary-calls switches run at the route, before the safety guard, and answer with a plain `error` and **no `errorCode`**:

| `error` | Cause |
|---------|-------|
| `Read-only API key` | The key can't submit transactions |
| `Restricted API key` | The **key** has `allowedRecipients` set, which blocks every raw submission. Use `/agent/prompt`, which enforces the key's allowlist |
| `Wallet paused` | All wallet transactions are paused in Security settings |
| `Arbitrary contract calls disabled` | The arbitrary-contract-calls switch is off |

Everything the safety guard rejects carries a machine-readable `errorCode` alongside the user-facing `error`:

| `errorCode` | Meaning |
|-------------|---------|
| `PER_TX_LIMIT_EXCEEDED` | The transaction's USD value is above the per-transaction limit |
| `DAILY_LIMIT_EXCEEDED` | It would push rolling-24h outflow past the daily limit |
| `RECIPIENT_NOT_PERMITTED` | `to` isn't on the permitted-recipients list |
| `RECIPIENT_COOLDOWN` | `to` was added recently and is still in its cooldown |
| `PRICING_UNAVAILABLE` | USD pricing failed while a limit was enabled, so it failed closed |

Branch on `errorCode` where there is one, and don't read its absence as "not a security rejection": a paused wallet is a `403` with no code. Never branch on the message text.
