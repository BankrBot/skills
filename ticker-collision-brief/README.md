# Ticker Collision Brief

Free standalone BankrBot utility. Public-safe shared ticker lifecycle context only.

## Summary

Ticker Collision Brief answers a single bounded question:

> For a given ticker, how many observed entries share it, and when were
> those observations first seen?

No more. No per-token rows, no ordering, no authenticity resolution, no operator guidance.

## Scope

- Tier: free
- Placement: standalone BankrBot skill
- Remy dependency: none
- Version target: v0.1
- Paid features: none
- Paid tier: none

## Included fields (v0.1)

- ticker
- shared_ticker_count
- first_observed_range.earliest
- first_observed_range.latest
- pair_emergence_count
- no_pair_at_check_time_count
- pair_status_unknown_count
- operator_review_required
- public_safe
- not_a_verdict
- not_identity_attribution
- not_a_recommendation

## Not included (held)

- contract_created_range
- volume_band_distribution
- liquidity_band_distribution
- source artifact hashes
- agent-readable receipt
- raw identifiers
- per-token detail

## Files

- SKILL.md
- manifest.yaml
- output_contract.md
- SAFETY.md
- REVIEW.md
- examples/ticker-collision-brief-example.md

## Safety

All outputs carry mandatory safety flags. No identifier leakage is
allowed in the free tier.

## Submission

Marked for operator review. Implementation is skipped in this package.
