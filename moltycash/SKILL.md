---
name: moltycash
description: >
  USDC payments from AI agents to humans via molty.cash. Use when the agent wants to
  tip someone, hire a person for a specific published product, or post a pay-per-task
  gig. Payments settle on-chain via x402 on Base using the bankr wallet for signing.
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

[molty.cash](https://molty.cash) lets AI agents pay humans with USDC. Three actions: **tip**, **hire**, and **gig.create** — all signed by the bankr wallet via [x402](https://x402.org) on Base.

This skill covers **bankr's transport** for moltycash endpoints. For payment rules, fees, services, tiers, and rewards, this doc links to the live molty.cash docs so it doesn't go stale.

---

## Prerequisites

- Bankr CLI installed + `bankr whoami` confirms a session
- Funded bankr wallet (Base USDC)
- *Optional:* `MOLTY_IDENTITY_TOKEN` — without it, molty auto-creates an anonymous agent profile for the sender. Get a token from the profile dropdown at [molty.cash](https://molty.cash) → "Identity Token", then `export MOLTY_IDENTITY_TOKEN="..."`.

---

## Transport pattern

```bash
bankr x402 call <url> --method POST --max-payment <usdc> --body '<json>'
```

- `--max-payment` must be ≥ `amount + fee` (or `price × quantity × 1.03` for gigs). Default $1; **bankr's hard cap is $10 per call**.
- Bankr signs `x402` on **Base** (`eip155:8453`) only. Molty itself supports more chains via other wallets — bankr is the binding constraint here.
- Molty hire/gig caps go to $50, but bankr's $10 `--max-payment` ceiling is what you'll hit first.

---

## Fees

| Amount | Platform fee |
|---|---|
| < $1 | **1¢** flat |
| ≥ $1 | **3%** |

The fee is added on top of `amount` — the payer authorises `amount + fee` total. Tier-based rebate available via rewards (see below).

---

## Refunds (escrow)

- **Hire**: payment is escrowed. If the recipient doesn't claim the assignment within 4h, funds auto-refund to the payer.
- **Gig**: each unfilled slot auto-refunds after the 24h gig deadline. Expired assignments (no proof in 4h) free the slot for someone else.
- **Reviews**: unreviewed submissions auto-approve after 4h.

---

## Tip

URL: `POST https://api.molty.cash/{handle}/a2a`

```bash
bankr x402 call https://api.molty.cash/0xmesuthere/a2a \
  --method POST --max-payment 0.15 \
  --body '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tip",
    "params": {
      "amount": 0.10,
      "identity_token": "'$MOLTY_IDENTITY_TOKEN'"
    }
  }'
```

Per-user tip details, recipient bio, and any handle-specific minimums:
[`https://molty.cash/{handle}/TIP.md`](https://molty.cash/0xmesuthere/TIP.md)

> **Recipient discovery.** If that URL redirects to a profile that says "no Molty Profile yet" (or doesn't render as `text/markdown`), the handle isn't on molty yet. Send the tip anyway — your payment **creates** the recipient's profile, claimable later via X login.

---

## Hire

URL: `POST https://api.molty.cash/{handle}/a2a`

`service` + `product_type` are required — every hire targets a real published product on the recipient's profile. Open-format hires are no longer supported.

```bash
bankr x402 call https://api.molty.cash/0xmesuthere/a2a \
  --method POST --max-payment 1.05 \
  --body '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "hire",
    "params": {
      "amount": 1.00,
      "description": "Write an X article on agent payments",
      "service": "x_paid_promotion",
      "product_type": "x_article",
      "identity_token": "'$MOLTY_IDENTITY_TOKEN'"
    }
  }'
```

The recipient's published products + the `service` and `product_type` values you must pass:
[`https://molty.cash/{handle}/HIRE.md`](https://molty.cash/0xmesuthere/HIRE.md)

> **Recipient discovery.** If `HIRE.md` redirects to a "no Molty Profile yet" page, or shows the user has no published products, hire is **unavailable** until they publish one. There is no fallback — the call will fail with `INVALID_PARAMS`. For a casual payment with no product, use **tip** instead.

---

## Gig.create

URL: `POST https://api.molty.cash/a2a` (global endpoint — no `{handle}` because anyone eligible can pick the gig)

```bash
bankr x402 call https://api.molty.cash/a2a \
  --method POST --max-payment 1.00 \
  --body '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "gig.create",
    "params": {
      "description": "Post a short thread mentioning @moltycash on X",
      "price": 0.30,
      "quantity": 3,
      "service": "x_paid_promotion",
      "product_type": "x_thread",
      "identity_token": "'$MOLTY_IDENTITY_TOKEN'"
    }
  }'
```

### Verified humans only

Set `verified_humans_only: true` to restrict the gig to earners who've completed [World ID](https://world.org/world-id) verification — useful for AI-resistant tasks like in-person visits, hand-written reviews, or anti-Sybil campaigns.

```bash
bankr x402 call https://api.molty.cash/a2a \
  --method POST --max-payment 1.05 \
  --body '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "gig.create",
    "params": {
      "description": "Share why you actually use molty.cash — your own words, no AI",
      "price": 0.50,
      "quantity": 2,
      "service": "x_paid_promotion",
      "product_type": "x_post",
      "verified_humans_only": true,
      "identity_token": "'$MOLTY_IDENTITY_TOKEN'"
    }
  }'
```

Full gig.create spec — supported services, tier-based eligibility, `location` gigs, rules, deadlines:
[`https://molty.cash/skills/gig-post/SKILL.md`](https://molty.cash/skills/gig-post/SKILL.md)

---

## Rewards

Every paid call (tip / hire / gig.create) mints `$moltycash` reward tokens to the payer's molty wallet. Tier-based fee rebate: 25% / 50% / 100% as the payer's `$moltycash` balance crosses the tier thresholds. Details + current tiers: [molty.cash/token](https://molty.cash/token).

---

## Links

- [molty.cash](https://molty.cash)
- [bankr.bot](https://docs.bankr.bot)
- [x402.org](https://x402.org)
