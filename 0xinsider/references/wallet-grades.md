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

`{address}` on `GET /api/v1/trader/{address}` takes a `0x` wallet address, a
known username, or a `trd_`-prefixed trader ID that the API emitted.
`/api/v1/traders/{trader}/position-timeline` also takes a bare integer ID and
`@username`, which forces a username lookup for an all-digit name.

## Sports and esports P&L

Since 2026-10-27 a wallet's figures cover its sports and esports markets only,
and its realized P&L is `pnl.in_scope.realized_pnl`. `pnl.in_scope` is omitted
until 0xinsider has computed the wallet's record: absent means not computed
yet, never zero. `realized_pnl` is null when its `basis` has no published
figure to split. Compare figures only within one `basis`, and quote `as_of`
with the number. `markets_out_of_scope` counts the wallet's other markets,
which 0xinsider no longer lists.

The wallet-wide `pnl.realized`, `pnl.total`, `pnl.net_total` and
`pnl.correction` are retired and never sent. Do not substitute any other figure
for a missing `in_scope.realized_pnl`; report it as not computed yet.

`GET /api/v1/trader/{address}/pnl` returns the daily series. Its days plus
`realized.undated_pnl` equal `pnl.in_scope.realized_pnl`.

With `expand=trust`, each field reports whether it is computed and which record
owns it. The retired wallet-wide P&L fields always read `not_computed`.

## Coverage

Grades apply to tracked wallets with enough settled history. An ungraded wallet
is uncovered, not unskilled.

Position timelines are outcome-specific running fill totals across pages, not
complete holdings: split, merge, redemption and negative-risk activity are
excluded. Follow the cursor to the end before totaling.

"Profitable wallets" names the high-grade cohort. "Tracked wallet" means
coverage at any grade. The two are not interchangeable.

## Exports

`POST /api/v1/trader/{address}/export` queues an async export of the wallet's
full dataset as `json`, `ndjson` or `csv`. Poll `/export/status` until
`terminal` is true, then fetch `/export/download` while the status is `ready`
(24 hours from submit). `GET` on the same `/export` path returns the export's
range, completeness and size estimate, not the data. Do not re-submit while a
job is pending.
