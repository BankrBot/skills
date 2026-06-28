---
name: x402-precheck
description: Before paying ANY x402 endpoint, call the x402Agentic Payment Pre-Flight Check to get an allow/warn/block verdict. Use this whenever an agent is about to settle an x402 / HTTP 402 payment — it validates the payee address, screens it against denylist and community-flagged lists, flags price gouging vs. category norms, checks the asset/network, and enforces the user's spend policy. Stops bad payments before money leaves the wallet.
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
Price: ~$0.001 USDC/call on Base (cheap on purpose — call it on every payment).
Discovery route (free): `https://api.x402agentic.ai/`

## When to use

Use this **every time** you are about to respond to an HTTP 402 challenge with a
payment, especially when:

- The endpoint is one you have not paid before.
- The price looks higher than usual for that kind of service.
- You are operating under a user spend policy / budget.
- The 402 envelope asks you to pay in a non-USDC asset or on an unusual network.

If the verdict is `block`, **do not pay** — surface the reason to the user.
If `warn`, pay only if the user/policy tolerates the flagged risk.
If `allow`, proceed with the payment.

## How to call

Forward the entire 402 response body as `challenge`, or pass fields directly.
POST is preferred. The endpoint is itself x402-paid: your agent wallet pays the
~$0.001 fee automatically through the normal 402 flow (e.g. via `x402-fetch`).

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

## Checks performed

envelope integrity · payee address validity · denylist screen · community-flagged
reports · price vs. category band (gouging) · absolute per-call ceiling · asset
sanity · network sanity · facilitator reputation · caller spend policy
(allowlist / blocklist / max-per-call / allowed networks / allowed assets /
max risk score).

See `references/checks.md` for the full scoring table.
