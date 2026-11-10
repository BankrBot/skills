---
name: singit
description: SingIt (singitai.app) is an x402 USDC agent-spending app for AI inference and paid web tools. Use when an agent needs pay-per-answer LLM chat with no API key (OpenAI-compatible /v1/chat/completions and Anthropic-compatible /v1/messages at https://ask.singitai.app, 300+ models), free model answers, or SingIt's remote MCP server at https://app.singitai.app/mcp (v0.1.6, 16 tools: 8 free, 8 paid — prices, model list, free chat, balance/limits/allowance/receipts, paid chat, web search, page reading, X profiles, crypto news, funding rates, ENS, token prices). Paid calls settle in USDC on Base or Solana within owner-set allowance limits. Triggers on mentions of SingIt, singitai, x402 chat, pay-per-answer LLM, agent spending allowance, USDC inference, or the SingIt MCP server.
---

# SingIt: x402 Agent Spending for LLM Chat and Paid Web Tools

SingIt gives agents two surfaces, both settled in USDC over x402:

1. **Chat API** at `https://ask.singitai.app` — OpenAI-compatible `POST /v1/chat/completions` and Anthropic-compatible `POST /v1/messages`. No API key and no signup for paid calls: an unpaid request returns HTTP 402 with the exact USDC ceiling, the wallet signs, the answer settles. `GET /v1/models` and `GET /v1/catalog` list every model with live prices.
2. **Remote MCP server** at `https://app.singitai.app/mcp` — server name `singit` ("SingIt x402"), version 0.1.6, protocol 2025-03-26, 16 tools: 8 free, 8 paid.

Payments settle in USDC on **Base** (`eip155:8453`) or **Solana**, always within owner-set allowance limits (per-request cap, daily cap, pause/revoke).

## Verified pricing (checked 2026-11-10)

All numbers below were read live from `GET /v1/models` and from real HTTP 402 responses.

**Model catalog** (`GET https://ask.singitai.app/v1/models`, free, no key):

- 217 chat models (211 paid + 6 free), plus image (54), image edit (24), speech (14), transcription (6), music (3), sound effects (2), embeddings (1), and web search (3) — over 300 models total.
- Default model: `deepseek-v4.1-flash`.
- Each entry carries `usdPerMillionTokens` (list price), per-network ceiling prices for a reference request, and the flat per-answer settlement fee.

**Reference-request ceilings** (reference request = one short user message, `max_tokens` 800, `upto` scheme on Base):

| Model | List price per 1M tokens (input / output) | Reference ceiling on Base |
| --- | --- | --- |
| `deepseek-v4.1-flash` (default) | $0.30 / $1.20 | $0.0015 |
| `claude-opus-5.5` | $4 / $20 | $0.0068 |
| `gpt-5.5` | $5 / $30 | $0.0118 |

**Billing mechanics:**

- Two schemes: `upto` settles what the answer actually used, up to the ceiling signed; `exact` is a fixed ceiling price with no metering.
- A flat settlement fee is added to every paid answer: **$0.001 on Base, $0.002 on Solana** (so Solana ceilings run about $0.001 higher).
- A live unpaid POST for the default model quoted a ceiling of **$0.0015 on Base** and **$0.00201 on Solana** (x402 version 2).
- Paid responses report the charge in `billing` (`providerCostAtomic`, `settlementFeeAtomic`, `totalAtomic`, `currency: "USDC"`, atomic = 6-decimal USDC units) and the model's own cost in `usage.buyer_cost_micro` (micro-USD).

## Free tier (no payment, no key)

Six free chat models: `free/openai-gpt-oss-20b`, `free/gemma-4-e2b`, `free/gemma-3-27b-it`, `free/mistral-small-3.2-24b-instruct`, `free/qwen3-coder-30b-a3b-instruct`, `free/deepseek-v4.1-flash`.

Limits: **20 answers per visitor per day**, up to 400 output tokens and 4000 characters per request, reset at UTC midnight, plus a shared daily cost budget that can end free answers sooner. Verified live: one free call returned an answer with `billing.free: true` and `remainingToday: 19`.

## Quick start: free answer

```bash
curl -s https://ask.singitai.app/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "free/deepseek-v4.1-flash",
    "messages": [{"role": "user", "content": "Explain x402 in one sentence."}],
    "max_tokens": 120
  }'
```

The response hints `drop the free/ prefix to pay` — the same model id without `free/` is the paid version.

## Quick start: paid answer over x402

1. **Quote.** Send the request without payment. The server answers HTTP 402 (x402 version 2) with an `accepts` array: each entry names a `scheme` (`upto` or `exact`), a `network` (Base or Solana), and the `amount` as an atomic USDC ceiling (6 decimals — divide by 1,000,000 for dollars). The quote is the maximum charge; it is shown before anything is signed.
2. **Sign.** Pay the chosen option with the agent's USDC wallet on Base or Solana through any x402 client. On Base the facilitator also accepts EIP-2612 gasless permits.
3. **Retry with the payment header.** The settled response is a standard chat completion plus `usage` and a `billing` block showing exactly what was charged. With `upto`, only actual usage settles within the signed ceiling.
4. **Optional fields:** `fallback_models` (1–3 alternates), `tools`/`tool_choice` (function calling, up to 64 tools), `stream` (buffered SSE after settlement), `max_tokens` up to 8192, up to 4 images per request.

Anthropic-style clients use `POST /v1/messages` on the same host; it returns the same 402 quote flow unpaid (verified).

## Remote MCP server

Endpoint: `https://app.singitai.app/mcp` (streamable HTTP; send `Accept: application/json, text/event-stream`). Initialize returns `serverInfo: { name: "singit", title: "SingIt x402", version: "0.1.6" }`.

**Free tools, no key needed (4):**

| Tool | What it does |
| --- | --- |
| `get_price` | Current price of a major crypto asset, gold/silver (Chainlink on Base), or an FX rate |
| `list_price_symbols` | Every symbol `get_price` covers — call it first when unsure |
| `list_models` | All SingIt chat/image/audio models with prices |
| `chat_free` | Short free model answers (400 tokens, small shared daily allowance) |

**Free tools, SingIt API key required (4):**

| Tool | What it does |
| --- | --- |
| `get_balance` | Available and held USDC, auto top-up, pending top-ups |
| `get_limits` | Key caps (daily, per-request), spent/remaining today, scopes, expiry, allowance state |
| `get_allowance` | What can still be spent right now: remaining today, per-purchase cap, approval on Base or Solana, `spendableNowUsd`, `bindingLimit` |
| `get_receipts` | Recent charges (id, time, model, USDC, tokens) and top-ups/refunds, paged with `before` |

**Paid tools (9), charged per call in USDC from the key's SingIt limits:**

| Tool | What it does |
| --- | --- |
| `chat` | Paid model answers (default 1024 max tokens, up to 8192; reasoning uses the same budget) |
| `web_search` | Web search via Exa — needs the key's `search` scope |
| `read_page` | Readable text of one page (up to 8000 chars) via Exa — needs `search` scope |
| `get_x_profile` | Public X profile data by username (Base accounts) |
| `get_crypto_news` | Latest crypto headlines with sentiment (Base accounts) |
| `get_funding_rates` | Funding rates, open interest, long/short, liquidations per symbol (Base accounts) |
| `resolve_ens` | ENS name to address and back (Base accounts) |
| `get_token_price` | Second-source USD price for a major token (Base accounts) |

Notes from the server's own instructions: `web_search`/`read_page` need the key's `search` scope; the market-data tools need its `tools` scope and a Base account for now; keys created before the paid data tools existed need a new key for those. `tools/list` and free `tools/call` requests work without a session — verified with a stateless `list_price_symbols` call returning the live symbol list.

## Spending limits and allowances

- Paid calls stay inside **owner-set allowance limits** on Base or Solana: per-request cap, per-day cap, wallet approval. The server enforces caps — a call over a cap is **refused before anything is charged**.
- The owner can pause the allowance (emergency stop) or revoke it at any time. On Base the allowance is on-chain; Solana daily and per-purchase limits are server-checked.
- Habit for agents: call `get_allowance` (or `get_limits`) before any paid call, then `get_receipts` after, so every spend is checked and auditable.

## Bankr integration patterns

- **Answer layer → execution layer.** Use SingIt for cheap inference (research summaries, classification, drafting) and hand any on-chain action to Bankr. Route bulk questions through free models; reserve frontier models (`claude-opus-5.5`, `gpt-5.5`) for the final answer.
- **Budget-aware agents.** Read `get_allowance` first, pick a model whose ceiling fits `spendableNowUsd`, pay, then log the receipt id from `get_receipts`.
- **Research loop.** `web_search` → `read_page` → `chat` summary, all inside one key with owner-set caps — no separate subscriptions.
- **Price checks.** Prefer the free `get_price` for majors; use paid `get_token_price` only as a second source.

## Errors and edge cases

| Situation | Behavior |
| --- | --- |
| Unpaid request to a paid model | HTTP 402 with the `accepts` quote (ceiling per network) |
| Call over a key/allowance cap | Refused before any charge; check `get_allowance` for the `bindingLimit` |
| Free daily allowance exhausted | Free calls stop; drop the `free/` prefix to pay, or wait for the UTC-midnight reset |
| `max_tokens` above 8192 | Clamped to 8192; invalid values default to 800 |
| Transient tool error (`isError: true`, "Try again shortly") | Retry after a short pause |

## Resources

- App: https://singitai.app
- Developer docs: https://singitai.app/developers/
- MCP tools docs: https://singitai.app/docs/mcp-tools/
- Model catalog with live prices: https://ask.singitai.app/v1/models
- MCP endpoint: https://app.singitai.app/mcp
- Open-source code: the SingItAI repository on GitHub
