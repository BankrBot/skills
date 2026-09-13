---
name: bankr-take-profit
description: Place, verify, reconcile, and cancel exact-quantity take-profit orders using Bankr native trading tools. Use for a specified price target or percentage gain on an existing spot position, including partial take profits and filled-entry handoffs.
---

# Bankr Take Profit

Use Bankr's native limit-sell tools to execute an authorized take profit. This
skill supplies an execution workflow; it does not add a new backend order type,
an always-running process, or guaranteed fills.

## Establish the order

Resolve the chain, exact token contract or mint, Bankr wallet, output asset,
quantity, target, expiry, and slippage from the request and existing mandate.
Ask only for missing consequential choices. A ticker alone is insufficient when
several tokens match. A request to install or demonstrate this skill does not
authorize a trade; use a dry run for demonstrations unless execution was requested.

For a percentage target, identify its baseline: confirmed fill price, an explicit
cost basis, or a named current quote. Do not substitute current price for entry
price. Compute `target = baseline × (1 + percent / 100)` using decimal arithmetic.
Preserve the baseline's denomination. A USDC-per-token cost is not automatically
a USD-per-token cost: verify the conversion if the native trigger uses USD, and
explain that a fixed USD trigger does not enforce a fixed USDC price as its peg
changes. Resolve a material mismatch before submitting.
Round a sell target upward to the venue's supported tick. A price gain is gross;
do not call it net profit after fees. If the user requests a net return, account
for the position's actual cost and estimated exit costs, and disclose uncertainty.

Use human token units when the bound tool expects them, raw units only when it
explicitly requires raw units. Preserve token precision. Size from confirmed,
unspent inventory after existing reservations. For “sell half,” compute half of
the identified position, not half of the entire wallet. Round quantity down to
token precision. Multiple take-profit legs must sum to no more than that position.

Read [references/native-orders.md](references/native-orders.md) before placing or
changing an order. Inspect the currently bound schema: chain support, size limits,
settlement asset, fees, expiry and trigger semantics can differ by order family.

## Execute and prove

1. Read wallet identity, current holdings, and existing active/pending orders.
   Resolve overlapping reservations. Preserve the user's gas reserve. Confirm
   the exact requested output asset is supported; do not silently settle in a
   different token or bridge funds to make an order possible.
2. Persist a concrete order record in the host's private durable state before
   submitting: chain, wallet, input/output token, exact input
   quantity, absolute USD target, expiry, slippage, position reference and purpose
   `take-profit`, creation time and submission state. If durable state is unavailable,
   disclose that recovery limitation and do not promise recurring or automatic
   retry handling. Reuse existing authorization for that exact scope. A read-only
   key or membership error is a capability block, not permission to change keys,
   buy a subscription, or increase spending.
3. Submit one native limit sell. Prefer an absolute target over a percentage
   relative to the moment of submission. If the target has already been crossed,
   explain that the order may execute immediately; do not replace it with a
   market sell unless the user's mandate permits that behavior.
4. Keep the returned order ID and any transaction IDs. An Agent API job ID is not
   a trading order ID. List/read the created order and match its wallet, chain,
   token pair, quantity, target and expiry to the record. If fields cannot be
   verified, label that gap. Report `armed` only with a matching active order,
   `filled` only with fill evidence, otherwise `pending` or `unverified`.
5. Reconcile a fill using executed quantity, proceeds, fees, transaction signature
   or hash when provided, and remaining quantity. Creation alone is not a sale.
   Partial fills retain a residual reservation; never resubmit the original full
   amount. A trigger crossing alone does not establish execution or profit.

A timeout or lost response leaves the outcome unknown. Query orders/job status
before considering another submission. Match by order ID or exact request fields
and creation window; if multiple matches remain, stop for reconciliation. Never
blindly repeat a write. Cancel by exact order ID and verify terminal status before
releasing its reservation or replacing it. A fill may race cancellation.

## Filled-entry handoff and competing exits

For a take profit attached to a future buy, use native linked/child orders only
when the current tools actually support and verify them. Otherwise record a
deferred intention. Create the take profit only after the buy has a confirmed
fill and the acquired quantity and execution price are known. Never place a sell
against an estimated future balance. Partial entry fills require distinct tracked
lots or an explicitly authorized cancel/reconcile/resize workflow.

Do not describe two independent take-profit and stop-loss orders as OCO. If a stop
already reserves the same inventory, use a verified native linkage/reservation
mechanism or explain that both cannot safely be armed for that quantity. Do not
cancel an existing protective stop just to make room for the take profit without
authorization. An external coordinator needs a running scheduler, durable state,
single ownership of the lot and recovery tests; this instruction pack does not
provide those. Report deferred protection honestly when no such runtime exists.

## Examples

- “Sell 250 tokens from this Base position at $0.012 USDC per token, expiring
  tomorrow at 18:00 UTC.” Resolve exact addresses and place one scoped limit sell.
- “Take profit on half my confirmed fill at +50%.” Read the fill, calculate half
  the remaining lot and 1.5 times its fill-price baseline, then verify the order.
- “Put a +50% TP on my unfilled buy.” Check linked-order support; otherwise keep
  it deferred. Do not claim a live exit or unattended monitoring.
- “That request timed out; try again.” Reconcile the prior job/order before any
  new write.

Return a short receipt: status, chain, quantity, target and baseline, output token,
expiry, order ID, and actual transaction IDs when present. Explicitly label a dry
run, pending creation, partial fill or unsupported linkage. Never include API
keys, session tokens, private keys or unrelated account history in shared output.
