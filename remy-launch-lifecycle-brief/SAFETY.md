# Safety — Remy Launch Lifecycle Brief

## Hard Constraints

| Constraint | Enforced | How |
|---|---|---|
| No raw 0x addresses | ✅ Leak check at generation | Regex blocklist rejects any 0x-prefixed strings |
| No tx hashes | ✅ Leak check | Blocked by same 0x pattern |
| No token names | ✅ Forbidden wording scan | Blocked by content policy |
| No buy/sell/hold trading language | ✅ Forbidden wording scan | `buy`, `sell`, `hold` as trading advice blocked |
| No price predictions | ✅ Forbidden wording scan | `price` blocked in output context |
| No identity attribution | ✅ Forbidden wording scan | `wallet`, `developer`, `team` blocked |
| No scam/rug/fraud/safe/risky verdicts | ✅ Forbidden wording scan | Explicit blocklist |
| No financial advice | ✅ Disclaimer | `not_financial_advice: true` on every output |
| No token recommendations | ✅ Disclaimer | `not_a_recommendation: true` on every output |
| No trading signals | ✅ Disclaimer | `not_trading_advice: true` on every output |
| Operator review required | ✅ Always | `operator_review_required: true` |

## Safety Gates

1. **Future date guard** — dates > current system date are rejected before any generation
2. **Leak check** — generated output is scanned for 0x identifiers before saving
3. **Forbidden wording scan** — generated output is scanned for verdict/trading/identity language
4. **Public_safe flag** — output must have `public_safe: true` for any external use
5. **Operator review** — manual review required before any external publication

## What Happens When Safety Fails

| Failure | Behavior |
|---|---|
| Leak check fails | Output not saved. Error message printed. |
| Forbidden wording detected | Output not saved. Error message printed. |
| Future date provided | Script exits with error before any generation. |
| Missing required artifacts | Script exits with clear error message. |

## Reporting a Safety Issue

Contact the Remy operator through the BankrGuard repository.

## Changelog

- **0.1.0** — Initial safety constraints documented.
