---
name: remy-launch-lifecycle-brief
version: 0.1.0
date: 20260603
purpose: public-safe aggregate evidence brief for BankrBot/Airlock-pattern launch lifecycle memory
input: date optional, format markdown/json
output: public-safe aggregate watch note
safety:
  - no raw identifiers
  - no verdicts
  - no financial advice
  - no trading language
  - no identity attribution
  - operator review required
  - aggregate only
  - not a scanner
  - not a token call product
---

# Remy Launch Lifecycle Brief

A public-safe, aggregate-only evidence brief generated from BankrBot/Airlock-pattern
launch lifecycle observation artifacts.

## What This Skill Does

- Produces aggregate public-safe lifecycle notes from observed launch data
- Summarizes launch inventory, pair emergence, role context, and downstream flow
- Tracks recurring downstream recipients across observation windows
- Provides operator-reviewed markdown and JSON evidence drafts

## What This Skill Does NOT Do

- **This is not a scanner.** It does not scan arbitrary Base tokens.
- **This is not a token call product.** It does not recommend tokens.
- **This is not financial advice.** It contains no trading signals or market advice.
- **This does not expose token addresses or role addresses.** All output is aggregate-only.
- **This does not infer developer, team, wallet, or individual identity.**
- **This does not assign safety or risk scores.** No scam/rug/fraud/verdict language.
- **This does not predict prices.** No price, liquidity, volume, or holder data.
- **This does not auto-PR, auto-merge, or auto-post.** Operator review is required.

## Input

- `--date YYYYMMDD` (optional, defaults to latest valid date)
- Formats: markdown, JSON, or both

## Output

- Public-safe aggregate watch note (markdown)
- Structured evidence draft (JSON, if available)
- Skill package draft with manifest and review metadata

## Safety

| Constraint | Enforced |
|---|---|
| No raw identifiers (0x addresses, BTC keys) | ✅ |
| No verdicts (scam/rug/fraud/safe/risky) | ✅ |
| No financial advice | ✅ |
| No trading signals | ✅ |
| No identity attribution | ✅ |
| No price predictions | ✅ |
| Aggregate-only | ✅ |
| Operator review required | ✅ |
| Not a scanner | ✅ |
| Not a token call product | ✅ |

## Caveats

- Operator review is required before any external use.
- Output is based on observed on-chain data only. No guarantee of completeness.
- Aggregate counts reflect the observation window only.
- This skill is a consumer of the BankrBot/Airlock pipeline, not a duplicate of it.
