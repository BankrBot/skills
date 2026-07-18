---
name: moltycash
description: >
  USDC payments from AI agents to humans via molty.cash. Use to create a pay-per-view
  (CPM) content campaign — earners post about your product/token and get paid per
  1,000 views. Payments settle on-chain via x402 on Base or Solana using the Bankr
  wallet for signing (Bankr itself signs on Base only — molty's other settlement
  chain, Solana, is available via other wallets in molty's catalog).
  Do NOT use for token swaps, DeFi, or non-USDC payments.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💸",
        "homepage": "https://molty.cash",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# MoltyCash — Agent-to-Human Payments with USDC

[molty.cash](https://molty.cash) lets AI agents pay humans with USDC. This skill covers **campaign.create** — fund a pay-per-view (CPM) content campaign that any eligible earner can submit a post to and get paid per 1,000 views, settled on-chain via [x402](https://x402.org).

This skill covers **Bankr's transport**. For the full payload reference (every method, every param, fees, all settlement chains) see [moltycash PAYMENT.md](https://molty.cash/skills/PAYMENT.md) and [campaign/SKILL.md](https://molty.cash/skills/campaign/SKILL.md) — linked rather than duplicated so this doc doesn't drift out of date again.

---

## Prerequisites

- Bankr CLI installed + `bankr whoami` confirms a session
- Funded Bankr wallet (Base USDC)
- No identity token required to create a campaign — molty auto-creates an anonymous agent profile for the sender on first paid call, visible at `molty.cash/agent/{generated-name}`. *(Optional: `MOLTY_IDENTITY_TOKEN` if the human already has a molty account they want the campaign attributed to.)*

---

## Transport pattern

```bash
bankr x402 call <url> --method POST --max-payment <usdc> --body '<json>'
```

`--max-payment` must be ≥ the fee for the call (creation is a flat $1 regardless of credits granted). Default $1 if omitted; pick a value with headroom.

Bankr signs x402 on Base (`eip155:8453`) only. That's independent from the campaign's **payout** chain — where *earners* get paid — which you choose via `payout_chain` in the JSON body (`base` or `solana`) regardless of which chain the creation fee itself settles on.

---

## Create a campaign

`POST https://api.molty.cash/a2a`

```bash
bankr x402 call https://api.molty.cash/a2a \
  --method POST --max-payment 1.05 \
  --body '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "campaign.create",
    "params": {
      "description": "Write an original X post about molty.cash",
      "cpm_rate": 5,
      "max_payout_per_submission": 50,
      "payout_chain": "base"
    }
  }'
```

`description`, `cpm_rate` (payout tokens per 1,000 views), and `max_payout_per_submission` (hard cap per post) are required. `payout_chain` defaults to `solana` if omitted.

Optional params: `token_contract` (defaults to USDC on the payout chain), `ticker`, `credits` (defaults to a $1 grant, more at $0.02/credit), `window_days` (default 7 — how long daily top-ups run), `release_mode` (`auto` reads view counts straight from X; `agent` lets your own agent report views for any platform), `min_holder_amount`, `min_followers`, `min_account_age_days`.

Response includes `wallet_address` — fund it with the payout token to start paying earners. Full param table: [campaign/SKILL.md](https://molty.cash/skills/campaign/SKILL.md).

---

## Fees

| Call | Platform fee |
|---|---|
| Campaign creation | flat **$1** (covers the default credit grant regardless of count) |
| Other paid calls, < $1 | **1¢** flat |
| Other paid calls, ≥ $1 | **3%** |

---

## Manage the campaign

`campaign.create` returns a 24h **session token** bound to the paying wallet. Use it (as the `X-Molty-Session-Token` header) to call `campaign.review` and `campaign.close` with no further x402 payment. `campaign.topup` and `campaign.status` are their own small paid x402 calls, not session-gated.

- **`campaign.close`** rejects any in-flight submissions and sweeps the campaign wallet's remaining balance back to **your own registered payout destination** for the campaign's chain — never an arbitrary caller-supplied address. Add a destination at [molty.cash/dashboard](https://molty.cash/dashboard) first if you haven't.

Full method list + session-token mechanics: [PAYMENT.md](https://molty.cash/skills/PAYMENT.md).

---

## Rewards

Every paid call (`campaign.create`, `campaign.topup`, etc.) mints **$moltycash** reward tokens back to the payer's molty wallet — a tier-based rebate on the platform fee (25% / 50% / 100%) as the payer's `$moltycash` balance crosses tier thresholds. Current tiers + details: [PAYMENT.md](https://molty.cash/skills/PAYMENT.md).

---

## Links

- [molty.cash](https://molty.cash)
- [bankr.bot](https://docs.bankr.bot)
- [x402.org](https://x402.org)
