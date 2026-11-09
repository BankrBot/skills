# cryptofeed402 endpoints used by this skill

Base URL `https://cryptofeed402.site`. Full spec: `/openapi.json`. Live prices: `/pricing`.
Every paid route has a free static example under `/samples` (index at `GET /samples`).

## GET /perps/{symbol} ($0.002)

Any listed Hyperliquid perp, case-insensitive. Unknown symbol: 404 before the 402, no charge.
Hyperliquid unavailable: 503, no charge.

Fields (names as in the response):

- `symbol`, `venue` (`hyperliquid`), `as_of` (upstream fetch time), `generated_at`
- `mark_px`, `oracle_px`, `mid_px`, `premium`, `premium_pct`, `change_24h_pct`
- `funding`: `rate_hourly`, `rate_8h`, `annualized_pct`, `interval_hours`, `side_paying` (`longs` or `shorts`)
- `open_interest`: `coins`, `usd`; `volume_24h_usd`; `max_leverage`; `impact_px {bid, ask}`
- `funding_extreme`: `in_top10`, `rank`, `ranked_universe`, `rule`, `top10[]` (perps with more than $1M 24h volume ranked by absolute annualized funding; same list as `/funding/extreme`)
- `venues[]`: `{venue, symbol, funding_rate, funding_interval_hours, funding_apr_pct, open_interest_usd, mark_px}`
- `source`, `disclaimer`

Not included: liquidation clusters (Hyperliquid's public API has no aggregate liquidation data).

Example shape: `GET /samples/perps`.

## GET /funding/extreme ($0.0025)

`most_extreme[]`: the 10 most extreme funding rates on Hyperliquid at fetch time (perps with
more than $1M 24h volume, ranked by absolute annualized funding). `watchlist[]`: BTC, ETH, SOL,
HYPE, NEAR, AAVE with `funding_apr_pct`. `as_of` gives the fetch time.

Example shape: `GET /samples/funding`.

## GET /sentiment/{symbol} ($0.002)

Crypto news sentiment for one asset over the last `window_minutes`.

- `score` -1..1, `label` (bearish / neutral / bullish), `counts {n_headlines, pos, neg, neu}`
- `top_headlines[]` (up to 5): `{title, source, url, stance}`. Titles and links only, no article text.
- `generated_at`, `age_seconds`, `model`, `method`, `disclaimer`

Pushed about every 15 minutes. Free index of available symbols and freshness: `GET /sentiment`.
404 (symbol not in snapshot) and 503 (stale > 75 min, or none) come before the 402, no charge.
The label describes the tone of recent headlines. It is not a forecast.

Example shape: `GET /samples/sentiment`.

## GET /price/{symbol} ($0.0025)

Watchlist coins only (BTC, ETH, SOL, HYPE, NEAR, AAVE): Hyperliquid perp mark, funding and OI,
plus OKX spot price. Example shape: `GET /samples/price`.

## GET /brief/latest ($0.015)

The latest twice-daily brief (AM and PM Pacific): watchlist prices and 24h / 7d change,
Hyperliquid extreme funding, OI, sentiment, and an economic calendar. 503 with no charge
when no fresh brief exists. Free trimmed previous edition: `GET /brief/sample`.

## Free

| Route | Purpose |
|---|---|
| `GET /samples` | Index of free example responses for every paid route |
| `GET /brief/teaser` | Current extreme funding and BTC / ETH / SOL prices |
| `GET /brief/sample` | Previous brief edition, trimmed, marked `sample: true` |
| `GET /sentiment` | Available sentiment symbols and freshness |
| `GET /pricing` | Live price list |
| `GET /.well-known/x402` | x402 discovery document |
| `GET /llms.txt` | Agent-readable docs |

Free routes are rate-limited per IP (30 to 60 requests per hour).
