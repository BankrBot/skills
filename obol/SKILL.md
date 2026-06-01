---
name: obol
description: Pay for and call x402-monetized APIs sold by Obol Stack agents. Use when the user wants to call an HTTPS endpoint that returns `402 Payment Required` (typically `https://<host>/services/<name>/*` on an Obol Stack trycloudflare tunnel) and pay in USDC or $OBOL via the Bankr Wallet API. Handles x402 v1 + v2, signs EIP-3009 `TransferWithAuthorization` for USDC and EIP-2612 `Permit` for $OBOL on mainnet (gasless via the Obol facilitator at `x402.gcp.obol.tech`). Reads asset decimals so a 1 OBOL price isn't misread as a trillion-dollar USDC ask. Buy-side only.
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

Call paid APIs hosted by Obol Stack agents. An Obol Stack seller exposes services behind `/services/<name>/*` on a public tunnel; hitting one of those URLs without payment returns HTTP 402 with a JSON payment challenge. This skill signs the challenge using the Bankr Wallet API and retries the request — the agent gets the response, the seller gets paid.

**Buy-side only.** Don't use this for installing the Obol Stack, running validators, or selling your own x402 endpoints.

Scripts are TypeScript on `bun` — no extra deps. `bun` is already in the Bankr sandbox.

## When to use

- The user wants to call an x402-protected URL (any HTTPS endpoint returning 402).
- The user wants to pay in USDC on Base or mainnet, or in $OBOL on mainnet (gasless via the Obol facilitator).
- The user wants to discover what an Obol Stack host is selling (fetch `<host>/skill.md`).

## Setup

Relies on the Bankr skill's config at `~/.clawdbot/skills/bankr/config.json`. The API key must have **Wallet API** access enabled and not be read-only — signing typed data is blocked otherwise.

```bash
test -f ~/.clawdbot/skills/bankr/config.json && echo OK || echo "set up the bankr skill first"
```

The buyer EVM address is fetched from `GET /wallet/me` automatically. Pass `--from 0x...` if the agent has multiple addresses and you need a specific one.

## Quick start

```bash
# List what an Obol Stack host is selling
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://example.trycloudflare.com

# Probe a single service — show price/network/asset, do NOT pay
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --probe \
  https://example.trycloudflare.com/services/hello

# Pay and call
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts \
  https://example.trycloudflare.com/services/hello

# POST with a JSON body
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts -X POST -d '{"prompt":"hi"}' \
  https://example.trycloudflare.com/services/quant

# Cap by base units (the script has no USD oracle — convert yourself)
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --max-amount 1000000 \
  https://example.trycloudflare.com/services/quant
```

The script prints the parsed challenge (price + network + asset + signing path) on stderr before signing. Paid response body goes to stdout. `-v` prints intermediate state.

**Always run `--probe` first on a URL you haven't called before** — the seller can post any price, and `--probe` shows it without committing.

## How the flow works

1. Unpaid request → server returns 402 with `accepts[]` (price, network, asset, payTo, scheme hints) and optional `extensions`.
2. Script picks `accepts[0]`, looks up the asset's decimals (built-in registry or on-chain `decimals()`), and prints a human-readable price (`1 OBOL  (= 1000000000000000000 base units)`).
3. Builds EIP-712 typed-data:
   - **EIP-3009 `TransferWithAuthorization`** (default for `exact` scheme — used by USDC).
   - **EIP-2612 `Permit`** when the seller signals gas-sponsored permits: `extensions.eip2612GasSponsoring` present, OR `extra.assetTransferMethod: "permit2"` on an EIP-2612-capable token, OR v1's `extra.permit: true`, OR `--force-permit`.
4. `POST /wallet/sign` (Bankr Wallet API) with `signatureType: "eth_signTypedData_v4"`.
5. Wraps signature + auth/permit fields in a base64 JSON envelope.
6. Re-requests with `PAYMENT-SIGNATURE` (v2) and/or `X-PAYMENT` (v1) header. 200 → prints body + decodes the `PAYMENT-RESPONSE` settlement receipt.

**Critical**: the `amount` in a 402 challenge is in the asset's base units, not USD. OBOL = 18 decimals; USDC/USDT = 6; DAI = 18. Assuming USDC decimals on an OBOL price overshoots by 10^12. The script reads `decimals()` and shows the formatted price so this can't happen via the script.

See [`references/x402-protocol.md`](references/x402-protocol.md) for full wire details (v1↔v2 renames, EIP-712 schemas, envelope examples).

## Payment rails

| Asset | Network | Signing path | Buyer needs gas? |
|-------|---------|--------------|------------------|
| USDC | base, base-sepolia, polygon[-amoy], arbitrum[-sepolia], avalanche[-fuji], optimism[-sepolia] | EIP-3009 | No — Coinbase facilitator |
| USDC | ethereum (mainnet) | EIP-3009 | No — Obol facilitator |
| **$OBOL** | ethereum (mainnet) | EIP-2612 Permit (gas-sponsored permit batching) | **No** — Obol facilitator |

The buyer doesn't pick the facilitator; the seller does, and the script picks the signing path from the challenge.

## Discovery: the seller's `/skill.md`

Every Obol Stack tunnel publishes a markdown catalogue at `<host>/skill.md` listing service names, prices, and URLs. Unauthenticated — only the `/services/<name>/*` URLs cost money.

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://example.trycloudflare.com
```

## Troubleshooting

- **Agent quoted a wildly wrong price (trillions, billions)**: it's reading raw base units without decimals. Always route through `obol-x402-call.ts --probe` — it formats with the correct decimals.
- **Paid request returned 402 again**: payment envelope rejected. Re-run `--probe` — if `payTo`/`asset`/`extra` changed, the seller rotated, just re-run. Otherwise the signature didn't verify (wrong `extra.name`/`extra.version`, wrong chainId, expired `validBefore`). Re-running generates a fresh signature.
- **`403` from `/wallet/sign`**: Bankr API key is read-only or missing Wallet API access. New key at [bankr.bot/api](https://bankr.bot/api).
- **`unknown x402 network`**: the script handles CAIP-2 (`eip155:<chainId>`) and a list of v1 plain names. Add unknown networks to `V1_NETWORK_TO_CHAIN` in the script if needed.
- **`scheme` is not `exact`**: out of scope. Show the user the full 402 body.
- **Token unknown — wrong decimals/symbol**: extend `KNOWN_TOKENS` in `scripts/obol-x402-call.ts`. The on-chain `decimals()` fallback works but doesn't know about EIP-2612 support; pass `--force-permit` if you know the token supports it natively.
- **`assetTransferMethod: "permit2"` but token isn't EIP-2612-capable**: script errors with a clear message. Pass `--force-permit` if you trust the seller's facilitator handles it.

## Security

- The `PAYMENT-SIGNATURE` / `X-PAYMENT` value is a signed authorisation for a specific amount, recipient, and expiry. Facilitators record nonces; replay is rejected.
- `validBefore` is `now + maxTimeoutSeconds` (typically 60s). Stale auths are rejected — re-run for a fresh signature.
- Never log the payment header to anywhere persistent.
- The Bankr API key is the sensitive bit. It lives in `~/.clawdbot/skills/bankr/config.json` (gitignored by Bankr). Never echo it.

## Resources

- Obol Stack docs: <https://docs.obol.org/obol-stack/>
- Obol mainnet x402 facilitator: <https://x402.gcp.obol.tech>
- x402 protocol: <https://www.x402.org/>
- Bankr Wallet API signing: <https://docs.bankr.bot/wallet-api/sign>
