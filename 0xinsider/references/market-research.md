# Market research

Finding Polymarket markets, what has been published about them, periodic
report snapshots, the daily pick, and what the API covers.

## Search and explore

| Need | REST | MCP tool |
| --- | --- | --- |
| Find a market | `GET /api/v1/markets/search` | `search_markets` |
| Browse by category | `GET /api/v1/markets/explore` | `explore_markets` |
| Find published research | `GET /api/v1/content/search` | `search_content` |

```bash
curl -s 'https://0xinsider.com/sandbox/api/v1/markets/search?q=super%20bowl'
```

`markets/search` returns the `condition_id` that flow, holder, snapshot and
candle calls require.

`content/search` covers published research and learn guides, with canonical
links and freshness metadata. Cite the canonical link, and check freshness
before describing a finding as current.

## Reports

| Granularity | REST | MCP tool |
| --- | --- | --- |
| Selector | `GET /api/v1/reports` | `get_report` |
| Daily | `GET /api/v1/reports/daily` | `get_daily_report_snapshot` |
| Weekly | `GET /api/v1/reports/weekly` | `get_weekly_report_snapshot` |
| Monthly | `GET /api/v1/reports/monthly` | `get_monthly_report_snapshot` |

A snapshot is the state at its stated timestamp, not a live read. Quote the
timestamp with the numbers.

## Daily pick

| Need | REST | MCP tool |
| --- | --- | --- |
| Today's pick | `GET /api/v1/pick-of-the-day` | `get_pick_of_the_day` |
| Past picks | `GET /api/v1/pick-of-the-day/archive` | `get_pick_of_the_day_archive` |
| One ledger entry | `GET /api/v1/pick-of-the-day/ledger/{pick_id}` | `get_pick_of_the_day_ledger_entry` |

Picks are published on a public record, win or lose. Each archived pick carries
its `outcome` (`pending`, `win`, `loss` or `void`); report a past pick with that
result, not the side alone.

## Coverage

`GET /api/v1/coverage` (`get_coverage`) needs no credential and declares which
data surfaces the API serves for Polymarket. Coverage is sports and esports
markets only: a market outside them answers `404 not_found` with
`error.reason` set to `market_out_of_scope`. Check it before assuming a sport,
a market type, or a field is covered. An absent capability is an absence of
coverage, not a zero. `/api/v1/platforms` (`get_platforms`) is its deprecated
alias until 2027-02-01.
