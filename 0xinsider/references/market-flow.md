# Market flow

How the activity of graded wallets is distributed across a market's outcomes,
rather than one trade or one wallet.

## Calls

| Need | REST | MCP tool |
| --- | --- | --- |
| Ranked sharp-money flow | `GET /api/v1/markets/sharp-money-flows` | `get_sharp_money_flows` |
| Ranked smart-money flow | `GET /api/v1/markets/smart-money-flows` | `get_smart_money_flows` |
| One market | `GET /api/v1/market/{condition_id}/intel` | `get_market_intel` |
| Many markets | `POST /api/v1/markets/intel/batch` | `batch_get_market_intel` |
| Live snapshot | `GET /api/v1/market/{condition_id}/snapshot` | `get_market_snapshot` |
| OHLC candles | `GET /api/v1/market/{condition_id}/candles` | - |
| Pre-event flow signals | `GET /api/v1/sports-edge-signals` | - |
| Observation cohorts | `GET /api/v1/sports-edge-observations` | - |
| Review flags | `GET /api/v1/insider-radar` | `get_insider_radar` |
| One flag | `GET /api/v1/insider-radar/{id}` | `get_insider_radar_flag` |

Resolve a market name to its `condition_id` through
`GET /api/v1/markets/search` first.

## Sign convention

Market intel reports outcome-aware flow from large trades. The sign decides the
conclusion:

- `BUY YES` adds exposure
- `SELL NO` adds exposure
- `BUY NO` subtracts exposure
- `SELL YES` subtracts exposure

When flow nets to zero, the YES label is a deterministic tie-break. Reporting it
as a lean toward YES is a fabrication.

## Insider Radar

Insider Radar reads stored scored trades and marks activity for review. Its
live flag floor is 60. A flag does not establish intent, non-public knowledge,
or a future outcome; it points at something worth a human look. The 0 to 100
review score is a different quantity from the 0.0 to 1.0 feed significance
score, so do not convert or compare them.

## Pre-event signals

`sports-edge-signals` returns ranked pre-event flow signals.
`sports-edge-observations` returns observation-only cohorts: observed, not
activated. Each cohort declares its coverage basis
(`partial_whale_threshold_fills` or `graded_wallet_fills`). Read it before
quoting a cohort.

## Reporting flow

Flow is what graded wallets did. It is analytics, not a forecast and not
advice. Report the direction, the size, the window, and the coverage basis. If
the basis is partial, say so in the same sentence as the number.
