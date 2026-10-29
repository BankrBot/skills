# Submitting Borro transactions through Bankr

Use `POST https://api.bankr.bot/wallet/submit` with a read-write key that has `walletApiEnabled`, `bankr wallet submit`,
or the Bankr agent's own transaction submit. Bankr's OpenAPI document (`https://docs.bankr.bot/openapi/api.yaml`) and
the core `bankr` skill (`references/sign-submit-api.md`) are the reference.

Each item of a plan's `bankr_submit` is the exact body:

```json
{
  "transaction": { "to": "<to>", "data": "<data>", "value": "0", "chainId": 4663, "gas": "<pinned limit>" },
  "description": "<the step's description>",
  "waitForConfirmation": true
}
```

```bash
curl -s -X POST https://api.bankr.bot/wallet/submit -H "X-API-Key: $BANKR_API_KEY" -H "Content-Type: application/json" \
  -d "$(node borro.mjs plan supply --wallet "$W" --asset USDG --amount 250 | jq -c '.bankr_submit[0]')"
```

## Gas

The `gas` limit is pinned per call in known-contracts.json (measured on live state, plus at least 30%). Morpho Vault V2
accrues interest lazily, and a transaction sent with a plain estimate can run out of gas. A limit is a ceiling: only the
gas used is paid. Bankr does not sponsor raw submits, so the wallet pays in ETH on Robinhood Chain; a wallet with none
gets `400 insufficient_funds_for_gas`.

## Order and confirmation

- Submit in array order, one at a time, each with `waitForConfirmation: true`. Never send step 2 before step 1 has
  confirmed.
- Any response carrying a `transactionHash` was broadcast, even a failure. `/wallet/submit` takes no idempotency key:
  look the hash up before doing anything else.
- `status: "reverted"` (HTTP 400): gas was spent and nothing happened. Build the plan again from the start; never resend
  the old one.
- Quotes and deadlines last 20 minutes (`expires_at`). Past that, build again.

## Refusals: stop, don't route around

| Bankr answers | Meaning | What to do |
| --- | --- | --- |
| `Arbitrary contract calls disabled` | The wallet's switch is off | Tell the user; only they can turn it on (bankr.bot, Security) |
| `Restricted API key` | The key has a recipient allowlist, which blocks raw submits | A key without one, or stop |
| `Read-only API key` | The key cannot transact | Stop |
| `PER_TX_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED` | Spend limits | Smaller size, or the user raises the limit themselves |
| `Transaction blocked by security scan` | Bankr's scanner refused it | Stop. Do not re-encode, split, or send the user elsewhere to get around it |
| `Wallet paused` | The user paused the wallet | Stop |
| A location refusal | Bankr's own location check | Stop and relay it |

Never tell the user to disable a protection to get a Borro transaction through.

## Signing (bookrunner binding only)

`bind` returns `bankr_sign`, the exact body for `POST /wallet/sign` with `signatureType: "eth_signTypedData_v4"`. It is a
signature, not a transaction: no gas, nothing moves. Bankr refuses typed data while "Enable arbitrary contract calls" is
off and on keys with a recipient allowlist. Borro accepts a binding signed by the wallet's own key (an EOA); a contract
wallet cannot bind yet.
