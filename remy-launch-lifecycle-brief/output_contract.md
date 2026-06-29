# Output Contract — Remy Launch Lifecycle Brief

## Output Format

The skill produces two output formats:

### Markdown (default)

Public-safe aggregate lifecycle note:
```
/tmp/remy-public-watch-note-YYYYMMDD.md
```

### JSON (with --format json or --run-full-pipeline)

Structured evidence draft:
```
/tmp/remy-evidence-draft-YYYYMMDD.json
```

## Output Schema (Markdown)

```markdown
# Remy Public Watch Note — YYYYMMDD

**Date:** YYYYMMDD
**Operator Review Required:** true

## Observation Scope
- Chain: base
- Total tokens observed: <number>
- Pair emergence: <percentage>
- No pair at check time: <percentage>

## Aggregate Summary
- Launch inventory: <number>
- High confidence: <number>
- Unique callers: <number>
- Unique fee recipients: <number>
- Unique beneficiaries: <number>
- Unique integrators: <number>

## Safety
- not_a_verdict: true
- not_identity_attribution: true
- not_financial_advice: true
- not_a_recommendation: true
```

## Safety Constraints

- No raw identifiers (0x addresses, tx hashes) appear in any output
- No token names appear in any output
- No buy/sell/hold trading language
- No price predictions
- No identity attribution
- No scam/rug/fraud/verdict language
- `operator_review_required: true`
- `public_safe: true`

## Input Requirements

- `--date YYYYMMDD` (valid operational date, not in the future)
- Artifacts in `/tmp/remy-*-YYYYMMDD.json` from evidence pipeline

## Verification

The output contract is verified by:
1. Leak check: no 0x addresses in generated output
2. Forbidden wording scan: no verdicts, trading language, or identity terms
3. Public_safe flag: must be true
4. Operator review: manual review before any external use
