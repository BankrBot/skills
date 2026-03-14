---
name: weave
description: Crypto-to-crypto invoicing and cross-chain payment workflows for Weave Cash. Use when the user wants to create an invoice, generate payment instructions, list supported token and network pairs, or monitor invoice settlement with the Weave CLI.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🧶",
        "homepage": "https://www.weavecash.com",
        "requires": { "bins": ["weave"] },
      },
  }
---

# Weave

Use `weave` for Weave Cash invoice workflows:

1. Create a crypto-to-crypto invoice
2. Generate payment instructions for a buyer
3. Track settlement until terminal status
4. Discover currently supported token and network pairs

Weave Cash is crypto-to-crypto only. The merchant chooses what crypto and network they want to receive, and the buyer can pay with another supported asset and network.

## Guardrails

- Do not introduce fiat pricing, fiat settlement, or fiat-denominated behavior unless the user explicitly asks for it.
- Prefer machine-readable JSON output. Use `--human` only when the user asks for readable terminal output.
- Never print or store secrets, private keys, JWTs, or credential-bearing URLs.
- Always discover current support with `weave tokens` instead of hardcoding token and network lists.
- Treat quote and status requests as network-dependent and failure-prone. Surface command errors clearly.

## Install

Preferred install:

```bash
go install github.com/AryanJ-NYC/weave-cash/apps/cli/cmd/weave@latest
```

Fallback install:

```bash
npm i -g weave-cash-cli
```

Verify:

```bash
weave --help
```

## Preflight

Before choosing assets or networks:

```bash
weave tokens
```

This is the runtime source of truth for:

- supported tokens
- valid token/network pairings
- accepted network aliases

## Create An Invoice

Use `weave create` to generate a new invoice.

Required inputs:

- `--receive-token`
- `--amount`
- `--wallet-address`

Conditionally required:

- `--receive-network` when the selected receive token supports more than one network

Optional:

- `--description`
- `--buyer-name`
- `--buyer-email`
- `--buyer-address`

Example:

```bash
weave create \
  --receive-token USDC \
  --receive-network Ethereum \
  --amount 25 \
  --wallet-address 0x1111111111111111111111111111111111111111
```

Typical JSON response:

```json
{
  "id": "inv_123",
  "invoiceUrl": "https://www.weavecash.com/invoice/inv_123"
}
```

Save the invoice ID for quoting and status checks.

## Generate Payment Instructions

Use `weave quote` after the invoice exists and is still pending.

Required inputs:

- invoice ID
- `--pay-token`
- `--pay-network`
- `--refund-address`

Example:

```bash
weave quote inv_123 \
  --pay-token USDT \
  --pay-network Ethereum \
  --refund-address 0x2222222222222222222222222222222222222222
```

Expected fields include:

- `depositAddress`
- `depositMemo` when applicable
- `amountIn`
- `amountOut`
- `timeEstimate`
- `expiresAt`

## Check Status

One-shot status:

```bash
weave status inv_123
```

Watch until terminal state:

```bash
weave status inv_123 --watch --interval-seconds 5 --timeout-seconds 900
```

Interpretation:

- exit `0`: terminal success path from the CLI perspective
- exit `1`: command, API, validation, or network failure
- exit `2`: watch timed out before a terminal invoice status

`weave get <invoice-id>` is an alias for `weave status <invoice-id>`.

## Human Output

When the user wants readable terminal output instead of JSON:

```bash
weave tokens --human
weave status inv_123 --human
```

## Common Failure Cases

- Invalid token/network pair: rerun `weave tokens` and choose a supported combination.
- Missing `--receive-network` for a multi-network token: provide an explicit receive network.
- Quote fails for a non-pending invoice: fetch current status first with `weave status <invoice-id>`.
- Watch timeout: rerun `weave status <invoice-id>` or extend `--timeout-seconds`.

## Operator Notes

- The installed binary can drift from source docs, so trust `weave tokens` over static assumptions.
- Keep examples path-safe and generic; do not reuse real wallet secrets or private operational data.
- If the user asks to install the CLI, ask before running installation commands.
