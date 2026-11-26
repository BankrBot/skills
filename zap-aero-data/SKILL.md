---
name: zap-aero-data
description: Free daily Base mainnet snapshot of the top 50 Aero DEX pools (Allocation Power per gauge, 24h mean fee rate, 24h swap volume, estimated gross swap fees, TVL, and weekly AERO emission caps). Use when an agent needs current Aero pool liquidity, gauge weights, fee rates, or pool/gauge contract addresses on Base without an API key or payment. Static JSON and CSV updated daily around 06:30 UTC at docs.zap.capital/data/aero/. Informational only, not financial advice.
tags: [aero, aerodrome, base, defi, gauges, liquidity, data]
visibility: public
---

# Zap Capital: Aero Daily Fee & Allocation Data

Free, unauthenticated, read-only daily snapshot of the top 50 Aero pools on Base (`chain_id: 8453`), ranked by `allocation_pct` descending. Updated daily around `06:30 UTC` at `https://docs.zap.capital/data/aero/`.

No API key, no signup, and no payment required.

## Endpoints

| Resource | URL | Use |
|---|---|---|
| Latest snapshot (JSON) | `https://docs.zap.capital/data/aero/latest.json` | Full structured snapshot: metadata, 24h timestamp-resolved window, protocol totals, `field_sources`, top 50 `pools[]`, and caveats (`notes`). |
| Latest snapshot (CSV) | `https://docs.zap.capital/data/aero/latest.csv` | Flat tabular version, one row per pool (`rank` 1–50). |
| Archive index | `https://docs.zap.capital/data/aero/index.json` | Latest block/date summary and dated JSON/CSV archive paths (`YYYY-MM-DD.json` / `.csv`). |
| JSON Schema (2020-12) | `https://docs.zap.capital/data/aero/schema-0.2.json` | Machine-readable contract (`0.2.0`) for validating payloads. |
| Human & agent overview | `https://docs.zap.capital/data/aero/` | Field notes and methodology overview. |

Optional polite header: send `X-Zap-Agent: <agent-name>/<version>` if your runtime supports custom headers.

## Quick Fetch Examples

```bash
# Check latest snapshot timestamp, block, and protocol totals
curl -s https://docs.zap.capital/data/aero/latest.json | jq '{snapshot: .snapshot, totals: .totals}'

# Top 10 pools by Allocation Power share
curl -s https://docs.zap.capital/data/aero/latest.json | jq '.pools[:10] | map({rank, pool_name, pool_address, gauge_address, allocation_pct, fee_pct, volume_24h_usd, gross_swap_fees_24h_usd_est, tvl_usd})'

# Look up a specific pool by pair or symbol (e.g. WETH/USDC or cbBTC)
curl -s https://docs.zap.capital/data/aero/latest.json | jq '.pools[] | select(.pair | test("cbBTC"; "i"))'

# Fetch dated historical snapshot from index.json
curl -s https://docs.zap.capital/data/aero/index.json | jq '.archives'
```

## Key Fields & Caveats

- **`allocation_power` & `allocation_pct`**: Read on-chain from Base `LeafVoter` (`gaugeStates(gauge).point`); share is over all Base gauges (`totals.gauge_count`).
- **`fee_pct` vs `fee_pct_spot`**: For concentrated-liquidity (`cl`) pools, `fee_pct` is the time-weighted mean of 24 hourly `pool.fee()` samples across the exact 86,400-second window (`snapshot.window`), while `fee_pct_spot` is the fee at the snapshot block.
- **`gross_swap_fees_24h_usd_est`**: `volume_24h_usd * fee_pct / 100` — estimated gross swap fees across all LPs, **not** allocator payouts or APR.
- **`emission_cap_aero_per_week`**: FactoryRegistry weekly cap (a ceiling, not realized emissions).
- **`incentives_usd_per_week`**: Currently `null` (incentive programs are not yet parsed in v0.2.0).
- **Outlier flags (`pool.notes`)**: Pools with `fee_pct >= 1.0%` or `< $100k` 24h volume on `>= $500k` TVL carry explicit notes.
- **Scope**: Informational only, not financial advice. Aero is a third-party protocol not affiliated with Zap Capital.
