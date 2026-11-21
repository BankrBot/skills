---
name: mercator-entity-evidence
description: |
  Company facts with the receipts attached. Ask for legal name,
  headquarters, founded year, employee count, executives or funding for
  a domain and get each field back with the URL its evidence is
  attributed to, a span copied byte for byte out of the document that
  was fetched, when it was retrieved, and n-of-m source agreement.
  Conflicting sources are returned, not hidden. A field that cannot be
  evidenced comes back UNKNOWN rather than guessed.

  $0.10 USDC per call over x402 on Base, charged once and only when at
  least one thing you asked for is verified. Every other answer - the
  company unresolved, only your own identifier handed back, or sources
  that disagree with no settled value - is returned in full as HTTP 404,
  and THIS ONE HOLDS: the x402 middleware cancels settlement on any
  status of 400 or above, so nothing is captured for it.

  Triggers: "what is the legal name of X", "verify this company",
  "enrich this domain with sources", "who runs X and where is it based".
emoji: 📑
tags: [company-verification, company-enrichment, due-diligence, citations, provenance, x402, base]
visibility: public
credentials:
  - name: MERCATOR_BASE_URL
    description: API origin. Defaults to https://mercator-entity-evidence.fly.dev.
    required: false
    storage: env
  - name: X_PAYMENT
    description: Pre-signed x402 payment header (base64-encoded JSON). Use when your agent platform doesn't auto-sign.
    required: false
    storage: env
metadata:
  openclaw:
    requires:
      bins:
        - curl
        - jq
---

# mercator-entity-evidence

Company enrichment where the answer carries its own evidence. The point
is not the value — plenty of APIs return a legal name. The point is that
you can see where it came from and decide whether to believe it.

## When you are charged

The service's billing rule, verbatim. The free preflight, the payment
manifest and the OpenAPI document serve the same text:

ONE RULE DECIDES THE CHARGE on every paid route of both products. An
answer that verifies at least one thing you asked for and did not
already have answers 200 and is charged once at the listed price. Every
other answer - nothing evidenced, only your own identifier handed back,
or credible sources that disagree with no settled value - is returned in
full as HTTP 404, and THIS ONE HOLDS: the x402 middleware cancels
settlement on any status of 400 or above before settlement is attempted,
so nothing is captured for it. Measured against x402 2.21.0 by
tests/unit/test_settlement_cancellation_effect.py. `billable` in the
body, the status code and the X-MERCATOR-Charged header are one decision
and always agree. HISTORY, because each of these was billed until it was
not: an answer evidencing nothing answered 200 until 2026-10-01, one
handing back only your own identifier until 2026-11-20, and one stating
only a disagreement until 2026-11-21.

For this product: an answer that verifies at least one requested field
with new evidence is charged once, even when another requested field is
in conflict or UNKNOWN. An answer in which every requested field is
unresolved, in conflict, or only your own identifier handed back answers
404 with the full body, under the rule above. CLOSED 2026-11-21: the
earlier versions of this file, 1.0.0 and 1.0.1, described the billing
differently and are withdrawn.

## The shape of the call

```bash
BASE="${MERCATOR_BASE_URL:-https://mercator-entity-evidence.fly.dev}"

# Free preflight — which fields will be attempted, and the price if you buy.
curl -sS -X POST "$BASE/v1/entity-evidence/validate" \
  -H 'content-type: application/json' \
  -d '{"domain":"lido.fi","fields":["legal_name","primary_domain"]}' | jq .

# Paid answer — $0.10 USDC on Base, x402.
curl -sS -X POST "$BASE/v1/entity-evidence" \
  -H 'content-type: application/json' \
  -H "X-PAYMENT: $X_PAYMENT" \
  -d '{"domain":"stripe.com","fields":["legal_name","headquarters","founded_year"]}' | jq .
```

| field | required | meaning |
|---|---|---|
| `fields` | **yes** | which of the supported fields to attempt |
| `domain` | one of | the company's domain |
| `name` | one of | the company's name, when you have no domain |
| `max_age_days` | no | freshness bound, default 30 |

Supported fields: `legal_name`, `primary_domain`, `headquarters`,
`industry`, `key_executives`, `last_reported_funding`, `founded_year`,
`employee_count`.

## What you are paying for

- every returned field carries value, source URL, verbatim excerpt,
  `retrieved_at`, confidence and n-of-m source agreement
- excerpts are **verified against the fetched document** before return
- conflicting sources are **returned, not hidden**
- fields that cannot be evidenced are returned **UNKNOWN, never guessed**
- `billable` in the body, the status code and the `X-MERCATOR-Charged`
  header are one decision and always agree

The free preflight above returns the service's current guarantees; read
it rather than this list if the two ever differ.

## Honest limits

- **Coverage is what the open web publishes.** A company with no
  reachable public record returns `UNKNOWN` fields, and that is the
  honest answer rather than a plausible one.
- **A verbatim excerpt is evidence of a claim, not proof of a fact.** A
  registry, a company's own site and a news page can all be wrong; what
  this guarantees is that the quote is really in the document it names.
- **Conflicts are surfaced, not resolved.** When credible sources
  disagree you get both readings — deciding between them is yours.

## Price

| | |
|---|---|
| `POST /v1/entity-evidence` | **$0.10** USDC, Base (`eip155:8453`), x402 `exact` |
| `POST /v1/entity-evidence/validate` | free |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| payTo | `0xEFc22716066C1092b12d12ca9377f00bA2ffA7A8` |

Price, network, asset and payee above were read from the live `402`
challenge on 2026-09-13, not from documentation; the free preflight
showed the same price on 2026-11-21. No signup, no API key, no account.

## Companion skill

`mercator-address-evidence` — the same discipline applied to contract
addresses before you transact, at $0.25.
