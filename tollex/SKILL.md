---
name: tollex
description: Pre-trade checks and on-chain evidence for Robinhood Chain, paid per call over x402 (about $0.008, no account or API key). Get a Stock Token price (multiplier-adjusted mid, with halt and staleness checks), check whether a tokenized stock's underlying is halted, simulate a Robinhood Chain transaction with eth_call before signing it, inspect any x402 endpoint's live price and recipient before paying it, and verify a signed Tollex receipt. Use when the user asks "is TSLA halted", "what is the AAPL stock token price", "simulate this before I send it", "what does this x402 endpoint charge", or wants proof of what a paid call returned. Pays in USDC on Base or USDG on Robinhood Chain.
tags: [robinhood, stock-tokens, x402, simulation, receipts]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://tollex.org"
---

# Tollex

Paid capabilities for agents, settled per call with x402 v2. Every paid result comes with an EIP-712 receipt signed by a published key.

**Base URL:** `https://api.tollex.org`
**Price:** about $0.008 per call. The live `402` states the exact amount.
**Payment:** x402 v2 `exact`, in USDC on Base (`eip155:8453`) or USDG on Robinhood Chain (`eip155:4663`). The `402` offers both rails at the same price. No account, no API key.
**Agent docs:** https://raw.githubusercontent.com/ShiftAboveCtrl/tollex/main/AGENTS.md

## When to use it

| User intent | Capability | Call |
|---|---|---|
| "Is TSLA halted?" before trading a tokenized stock | `stock_token_halt_status` | `POST /tools/stock_token_halt_status` `{"symbol":"TSLA"}` |
| "What's the AAPL stock token price?" | `stock_token_quote` | `POST /tools/stock_token_quote` `{"symbol":"AAPL"}` |
| "Simulate this transaction before I send it" on Robinhood Chain | `chain_simulate` | `POST /tools/chain_simulate` `{"to":"0x…","data":"0x…"}` (optional `from`, `value`) |
| "What does this x402 endpoint charge, and who gets paid?" | `x402_inspect_endpoint` | `POST /tools/x402_inspect_endpoint` `{"url":"https://…"}` |
| "Check my wallet works with x402" | agent check | `GET /v1/agent-check` (no input; returns the rail you paid on and chain heads) |

Halt status and quote cost the same. Check the halt first, then quote. A quote is a price input, not an order.

More capabilities (blocks, logs, balances, allowances, receipts): `GET https://api.tollex.org/v1/catalog`, free. To find the right one for a need, `POST https://api.tollex.org/v1/resolve` with `{"need": "..."}`, also free; it never spends.

## How to call (Bankr)

Bankr pays external x402 v2 endpoints on Base and Robinhood Chain. Always set a small cap.

```bash
# Is the underlying halted? (about $0.008)
bankr x402 call https://api.tollex.org/tools/stock_token_halt_status -X POST -d '{"symbol":"TSLA"}' --max-payment 0.02

# Stock Token price (about $0.008)
bankr x402 call https://api.tollex.org/tools/stock_token_quote -X POST -d '{"symbol":"AAPL"}' --max-payment 0.02

# Pre-flight a Robinhood Chain transaction (never broadcasts)
bankr x402 call https://api.tollex.org/tools/chain_simulate -X POST -d '{"to":"0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168","data":"0x18160ddd"}' --max-payment 0.02
```

Through the agent: "Using the tollex skill, check whether TSLA is halted, then get its stock token price."

## Reading the result

The body is `{ tool, result, evidence, untrustedOutput }`. The capability's output is in `result`:

- `stock_token_halt_status` → `{ symbol, isTradingHalt, generatedAt }`. Don't trade if `isTradingHalt` is true.
- `stock_token_quote` → `{ symbol, price, currentMultiplier, generatedAt, source }`. `price` is USD, already multiplier-adjusted. Check `generatedAt` before acting.
- `chain_simulate` → `{ ok: true, returnData }`, or `{ ok: false, revertSelector, error }` when the call would revert.
- `x402_inspect_endpoint` → `{ payable, accepts[], acceptsHash, … }`, the endpoint's live terms, fetched unpaid.

The `PAYMENT-RESPONSE` header carries the settlement transaction (view it on Blockscout) and the signed receipt in `extensions["tollex-receipt"].info`. The signing keys are at `https://api.tollex.org/.well-known/tollex-receipt-keys`. Full field reference: [references/endpoints.md](references/endpoints.md).

## Safety

- Never call without a cap: `--max-payment 0.02` covers any single Tollex call today.
- A `402` with a reason (for example `invalid_exact_evm_*`) means nothing moved.
- A `202` means settlement is pending. Check `GET https://api.tollex.org/tollex/operations/{operationId}` and do not pay again.
- `stock_token_*` results are data inputs. They don't execute trades.
