---
name: askgrokwallet
description: "Spend guardrails and verifiable receipts for an agent that moves money. Use when: the agent is about to pay, trade, refund, or take a consequential action and needs (1) a policy verdict before it spends, (2) a human decision for anything the rules do not cover, or (3) a signed receipt of what happened that a third party can verify without trusting the issuer. NOT for: custody, key management, or executing the payment — this skill decides and records; your own wallet (Bankr) executes."
credentials:
  - name: ASKWALLET_API_TOKEN
    description: "Optional bearer token for non-demo writes. Without it, every call uses the keyless `source: \"demo\"` identity."
    required: false
    storage: env
metadata:
  openclaw:
    requires:
      bins:
        - curl
        - node
---

# AskGrokWallet — ask before you spend, prove after

An agent with a wallet has two settings today: spend freely, or ask a human about
everything. This skill adds the middle: a plain-English policy that compiles to
**allow / ask / deny**, a place for the human decisions to land, and a receipt that
records what actually happened.

Use it **around** your existing execution path — before you call Bankr's wallet or
submit API, ask for a verdict; on `ask`, stop and get a decision; after execution,
hand the user the receipt and how to check it.

Nothing here is custodial. This skill never asks for a private key, never signs,
and never moves funds. It decides and it records.

## The loop

### 1. Ask for a verdict before you act

```bash
curl -s -X POST https://askgrokwallet.io/api/approvals \
  -H 'content-type: application/json' \
  -d '{
    "source": "demo",
    "requester": "bankr-agent",
    "summary": "swap 25 USDC for ETH",
    "amountUsd": 25,
    "target": "uniswap",
    "intentKind": "trade",
    "policyText": "trades under $10 run automatically; over $10 ask me; daily budget $50; never trade PUMPDUMP"
  }'
```

`source: "demo"` is a keyless shared demo identity — enough to try the gate. For real
rows, put `ASKWALLET_API_TOKEN` in `Authorization: Bearer …` and change `source` to
your own label.

### 2. Read the verdict from the body, never from the status code

| Verdict | HTTP | Body | What you do |
| --- | --- | --- | --- |
| `allow` | **200** | `{"ok":true,"verdict":{"verdict":"allow","reasons":[…]},…}` | inside the rules — execute, then fetch the receipt |
| `ask` | **201** | `{"ok":true,"approval":{"id":"appr_…","status":"pending",…},"verdict":{"verdict":"ask","reasons":[…]}}` | **do not execute.** Show the user the approval row / `https://askgrokwallet.io/approvals` and wait |
| `deny` | **200** | `{"ok":true,"verdict":{"verdict":"deny","reasons":[…]},…}` | **do not execute, and do not retry with a tweaked target** |

Two traps worth knowing before you integrate:

- **Read `verdict.verdict` from the body, never the status code.** Until
  2026-09-18 `allow` and `deny` answered HTTP 409 with the reason in an `error` field,
  so a client that does `if (!res.ok) throw` treated a legitimate `allow` as a failure;
  that is fixed, but a client that reads the body works against both.
- **`allow` returns no `approval.id`.** The row still exists — list it with
  `GET /api/approvals?status=auto-allowed`.

### 3. If the verdict is `ask`, get the human decision

```bash
# what the human sees: https://askgrokwallet.io/approvals
curl -s "https://askgrokwallet.io/api/approvals?status=pending"

# record their decision
curl -s -X POST https://askgrokwallet.io/api/approvals/appr_xxxxxxxx-xxx \
  -H 'content-type: application/json' \
  -d '{ "decision": "approve", "by": "operator@example.com" }'
```

Approving returns the row with `status: "approved"`, `decision`, `decidedBy` and an
Ed25519 `signature`. Only execute after that response comes back. A `deny` decision
is final.

### 4. After execution, hand over the receipt, not a promise

Every row is signed and appended to a public, hash-chained log. Anyone can check one
without trusting AskGrokWallet, including the payee or an auditor:

```bash
BASE=https://github.com/askgrokwallet/askgrokwallet/releases/download/verify-receipt-v1.0.0
curl -LO $BASE/verify-receipt.mjs
node verify-receipt.mjs receipt.json
```

Four lines come back — signature, position in the log, onchain anchor, verdict —
each marked `✓`, `✗` or `~`. Only `✗` means something is provably wrong. `node
verify-receipt.mjs --version` prints the version and sha256 of the file, so two
people can confirm they ran the same verifier.

## Hard rules

1. **Never invent a policy.** Ask the user for the rules, or for one of the presets:
   `GET /api/presets` → `shopping-checkout`, `bill-pay`, `refund-recovery`,
   `trading-desk`, `account-change-guard`.
2. **Never execute on `ask`.** Waiting is the feature. If the user is away, the
   correct outcome is "waiting", not "probably fine".
3. **Never re-cut a `deny`.** Do not rename the target, lower the amount, or split
   the payment to get a different verdict.
4. **Never treat `source: "demo"` as production.** Rows written with it are visible
   to anyone and belong to a shared identity.
5. **Never ask for a private key** and never claim a payment is verified unless the
   standalone verifier printed the four lines for that receipt.

## Writing the policy

Plain English, one rule per line, amounts in USD:

```text
payments under $50 run automatically; over $50 ask me
never pay blacklisted-merchant
trades under $10 run automatically; over $10 ask me
max drawdown $50; daily loss limit $20
daily budget $200
```

Two behaviours to know: a `never X` rule is matched against the **`target`** string
you send (so send a meaningful target, not "unknown"), and consequential action
types (`cancel`, `downgrade`, `upgrade`, `delete`, `send`, `apply`, `update`) with
no explicit rule default to **ask** — silence fails safe. Evaluation order is
fixed: deny → ask → allow → default.

## What this does not do

- It does not hold funds, hold keys, or execute anything. Your wallet does that.
- It does not prove the payment was *wise*, only that it was authorised by the
  policy, decided by a named human if required, and recorded unaltered.
- The issuer currently demonstrates value-moving execution on Ethereum Sepolia with
  mock assets; contracts are deployed on Base mainnet. Treat it as an unaudited
  developer preview and set your own limits.

More detail, including every response field and the deny/extract semantics:
[`references/api.md`](references/api.md). Live product:
<https://askgrokwallet.io> · verifier source:
<https://github.com/askgrokwallet/askgrokwallet>
