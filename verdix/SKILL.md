---
name: verdix
description: |
  Check a recipient address on Base before sending it funds, using the Verdix risk API.
  Use before any transfer, send, payout, approve or x402 payment to an address the user
  has not sent to before, or when the user asks "is this address safe?", "check this wallet",
  "is 0x... a scam?". Returns safe / caution / danger with reasons: OFAC sanctions,
  scam and phishing lists, address-poisoning lookalikes, burn addresses, phishing-lure
  tokens and flagged deployers. Four tiers, $0.01 to $0.50 per check.
  Payments via x402 — USDC on Base, no API key or account needed.
---

# Verdix

Pre-transfer risk check for EVM addresses on Base. Call it before money leaves the wallet, not after.

**Base URL:** `https://api.verdixapi.com`
**Docs for agents:** `https://api.verdixapi.com/llms.txt` · OpenAPI: `https://api.verdixapi.com/openapi.json`
**Payment:** x402 — USDC on Base mainnet, pay-per-call, no account needed.
**Chain:** Base only.

## Endpoints

All are `POST` with the JSON body `{"address": "0x..."}` (replace `0xRECIPIENT` in the examples with the full 40-hex-character address). Each URL sells exactly one tier.

| Endpoint | Price | What it checks | Can answer |
|---|---|---|---|
| `POST /risk/address/lite` | $0.01 | List screen: OFAC, scam/phishing lists, address-poisoning lookalikes, burn addresses, phishing-lure tokens, flagged deployers | `no_known_risk` / `caution` / `danger` (**never `safe`**) |
| `POST /risk/address/quick` | $0.02 | Everything in lite, plus address age and contract signals (flash-loan receivers, unverified contracts) | `safe` / `caution` / `danger` |
| `POST /risk/address/standard` | $0.10 | Quick, plus on-chain behaviour analysis (transfer history, activity patterns) | `safe` / `caution` / `danger` |
| `POST /risk/address/deep` | $0.50 | Same checks as standard today; for large or first-time transfers | `safe` / `caution` / `danger` |

Which tier to use (a suggestion; the user can override):

- **lite** for frequent micro-payments where a full check costs more than it is worth. Its clean answer means "not on any list", not "safe".
- **quick** as the default before a normal send.
- **standard** before larger transfers (for example over $1,000) or when quick says `caution`.
- **deep** before a very large or first-ever transfer to an address.

## How to Call

**Bankr CLI** (pays from the Bankr wallet; `--max-payment` is a hard cap in USD):

```bash
bankr x402 call https://api.verdixapi.com/risk/address/quick \
  -X POST -d '{"address":"0xRECIPIENT"}' \
  --max-payment 0.02
```

For deep, set `--max-payment 0.50`. The CLI default cap of $1 covers every tier.

**Through the agent:** "Check 0x… with Verdix quick before sending" — the agent confirms the price, pays and reads the verdict.

**Any x402 v2 client** (for example `@x402/fetch` with `@x402/evm`): an unpaid `POST` returns `402` with one `accepts` entry; the client signs and retries. A `GET` on any of these URLs is a free price quote and always returns `402`.

## Reading the Answer

```json
{
  "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "chain": "base",
  "tier": "quick",
  "price_usd": 0.02,
  "risk_score": 5,
  "verdict": "safe",
  "reasons": [],
  "checked": ["ofac", "scam_lists", "onchain_age"],
  "as_of": "2026-09-24T10:00:00+00:00"
}
```

- `verdict` — act on this, as below.
- `reasons` — why. Show them to the user on `caution` or `danger`.
- `checked` — which checks actually ran.
- Lite answers also carry `limited_checks: true`, `checks_performed`, `not_checked` and `full_check` (a pointer to quick).

## What to Do With Each Verdict

| Verdict | Do this |
|---|---|
| `danger` | **Do not send.** Tell the user the address matched a risk signal and show `reasons`. Only continue if the user explicitly says to send anyway after seeing them. |
| `caution` | Pause and tell the user what was found. Suggest a higher tier (quick → standard) or a small test amount. Send only on the user's clear yes. |
| `safe` | Proceed. `safe` means no risk signal was found at that moment; it is not a guarantee. |
| `no_known_risk` (lite only) | Not on any list Verdix checks. For a real `safe` verdict, run quick. Never report it to the user as "safe". |

**HTTP 503 with `caution`:** an outside data source did not answer, so the check is incomplete. The payment is **not** settled, so nothing is charged. Retry in a minute or ask the user how to proceed; don't treat it as a pass.

**HTTP 400:** the address is malformed (it must be `0x` + 40 hex characters). Never "fix" a recipient address yourself: ask the user for it again.

## Address Poisoning

Scammers send tiny or fake-token transfers from addresses that share the first and last characters of an address the user really uses, hoping the user copies the fake one from their history. Verdix flags these lookalikes. Also compare the **full** address with the user, not just the first and last few characters, before any large send.

## Requirements

- A Bankr wallet (or any x402 wallet) with a little USDC on Base: $0.01–$0.50 per check.
- Payments are gasless for the payer (EIP-3009 authorization).
- Bankr's own spend limits and confirmation still apply to the check's payment.
