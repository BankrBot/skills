# Wallet Integration Examples

## Purpose

`bracketsbot` is designed to prepare transaction payloads, not require private key custody.

Use:

1. `prepare-submit-tx` to generate unsigned tx request data
2. your existing wallet stack (agent/runtime) to sign and broadcast

## Transaction Payload Contract

`prepare-submit-tx` returns:

- `chainId`
- `to`
- `data`
- `value` (wei string)
- `valueHex` (hex wei string)

These fields are sufficient for common EVM signing/submission stacks.

## Bankr CLI Example

Generate tx payload:

```bash
pnpm run cli prepare-submit-tx --json > /tmp/bracketsbot-submit-tx.json
```

Extract the transaction object and submit with Bankr:

```bash
TX=$(jq -c '{to,data,value,chainId}' /tmp/bracketsbot-submit-tx.json)
bankr submit json "$TX" --description "BracketsBot bracket mint"
```

Notes:

- `bankr submit json` sends the transaction directly (no AI prompt round-trip)
- pass `--no-wait` if you don't need to block until confirmation
- ensure your Bankr key has write permissions
- use Base/mainnet chain IDs matching your deployment target

## Bankr Submit with Explicit Params

```bash
bracketsbot prepare-submit-tx --json > /tmp/bracketsbot-submit-tx.json

bankr submit tx \
  --to "$(jq -r .to /tmp/bracketsbot-submit-tx.json)" \
  --chain-id "$(jq -r .chainId /tmp/bracketsbot-submit-tx.json)" \
  --data "$(jq -r .data /tmp/bracketsbot-submit-tx.json)" \
  --value "$(jq -r .value /tmp/bracketsbot-submit-tx.json)" \
  --description "BracketsBot bracket mint"
```

## Generic Wallet Runtime Example

Use your runtime's existing signer API with `{ to, data, value, chainId }`.
Avoid introducing private-key handling into this package.

## Security Guidance

- never commit wallet credentials
- use dedicated agent wallets with constrained funds
- verify `chainId`, `to`, `value` before signing
- prefer dry-runs/local chains before production
