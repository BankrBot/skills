---
name: bilbop
description: |
  Pay-per-call Solana token data, text summarization, Piper TTS (WAV), and human brand feedback via x402.
  Use when an agent needs cheap on-chain SPL mint facts, a public token market brief, a short summary,
  speech audio, or a human brand-feedback sample and has an x402-capable Solana USDC wallet.
  Triggers: "sol mint info", "token brief", "summarize this", "tts wav", "brand feedback",
  any Solana SPL research needing pay-per-call data without an API key.
  Payments via x402 — USDC on Solana mainnet, no API key or account needed.
---

# bilbop

Cheap pay-per-call Solana tools for agents over x402.

**Base URL:** `https://api.bilbop.org`  
**Discovery:** `https://api.bilbop.org/.well-known/x402` (also `/.well-known/x402.json`)  
**Portfolio:** `https://bilbop-portfolio.pages.dev/`  
**Payment:** x402 exact — USDC on Solana mainnet (`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`), payTo `2r2vsoyuYuy4dsyQVRhfmMBqsMRKHRS5FTPNumYFhxE4`, PayAI facilitator. No account / API key.

## Endpoints

| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `POST /v1/sol-mint-info` | $0.01 | `{"mint":"<SPL mint>"}` | on-chain mint info (decimals, supply, authorities) |
| `POST /v1/sol-token-brief` | $0.01 | `{"mint":"<SPL mint>"}` | token brief from public aggregators (price/liquidity/volume where available) |
| `POST /v1/summarize` | $0.01 | `{"text":"..."}` | short 1–3 sentence summary |
| `POST /v1/tts` | $0.025 | `{"text":"...","voice_id?":"..."}` | Piper WAV audio (en_US-lessac-medium) |
| `POST /brand-feedback` | $0.50 | `{"brand":"Acme","question":"...","n":1}` | human brand-feedback replies via WURK |

## How to Call (x402)

Probe unpaid once to get the 402 `accepts` descriptor, then retry with a payment header from any x402 Solana client.

**curl (unpaid probe → expect HTTP 402):**
```bash
curl -s -X POST https://api.bilbop.org/v1/sol-mint-info \
  -H 'content-type: application/json' \
  -d '{"mint":"So11111111111111111111111111111111111111112"}'
```

**TypeScript (`@x402/fetch` / Solana signer):**
```typescript
// Use any x402-capable Solana USDC wallet. Abort if payTo ≠ 2r2vsoyuYuy4dsyQVRhfmMBqsMRKHRS5FTPNumYFhxE4.
const res = await paidFetch("https://api.bilbop.org/v1/sol-token-brief", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mint: "<SPL mint>" }),
});
```

Never pay more than the listed price. Backup origin only if `api.bilbop.org` is down: `https://bilbop-x402.watchdogsfreak.workers.dev`.

## Practical Flow

1. Mint facts first (`/v1/sol-mint-info`), then market snapshot (`/v1/sol-token-brief`) when you need price/liquidity.
2. Use `/v1/summarize` for short text condensation; `/v1/tts` when you need a real WAV.
3. `/brand-feedback` is human-in-the-loop and priced higher — use sparingly.

## Notes

- No API key, no account. Payment is the auth.
- Self-hosted by bilbop; no automated refunds.
- OpenAPI: `https://api.bilbop.org/openapi.json`
