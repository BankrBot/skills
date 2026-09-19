---
name: mercator-address-evidence
description: |
  Before you send a transaction, check that the chain and contract
  address you are about to use is the one the entity actually
  publishes. Not a scam or rug assessment — provenance. You supply the
  entity, the chain and the candidate address; the answer is whether
  the entity's own source and an independent chain source support that
  exact claim, with the URL, the verbatim excerpt and a transact
  true/false. Disagreeing sources return no address at all.

  Triggers: "is this the official contract for X", "verify this address
  before I trade", "did X publish this address", "which chain is this
  contract on and who says it's theirs".
emoji: 🔐
tags: [address-verification, provenance, x402, base, agent-safety, pre-transaction]
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

# mercator-address-evidence

## What this is not

It is **not** scam, rug or safety forensics. If you want to know whether
a deployer is hostile, whether supply is concentrated or whether a
migration narrative holds up, use `bankr-token-scam-analysis` — that is
a different question and it answers it.

This answers one question only: **is this chain and address the one the
entity publishes for this purpose?** A contract can pass here and still
be unaudited, upgradeable to hostile code, or able to take your funds.
PASS means *intended target*, not *safe*.

## Why it exists

An agent that takes a contract address out of prose — a message, a
reply, a doc page — and trades on it has authenticated the speaker, not
the address. Those are different things, and only one of them is
checkable before the transfer is irreversible.

## The shape of the call

You bring three things and we check them. We never pick a target for
you: a request with no candidate address always answers
`transact: false` with reason `candidate_address_required` rather than
guessing which of an entity's dozens of contracts you meant.

```bash
# Free preflight — what will be checked, and what the answer will mean.
curl -sS -X POST https://mercator-entity-evidence.fly.dev/v1/address-evidence/validate \
  -H 'content-type: application/json' \
  -d '{"domain":"lido.fi","chain":"ethereum",
       "address":"0x73b047fe6337183A454c5217241D780a932777bD",
       "purpose":"emergency multisig"}' | jq .

# Paid answer — $0.25 USDC on Base, x402.
curl -sS -X POST https://mercator-entity-evidence.fly.dev/v1/address-evidence \
  -H 'content-type: application/json' \
  -H "X-PAYMENT: $X_PAYMENT" \
  -d '{"domain":"lido.fi","chain":"ethereum",
       "address":"0x73b047fe6337183A454c5217241D780a932777bD",
       "purpose":"emergency multisig"}' | jq .
```

| field | required | meaning |
|---|---|---|
| `domain` | yes | the entity's domain, e.g. `lido.fi` |
| `chain` | yes | `ethereum`, `base`, … |
| `address` | no, but required for `transact: true` | the candidate you are about to use |
| `protocol` | no | narrows the claim when a domain hosts several |
| `purpose` | no | what you believe the contract is for, e.g. `emergency multisig` |

## What comes back

Measured live on 2026-09-13 against the deployed build, for the request
above:

```json
{
  "status": "PASS",
  "entity": "lido.fi",
  "chain": "ethereum",
  "chain_caip2": "eip155:1",
  "address": "0x73b047fe6337183A454c5217241D780a932777bD",
  "confidence": 0.9,
  "agreement": "2_of_2",
  "independent_origins": 2,
  "evidence_basis": ["entity_published", "explorer_verified"],
  "contract_role": "Emergency Brakes Multisigs",
  "checked_purpose": "emergency multisig",
  "checked_purpose_supported": true,
  "checked_address_supported": true,
  "self_published_only": false,
  "proxy": { "is_proxy": true, "proxy_type": "master_copy", "…": "…" },
  "action": { "transact": true, "reason": "…", "does_not_mean": "…" },
  "billable": true
}
```

Every row under `evidence` carries the operator, the URL, a verbatim
excerpt and the time it was retrieved, and may only sit there if it
states the chain and address that were returned.

## The rules that make the answer worth paying for

- `action.transact` is **derived, never assigned**. Any conflict, any
  null value, anything short of a pass makes it false.
- `transact: true` also requires the entity's source to have said **what
  the contract is**. An entity owns its staking contract, its bridges
  and its emergency multisigs alike; "it is theirs" is not by itself a
  reason to send a transaction to it.
- **A contract address is never decided by counting.** Two credible
  sources that disagree produce no answer at all — the cost of the
  minority being right is your funds.
- For an upgradeable contract the canonical target is the **proxy**; the
  implementation is context and is expected to change without changing
  the answer.
- Provenance is graded, not flattened: `entity_published`,
  `explorer_verified`, `registry_mapping`, `cryptographic_control` and
  `inferred` mean different things and the payload says which it has.
- An explorer proves a contract **exists**; it never says whose it is.

## Honest limits — read these before you rely on it

- **A bare hex with no entity is `UNRESOLVED`.** If all you have is
  `0xabc…` pasted in a chat and no idea whose it is, this cannot help:
  there is no published claim to check it against. The name is the
  input.
- **Coverage is the entity's own publishing.** If a project does not
  publish its addresses on a page we can reach, the honest answer is
  `UNRESOLVED`, not a guess.
- **Not a safety assessment.** See the top of this file.
- **Self-published only** is reported as such: when the only source is
  the entity's own page, `self_published_only` is `true` and confidence
  is lower, because a compromised docs page is exactly the attack.

## Price

| | |
|---|---|
| `POST /v1/address-evidence` | **$0.25** USDC, Base (`eip155:8453`), x402 `exact` |
| `POST /v1/address-evidence/validate` | free |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| payTo | `0xEFc22716066C1092b12d12ca9377f00bA2ffA7A8` |

**An answer that evidences no target is `billable: false` and settlement
is cancelled.** You are charged for an answer, not for a lookup.

Prices, network, asset and payee above were read from the live `402`
challenge on 2026-09-13, not from documentation.

## Companion skill

`mercator-entity-evidence` — the same evidence discipline applied to
company facts (legal name, domain, headquarters, executives) at $0.10.
