---
name: lorg-check
description: Safety check before money moves on Base or Ethereum. Use it before buying or swapping into any token (is it a honeypot, a rug, a fake?) and before sending funds to an address (sanctioned, a scam, a sweeper wallet, an address-poisoning look-alike?), including every buy inside an automation, limit order, DCA or snipe. Returns a signed allow, caution or block in about a second, paid per call over x402 ($0.03 a token, $0.01 an address).
tags: [security, scam, rug, honeypot, token-safety, wallet-screening, sanctions, address-poisoning, base, ethereum, x402]
version: 1
visibility: public
metadata:
  clawdbot:
    emoji: "🛡️"
    homepage: "https://lorglabs.com"
---

# Lorg Check: check before money moves

Lorg Check answers one question before a trade or a payment: is this token a trap, or is this address one you shouldn't pay? It simulates a real buy and sell-back through the token's own pool, reads what its creator can still do, who can pull the liquidity and who funded the creator; for an address, it checks sanctions lists, scam labels, sweeper wallets and address-poisoning look-alikes. Every answer is signed by Lorg Labs.

## When to run it

Run it yourself, without being asked:

- **Before buying or swapping into a token**, whatever the size. A well-known token answers in milliseconds from cache, so there is no reason to skip it.
- **Before sending funds** to an address the user hasn't paid before, or one taken from their history or from a message.
- **Inside automations:** check when a limit order, DCA step, snipe or any scheduled buy is about to execute, not only when it was set up. A token can turn into a trap after the order was placed.

## How to call it

Two paid endpoints on Bankr's x402 Cloud, POST with a JSON body, paid from the wallet in USDC on Base. You are charged only when an answer comes back.

| Check | Endpoint | Price |
|---|---|---|
| Token | `https://x402.bankr.bot/0x04a78f755d1cb5a5ea7c0a945d70ea51e562887f/token-safety-check` | $0.03 |
| Address | `https://x402.bankr.bot/0x04a78f755d1cb5a5ea7c0a945d70ea51e562887f/address-safety-check` | $0.01 |

Body: `{"chain": "base", "address": "0x…"}`. `chain` is `base` or `ethereum`. For a token you are about to buy, add `"amount_usd"` with the trade size in dollars: the check then also tries a trade of that size and warns when the pool can't take it.

In Bankr, call the endpoint as an x402 request from the wallet. From a terminal:

```bash
bankr x402 call https://x402.bankr.bot/0x04a78f755d1cb5a5ea7c0a945d70ea51e562887f/token-safety-check \
  -X POST -d '{"chain":"base","address":"0x67c958d79ea11830e145d3508103cfb2d5d7c620","amount_usd":50}'
```

## What to do with the answer

Read `action`:

- **`proceed`**: go ahead. If `reasons` holds notes (an upgrade key, an issuer that can freeze), mention them in one line.
- **`limit_exposure`** (verdict caution): tell the user the `summary`. Go in small or ask before continuing. In an automation, skip or reduce the step unless the user has said in advance what to do with cautions.
- **`do_not_proceed`** (verdict block): **stop.** Don't buy, don't send. Show the `summary` and the first reason. Go ahead only if the user, having seen the reason, explicitly tells you to.

An HTTP **503** (`CHECKS_INCOMPLETE`, `UPSTREAM_UNAVAILABLE`) is not a verdict and is not charged: treat the token or address as unverified, don't proceed automatically, retry once after a few seconds. A **400 or 422** means the input was wrong (check `chain` and the address); not charged.

An `allow` is not a guarantee: it means nothing that should stop the trade was found at the moment of the check.

## How to tell the user

One line, the verdict and the summary, for example: *"Lorg Check: block. Selling it back reverted: this token is a honeypot."* Give the other reasons if asked. The fields and every reason code are in `references/reading-the-answer.md`.

## Deeper investigation

Lorg Check is the fast gate before each trade. For a written forensic report on a whole project (team claims, migrations, reward splits), use the `token-scam-analysis` skill.

## Outside Bankr

The same checks: `https://api.lorglabs.com/v1/check/token` and `/v1/check/quick` (x402, or an API key: free at lorglabs.com/get-a-key.html), or as MCP tools at `https://api.lorglabs.com/mcp` (sign in with OAuth). Docs: https://lorglabs.com/docs.html
