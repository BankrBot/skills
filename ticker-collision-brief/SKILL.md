---
name: ticker-collision-brief
title: Ticker Collision Brief
description: >
  Free standalone BankrBot utility. Provides public-safe shared ticker
  lifecycle context only. Neutral aggregate context tool with no selection,
  no prioritization, and no authenticity resolution.
version: 0.1.0
tier: free
category: utility
standalone: true
remy_core_dependency: none
operator_review_required: true
---

# Ticker Collision Brief

Shared ticker lifecycle context utility for BankrBot.

## What it is

Ticker Collision Brief is a public-safe aggregate memory snapshot. It
shows how many observed tokens share a given ticker and their lifecycle
patterns across observation runs.

## What it is not

- Not a discovery tool.
- Not an authenticity resolution tool.
- Not a token comparison tool.
- Not a selection or prioritization tool.
- No operator or entity attribution in output.
- No operational guidance implied.
- No trading guidance implied.

## Output contract (v0.1)

Every output must contain exactly the free-tier fields defined in
`output_contract.md`. No additional fields may be added to the public
brief without operator review and a scope update.

## Safety rules

See `SAFETY.md`. These are hard constraints, not suggestions.

## Usage steps

1. Receive ticker input.
2. Count observed entries sharing that ticker.
3. Report first observed timestamps.
4. Report pair emergence counts.
5. Apply free-tier schema.
6. Gate output on safety flags.

## Readiness

See `REVIEW.md` for submission readiness checklist.
