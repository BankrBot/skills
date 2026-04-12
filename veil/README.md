# Veil skill

This folder tracks the current [@veil-cash/sdk](https://github.com/veildotcash/veildotcash-sdk) CLI-first skill for Veil on Base (`0.6.2`), with optional helper scripts for OpenClaw and Bankr workflows.

## Source of truth

- Main skill instructions: [`SKILL.md`](SKILL.md)
- CLI payload and SDK reference: [`reference.md`](reference.md)
- Troubleshooting: [`references/troubleshooting.md`](references/troubleshooting.md)

## Current model

- Prefer the `veil` CLI directly for all operations.
- Choose signing mode first: local signing with `WALLET_KEY`, or external signing with `SIGNER_ADDRESS`.
- Use `--unsigned` when the transaction will be submitted by an external signer such as Bankr.
- Keep `.env` and `.env.veil` outside git.

## Helper scripts

The scripts in `scripts/` are convenience wrappers around the current Veil CLI. They are optional and should follow the same contract as `SKILL.md`.

```bash
cd veil

# Keypair and status
scripts/veil-init.sh
scripts/veil-keypair.sh
scripts/veil-status.sh

# Bankr wallet/address prompt helper
scripts/veil-bankr-prompt.sh "What is my Base wallet address? Respond with just the address."

# Balances
scripts/veil-balance.sh --address 0x...
scripts/veil-balance.sh --address 0x... --pool usdc

# Unsigned or Bankr-submitted deposits
scripts/veil-deposit-unsigned.sh ETH 0.1
scripts/veil-deposit-via-bankr.sh ETH 0.1
scripts/veil-deposit-via-bankr.sh USDC 100

# Private actions (require VEIL_KEY)
scripts/veil-withdraw.sh ETH 0.05 0x...
scripts/veil-transfer.sh ETH 0.02 0x...
scripts/veil-merge.sh ETH 0.1
```

## Bankr notes

- Bankr-backed helpers use the current wallet APIs: `POST /wallet/sign` and `POST /wallet/submit`.
- `veil-deposit-via-bankr.sh` submits the approval transaction first for USDC, then submits the deposit transaction.
- `veil-bankr-prompt.sh` is for natural-language wallet queries, not transaction submission.
