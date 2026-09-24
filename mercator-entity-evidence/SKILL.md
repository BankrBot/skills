---
name: mercator-entity-evidence
description: |
  Company facts with the receipts attached. Ask for legal name,
  headquarters, founded year, employee count, executives or funding for
  a domain and get each field back with its source URL, a verbatim
  excerpt from that page, when it was retrieved, and n-of-m source
  agreement. Conflicting sources are returned, not hidden. A field that
  cannot be evidenced comes back UNKNOWN rather than guessed, and a
  company that cannot be resolved is not charged for.

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

## The shape of the call

```bash
# Free preflight — which fields will be attempted, and the price if you buy.
curl -sS -X POST https://mercator-entity-evidence.fly.dev/v1/entity-evidence/validate \
  -H 'content-type: application/json' \
  -d '{"domain":"lido.fi","fields":["legal_name","primary_domain"]}' | jq .

# Paid answer — $0.10 USDC on Base, x402.
curl -sS -X POST https://mercator-entity-evidence.fly.dev/v1/entity-evidence \
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

These are the service's own guarantees, returned verbatim by the free
preflight above — read live on 2026-09-13:

- every returned field carries value, source URL, verbatim excerpt,
  `retrieved_at`, confidence and n-of-m source agreement
- excerpts are **verified against the fetched document** before return
- conflicting sources are **returned, not hidden**
- fields that cannot be evidenced are returned **UNKNOWN, never guessed**
- an unresolvable company is **not charged for**

## Honest limits

- **Coverage is what the open web publishes.** A company with no
  reachable public record returns `UNKNOWN` fields, and that is the
  honest answer rather than a plausible one.
- **A verbatim excerpt is evidence of a claim, not proof of a fact.** A
  registry, a company's own site and a news page can all be wrong; what
  this guarantees is that the quote is really on the page it names.
- **Conflicts are surfaced, not resolved.** When credible sources
  disagree you get both readings — deciding between them is yours.

## Price

| | |
|---|---|
| `POST /v1/entity-evidence` | **$0.10** USDC, Base (`eip155:8453`), x402 `exact` |
| `POST /v1/entity-evidence/validate` | free |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| payTo | `0xEFc22716066C1092b12d12ca9377f00bA2ffA7A8` |

Prices, network, asset and payee above were read from the live `402`
challenge on 2026-09-13, not from documentation.

## Companion skill

`mercator-address-evidence` — the same discipline applied to contract
addresses before you transact, at $0.25.
