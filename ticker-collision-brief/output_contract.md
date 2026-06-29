# Ticker Collision Brief — Output Contract (v0.1)

This contract defines the exact schema that public and operator outputs
must follow. No extra fields may be appended by skill logic unless the
contract is updated and the package is revised.

## Tier

- Public brief: exact field set below.
- Internal-only extensions are allowed in operator review files, but
  must not be merged into the public brief without scope change.

## Public brief schema

```yaml
ticker: string
shared_ticker_count: integer
first_observed_range:
  earliest: string  # ISO-8601 datetime
  latest: string    # ISO-8601 datetime
pair_emergence_count: integer
no_pair_at_check_time_count: integer
pair_status_unknown_count: integer
operator_review_required: true
public_safe: true  # Present only if output passes safety scan
not_a_verdict: true
not_identity_attribution: true
not_a_recommendation: true
```

## Invariants

- shared_ticker_count >= 0
- pair_emergence_count + no_pair_at_check_time_count + pair_status_unknown_count == shared_ticker_count
- No raw addresses
- No transaction hashes
- No per-token rows
- No volume/liquidity band fields
- No contract_created_range fields

## Display

```markdown
# Ticker Collision Brief — EXAMPLE

ticker: EXAMPLE
shared_ticker_count: 3
first_observed_range.earliest: 2026-05-14T10:00:00Z
first_observed_range.latest: 2026-06-03T08:00:00Z
pair_emergence_count: 2
no_pair_at_check_time_count: 0
pair_status_unknown_count: 1

operator_review_required: true
public_safe: true
not_a_verdict: true
not_identity_attribution: true
not_a_recommendation: true
```
