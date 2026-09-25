# Wallet grades

Grades S to F and P&L for tracked Polymarket wallets, computed from settled
history.

## Calls

| Need | REST | MCP tool |
| --- | --- | --- |
| One wallet | `GET /api/v1/trader/{address}` | `get_trader` |
| Many wallets | `POST /api/v1/traders/batch` | `batch_get_traders` |
| Ranked list | `GET /api/v1/leaderboard` | `get_leaderboard` |
| Rising wallets | `GET /api/v1/leaderboard/trending` | `get_trending_wallets` |
| P&L series | `GET /api/v1/trader/{address}/pnl` | `get_trader_pnl` |
| Timeline on a market | `GET /api/v1/trader/{address}/position-timeline` | `get_position_timeline` |
| Current positions | `GET /api/v1/positions` | `get_positions` |
| Wallet as prose | `GET /api/v1/trader/{address}/context.md` | - |

Batch reads accept 25 addresses per call. One batch call replaces 25 single
calls against a 100-per-minute limit.

```bash
curl -s https://0xinsider.com/sandbox/api/v1/leaderboard
```

`context.md` returns the wallet as Markdown rather than JSON, which is the
cheaper input when the wallet goes to a language model instead of to code.

## Identity

`/api/v1/trader/{address}` is an address lookup. A username lookup takes
`@name` through `/api/v1/traders/{trader}/position-timeline`. A username sent
where an address is expected returns a lookup failure, not an empty wallet.

## Settled P&L

`pnl.realized` carries trust metadata. With `expand=trust`, a matching native
accounting snapshot marks the figure computed: native Polymarket realized P&L
plus credited maker and taker rebates, with fees included.

Without a matching snapshot, `pnl.realized` is omitted and its trust metadata
is unavailable. Report it as unavailable. Raw total P&L is never a substitute,
and substituting it produces a number that looks authoritative and is wrong.

## Coverage

Grades apply to tracked wallets with enough settled history. An ungraded wallet
is uncovered, not unskilled.

Position timelines are outcome-specific running fill totals across pages, not
complete holdings: split, merge, redemption and negative-risk activity are
excluded. Follow the cursor to the end before totaling.

"Profitable wallets" names the high-grade cohort. "Tracked wallet" means
coverage at any grade. The two are not interchangeable.

## Exports

`GET /api/v1/trader/{address}/export` starts a snapshot job. Poll
`/export/status`, then fetch `/export/download`. Do not block on the first
call, and do not re-issue the job while a poll is pending.
