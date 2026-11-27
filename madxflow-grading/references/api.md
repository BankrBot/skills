# MADxFLOW GRADING SKILL — API reference

Base URL for the Standard doors: `https://flow-kg4x.vercel.app`
Grader of record: `FlowExecutor` — the MADxFLOW grading skill's issuing
desk (FlowExecutor built the doors; MAD second-reads and witnesses the
verdicts under the treaty). Standard: PASS only on reproduction from
source, FAIL only on contradiction, silence = INCONCLUSIVE with the missing
leg named. Every response names its source.

## POST /api/4663/token-check

Grades a token's printed identity figures against its own contract on
Robinhood Chain (4663). GET with query parameters is equivalent; POST JSON
fields win per-field.

### Request

```json
{
  "contract": "0xc877479e3b4e5ad952c85b2ee46f4b140e759c5a",
  "printed": { "supply": "1000000000", "name": "Receipts", "symbol": "RCPT" }
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `contract` (or `address`) | yes | 0x address on chain 4663. Missing or malformed → HTTP 400 with an INCONCLUSIVE receipt naming the input leg. |
| `printed.supply` | no | Human units, exactly as printed (e.g. `"1000000000"`, not raw wei). |
| `printed.name` | no | Compared byte-exact against the contract's `name()`. |
| `printed.symbol` | no | Compared byte-exact against the contract's `symbol()`. |

Flat `supply` / `name` / `symbol` fields at the top level are accepted in
place of the `printed` object. Each supplied figure becomes one graded leg.
Supplying nothing returns the chain facts as evidence with an INCONCLUSIVE
verdict — nothing was claimed, so nothing is graded.

Priced at the standing 1¢-class x402 toll: if the door returns an x402
payment challenge (HTTP 402), complete the payment and retry the same call.

### Response (receipt shape — every Standard door answers in this shape)

```json
{
  "claim": "Printed figures for token 0xc877479e3b4e5ad952c85b2ee46f4b140e759c5a on Robinhood Chain — supply 1000000000, name \"Receipts\", symbol \"RCPT\" — reproduce from the contract itself.",
  "verdict": "PASS",
  "legs": [
    { "leg": "supply", "verdict": "PASS", "detail": "printed supply 1000000000 (human units) vs chain totalSupply 1000000000 (raw 1000000000000000000000000000, 18 decimals)" },
    { "leg": "name",   "verdict": "PASS", "detail": "printed name \"Receipts\" vs chain \"Receipts\"" },
    { "leg": "symbol", "verdict": "PASS", "detail": "printed symbol \"RCPT\" vs chain \"RCPT\"" }
  ],
  "evidence": {
    "endpoint": "token-check",
    "sources": { "rpc": "https://rpc.mainnet.chain.robinhood.com", "method": "eth_call at latest block" },
    "contract": "0xc877479e3b4e5ad952c85b2ee46f4b140e759c5a",
    "chain": {
      "name": "Receipts", "symbol": "RCPT", "decimals": 18,
      "totalSupplyRaw": "1000000000000000000000000000",
      "totalSupply": "1000000000"
    },
    "printed": { "supply": "1000000000", "name": "Receipts", "symbol": "RCPT" }
  },
  "chain": 4663,
  "at": { "block": 124417470, "timestamp": "<ISO-8601 time of the read>" },
  "grader": "FlowExecutor"
}
```

This is a real recorded call (the $RCPT twin on 4663): verdict PASS,
3 of 3 legs PASS, read at block 124417470. The `owner` field also returns
in `evidence.chain` when the contract exposes `owner()`.

### Verdict rules

- One contradicted leg fails the whole check (`FAIL`).
- All supplied legs reproduce → `PASS`.
- Any supplied leg unreadable on chain, or nothing supplied →
  `INCONCLUSIVE`; the leg's `detail` names what could not be read.
- `at.block` is the 4663 block the read was taken at — cite it when you
  rely on the verdict.

## POST /api/4663/grade

Orders a full desk grade of a claim set (a launch's printed claims, an
index's composition / weights / fee routing).

```json
{ "claim": "<the claim, word for word as printed>", "source": "<URL or handle where it is printed>" }
```

Both fields are required; a missing one returns HTTP 400 with an
INCONCLUSIVE receipt naming the missing input and no order taken.

The response (HTTP 201) is an **order receipt**: an order id, the price,
and the terms. It is never a verdict and never implies one — the desk
freezes the claim from the named source, grades it from primary source
with two independent read-backs, and issues the verdict when the work is
done. PASS, FAIL, and INCONCLUSIVE print at the same size.

## Other doors

| Door | Shape | Notes |
| --- | --- | --- |
| Grade Feed | `GET https://feed.toughlovesec.win/api/grade-feed` | The desk's published verdict record. Free to read. |
| Agent card | `GET https://flow-kg4x.vercel.app/api/agent` | All 13 desk products and doors, machine-readable. |
| Verify (Base) | `POST https://flow-kg4x.vercel.app/api/verify` | Payment verification on Base, same standard. |
| Quote (Base) | `POST https://flow-kg4x.vercel.app/api/quote` | Quote door on Base. |

## Prices (printed rack — the same for everyone)

| Work | Price |
| --- | --- |
| Token-check (4663) | 1¢-class x402 toll per call |
| Flash grade | $5 USDC / $2.50 $RCPT |
| Launch grade / index verification | $25 USDC / $12.50 $RCPT |

Setup is free ($0 onboarding). The fee buys the desk's work, never its
verdict.
