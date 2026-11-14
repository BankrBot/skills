# AI credit lines: the basics

An agent posts its AI credits in a line its owner opens, and borrows USDG against them inside limits the owner sets
once. Two credit markets exist: **rCREDIT** (Raeto, one rCREDIT backed by one USDG) and **CREDIT** (Orbio, one dollar of
Orbio inference, priced from its pool). `node borro.mjs read credit_markets` says which one is open now
(`new_lines_open`), its yearly borrow rate (`borrow_apr_text`), its LLTV and its defaults. On 2026-10-24 new lines were
open on both. A market whose price feed is warming up or paused says so in `paused.text`.

## Who is who

- **The owner** signs `credit_open`. It owns the line: only it can change the limits, revoke the agent, close the line
  and take everything back.
- **The agent** is the wallet that borrows. It is never the owner's own wallet (`AgentIsOwner`). It can borrow only to
  the owner or to addresses on the line's allowlist, within the daily limit.
- **Borro's keeper** is every new line's default keeper: if the line goes over its trigger, it repays from the USDG the
  line holds (`protect`).

## The limits (set at open, changed with Borro's `credit_guardrails` tool)

| Limit | Flag | Default |
| --- | --- | --- |
| Ceiling: the most USDG the line may owe | `--ceiling` | what the target allows today |
| Daily limit: USDG out in any 24 hours, borrows and the agent's withdrawals together | `--daily_limit` (or `none`) | the ceiling; $100 with a gas station |
| Target LTV | `--target_ltv` | the market's (rCREDIT 80%, CREDIT 18%) |
| Protect trigger | `--trigger_ltv` | the market's (rCREDIT 85%, CREDIT 27%) |
| Allowlist: where borrowed USDG may go | `--allow 0xA,0xB` | the owner only |
| Gas station: lets the agent turn borrowed USDG into its own ETH | `--gas_station true` | off |

A stolen agent key can take at most one day's limit.

## Commands

```bash
# Owner opens a line for its agent in rCREDIT: posts 50 rCREDIT, borrows nothing yet
node borro.mjs plan credit_open --wallet OWNER --market rCREDIT --agent AGENT --credits 50 --ceiling 30 --daily_limit 20
# Agent pays an allowlisted payee from the line
node borro.mjs plan credit_pay --wallet AGENT --account LINE --to PAYEE --amount 5
# Anyone repays; the owner can close and take every credit back
node borro.mjs plan credit_repay --wallet OWNER --account LINE --amount all
node borro.mjs plan credit_repay --wallet OWNER --account LINE --close
# The line itself
node borro.mjs read credit_line --account LINE
```

The open plan returns `line.account`, the line's address before it exists, and `line.can_borrow_at_open_usdg`.

## Risks to say before a user opens a line

- A line whose LTV passes the market's LLTV can be liquidated: its credits are seized to repay the debt.
- rCREDIT goes back to USDG only through Raeto's own redeem, which pays 98%. USDG's issuer can freeze USDG, which stops
  that exit and rCREDIT borrowing until it lifts (`lending_paused`).
- A market can carry a write-off notice (`write_off`): from its proposal on, no line borrows.

Gas stations, guardrail changes and ownership transfers are Borro MCP tools this skill does not wrap (`credit_gas`,
`credit_guardrails`): use the Borro app or call them through a connected Borro MCP server and check the answer by hand
against references/TX-VALIDATION.md.
