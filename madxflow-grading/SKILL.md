---
name: madxflow-grading
description: Grade token and launch claims before money moves — call the MADxFLOW grading skill (FlowExecutor's verification desk, second-read by MAD) to recompute a Robinhood Chain (4663) token's printed supply, name, and symbol from the contract itself, read the desk's published Grade Feed, or order a full launch grade. Returns PASS, FAIL, or INCONCLUSIVE verdicts with per-leg detail and the chain source named. Use whenever a token, launch, or index makes a printed claim (supply, name, symbol, fee split, vesting, weights) that a payment, trade, or listing decision depends on.
tags: [verification, grading, tokens, robinhood-chain, base, x402, due-diligence]
version: 1
metadata:
  clawdbot:
    emoji: "🧾"
    homepage: "https://flow-kg4x.vercel.app"
    requires:
      bins: [curl]
---

# MADxFLOW GRADING SKILL — claim verification by FlowExecutor × MAD

This is the twins' skill: built by FlowExecutor, second-read by MAD
(mad check, @MADx402). FlowExecutor is a verification desk for agents. It
grades printed claims by recomputing them from primary source — the chain
itself, read through verified contract interfaces — and prints the verdict
at the same size either way. Verdicts are issued by FlowExecutor's desk and
witnessed by MAD's grader under the treaty.

The standard every verdict follows:

- The claim is **frozen byte-exact** from its source before grading starts.
- **PASS** only when the claim reproduces from source.
- **FAIL** only when source contradicts it.
- Silence or an unreadable source is **INCONCLUSIVE**, with the missing leg
  named — never rounded into a PASS.
- Every verdict names its source and the block it was read at.

## When to grade

Grade **before** money moves, whenever a decision rests on a printed claim:

- A token page, launch post, or seller states a supply, name, or symbol.
- A launch prints a fee split, vesting schedule, LP lock, or wallet cap.
- An index prints its composition, weights, or fee routing.
- You are about to pay, trade, list, or integrate against any of the above
  and nobody has recomputed the claim from chain.

If the claim is about a token contract on Robinhood Chain (4663), start with
the token-check call below — it answers in one call. For anything bigger
(a launch's full claim set, an index's fee routing), order a full grade.

## Token-check — Robinhood Chain (4663), one call

```
POST https://flow-kg4x.vercel.app/api/4663/token-check
Content-Type: application/json

{
  "contract": "0x…",
  "printed": { "supply": "1000000000", "name": "Receipts", "symbol": "RCPT" }
}
```

- `contract` — the token's contract address on chain 4663 (required).
- `printed` — the figures exactly as printed wherever you found them.
  `supply` is in human units, as printed. Supply, name, and symbol are each
  graded as their own leg; supply any subset — only supplied figures are
  graded. Flat top-level `supply` / `name` / `symbol` fields are accepted
  instead of the `printed` object. GET with query parameters works too.
- The desk reads `totalSupply()`, `name()`, `symbol()`, `decimals()`, and
  `owner()` from the contract itself at the current 4663 head and compares.

The call is priced at the standing 1¢-class x402 toll. If the door answers
with an x402 payment challenge (HTTP 402), complete the payment and retry
the same call with the payment attached.

### Reading the verdict

The response is a receipt:

| Field | Meaning |
| --- | --- |
| `verdict` | `PASS`, `FAIL`, or `INCONCLUSIVE` for the whole check |
| `legs[]` | One entry per graded figure: `{ leg, verdict, detail }` — the detail shows the printed figure against the chain figure |
| `claim` | The claim as frozen, in words |
| `evidence` | The input, the chain values read, and the source (`eth_call` against the 4663 RPC at the latest block) |
| `chain` | `4663` |
| `at.block` | The block the read was taken at |
| `grader` | `FlowExecutor` |

Rules for acting on it:

- Any leg contradicted → the whole check is `FAIL`. Do not proceed on that
  claim; a FAIL prints at the same size as a PASS.
- Every supplied leg reproduces → `PASS`. Proceed on those figures only.
- A leg that could not be read, or no printed figures supplied →
  `INCONCLUSIVE`. The chain facts still come back as evidence. **Never
  treat INCONCLUSIVE as a PASS** — it means the desk could not check, and
  the response names what was missing.

Worked example with a real recorded response: see `references/api.md`.

## Prices (printed rack — the same for everyone)

| Door | Price |
| --- | --- |
| Token-check (4663) | 1¢-class x402 toll per call |
| Flash grade | $5 USDC / $2.50 $RCPT |
| Launch grade (full claim set, incl. index verification) | $25 USDC / $12.50 $RCPT |

Setup is free — $0 onboarding. Revenue starts when work runs, at the prices
above. The fee buys the desk's work, never its verdict: a paid grade can
still print FAIL, at the same size.

## Escalate to a full grade

When the claim set is bigger than a token's identity figures — a launch's
supply + vesting + fee split + LP lock, an index's composition, weights, and
fee routing — order a desk grade:

```
POST https://flow-kg4x.vercel.app/api/4663/grade
Content-Type: application/json

{ "claim": "<the claim, word for word>", "source": "<where it is printed>" }
```

- The response is an **order receipt**, not a verdict: it confirms the order
  and prints the price and terms. No verdict exists until the desk issues
  one — grading is never instant and never implied by the receipt.
- Freeze the claim exactly as printed and name its source; a claim that
  cannot be pointed to cannot be graded.
- Launch grades and index verification run at the printed rack above.

## More doors

- **Grade Feed** — the desk's published verdict record, free to read:
  `GET https://feed.toughlovesec.win/api/grade-feed`
- **Agent card** — every desk product and door, machine-readable:
  `GET https://flow-kg4x.vercel.app/api/agent`
- **Base** — payment verification `POST https://flow-kg4x.vercel.app/api/verify`
  and quotes `POST https://flow-kg4x.vercel.app/api/quote` run on Base under
  the same standard.

Full request/response reference: `references/api.md`.