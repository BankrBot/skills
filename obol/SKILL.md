---
name: obol
description: Pay for and call x402-monetized APIs sold by Obol Stack agents. Use when the user wants to discover, probe, or call an Obol-hosted x402 service — any HTTPS endpoint that returns `402 Payment Required` and is exposed by an Obol Stack seller (usually a Cloudflare quick tunnel routing `/services/<name>/*`). Settles payments by signing EIP-712 typed-data via the Bankr Wallet API (`POST /wallet/sign` with `eth_signTypedData_v4`). Supports USDC on Base (default facilitator), USDC on Ethereum mainnet (Obol facilitator at `x402.gcp.obol.tech`), and $OBOL on Ethereum mainnet (Obol facilitator, gas-sponsored EIP-2612 permit batching — buyers spend zero ETH). Buy-side only — does NOT install, run, or operate the Obol Stack itself.
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

Call paid APIs hosted by Obol Stack agents. An Obol Stack seller exposes services behind `/services/<name>/*` on a public tunnel; hitting one of those URLs without payment returns HTTP 402 with a JSON payment challenge. This skill signs the challenge using the Bankr Wallet API and retries the request — the agent gets the response body, the seller gets paid.

**This is buy-side only.** Selling x402 services is the seller's problem (they run the Obol Stack). You are the buyer with a Bankr wallet.

The scripts are TypeScript and run on `bun` — no extra deps, no `jq`, no Python. `bun` is already in the Bankr sandbox.

## When to use this skill

- The user wants to call an x402-protected URL (any HTTPS endpoint that returns 402).
- The user has been given a URL like `https://<something>.trycloudflare.com/services/<name>/...` or `https://<host>/services/<name>/...` and wants to pay for one or more requests.
- The user wants to discover what services an Obol Stack host is selling (fetch `<host>/skill.md`).
- The user wants to pay in **$OBOL on Ethereum mainnet** without holding ETH (the Obol facilitator sponsors gas).
- The user wants to pay in **USDC on Ethereum mainnet** and the seller has chosen the Obol facilitator.
- The user wants to pay in **USDC on Base** (the standard path — the buyer doesn't need to know which facilitator the seller picked).

Don't use this skill for:
- Installing or running the Obol Stack — out of scope here.
- Operating distributed validators or monitoring Obol clusters — not the same product.
- Selling your own x402 endpoints — seller-side, out of scope.

## Setup

Relies on the Bankr skill's existing config at `~/.clawdbot/skills/bankr/config.json`. The API key must have **Wallet API** access enabled with a non-read-only key — signing typed data is blocked for read-only keys per the Bankr docs.

Sanity-check Bankr is configured:

```bash
test -f ~/.clawdbot/skills/bankr/config.json && echo OK || echo "set up the bankr skill first"
```

The wallet address used as the x402 buyer (`from` field on EIP-3009, `owner` on EIP-2612) is the EVM address returned by `GET /wallet/me`. The script extracts it automatically; override with `--from 0x...` if the agent has multiple EVM addresses and needs a specific one.

## Quick start

```bash
# 1. List services advertised by an Obol Stack host
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://example.trycloudflare.com

# 2. Probe a single service (parse 402, show price/network/asset, do NOT pay)
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --probe \
  https://example.trycloudflare.com/services/hello/

# 3. Pay and call (the normal flow)
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts \
  https://example.trycloudflare.com/services/hello/

# 4. POST with a JSON body
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts -X POST \
  -d '{"prompt":"hi"}' https://example.trycloudflare.com/services/quant/
```

The script prints the seller's price + network + asset on stderr before signing, so the agent (or user) can sanity-check before authorising the payment. The paid response body goes to stdout.

## How x402 works (one minute)

1. Client `GET`s the URL with no payment.
2. Server returns `402 Payment Required` with a JSON body shaped roughly like:
   ```json
   {
     "x402Version": 1,
     "accepts": [
       {
         "scheme": "exact",
         "network": "base",
         "maxAmountRequired": "1000",
         "resource": "https://.../services/hello/",
         "payTo": "0xSellerWallet",
         "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
         "maxTimeoutSeconds": 60,
         "extra": { "name": "USD Coin", "version": "2" }
       }
     ],
     "error": "X-PAYMENT header is required"
   }
   ```
3. Client picks one entry from `accepts`, builds an EIP-712 typed-data payload that authorises that transfer, signs it, and base64-encodes a JSON wrapper into the `X-PAYMENT` header.
4. Client re-issues the same request with `X-PAYMENT: <base64-json>`.
5. Server verifies the signature with its facilitator, settles on-chain, and returns the real response. The facilitator pays the on-chain gas — buyer signs an off-chain message and is done.

The script handles all of this. See [`references/x402-protocol.md`](references/x402-protocol.md) for wire-level details.

## Payment rails this skill handles

| Asset | Network | Scheme | Typed-data | Buyer needs gas? |
|-------|---------|--------|------------|------------------|
| USDC | `base` | `exact` | EIP-3009 `TransferWithAuthorization` | No — facilitator pays |
| USDC | `base-sepolia` | `exact` | EIP-3009 | No |
| USDC | `ethereum` (mainnet) | `exact` | EIP-3009 | No — Obol facilitator pays |
| USDC | `polygon`, `polygon-amoy`, `avalanche`, `avalanche-fuji`, `arbitrum-one`, `arbitrum-sepolia` | `exact` | EIP-3009 | No |
| **$OBOL** | `ethereum` (mainnet) | `exact` with `extra.permit: true` | EIP-2612 `Permit` | **No** — Obol facilitator batches permit + transfer at settlement |

The buyer never picks the facilitator — that's the seller's choice, embedded in the 402 response. This skill picks the right typed-data shape based on what the server asks for.

**The OBOL-on-mainnet UX is the headline reason to use this skill**: buyer signs an off-chain message, seller receives OBOL, neither party touches ETH. If you're testing the skill end-to-end and the seller has an OBOL price posted, prefer that path — it's the most visibly Obol-flavoured experience.

## Discovering services

Two paths:

### 1. User provides a URL directly

User says "call `https://foo.trycloudflare.com/services/blocks/?height=22000000`" — pass it straight to `obol-x402-call.ts`. The probe step shows the price before payment.

### 2. Fetch the seller's `/skill.md` catalogue

Every Obol Stack tunnel publishes a `/skill.md` at the tunnel root that lists what the host is selling, in human + agent-readable form. Use this to enumerate services when the user only knows the host:

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://foo.trycloudflare.com
```

The script prints the raw `skill.md` (markdown) so the agent can read service names, descriptions, and prices. Match what the user wants to one of those entries, then call its URL with `obol-x402-call.ts`.

The skill catalogue is unauthenticated and free. Only the actual `/services/<name>/*` endpoints cost money.

## Calling a paid endpoint — the full flow

End-to-end, the script:

1. Issues the unpaid request and inspects the 402 body.
2. Calls `GET /wallet/me` on `api.bankr.bot` for the buyer EVM address.
3. Constructs EIP-712 typed-data matching the seller's `accepts[0]`:
   - Standard `exact` → EIP-3009 `TransferWithAuthorization` with a random `bytes32` nonce, `validAfter=0`, `validBefore=now+maxTimeoutSeconds`.
   - `exact` + `extra.permit: true` → EIP-2612 `Permit` with the token's on-chain `nonces(owner)` and `deadline=now+maxTimeoutSeconds`.
4. `POST /wallet/sign` with `{ signatureType: "eth_signTypedData_v4", typedData }`.
5. Wraps `{ x402Version, scheme, network, payload }` (where payload includes the signature and the authorization/permit fields) and base64-encodes it as the `X-PAYMENT` header.
6. Re-requests with the header. Status 200 → prints the body. Anything else → prints the body to stderr and exits non-zero.

Verbose mode (`-v`) logs each step. The script's source is the source of truth — read `scripts/obol-x402-call.ts` if anything below is unclear at runtime.

## Common patterns

### Call once, print the response

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts \
  https://foo.trycloudflare.com/services/hello/
```

### Probe first, decide whether to pay

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --probe \
  https://foo.trycloudflare.com/services/quant/
# Reads price, network, asset, payTo. No signing, no payment.
```

Useful when the user wants to confirm "is this really 0.01 USDC?" before authorising.

### Discover, then call

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-skill-list.ts https://foo.trycloudflare.com
# → user picks "quant" from the printed catalogue
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts -X POST \
  -d '{"ticker":"ETH"}' \
  https://foo.trycloudflare.com/services/quant/
```

### Cap the price you're willing to pay

```bash
bun ~/.clawdbot/skills/obol/scripts/obol-x402-call.ts --max-amount 1000000 \
  https://foo.trycloudflare.com/services/quant/
# Refuses to sign if maxAmountRequired exceeds the cap (in token base units).
# USDC is 6 decimals → 1000000 = 1.0 USDC. OBOL is 18 decimals.
```

Always do this when calling a seller you haven't called before.

## Troubleshooting

- **`402` returned again after retry**: the `X-PAYMENT` header was rejected. Run `--probe` against the same URL — if `payTo`, `asset`, or `extra` changed between calls, the seller is rotating; just retry. If they're stable, the signature didn't verify (wrong domain, wrong chainId, expired `validBefore`). Re-run; the script always generates a fresh signature.
- **`403` from `/wallet/sign`**: the Bankr API key is read-only or doesn't have Wallet API access. Issue a new key at [bankr.bot/api](https://bankr.bot/api) with Wallet API + Agent API enabled and not read-only.
- **`scheme` is not `exact`**: the seller is using a scheme this skill doesn't handle yet. The script prints the full 402 body — show it to the user and ask. Most schemes you'll see in the wild are `exact`.
- **`network` is not in the mapped list**: the script lists the networks it knows about in `networkToChainId()`. Add a mapping if the seller is on a network the script doesn't know yet — chainId is the only missing piece.
- **`/wallet/me` returns multiple addresses**: pass `--from 0x...` to `obol-x402-call.ts` to disambiguate.
- **`extra.permit: true` but signing fails**: the EIP-2612 path needs to read `nonces(owner)` from the token contract. The script makes that call via `https://ethereum-rpc.publicnode.com` by default. Override with `--rpc-url` if blocked, or if the seller posted an asset on a chain other than mainnet (rare for permit-based assets).
- **`X-PAYMENT` is huge / fails to send**: this is expected; the header is a base64 JSON blob (a few hundred bytes). If the server rejects on size, the seller has misconfigured their Traefik middleware.

## Security notes

- The `X-PAYMENT` value carries a signed authorisation for a specific amount to a specific address at a specific time. The facilitator records nonces — replay is rejected automatically.
- The `validBefore` window defaults to the seller's `maxTimeoutSeconds` (typically 60s). If the request takes longer than that to reach the seller, the auth expires and the seller's facilitator rejects it. Retry — the script always generates a fresh signature.
- **Always probe before paying** when calling a URL the user hasn't called before. The seller can change their price at any time; `--probe` shows the current ask without committing.
- Never log the `X-PAYMENT` value to anywhere persistent — it's single-use but still an authorisation artefact tied to the wallet.
- The Bankr API key is the most sensitive thing here. Keep it in `~/.clawdbot/skills/bankr/config.json` (which is `.gitignore`d by Bankr) and never echo it.

## Resources

- Obol project: <https://obol.org>
- Obol LLMs.txt: <https://obol.org/llms.txt>
- Obol Skills: <https://github.com/ObolNetwork/skills/>
- Obol Stack docs: <https://docs.obol.org/obol-stack/>
- Obol mainnet x402 facilitator: <https://x402.gcp.obol.tech>
- x402 protocol: <https://www.x402.org/>
- Bankr Wallet API (signing): <https://docs.bankr.bot/wallet-api/sign>
- Bankr Wallet API overview: <https://docs.bankr.bot/wallet-api/overview>

---

**💡 Pro tip**: The first time you call any seller, run `--probe` first and read the price back to the user. Most Obol Stack demo prices are tiny (0.001 USDC, 1 OBOL) but a misconfigured seller can post anything.

**🏛️ Why Obol facilitator on mainnet**: the default Coinbase facilitator settles on Base only. To buy a service whose price is settled on Ethereum mainnet (USDC or OBOL), the seller has to point at a mainnet-capable facilitator — Obol runs the public one at `x402.gcp.obol.tech`. The buyer doesn't configure this; the seller does, and the buyer just signs what the 402 response asks for.
