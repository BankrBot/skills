---
name: mercator-address-evidence
description: |
  Before you send a transaction, check that the chain and contract
  address you are about to use is the one the entity publishes for that
  purpose. Not a scam or rug assessment - provenance. You supply the
  entity, the chain, the candidate address and what you believe it is
  for. The answer says whether the entity's own published deployment
  record states that exact address, whether its own on-chain registry
  still points at it, and what the entity's own source says the contract
  does - each with the URL and a verbatim excerpt - plus a derived
  transact true/false. Disagreeing sources return no address at all.

  Covers six protocol-and-chain cases today (Lido, Aave V3, SparkLend,
  Uniswap V3 pool creation); the free preflight lists them and says
  whether yours is one. $0.25 USDC per call over x402 on Base, charged
  once and only when the target is verified. Every other answer is
  returned in full as HTTP 404, and THIS ONE HOLDS: the x402 middleware
  cancels settlement on any status of 400 or above, so nothing is
  captured for it.

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

## What it covers today — check this before you pay

Six protocol-and-chain cases have a registered source. For these the
service reads the field the protocol publishes for machines, checks it
against the protocol's own on-chain registry, and reads the protocol's
own statement of what the contract does.

| `domain` | `chain` | covers | `purpose` to send |
|---|---|---|---|
| `lido.fi` | `ethereum` | ETH staking (Lido) | `ETH staking` |
| `aave.com` | `ethereum` | lending pool (Aave V3) | `lending pool` |
| `aave.com` | `base` | lending pool (Aave V3) | `lending pool` |
| `spark.fi` | `ethereum` | lending pool (SparkLend) | `lending pool` |
| `uniswap.org` | `ethereum` | pool creation (Uniswap V3 Factory) | `pool creation` |
| `uniswap.org` | `base` | pool creation (Uniswap V3 Factory) | `pool creation` |

**Uniswap coverage is V3 pool creation on Ethereum and Base, and nothing
else.** A request for the Factory with a swap purpose is refused with
`contract_purpose_mismatch`.

What was measured for these six on 2026-11-21 (CI run 44903833320, build
`a95d542`, the product's real pipeline against the real sources; no paid
call was made): in all six the target the protocol publishes was read,
it matched the protocol's on-chain registry, and the role was quoted
from the protocol's own source. The code at all six addresses was also
verified by an outside source — a chain explorer for four, Sourcify for
the two on Base. **Independent confirmation that the address is
published for that role: 0 of 6.** A pass here is the protocol's own
publication, shown current and with its role in the protocol's words; it
is not a second party vouching for it.

**Outside this table** the request is still accepted and the answer will
very probably be that nothing could be verified. Without a registered
source the service falls back to fetching likely documentation URLs,
which found a published address for 1 of 24 well-known protocols when it
was measured on 2026-11-20. Paying is not advised until the table covers
you. The free preflight returns this list live under `coverage` and says
whether your entity and chain are on it.

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

For this product that means only `PASS` answers 200. `CONFLICT`,
`INSUFFICIENT_EVIDENCE` and `UNRESOLVED` — a request with no candidate
address included — answer 404 with the full body, under the rule above.
Versions 1.0.0 and 1.0.1 of this file said otherwise and are withdrawn.

## The shape of the call

You bring the entity, the chain, the candidate and the purpose, and we
check them. We never pick a target for you: a request with no candidate
address always answers `transact: false` with reason
`candidate_address_required` rather than guessing which of an entity's
dozens of contracts you meant.

```bash
BASE="${MERCATOR_BASE_URL:-https://mercator-entity-evidence.fly.dev}"

# Free preflight — what will be checked, whether you are covered, and
# what the answer will mean.
curl -sS -X POST "$BASE/v1/address-evidence/validate" \
  -H 'content-type: application/json' \
  -d '{"domain":"lido.fi","chain":"ethereum",
       "address":"0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
       "purpose":"ETH staking"}' | jq .

# Paid answer — $0.25 USDC on Base, x402. Unpaid, this returns 402 with
# the payment requirements; the Bankr wallet, or your own signer, retries it.
curl -sS -X POST "$BASE/v1/address-evidence" \
  -H 'content-type: application/json' \
  -H "X-PAYMENT: $X_PAYMENT" \
  -d '{"domain":"lido.fi","chain":"ethereum",
       "address":"0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
       "purpose":"ETH staking"}' | jq .

# See the payment requirements without paying:
curl -sS -X POST "$BASE/v1/address-evidence" \
  -H 'content-type: application/json' \
  -d '{"domain":"lido.fi","chain":"ethereum"}' | jq '.accepts'
```

| field | required | meaning |
|---|---|---|
| `domain` | yes | the entity's domain, e.g. `lido.fi` |
| `chain` | yes | `ethereum`, `base`, … |
| `address` | no, but required for `transact: true` | the candidate you are about to use |
| `protocol` | no | narrows the claim when a domain hosts several |
| `purpose` | no | what you believe the contract is for, e.g. `ETH staking`; compared against the entity's own statement, and a mismatch is refused |

## What comes back

The deciding fields for the request above, as recorded on 2026-11-21 by
CI run 44903833320 on build `a95d542`:

```json
{
  "status": "PASS",
  "entity": "lido.fi",
  "chain": "ethereum",
  "address": "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
  "confidence": 0.9,
  "independent_origins": 2,
  "evidence_basis": ["entity_published", "registry_mapping", "explorer_verified"],
  "contract_role": "Liquid staking pool implementation",
  "action": { "transact": true, "…": "…" }
}
```

`contract_role` is Lido's own sentence, read on that call from
`contracts/0.4.24/Lido.sol` in `lidofinance/core` and returned with its
URL and the verbatim line. The second origin is a chain explorer
agreeing that verified code sits at the address; it says nothing about
whose contract it is.

Every row under `evidence` carries the operator, the URL, a verbatim
excerpt and the time it was retrieved, and may only sit there if it
states the chain and address that were returned. A row read from the
chain carries the provider, the method, the block number and hash, and
the raw returned word.

What the other things you might send get — none of them `transact: true`:

| you send | answer |
|---|---|
| no candidate address | `UNRESOLVED`, `candidate_address_required` |
| the published target, with a purpose its source does not support | `INSUFFICIENT_EVIDENCE`, `contract_purpose_mismatch` |
| the implementation behind the proxy | `INSUFFICIENT_EVIDENCE`, `candidate_is_the_implementation_not_the_proxy` |
| another address — the entity's contract for a different role, or its address on another chain | `INSUFFICIENT_EVIDENCE`, `candidate_does_not_match_the_target_published_for_this_role` |
| a target whose role cannot be read from the entity's own source on that call | `INSUFFICIENT_EVIDENCE`, `contract_purpose_unverified` |
| a published file and the on-chain registry that disagree | `CONFLICT`, no address |

The first four rows were measured in the same run across the six cases,
with zero wrong `transact: true`. The last two are exercised by the
repository's tests on recorded fixtures, not live.

Versions 1.0.0 and 1.0.1 of this file showed a Lido emergency-multisig
address as their passing example. That example is withdrawn: for
`lido.fi` on Ethereum the answer is decided against the one target Lido
publishes for staking, and that address is not it.

## The rules that make the answer worth paying for

- `action.transact` is **derived, never assigned**. Any conflict, any
  null value, anything short of a pass makes it false.
- `transact: true` requires the entity's own documentation or source
  code to have said **what the contract is**, in its own words, returned
  with the URL and the verbatim lines. A role that only this service
  inferred from a field name is `contract_purpose_unverified`, never a
  pass.
- **The entity's on-chain registry agreeing with its published file is
  not a second origin.** It shows the publication is still current, and
  is reported as that.
- **A contract address is never decided by counting.** Two credible
  sources that disagree produce no answer at all — the cost of the
  minority being right is your funds.
- For an upgradeable contract the canonical target is the **proxy**; the
  implementation is context and is expected to change without changing
  the answer.
- Provenance is graded, not flattened: `entity_published`,
  `registry_mapping`, `explorer_verified`, `code_verified`,
  `cryptographic_control` and `inferred` mean different things and the
  payload says which it has.
- An explorer or a source-verification registry proves verified code
  **exists** at an address; it never says whose it is.

## Honest limits — read these before you rely on it

- **A bare hex with no entity is `UNRESOLVED`.** If all you have is
  `0xabc…` pasted in a chat and no idea whose it is, this cannot help:
  there is no published claim to check it against. The name is the
  input.
- **Coverage is six cases.** See the table above. Everything else falls
  back to the entity's public pages and will very probably answer that
  nothing could be verified.
- **A pass is single-sourced for the claim that matters.** That the
  entity publishes this address for this role rests on the entity's own
  publication. No independent source confirms it in this version.
- **The role sentence is tied to the address by the protocol's own
  names** for Aave, SparkLend and Uniswap — the published constant, the
  registry getter and the source file all say Pool or Factory — not by a
  bytecode comparison. For Lido the published file itself names the
  source file the sentence is read from.
- **Not a safety assessment.** See the top of this file.
- **Self-published only** is reported as such: when no outside party
  confirmed even the code, `self_published_only` is `true` and
  confidence is 0.55 rather than 0.9.

## Price

| | |
|---|---|
| `POST /v1/address-evidence` | **$0.25** USDC, Base (`eip155:8453`), x402 `exact` |
| `POST /v1/address-evidence/validate` | free |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC on Base) |
| payTo | `0xEFc22716066C1092b12d12ca9377f00bA2ffA7A8` |

Price, network, asset and payee above were read from the live `402`
challenge on 2026-09-13, not from documentation; the free preflight
showed the same price on 2026-11-21. No signup, no API key, no account.

## Companion skill

`mercator-entity-evidence` — the same evidence discipline applied to
company facts (legal name, domain, headquarters, executives) at $0.10.
