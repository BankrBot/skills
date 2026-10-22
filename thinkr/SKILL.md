---
name: thinkr
description: Sealed evidence with money behind it, for agents that pay other agents. Use before paying another agent over x402 to read whether that seller has posted a bond and whether it is safe to pay. Use after a payment that delivered nothing to file a claim against the seller's bond. Use when your own agent sells, to post a bond, seal every hour what it delivered, and answer claims with the sealed record. Covers non delivery only, never the quality of the work.
---

# THINKR

Any agent can sign a record after the fact. THINKR seals it before anyone knows there
is a dispute, and puts money behind it.

- **The seal.** Every hour a seller commits one root covering everything it delivered
  that hour. The window to seal an hour closes before the window to claim against it
  opens, so evidence can never be written in answer to a claim. Signed proves who.
  Sealed proves when.
- **The bond.** The seller posts its own money against its ERC-8004 identity. If it
  takes a payment and cannot show the sealed delivery, the claimant is paid from it.

x402 itself is untouched. The payment stays instant and final; nothing is held or
routed. The API never holds a key: every write returns transactions for your own
wallet to sign and send.

API base: `https://api.thinkr.tech` (or `THINKR_API` if the user runs their own).
`GET /v1` lists every endpoint. Agent ids are ERC-8004 token ids, as plain numbers.
Amounts are whole units of the collateral token, as strings. THINKR runs on Robinhood
Chain (4663), contract `0xD5e4643e7E20c987a3da124b05a54cae57de9DDA`, with USDG as collateral (6 decimals, so `"1000000"` is $1). The bond
response names the chain; check it matches the chain you are paying on.

## Before paying an agent

```
GET /v1/bond/{agentId}?amount={what you are about to pay}
```

Always pass the amount. Branch on `safeToPay`: with an amount it is true only when the
seller's unreserved bond covers that payment and the seller has not given notice to
leave. Bonds start at $1, so the minimum alone says little; the comparison with your
payment is the check. `claimable` says separately whether the payment is large enough
to claim against (at least 1% of the bond). A small call to a well bonded seller is
safe but not claimable: the bond vouches for the seller, it cannot refund that call.

```json
{
  "agentId": "1427",
  "bonded": "10000000",
  "available": "10000000",
  "status": "active",
  "minClaim": "100000",
  "payment": "250000",
  "covers": true,
  "claimable": true,
  "safeToPay": true,
  "epoch": 491234,
  "chain": { "id": 4663, "name": "Robinhood Chain" }
}
```

- `status: "winding_down"` means the seller has started its notice period. Its bond
  may be gone before a claim against it ripens. Treat it as unbonded.
- `minClaim` is the smallest claim this seller can face (1% of its bond). A payment
  below it comes back `claimable: false`: there would be no refund if it fails. Fine
  for a few cents; say so before paying more than you would lose quietly.
- A seller with no bond is not necessarily dishonest. Nothing stands behind its
  promise, and the user should know that before money moves.

`GET /v1/claims/{agentId}` gives the record: claims filed, answered with a sealed
proof, and paid out.

## After a payment that delivered nothing

File a claim naming the transaction. See [references/claims.md](references/claims.md).
The claimant stakes 2% of the claim. If the seller answers with its sealed proof
within 48 hours, the stake goes to the seller. If it stays silent, anyone can settle
and the claimant receives the claim plus its stake back.

Only file when nothing arrived. A disagreement about quality is not covered, and a
seller that delivered will answer and take the stake.

## When your own agent sells

Post a bond, seal every hour, answer claims. See
[references/selling.md](references/selling.md).

The hourly seal is the whole mechanism. **A seller that stops sealing can no longer
answer claims**, so run it as a scheduled job, never as best effort.

## Refs and digests

Every delivery is a pair of 32 byte values:

- `ref`: what both sides call the transaction. An x402 payment reference, an
  [action_ref](https://datatracker.ietf.org/doc/draft-etcheverry-action-ref/), a
  Tersign receipt id. A buyer only ever needs this.
- `digest`: a hash of the seller's evidence, in whatever format it already keeps.

The API accepts only 32 byte hex for both, on purpose: a mistyped id must fail
loudly, never turn silently into a different ref. To convert other shapes, use the
SDK in the THINKR repo (`contracts/sdk/tree.js`): `toRef` passes any 32 byte hex id
through unchanged and hashes anything else (a UUID, say) with keccak256; `toDigest`
hashes bytes and strings as they are and JSON as RFC 8785 canonical JSON, so the
same envelope always gives the same digest.

## What it covers

| Covered | Not covered |
| --- | --- |
| Payment settled, nothing delivered | Whether the work was any good |
| Seller went silent after taking payment | Disagreement about scope |
| No sealed record for your transaction | Payments smaller than the seller's `minClaim` |

Non delivery is the only part that can be settled mechanically, so it is the only
part covered. The contract also cannot confirm a payment happened; the claimant's
stake is what makes a false claim cost money.
