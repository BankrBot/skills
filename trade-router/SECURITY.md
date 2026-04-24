# Security Model

This document explains the security architecture of the Trade Router MCP skill. It exists to address the "suspicious" verdict returned by static analysis tools (e.g., VirusTotal, ClawHub moderation) that cannot infer the non-custodial flow from behavior alone.

## TL;DR

- **Your private key never leaves your machine.** It is read once from an environment variable, used to sign transactions locally using the standard Solana cryptography library, and never transmitted, logged, or persisted.
- **The remote service (api.traderouter.ai) only receives signed transactions** — cryptographically sealed bundles that cannot be used to compromise the originating wallet.
- **The private key is only required for actual trading.** Read-only operations (`/holdings`, `/mcap`) do not require any key at all.
- **Dry-run mode is available** (`TRADEROUTER_DRY_RUN=1`) — no swaps are submitted, only unsigned transactions returned for inspection.
- **Daily loss limits and server-side signature verification** provide additional guardrails.

## Threat model

### What we protect against

| Threat | Mitigation |
|---|---|
| Private key exfiltration to remote service | Key never leaves local process. Only signed transactions (which cannot be replayed beyond their single intended swap) are transmitted. |
| Key being logged/persisted on disk | Private key is read from `PRIVATE_KEY` env var, held in memory for the signing operation, never written to disk. No log statement in the codebase includes the key. |
| Key being captured by a compromised dependency | All cryptography is performed via `solders` (Rust-backed Solana library) — isolated signing primitives. No custom crypto. |
| MITM attack on API calls | All requests use HTTPS to api.traderouter.ai. Server responses are verified via Ed25519 signatures using a hard-coded trust anchor public key (see `/security` endpoint). |
| Malicious server asking to sign arbitrary tx | Client validates every returned transaction is a legitimate swap of the expected input/output amounts before signing. |
| Sandwich / MEV attacks on the swap itself | `/protect` endpoint submits via Jito bundles, preventing mempool visibility. |
| Slippage abuse | User sets slippage tolerance; chain enforces it at settlement. |

### What's out of scope

- User running this MCP on a compromised machine (local key theft via malware is beyond our remit — user is responsible for operating system security).
- User revealing `PRIVATE_KEY` via shell history, `.env` files committed to public repos, or exposed process env (see "User responsibilities" below).
- Attacks on Solana itself (consensus, validator compromise, etc.).

## Data flow

```
┌──────────────────────────────────────────────────────────────┐
│ LOCAL MACHINE                                                │
│                                                              │
│ 1. PRIVATE_KEY env var  ──────► MCP server process           │
│                                  │                           │
│                                  │ (read once, held in mem)  │
│                                  ▼                           │
│ 2. Agent calls `swap` tool      Local signing with solders   │
│                                  │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │
                                   │  (NETWORK boundary)
                                   │
                                   ▼
  POST /swap  (wallet_address, token, amount, action)
  GET  /mcap  (token_mint)
  GET  /holdings (wallet_address)
       ↓
  api.traderouter.ai returns an unsigned transaction

                                   │
                                   │  (back to local)
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│ LOCAL MACHINE                                                │
│                                                              │
│ 3. Unsigned tx signed with PRIVATE_KEY (local)               │
│ 4. SIGNED tx sent to /protect endpoint                       │
│                                                              │
│    >>> THE PRIVATE KEY NEVER LEAVES THIS BOX <<<             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  POST /protect  (signed_tx_base64)
       ↓
  api.traderouter.ai submits to Jito bundle
  Returns: (signature, pre/post balances)
```

## What each endpoint sends

| Endpoint | Request contents | Never includes |
|---|---|---|
| `POST /swap` | wallet_address (public key), token_mint, action (buy/sell), amount | Private key, seed phrase, any signing material |
| `POST /protect` | signed_tx_base64 (fully signed transaction) | Private key, unsigned tx, session data |
| `POST /holdings` | wallet_address only | Private key, any auth material |
| `GET /mcap` | token_mint(s) | Anything user-specific |
| `GET /flex` | wallet + token (for PNG generation) | Private key |
| WebSocket `/ws` | wallet_address to register, order params | Private key (signing happens client-side on fill) |

## Permissions manifest

```yaml
required_env_vars:
  PRIVATE_KEY: "Read once. Used locally for signing. Never transmitted."
  SOLANA_RPC_URL: "Optional — your own RPC. Used locally for queries."

network_access:
  - api.traderouter.ai:443   # HTTPS for REST endpoints
  - api.traderouter.ai:443   # WSS for WebSocket limit orders
  - (optional) any.rpc.solana.com  # Direct Solana RPC if SOLANA_RPC_URL set

filesystem_access:
  - read-only: none required
  - write: none required (stateless)

outbound_data:
  - wallet public addresses
  - token mints
  - swap parameters (amounts, slippage)
  - signed transactions
  NEVER:
  - private keys
  - seed phrases  
  - unsigned transactions with key attached
  - keystore files
  - passwords
```

## User responsibilities

The following are the user's responsibility — even a perfect tool cannot protect you from these:

1. **Do not commit `.env` files to public repos.** Add `.env` to `.gitignore`.
2. **Do not export `PRIVATE_KEY` in shells where history is logged to shared systems** (shared servers, bastion hosts).
3. **Use a dedicated trading wallet with limited balance** — not your main wallet. Treat it as a hot wallet.
4. **Rotate keys periodically.** Every 30-90 days, move funds to a new wallet, stop using the old one.
5. **Run on trusted hardware.** Do not run this MCP on a machine you don't control.
6. **Set reasonable slippage.** Low-liquidity tokens require 15-25% slippage; your own risk tolerance applies.
7. **Set `MAX_DAILY_LOSS`** if concerned about runaway automation.

## Safety features built in

- **Dry-run mode** — set `TRADEROUTER_DRY_RUN=1` and no swaps will be submitted. Safe to test.
- **Daily loss limits** — set `MAX_DAILY_LOSS_SOL=N` and the MCP will refuse trades if cumulative same-day loss exceeds N SOL.
- **Server-side signature verification** — `/protect` rejects any tx that doesn't match its claimed signer.
- **Trust anchor** — server public key `EXX3nRzfDUvbjZSmxFzHDdiSYeGVP1EGr77iziFZ4Jd4` hard-coded in both Python and JS implementations. Client verifies `order_filled` Ed25519 signatures against this anchor before accepting.

## Disclosure

Found a vulnerability? Please email **security@traderouter.ai** or use GitHub Security Advisories on this repo.

We commit to:
- Acknowledge within 48 hours
- Fix critical issues within 7 days
- Credit the reporter publicly (with their consent)

## Audit status

- 2026-04-23: Self-audited, documentation-complete (this file). External audit pending.
- We plan to commission a formal audit from a reputable firm (Offside Labs / OtterSec / Zellic) in Q2 2026.

## License

See `LICENSE`. This code is available under the MIT License.
