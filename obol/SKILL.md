---
name: obol
description: Pay for and call x402-monetized APIs sold by Obol Stack agents. Use when the user wants to call an HTTPS endpoint that returns `402 Payment Required` (typically `https://<host>/services/<name>/*` on an Obol Stack tunnel) and pay in USDC or $OBOL via the Bankr Wallet API. Signs EIP-3009 `TransferWithAuthorization` for USDC and, for $OBOL on mainnet, a Permit2 `PermitWitnessTransferFrom` plus a gasless EIP-2612 permit settled by the Obol facilitator (`x402.gcp.obol.tech`). Reads asset decimals so a 1 OBOL price isn't misread as a trillion-dollar USDC ask. Buy-side only.
metadata:
  {
    "clawdbot":
      {
        "emoji": "♾️",
        "homepage": "https://obol.org/stack",
        "requires": { "bins": ["bun"] },
      },
  }
---

# Obol (x402 buy-side)

Call paid APIs hosted by Obol Stack agents. A seller exposes services behind `/services/<name>/*` on a public tunnel; hitting one without payment returns HTTP 402 with a JSON payment challenge. This skill signs the challenge with the Bankr Wallet API and retries — the agent gets the response, the seller gets paid.

**Buy-side only.** Not for installing the Obol Stack, running validators, or selling your own endpoints.

Scripts are TypeScript on `bun` (already in the Bankr sandbox), no extra deps:
- `scripts/obol-x402-call.ts` — probe / pay / call (the one you run).
- `scripts/obol-skill-list.ts` — fetch a host's free `/skill.md` catalogue.
- `scripts/x402.ts` — protocol library imported by the call script; don't run it directly.

## When to use

- The user wants to call an x402-protected URL (any HTTPS endpoint returning 402).
- They want to pay in USDC (Base, Base Sepolia, or mainnet) or $OBOL on mainnet (gasless via the Obol facilitator).
- They want to discover what an Obol Stack host sells (fetch `<host>/skill.md`).

## Setup

Relies on the Bankr skill's config at `~/.clawdbot/skills/bankr/config.json`. The API key must have **Wallet API** access and not be read-only — signing typed data is blocked otherwise.

```bash
test -f ~/.clawdbot/skills/bankr/config.json && echo OK || echo "set up the bankr skill first"
```

The buyer EVM address comes from `GET /wallet/me` automatically. Pass `--from 0x...` to pin a specific address.

## Quick start

```bash
# List what a host is selling (free, unauthenticated)
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://example.trycloudflare.com

# Probe a service — show price / network / asset / signing path, do NOT pay
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --probe \
  https://example.trycloudflare.com/services/hello

# Pay and call
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts \
  https://example.trycloudflare.com/services/hello

# POST a JSON body
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts -X POST -d '{"prompt":"hi"}' \
  https://example.trycloudflare.com/services/quant

# Cap the spend (base units — no USD oracle, convert yourself) and pin the chain
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --max-amount 1000000 --network base \
  https://example.trycloudflare.com/services/quant
```

The script prints the parsed challenge (price + network + asset + signing path) on stderr before signing; the paid response body goes to stdout. `-v` prints intermediate state.

**Always `--probe` first on a URL you haven't called** — the seller posts the price, and `--probe` shows it without committing.

## How the flow works

1. Unpaid request → `402` with `accepts[]` (scheme, network, asset, `amount`, `payTo`, `extra`) and optional top-level `extensions`.
2. The script takes `accepts[0]`, resolves the asset's decimals (built-in registry for USDC/OBOL, else on-chain `decimals()`), and prints a human-readable price.
3. It signs the path the seller asked for in `extra.assetTransferMethod`:
   - **`eip3009`** → EIP-3009 `TransferWithAuthorization` (USDC).
   - **`permit2`** → Permit2 `PermitWitnessTransferFrom`; if the seller advertises `extensions.eip2612GasSponsoring` (OBOL on mainnet) it *also* signs an EIP-2612 permit that the Obol facilitator submits gaslessly.
4. `POST /wallet/sign` (Bankr) with `signatureType: "eth_signTypedData_v4"` for each signature.
5. Base64-encodes the `{x402Version, accepted, payload, extensions?}` envelope and retries with the `X-PAYMENT` header (`redirect: "manual"` — a signed voucher is never replayed to a redirected host).
6. `200` → prints body + decodes the `X-PAYMENT-RESPONSE` settlement receipt.

**Critical**: the `amount` is in the asset's base units, not USD. OBOL = 18 decimals; USDC = 6. Misreading OBOL as USDC overshoots by 10^12 — the script reads decimals and shows the formatted price so this can't happen.

See [`references/x402-protocol.md`](references/x402-protocol.md) for the EIP-712 schemas and envelope examples.

## Payment rails

| Asset | Network | `assetTransferMethod` | Buyer gas? |
|-------|---------|-----------------------|------------|
| USDC | base, base-sepolia, mainnet | `eip3009` | No — facilitator settles |
| **$OBOL** | mainnet | `permit2` + `eip2612GasSponsoring` | **No** — Obol facilitator submits the permit |

The seller picks the network and method; the script picks the signing path from the challenge. Known chains (signing domains + USDC addresses): mainnet, base, base-sepolia. Other `eip155:<id>` chains work for `eip3009` if the seller advertises `extra.eip712Domain` and you pass `--rpc-url`.

## Discovery: the seller's `/skill.md`

Every Obol Stack tunnel publishes a free markdown catalogue at `<host>/skill.md` listing service names, prices, and URLs (also `<host>/api/services.json`). Only the `/services/<name>/*` URLs cost money.

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://example.trycloudflare.com
```

## Troubleshooting

- **Wildly wrong price quoted (trillions)**: that's raw base units without decimals. Route through `--probe`, which formats with the right decimals.
- **Paid request returned 402 again**: envelope rejected. Re-run `--probe`; if `payTo`/`asset`/`extra` changed the seller rotated — just re-run. Otherwise the signature didn't verify (wrong domain `name`/`version`, chainId, or an expired deadline). Re-running signs fresh.
- **`403` from `/wallet/sign`**: Bankr key is read-only or lacks Wallet API access. New key at [bankr.bot/api](https://bankr.bot/api).
- **`unknown x402 network`**: handles CAIP-2 (`eip155:<id>`) and a few v1 names. Add to `NET_ALIAS` in `scripts/x402.ts` if needed.
- **`scheme` is not `exact`**: out of scope — show the user the full 402 body.
- **permit2 without gas sponsoring**: the script warns; that path needs a one-time `approve(Permit2, …)` on the token from your wallet, which this client doesn't do. Use a sponsored (OBOL) seller or approve Permit2 separately.
- **New token shows wrong symbol/decimals**: add it to `TOKENS`/`CHAINS` in `scripts/x402.ts`. The on-chain `decimals()` fallback handles unknown tokens for display.

## Security

- The `X-PAYMENT` value is a signed authorisation for a specific amount, recipient, and expiry. Facilitators record nonces; replay is rejected.
- The voucher deadline is short and used immediately; stale vouchers are rejected — re-run for a fresh signature.
- The retry uses `redirect: "manual"` so a redirecting seller can't replay your voucher to another host.
- Never log the `X-PAYMENT` header anywhere persistent.
- The Bankr API key is the sensitive bit — it lives in `~/.clawdbot/skills/bankr/config.json` (gitignored by Bankr). Never echo it.

## Resources

- Obol Stack docs: <https://docs.obol.org/obol-stack/>
- Obol mainnet x402 facilitator: <https://x402.gcp.obol.tech>
- x402 protocol: <https://www.x402.org/>
- Bankr Wallet API signing: <https://docs.bankr.bot/wallet-api/sign>
