# Native order mapping

Use bound tool schemas as the executable contract. The names and fields below
are discovery hints, not hard-coded guarantees across deployments.

## Solana

The observed native tool family exposes `place_solana_trigger_order`,
`get_solana_trigger_orders`, and `cancel_solana_trigger_order`.
For a take profit, inspect support for:

| Intent | Observed field |
| --- | --- |
| Sell when price reaches target | `orderType: limit-sell` |
| Sell a bounded number of input tokens | `amountType: input`, `amount` |
| Exact sell mint and proceeds mint | `inputTokenAddress`, `outputTokenAddress` |
| Absolute USD price of the sold token | `triggerPrice` |
| Lifetime from creation | `validForSeconds` |
| Slippage bound | `slippageBps` |

Confirm that the sell trigger measures the sold token's USD price. Do not pass
an entry-relative gain into a current-price-relative percentage field. Convert
absolute UTC expiry immediately before submission to a positive integer duration
that does not extend the deadline; reject an expired deadline. Verify the returned
expiration and venue precision.

A September 2026 schema inspection reported a 0.5% execution fee, configurable
slippage with a 200-bps default, and no stated minimum size or SOL gas reserve.
Recheck actual fees and minimums; absence from a schema is not zero. Do not infer
sponsorship from a successful order on another chain. Preserve enough SOL for
the supported transaction path using current evidence.

That inspection exposed no automatic child orders or OCO fields. A standalone
take-profit is supported independently of linked-entry/stop coordination. Listing
and cancellation use the returned order ID; filled or expired orders cannot be
cancelled. Cancelled does not undo any earlier partial fill.

## EVM chains

Inspect `place_limit_order` and the corresponding list/cancel tools. Check the
chain enum for the requested network; do not send Solana through an EVM tool.
Use a specific sell quantity where supported. Never assume an EVM tool can only
sell the whole wallet, and never silently switch a scoped request to that mode.
Derive field names from the live schema rather than copying the Solana payload.
Verify destination asset support, expiry, order limits and account permissions.

## Calling Bankr from another host

In Bankr, use native bound tools directly. Another agent can request this workflow
through the authenticated Bankr Agent API or CLI, loading credentials from its own
secret store. `POST /agent/prompt` creates an asynchronous job; persist its ID,
then query `GET /agent/job/{jobId}`. A completed job does not alone prove an order
exists. Retrieve the trading order and verify its fields separately.

Do not assume web UI endpoints accept API-key authentication, or that a read-only
session exposes write tools. Default Agent API access may require Club membership;
Max Mode can consume inference credits when supported and authorized. Neither
membership nor credits are automatically purchased by this skill.

## Maintainer references

- [Bankr native limit orders](https://docs.bankr.bot/features/trading/limit-orders/)
- [Bankr automations](https://docs.bankr.bot/agent/automations/)
- [Bankr Agent API workflow](https://github.com/BankrBot/skills/blob/main/bankr/references/api-workflow.md)
- [Install skills inside Bankr](https://docs.bankr.bot/skills/in-bankr/from-github/)

General documentation may lag a tool family. State which live schema was checked
and preserve the relevant response privately; never publish a user's trading log
as an example fixture.
