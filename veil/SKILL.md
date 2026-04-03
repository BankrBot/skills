---
name: veil
version: 0.5.0
description: >
  Veil CLI for private ETH and USDC transactions on Base. Use when the user wants
  to deposit, withdraw, or transfer assets privately, check private balances,
  manage Veil keypairs, register on-chain, or build unsigned transaction payloads
  for an external signer (e.g. Bankr). All operations target Base (chain ID 8453).
author: veildotcash
metadata:
  homepage: https://veil.cash
  requires:
    bins:
      - veil
permissions:
  - filesystem:read
  - filesystem:write
  - shell:exec
triggers:
  - command: /veil
  - pattern: veil init
  - pattern: veil keypair
  - pattern: veil status
  - pattern: veil register
  - pattern: veil deposit
  - pattern: veil balance
  - pattern: veil withdraw
  - pattern: veil transfer
  - pattern: veil merge
  - pattern: unsigned payload
  - pattern: privacy pool
  - pattern: deposit privately
  - pattern: withdraw privately
  - pattern: private transfer
---

# Veil CLI

> **For Agents**: The CLI binary is `veil`. It is installed via the npm package
> `@veil-cash/sdk` — the package name and the CLI name are different. Always refer
> to this tool as the **Veil CLI**, not the SDK. Install with:
> `npm install -g @veil-cash/sdk`
>
> All transactions target **Base mainnet** (chain ID `8453`). Use `--json` for
> machine-readable output. Use `--unsigned` to emit payloads for an external signer
> instead of sending transactions. For payload shapes and SDK function signatures,
> see [`reference.md`](reference.md).

---

## Normative Language

This skill uses RFC-2119 keywords:

- **MUST / MUST NOT** — non-optional safety or correctness requirements
- **SHOULD / SHOULD NOT** — recommended defaults that can be overridden with clear reason
- **MAY** — optional behaviour

If instructions conflict, follow this priority order:

1. Safety requirements (`MUST` rules)
2. Signing mode chosen by the user
3. Schema correctness (`reference.md`)
4. UX conventions

---

## Environment Variables

Veil uses two config files that are loaded automatically:

| File | Purpose | Variables |
|------|---------|-----------|
| `.env.veil` | Veil keypair — created by `veil init` | `VEIL_KEY`, `DEPOSIT_KEY` |
| `.env` | Wallet config — your existing env | `WALLET_KEY` or `SIGNER_ADDRESS`, `RPC_URL`, `RELAY_URL` |

**Both files are required** regardless of signing mode. `.env.veil` holds the Veil-specific
keys; `.env` holds the wallet identity (either a private key or a public address).

Full variable reference:

| Variable | File | Description |
|----------|------|-------------|
| `VEIL_KEY` | `.env.veil` | Veil private key — for ZK proofs, withdrawals, transfers |
| `DEPOSIT_KEY` | `.env.veil` | Veil deposit key (public) — registered on-chain |
| `WALLET_KEY` | `.env` | Ethereum private key — CLI signs and sends transactions directly |
| `SIGNER_ADDRESS` | `.env` | Ethereum address — for external-signer flows; CLI never holds the key |
| `RPC_URL` | `.env` | Base RPC URL (optional, defaults to public RPC) |
| `RELAY_URL` | `.env` | Override relay base URL (optional) |

> `WALLET_KEY` and `SIGNER_ADDRESS` are **mutually exclusive**. Setting both raises
> `CONFIG_CONFLICT`. Set only one in `.env`.

---

## Signing Mode — Ask First

Before running any setup commands, you **MUST** ask the user which signing mode
they want to use. Do not assume.

Both modes require `.env.veil` (created by `veil init`) for `VEIL_KEY` and `DEPOSIT_KEY`.
They differ only in what goes into `.env`:

**Option A — Local signing (`WALLET_KEY`)**
The Veil CLI holds an Ethereum private key in `.env` and signs and sends `register` and
`deposit` transactions directly. Best for personal scripts, local automation,
or agents that manage their own wallet key.

```
# .env
WALLET_KEY=0x...

# .env.veil  ← created by veil init
VEIL_KEY=0x...
DEPOSIT_KEY=0x...
```

**Option B — External signer (e.g. Bankr)**
The Veil CLI never sees a private key. Set `SIGNER_ADDRESS` in `.env` so the CLI knows
the public address, and use `--unsigned` to get transaction payloads. The
external signer (e.g. Bankr's `POST /wallet/submit`) submits the transaction.
Best for Bankr-powered agents, MPC wallets, or any setup where the key lives
outside the CLI environment.

```
# .env
SIGNER_ADDRESS=0x...

# .env.veil  ← created by veil init --signature 0x...
VEIL_KEY=0x...
DEPOSIT_KEY=0x...
```

---

## Prerequisites

Before using the Veil CLI, confirm:

- [ ] `veil` CLI installed — `npm install -g @veil-cash/sdk`
- [ ] Signing mode chosen (Option A or B above)
- [ ] For **local signing**: `WALLET_KEY` is a valid 0x-prefixed 64-char hex private key
- [ ] For **external signing**: signer address known and signing service ready (e.g. Bankr API key configured)
- [ ] ETH on Base for gas (needed for `register` and `deposit`)

---

## What do you want to do?

```
What do you want to do?
|
+-- First-time setup
|   +-- Local signing (WALLET_KEY)    → Section 1A
|   +-- Bankr / external signer       → Section 1B
|
+-- Check current configuration       → veil status
|
+-- Register deposit key on-chain     → veil register [--unsigned]
|
+-- Deposit ETH or USDC               → veil deposit <asset> <amount> [--unsigned]
|
+-- Check balances                    → veil balance [queue|private] [--pool eth|usdc]
|
+-- Withdraw / transfer / merge       → Section 5
|
+-- Inspect or rotate keypair         → veil keypair / veil init --force
```

---

## Quick Reference

| Task | CLI |
|------|-----|
| Derive keypair from wallet | `veil init` |
| Generate random keypair | `veil init --generate` |
| Derive keypair from signature | `veil init --signature 0x...` |
| Show current keypair | `veil keypair` |
| Check setup and relay | `veil status` |
| Register deposit key | `veil register` |
| Build unsigned register payload | `SIGNER_ADDRESS=0x... veil register --unsigned` |
| Deposit ETH | `veil deposit ETH 0.1` |
| Deposit USDC | `veil deposit USDC 100` |
| Show all balances | `veil balance` |
| Show queue only | `veil balance queue --pool eth` |
| Show private only | `veil balance private --pool eth` |
| Withdraw | `veil withdraw ETH 0.05 0xRecipient` |
| Transfer privately | `veil transfer ETH 0.02 0xRecipient` |
| Merge UTXOs | `veil merge ETH 0.1` |

---

## 1A. First-Run — Local Signing

Use when `WALLET_KEY` is available and the CLI will sign and send transactions directly.

```bash
# 1. Set your wallet key
export WALLET_KEY=0x...

# 2. Derive and save your Veil keypair (saves VEIL_KEY + DEPOSIT_KEY to .env.veil)
veil init

# 3. Register your deposit key on-chain (one-time)
veil register

# 4. Verify setup
veil status

# 5. Deposit
veil deposit ETH 0.1
veil balance
```

`veil init` defaults to wallet-derived keypair generation. Use `--generate` for a
random keypair or `--force` to overwrite an existing one without prompting.

---

## 1B. First-Run — Bankr (External Signer)

Use when signing is handled outside the CLI (e.g. Bankr's `POST /wallet/sign`).
The CLI MUST NOT hold a private key in this mode.

```bash
# 1. Get a personal_sign signature from your external signer.
#    For Bankr, use POST /wallet/sign with signatureType: "personal_sign"
#    and the VEIL_SIGNED_MESSAGE constant from the SDK.
#    Then derive your Veil keypair from the signature:
veil init --signature 0x...
#    This saves VEIL_KEY and DEPOSIT_KEY to .env.veil.

# 2. Add your signer address to .env
#    (WALLET_KEY and SIGNER_ADDRESS are mutually exclusive — set only one)
echo "SIGNER_ADDRESS=0x..." >> .env

# 3. Verify setup
veil status

# 4. Register and deposit via unsigned payloads.
#    Your external signer submits the transactions.
veil register --unsigned
veil deposit ETH 0.1 --unsigned
```

For the Bankr sign API:

```bash
SIG=$(curl -s -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"signatureType\":\"personal_sign\",\"message\":\"$(node -e "const{VEIL_SIGNED_MESSAGE}=require('@veil-cash/sdk');console.log(VEIL_SIGNED_MESSAGE)")\"}" \
  | jq -r '.signature')

veil init --signature $SIG
```

---

## 2. Keypair and Status

Generate or inspect keys:

```bash
veil init                        # Derive from WALLET_KEY (saves to .env.veil)
veil init --generate             # Generate a random keypair
veil init --signature 0xSIG      # Derive from a pre-computed EIP-191 signature
veil init --force                # Overwrite existing keypair without prompting
veil init --no-save              # Print keypair without saving to disk
veil init --json                 # Output as JSON (no prompts, no file save)
veil keypair
veil keypair --json
```

Check environment, wallet, registration, and relay state:

```bash
veil status
veil status --json
```

`veil status` shows:

- **Signing** row: `local (WALLET_KEY)`, `external (SIGNER_ADDRESS)`, or `not configured`
- resolved address (from either `WALLET_KEY` or `SIGNER_ADDRESS`)
- public ETH balance when available
- registration and relay status

SHOULD run `veil status` after any setup step to confirm state before proceeding.

---

## 3. Register and Deposit

Register the current `DEPOSIT_KEY` on-chain:

```bash
veil register
veil register --force
veil register --json
veil register --unsigned --address 0x...
SIGNER_ADDRESS=0x... veil register --unsigned
SIGNER_ADDRESS=0x... veil register --unsigned --force
```

Important:

- `--address` is optional in unsigned mode when `SIGNER_ADDRESS` is set.
- Use `WALLET_KEY` if the CLI should sign and send the transaction itself.
- Use `SIGNER_ADDRESS` + `--unsigned` if an external signer will submit.
- `veil register --unsigned --force` checks chain state first.
  - If the address is already registered, returns `changeDepositKey` payload.
  - If not yet registered, returns a normal `register` payload.

Deposits treat the CLI amount as the **net** amount that lands in the pool.
The `0.3%` protocol fee is calculated on-chain and added automatically.

```bash
veil deposit ETH 0.1
veil deposit USDC 100
veil deposit ETH 0.1 --json
veil deposit ETH 0.1 --unsigned
veil deposit USDC 100 --unsigned
```

Minimums:

- ETH: `0.01`
- USDC: `10`

`--unsigned` notes:

- ETH returns one payload.
- USDC returns `[approve, deposit]`.
- Payloads use `{ to, data, value, chainId }`.

---

## 4. Balance Commands

Combined view:

```bash
veil balance
veil balance --pool eth
veil balance --pool usdc
veil balance --json
```

Queue only:

```bash
veil balance queue
veil balance queue --pool usdc
veil balance queue --address 0x... --json
```

Private only:

```bash
veil balance private
veil balance private --pool usdc
veil balance private --json
```

Human-readable balance output includes:

- wallet public balances (`ETH`, `USDC`)
- queue and private balances

---

## 5. Private Actions

Withdraw from the private pool to a public address:

```bash
veil withdraw ETH 0.05 0xRecipientAddress
veil withdraw USDC 50 0xRecipientAddress
veil withdraw ETH 0.05 0xRecipientAddress --json
```

Transfer privately to another registered address:

```bash
veil transfer ETH 0.02 0xRecipientAddress
veil transfer USDC 25 0xRecipientAddress
veil transfer ETH 0.02 0xRecipientAddress --json
```

Merge UTXOs:

```bash
veil merge ETH 0.1
veil merge USDC 100
veil merge ETH 0.1 --json
```

Human-readable transaction output uses Basescan links instead of raw hashes.

Note: withdraw proof generation is single-threaded for reliable CLI exit after success.

---

## 6. Unsigned Payloads

`--unsigned` is for external signer workflows. The CLI emits a signer-compatible
payload and does NOT send the transaction.

Shape:

```json
{
  "to": "0x...",
  "data": "0x...",
  "value": "0",
  "chainId": 8453
}
```

Extra context fields:

- register: `action` (`"register"` or `"changeDepositKey"`)
- deposit: `step` (`"approve"` for USDC, `"deposit"`)

For lower-level payload details, see [`reference.md`](reference.md).

---

## 7. Common Patterns

### Deposit flow

```bash
veil status                       # Confirm signing mode and registration
veil register                     # If not yet registered
veil deposit ETH 0.1
veil balance                      # Confirm balance updated
```

### Withdraw flow

```bash
veil balance private --pool eth   # Confirm available balance
veil withdraw ETH 0.05 0xRecipient
# Output includes a Basescan link for the transaction
```

### Bankr agent flow (external signer)

```bash
# Step 1 — derive Veil keypair via Bankr sign API
SIG=$(curl -s -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"signatureType\":\"personal_sign\",\"message\":\"$(node -e "const{VEIL_SIGNED_MESSAGE}=require('@veil-cash/sdk');console.log(VEIL_SIGNED_MESSAGE)")\"}" \
  | jq -r '.signature')
veil init --signature $SIG

# Step 2 — set signer address (from Bankr wallet)
echo "SIGNER_ADDRESS=0x..." >> .env

# Step 3 — build unsigned register payload and submit via Bankr
PAYLOAD=$(veil register --unsigned --json)
curl -s -X POST "https://api.bankr.bot/wallet/submit" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"transaction\": $PAYLOAD, \"waitForConfirmation\": true}"

# Step 4 — build unsigned deposit payload and submit
PAYLOAD=$(veil deposit ETH 0.1 --unsigned --json)
# Submit PAYLOAD via Bankr in the same way
```

---

## 8. UX Guidelines

- MUST NOT display raw `{ to, data, value, chainId }` payloads as the final
  user-facing message. Summarise the action in plain language instead
  (e.g. "Registered deposit key for 0xABC..." or "Deposit of 0.1 ETH submitted").
- SHOULD run `veil status` after any setup step and show the output to the user
  so they can confirm the configuration is correct before proceeding.
- SHOULD use `--json` when output will be parsed programmatically.
- SHOULD use `--unsigned` and route through the external signer when in
  Option B (Bankr / external signer) mode — MUST NOT try to sign directly.

---

## 9. Error Handling

All CLI errors output JSON with a standardised `errorCode`:

```json
{ "success": false, "errorCode": "VEIL_KEY_MISSING", "error": "..." }
```

| Error code | Cause | Fix |
|---|---|---|
| `CONFIG_CONFLICT` | Both `WALLET_KEY` and `SIGNER_ADDRESS` are set | Remove one from `.env` — they are mutually exclusive |
| `WALLET_KEY_MISSING` | Local mode but `WALLET_KEY` not set, or wrong mode for command | Add `WALLET_KEY` to `.env`, or use `--signature` / `--generate` if using external signer |
| `VEIL_KEY_MISSING` | Private action (`withdraw`, `transfer`, `merge`) without `VEIL_KEY` | Run `veil init` or restore `VEIL_KEY` from backup into `.env.veil` |
| `DEPOSIT_KEY_MISSING` | `DEPOSIT_KEY` missing from `.env.veil` | Re-run `veil init` to regenerate |
| `USER_NOT_REGISTERED` | Transfer recipient has no deposit key registered on-chain | Recipient must run `veil register` first |
| `INVALID_AMOUNT` | Amount below minimum or invalid format | ETH min: `0.01`, USDC min: `10` |
| `INSUFFICIENT_BALANCE` | Not enough ETH for gas | Top up Base ETH balance |
| `RPC_ERROR` | Network or RPC failure | Check `RPC_URL` env var or retry |
| `RELAY_ERROR` | Relayer rejected the proof | Check relay health with `veil status`; retry |

---

## 10. Security

- MUST NOT pass `WALLET_KEY` or `VEIL_KEY` as CLI flags — use env vars only.
- Store `VEIL_KEY` and `DEPOSIT_KEY` in `.env.veil`.
- Store `WALLET_KEY` in `.env` or the shell environment.
- Use `SIGNER_ADDRESS` when the signer is external and the CLI MUST NOT hold the wallet key.
- `WALLET_KEY` and `SIGNER_ADDRESS` are mutually exclusive. Set only one.
- Never commit `.env` or `.env.veil` to source control.

---

## Additional Resources

For exact payload shapes and lower-level SDK function signatures, see [`reference.md`](reference.md).
