# Market flow

How the activity of graded wallets is distributed across a market's outcomes,
rather than one trade or one wallet.

## Calls

| Need | REST | MCP tool |
| --- | --- | --- |
| Ranked sharp-money flow | `GET /api/v1/markets/sharp-money-flows` | `get_sharp_money_flows` |
| One market | `GET /api/v1/market/{condition_id}/flow` | `get_market_flow` |
| Many markets | `POST /api/v1/markets/flow/batch` | `batch_get_market_flow` |
| Graded holders of a market | `GET /api/v1/market/{condition_id}/holders` | `get_market_holders` |
| Live snapshot | `GET /api/v1/market/{condition_id}/snapshot` | `get_market_snapshot` |
| OHLC candles | `GET /api/v1/market/{condition_id}/candles` | `get_market_candles` |
| Edge Hunter board (Max) | `GET /api/v1/edge-hunter` | `get_edge_hunter` |
| Full ranked signals (Max) | `GET /api/v1/edge-hunter?view=signals` | `get_edge_hunter` (`view: "signals"`) |
| Holder cohorts (Max) | `GET /api/v1/edge-hunter?view=observations&cohort=wider_holder` | `get_edge_hunter` (`view: "observations"`, `cohort`) |
| Trades flagged for review | `GET /api/v1/suspicious-trades` | `get_suspicious_trades` |
| One flag | `GET /api/v1/suspicious-trades/{id}` | `get_suspicious_trade` |

Resolve a market name to its `condition_id` through
`GET /api/v1/markets/search` first.

Deprecated aliases answer until 2027-02-01: `/market/{condition_id}/intel` and
`/markets/intel/batch` (`get_market_intel`, `batch_get_market_intel`),
`/markets/smart-money-flows` (`get_smart_money_flows`) and `/insider-radar`
(`get_insider_radar`, `get_insider_radar_flag`). `/api/v1/sports-edge-signals`
and `/api/v1/sports-edge-observations` are already retired and return `410`;
use the Edge Hunter views instead.

## Sign convention

Market flow reports outcome-aware flow from large trades. The sign decides the
conclusion:

- `BUY YES` adds exposure
- `SELL NO` adds exposure
- `BUY NO` subtracts exposure
- `SELL YES` subtracts exposure

When flow nets to zero, the YES label is a deterministic tie-break. Reporting it
as a lean toward YES is a fabrication.

## Suspicious-trade flags

Formerly Insider Radar. The feed lists stored trades whose recorded
`suspicion_score` met the live flag floor of 60, on a 0 to 100 scale.
`mode=stable` pins a paginated walk to one published scoring generation and
returns `cursor_expired` when scores or filters change.

A flag does not establish intent, non-public knowledge, or a future outcome; it
points at something worth a human look. The 0 to 100 suspicion score is a
different quantity from the 0.0 to 1.0 `review_score` on a feed trade, so do not
convert or compare them.

## Edge Hunter

Every Edge Hunter view needs Max; a Pro credential receives `403 forbidden`
with `error.reason` set to `max_plan_required`.

- The default board is the quoted board at https://0xinsider.com/sports/edge:
  at most 30 rows, events kicking off within 48 hours, and a B grade floor.
- `view=signals` returns the full ranked records with their category-skill and
  source evidence, cursor-paged, with a 12-hour default horizon.
- `view=observations` requires `cohort=wider_holder`, `in_play` or
  `emerging_pile`. Observations are observed, not activated.

Every view takes the same selections: `kind=sports|esports`, `sports`,
`leagues`, `market_types`, `condition_ids`, `event_slugs` and `series_slugs`.
A snapshot that is not ready returns `503 read_model_warming` with
`Retry-After: 5`. A refreshed snapshot expires cursors: restart at page one on
`cursor_expired`.

## Reporting flow

Flow is what graded wallets did. It is analytics, not a forecast and not
advice. Report the direction, the size, the window, and the evidence basis.
Edge Hunter states its basis in `meta.ranking_source`,
`meta.directional_source` and the category-skill `source_coverage`
(`partial_whale_threshold_fills` or `graded_wallet_fills`). If the basis is
partial or degraded, say so in the same sentence as the number.
