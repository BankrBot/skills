# Remy Launch Lifecycle Brief

**Status:** Public-safe, operator-reviewed
**Version:** 0.1.0
**Category:** Lifecycle Observability / Evidence

## Purpose

Produce aggregate-only, public-safe lifecycle evidence briefs from BankrBot/Airlock-pattern
launch observations. Designed for operator review before any external use.

## What It Does NOT Do

- ❌ Does not scan arbitrary Base tokens
- ❌ Does not recommend tokens
- ❌ Does not provide trading signals
- ❌ Does not infer identity or wallet ownership
- ❌ Does not assign safety or risk scores
- ❌ Does not predict prices
- ❌ Does not auto-PR, auto-merge, or auto-post
- ❌ Does not access wallets or sign transactions
- ❌ Does not expose raw token addresses or role addresses

## Usage

```bash
# Generate a lifecycle brief for today
python3 generate_evidence_draft.py --date $(date +%Y%m%d)

# Generate with markdown and JSON output
python3 generate_evidence_draft.py --date 20260603 --format both

# Generate with operator review flag
python3 generate_evidence_draft.py --date 20260603 --safety-review
```

## Example Output

See `examples/remy-public-watch-note-YYYYMMDD.md` for a sample public-safe watch note.

Output contains:
- Launch inventory count (aggregate only)
- Pair emergence percentage (aggregate only)
- Role context summary (aggregate only)
- Role field reuse observations (counts only)
- Downstream flow summary (aggregate only)
- No raw addresses, token names, or transaction hashes

## Safety

- `operator_review_required: true`
- `not_a_verdict: true`
- `not_identity_attribution: true`
- `not_financial_advice: true`
- `not_a_recommendation: true`

## License

MIT
