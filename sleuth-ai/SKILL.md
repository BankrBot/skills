---
name: sleuth-ai
description: |
  On-chain investigation — insiders, holders, whales, first buyers, wallet identity,
  side-wallet networks, pump-and-dump detection, and free-text investigations. Use when you need to
  investigate a token, wallet, or on-chain entity: "who are the insiders of $TOKEN",
  "who funded this wallet", "detect pump and dump on a coin", "detect wash trading on a coin",
  "is this wallet a known malicious actor". Endpoints are discovered from a free manifest and paid
  per call via x402 (no API key or account needed). Today investigations run on Base; more chains
  will be supported over time — the manifest declares the chains each endpoint actually serves.
  Triggers: on-chain investigation, insiders, holders, whales, first buyers, side
  wallets, wallet funding, pump and dump, token research.
---

# Sleuth AI — On-Chain Investigation (x402)

Guided on-chain investigation. Ask about a token, wallet, or entity and get a natural-language
answer backed by on-chain data.

**Discovery:** `GET https://app.sleuthagent.ai/x402/openai-bnkr.json` — free, no key, no payment.
**Payment:** x402 — pay-per-call, no account needed. The exact token and chain are advertised in
each endpoint's `402` response; they may change over time.

## Discover the live endpoints first

The set of endpoints evolves. **Always read the free manifest for the current list** — do not
hardcode it from this file. The manifest is an OpenAI-tool-format document; each entry carries its
`function` (name, description, JSON-Schema `parameters`) plus `x-invoke-url` (the endpoint to POST
to) and `x-payment: "x402"`.

```bash
curl https://app.sleuthagent.ai/x402/openai-bnkr.json
```

The examples below are **illustrative, not exhaustive** — the manifest is the source of truth.
Sleuth can, among other things:

- detect pump-and-dump on a coin
- detect wash trading on a coin
- tell whether a wallet is a known malicious actor
- surface a token's insiders, whales, first buyers, and holder distribution
- find the wallet behind an @handle / ENS / partial address, and map its funding + side wallets

For anything not covered by a specific endpoint, use **`run-investigation`** — a free-text endpoint
that answers any plain-language on-chain question.

## How to call (x402)

x402 is pay-per-call. No API key or account — a funded wallet on the endpoint's payment chain is
all you need (read the chain/token from the `402` response). Every call is a **POST** with a JSON
body; always include a `conversation_id` (a UUID you generate per session).
The response is `{ "response": "<natural-language answer>" }`.

**Python:**
```python
from x402.client import x402_client

client = x402_client(wallet=YOUR_WALLET)

# Read the manifest, pick an endpoint's x-invoke-url, then POST to it:
res = client.post(
    "https://x402.bankr.bot/0x08e82839e1513023d115451babc0ff18eda8f925/run-investigation",
    json={"conversation_id": "<uuid>", "query": "Who are the insiders of $VIRTUAL?"},
).json()
print(res["response"])
```

**TypeScript:**
```typescript
import { withPaymentInterceptor } from "x402-axios";
import axios from "axios";

const client = withPaymentInterceptor(axios.create(), walletClient);
const { data } = await client.post(
  "https://x402.bankr.bot/0x08e82839e1513023d115451babc0ff18eda8f925/run-investigation",
  { conversation_id: crypto.randomUUID(), query: "Trace the funding of 0xabc…" },
);
```

The x402 client handles payment automatically — it intercepts the `402`, signs and sends the
payment, then retries with the receipt. **The price and token are advertised in the endpoint's 402
response — read them there; never assume a fixed price.**

## Errors

| Status | Meaning |
|---|---|
| `402` | Payment required — attach the x402 payment and retry (the client does this automatically) |
| `400` | Bad request — missing/invalid params (e.g. missing `conversation_id`) |
| `429` | Rate limited — back off and retry after the `Retry-After` window |
| `502` | Investigation failed upstream |
| `503` | Timed out — **no payment was settled**; retry (large scans can take longer and may succeed on retry) |

On `503`, nothing was charged — it's safe to retry.

## Notes

- **Chains.** Today investigations run on Base; more chains will be supported over time. The
  manifest declares the chains each endpoint actually serves — read it rather than assuming.
- **`conversation_id` is required** on every call — a fresh UUID per session.
- **Single-shot.** Each call runs one investigation from scratch; there is no multi-turn state.
- **Discover, don't hardcode.** The endpoint list, their params, and their payment chain/token live
  in the manifest and the `402` response — read them; never assume fixed.
