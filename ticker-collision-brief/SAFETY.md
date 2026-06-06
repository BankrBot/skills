# Ticker Collision Brief — Safety Rules (v0.1)

Safety is a hard boundary, not a guideline.
Any output that violates these rules must not be produced.

## Prohibited content and language

- No raw addresses
- No transaction hashes
- No per-token rows
- No top/bottom listings
- No volume/liquidity bands in v0.1
- No contract_created_range in v0.1
- No real/fake wording
- No scam/rug/fraud/verdict language
- No buy/sell/hold language
- No price predictions
- No wallet or entity attribution
- No token ranking
- No individual token recommendation

## Required outputs

Every output must include the following flags:

- operator_review_required: true
- public_safe: true or false
- not_a_verdict: true
- not_identity_attribution: true
- not_a_recommendation: true

## Output review rule

Output is public-safe only if all required flags are present and no
prohibited content is detected. If public_safe is false, operator review
is required before publication.

## Future scope caution

Later versions must not use the following concepts to rebuild disallowed
output through indirect fields:

- indirect authenticity scoring
- inferred token maturity
- inferred operator identity
- implied quality through presentation order
