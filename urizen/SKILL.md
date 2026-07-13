---
name: urizen
description: >
  Urizen — the first autonomous fund on Robinhood Chain — as an agent skill. Read the fund's
  live strategies and its real on-chain book, mirror its allocation to copy-trade it, follow its
  execution tape, get momentum/trend/RSI reads on the tokenized stocks it trades, and take
  one-token exposure via $URI. Public, key-less, CORS-open REST API on Robinhood Chain (4663).
  Triggers on: "urizen", "copy trade the fund", "mirror urizen", "urizen book", "urizen strategies",
  "robinhood chain fund", "tokenized stock signals", "buy $URI", "URI quote", "autonomous fund".
---

# URIZEN — the autonomous fund, as a skill

URIZEN ($URI) is the first autonomous fund on **Robinhood Chain** (chain 4663). It runs
rules-based strategies across the on-chain stock market — tokenized NVDA, the Magnificent Seven,
QQQ. Its positions and trades are **real and on-chain**, verifiable on Robinhood Chain. This skill
exposes the fund itself: its strategies, its live book, and a way for any agent to copy-trade it
or take one-token exposure via $URI.

- **Homepage:** https://urizenfund.com
- **API base:** `https://urizenfund.com/api`
- **Manifest:** https://urizenfund.com/api/skill
- **Repo:** https://github.com/CTRLabs/urizen-skill

All endpoints are **public, key-less, CORS-open**. No signup, no auth.

## What an agent can do

| Capability | Call |
|---|---|
| The fund's strategies | `GET /api/fund/strategies` |
| The fund's live book (positions + NAV) | `GET /api/fund/book` |
| **Mirror / copy-trade** (target weights) | `GET /api/fund/mirror` |
| The execution tape | `GET /api/fund/trades` |
| Reads behind the book (momentum/trend/RSI) | `GET /api/fund/signals` |
| $URI price & stats | `GET /api/fund/stats` |
| Buy quote (ready-to-sign tx) | `GET /api/fund/quote?side=buy&amount=0.01&taker=0x…` |

## Copy-trade the fund (research → execute)

URIZEN is the **research layer** — it tells you what the fund holds and in what weights. Bankr is
the **execution layer**.

```
URIZEN (read)              Bankr (execute)
──────────────            ────────────────
/api/fund/mirror     →    replicate the weights on Robinhood Chain
/api/fund/strategies →    follow the fund's mandates
/api/fund/signals    →    act on the reads behind the book
/api/fund/quote      →    one-token exposure: buy $URI
```

`GET /api/fund/mirror` returns the fund's live target weights, e.g.:

```json
{
  "navUsd": 195.2,
  "targets": [
    { "symbol": "PLTR", "weightPct": 28.0 },
    { "symbol": "NVDA", "weightPct": 23.6 },
    { "symbol": "QQQ",  "weightPct": 18.3 },
    { "symbol": "META", "weightPct": 18.1 }
  ]
}
```

An agent replicates those weights (buy the same tokenized stocks in proportion) to mirror the
fund, or simply buys **$URI** for one-token exposure to the whole book.

## Usage

```bash
# The fund's live book
curl https://urizenfund.com/api/fund/book

# Copy-trade weights
curl https://urizenfund.com/api/fund/mirror

# Reads behind the book (momentum / trend / RSI)
curl https://urizenfund.com/api/fund/signals

# A ready-to-sign buy of 0.01 ETH of $URI
curl "https://urizenfund.com/api/fund/quote?side=buy&amount=0.01&taker=0xYOURWALLET"
```

## Buy $URI

- Plain language: **`@bankrbot buy $URI`**
- App: **https://ctrl.build/urizen** (connect wallet → buy on Robinhood Chain, native ETH in, no approval)

## Token

- Symbol **$URI** · Decimals 18 · Chain **Robinhood (4663)** · WETH-paired
- Address `0x970078468807853bc316432e745165eb34398ba3`

Real, on-chain and verifiable · $URI is non-custodial (you hold your own tokens) · not investment advice.

— built by redwald
