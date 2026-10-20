# Submitting Chop transactions through Bankr

Use `POST https://api.bankr.bot/wallet/submit` with a read-write key that has `walletApiEnabled`, or
`bankr wallet submit`. Request and response schemas are in Bankr's OpenAPI spec
(`https://docs.bankr.bot/openapi/api.yaml`) and the core `bankr` skill (`references/sign-submit-api.md`).

```json
{
  "transaction": { "to": "<to>", "data": "<data>", "value": "<value>", "chainId": 4663, "gas": "<gas, only if the plan has one>" },
  "description": "<the plan's description>",
  "waitForConfirmation": true
}
```

## Order and confirmation

- Submit `transactions[]` **in array order**, one at a time, each with `waitForConfirmation: true`.
- After an `approval-required` plan, **re-run the same CLI command**. Never reuse an older final transaction,
  because its minimums and deadline came from an earlier state.
- A response that carries a `transactionHash` was broadcast, even if it failed. Look the hash up before
  doing anything else. `/wallet/submit` has no idempotency key, so a blind retry can execute twice.
- `status: "reverted"` (HTTP 400) means gas was spent and nothing happened. Rebuild from scratch with the CLI.
  It re-reads state and re-simulates.

## Robinhood Chain (4663) only

If Bankr reports that 4663 is unsupported for this wallet, **stop**. Do not bridge, switch chains, or suggest
another venue.

## Security refusals: stop, don't route around

| Bankr response | Meaning | What to do |
|---|---|---|
| `Arbitrary contract calls disabled` | The wallet's security switch is off | Tell the user. Only they can turn it on at bankr.bot → Security |
| `Restricted API key` | The key has a recipient allowlist, which blocks raw submits | Ask the user for a key without the allowlist, or stop |
| `PER_TX_LIMIT_EXCEEDED` / `DAILY_LIMIT_EXCEEDED` | Spend limits | Reduce the size, or the user raises limits themselves |
| `Transaction blocked by security scan` / `untrusted_address` | Bankr's scanner refused the contract | **Stop.** Do not re-encode, split, or send the user to another app to bypass it |
| `Wallet paused` | The user paused the wallet | Stop |

Never tell the user to disable a protection to get a Chop transaction through.

## Gas

The wallet pays gas in native ETH on Robinhood Chain. Raw submits are never sponsored. Keep a small
ETH balance, and when wrapping ETH into WETH, leave some ETH unwrapped.
