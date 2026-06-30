---
name: x402-precheck
description: Before paying ANY x402 endpoint, call the x402 Agentic payment-trust suite. The flagship /precheck returns an allow/warn/block verdict — validating the payee, screening it against the OFAC sanctioned-address list, flagging price gouging vs. category norms, checking asset/network, and enforcing the user's spend policy. Companion endpoints: /screen (focused OFAC check), /spend-guard (per-agent budget enforcement), /token-check (verify a token is canonical USDC vs a lookalike), /verify-payment (confirm a payment settled on-chain), /reputation (payee reputation score). Stops bad payments before money leaves the wallet.
tags: [x402, payments, security, agents, risk, precheck, safety]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: "https://x402agentic.ai"
    requires:
      bins: [curl]
---

# x402 Payment Pre-Flight Check

A pre-pay risk gate for autonomous agents. **Call it right before you pay any
x402 endpoint.** It returns a verdict — `allow`, `warn`, or `block` — plus a
0–100 risk score and itemized reasons, so you never settle a payment to an
invalid/denied/flagged payee, overpay a gouging endpoint, or pay in the wrong
asset.

Endpoint: `https://api.x402agentic.ai/precheck`
Price: $0.10 USDC/call on Base (configured via `PRICE_PRECHECK` / `PRICE_USDC`).
Protocol: x402 **v2** (settles via Coinbase CDP facilitator on Base mainnet).

This is the flagship endpoint of the **x402 Agentic** payment-trust suite. The same
service hosts companion endpoints (see "Companion endpoints" below): `/screen`,
`/spend-guard`, and `/token-check`.

Screening is backed by the live **OFAC sanctioned-address list** (auto-refreshed
weekly), plus the structural checks below — so `denylist_screen` reflects real
sanctions data, not placeholders.
Discovery route (free): `https://api.x402agentic.ai/`

## When to use

Call `/precheck` before settling a payment that's **worth protecting** — i.e. any
non-trivial or unfamiliar payment where a bad/denied payee, a gouging price, or a
wrong asset would cost more than the check. It's most valuable when:

- The endpoint is one you have not paid before.
- The payment is large enough that the check fee is negligible against it.
- The price looks higher than usual for that kind of service.
- You are operating under a user spend policy / budget.
- The 402 envelope asks you to pay in a non-USDC asset or on an unusual network.

For high-frequency, sub-cent payments where a full verdict isn't worth $0.10, use
the cheaper focused `/screen` ($0.02) for a sanctions-only check, or `/token-check`
($0.02) for asset verification.

If the verdict is `block`, **do not pay** — surface the reason to the user.
If `warn`, pay only if the user/policy tolerates the flagged risk.
If `allow`, proceed with the payment.

## How to call

Forward the entire 402 response body as `challenge`, or pass fields directly.
POST is preferred. The endpoint is itself x402-paid: your agent wallet pays the
per-call fee automatically through the normal 402 flow (e.g. via `x402-fetch`).

```bash
# Forward the raw 402 challenge you just received
curl -X POST "https://api.x402agentic.ai/precheck" \
  -H "Content-Type: application/json" \
  -d '{ "challenge": <the JSON body of the 402 response>, "category": "llm" }'
```

```bash
# Or pass fields explicitly, with an optional spend policy
curl -X POST "https://api.x402agentic.ai/precheck" \
  -H "Content-Type: application/json" \
  -d '{
        "payTo": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "amount": 0.01,
        "asset": "USDC",
        "network": "base",
        "category": "market-data",
        "resource": "https://some-api.example/data",
        "policy": { "maxPerCallUsd": 0.05, "blocklist": ["0xbad..."] }
      }'
```

```bash
# GET also works for quick checks
curl "https://api.x402agentic.ai/precheck?payTo=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=0.01&network=base&category=llm"
```

## Inputs

- `challenge` — the raw 402 response body (object with an `accepts` array), or a
  single PaymentRequirements. If given, payTo/amount/asset/network are parsed
  from it.
- `payTo`, `amount` (USD) or `maxAmountRequired` (atomic), `asset`, `network` —
  explicit alternative to `challenge`.
- `category` — one of: `llm-compact`, `llm`, `market-data`, `crypto-data`,
  `rpc`, `scrape`, `web-search`, `social-data`, `data-enrichment`, `image-gen`,
  `video-gen`, `prediction`, `identity`, `generic`. Improves price-gouging
  detection.
- `resource` / `endpoint`, `facilitator` — optional context.
- `policy` — optional: `maxPerCallUsd`, `allowlist[]`, `blocklist[]`,
  `allowedNetworks[]`, `allowedAssets[]`, `maxRiskScore`.

## Output

```json
{
  "verdict": "allow | warn | block",
  "recommendation": "proceed | proceed_with_caution | do_not_pay",
  "riskScore": 0,
  "summary": "Safe to pay. All checks passed.",
  "payTo": "0x...",
  "amountUsd": 0.01,
  "category": "market-data",
  "priceBand": { "p50": 0.001, "p90": 0.02, "max": 0.1 },
  "checks": [ { "id": "...", "label": "...", "status": "pass|warn|fail", "detail": "..." } ],
  "flags": ["price_outlier"]
}
```

## Decision rule for the agent

1. `block` → abort the payment, tell the user which check failed.
2. `warn` → only pay if within the user's risk tolerance / policy.
3. `allow` → pay.

## Companion endpoints (same service, same wallet)

The x402 Agentic service hosts five more paid endpoints alongside `/precheck`.
Each is its own x402-paid route (GET or POST) under `https://api.x402agentic.ai`.

### `/screen` — OFAC sanctions screen ($0.02)
Focused yes/no sanctions check on a single address. Lighter than `/precheck`
when all you need is "is this payee sanctioned?".
```bash
curl "https://api.x402agentic.ai/screen?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
# -> { "address": "...", "valid": true, "sanctioned": false, "verdict": "allow", "listSize": 97 }
```

### `/spend-guard` — per-agent budget enforcement ($0.01)
Track an agent's cumulative spend against a budget. `POST` records a spend and
enforces the cap; `GET` previews remaining budget without recording. Soft
(eventually-consistent) budget guard — ideal for "don't blow the monthly cap".
```bash
curl -X POST "https://api.x402agentic.ai/spend-guard" \
  -H "Content-Type: application/json" \
  -d '{ "agentId": "agent-123", "amountUsd": 0.25, "budgetUsd": 10 }'
# -> { "agentId": "agent-123", "spentUsd": 0.25, "remainingUsd": 9.75, "allowed": true, "verdict": "allow" }
```

### `/token-check` — canonical asset verification ($0.02)
Confirm a token contract is the real USDC (or WETH/DAI/etc.) on Base, not a
lookalike/spoof. Returns `canonical` + symbol/decimals, or a `warn` if unknown.
```bash
curl "https://api.x402agentic.ai/token-check?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
# -> { "canonical": true, "symbol": "USDC", "decimals": 6, "verdict": "allow" }
```

### `/verify-payment` — on-chain settlement proof ($0.05)
Confirm an x402 payment actually settled on Base: pass a `txHash` (and optionally
the expected `payTo` / `amountUsd`), and it reads the transaction receipt, finds
the USDC transfer, and checks recipient + amount. Proof-of-payment / receipts.
```bash
curl -X POST "https://api.x402agentic.ai/verify-payment" \
  -H "Content-Type: application/json" \
  -d '{ "txHash": "0x...", "payTo": "0xRECIPIENT", "amountUsd": 0.10 }'
# -> { "settled": true, "verified": true, "to": "0x...", "amountUsd": 0.1, "verdict": "allow" }
```

### `/reputation` — payee reputation score ($0.02)
`GET` returns a 0–100 score with a label (sanctioned / reported / trusted /
vouched / unknown). `POST` with `action: "report"` or `"vouch"` contributes a
signal; a report also feeds the `/precheck` community-reports check. Built from
sanctions data + crowd signals — community reports are unweighted in v1
(sybil-vulnerable), so treat as signal, not authority.
```bash
curl "https://api.x402agentic.ai/reputation?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
# -> { "address": "...", "score": 50, "label": "unknown", "verdict": "neutral" }
```

All six endpoints are listed in the service's `/.well-known/agent.json` and
`/openapi.json`, and each carries the x402 Bazaar discovery extension.

## Checks performed

envelope integrity · payee address validity · denylist screen · community-flagged
reports · price vs. category band (gouging) · absolute per-call ceiling · asset
sanity · network sanity · facilitator reputation · caller spend policy
(allowlist / blocklist / max-per-call / allowed networks / allowed assets /
max risk score).

See `references/checks.md` for the full scoring table.
