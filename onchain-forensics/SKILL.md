---
name: onchain-forensics
description: "Pre-trade token and wallet risk checks for AI agents. Returns a letter grade (A-F), an activity score, and the on-chain reason behind it, computed from live transfer flow, liquidity, holder concentration and mint activity. Use when: the agent is about to buy, sell, swap, snipe or LP into a token and needs a safety check first; a user asks 'is this token safe / alive / a rug / wash traded'; checking whether a memecoin has real flow or is dead; verifying a wallet actually holds what it claims; screening a list of tokens before a batch trade; checking mint activity or supply changes on a token; checking settlement safety of an RWA or tokenized-asset token. Covers Base and Ethereum. NOT for: price prediction, technical analysis, chart patterns, portfolio tracking, or executing the trade itself."
metadata:
  openclaw:
    requires:
      env:
        - FORENSICS_DEV_KEY
      bins:
        - node
        - npx
      install: "npx -y github:leohoudinisanders-byte/forensics-mcp"
    primaryEnv: FORENSICS_DEV_KEY
    envFileDiscovery: true
    notes: "FORENSICS_DEV_KEY is optional. Without it every call pays per request in USDC over x402, which a Bankr agent wallet can settle automatically. With a free developer key (10,000 cached checks per month, no card) the cached verdict route is free."
---

# On-chain Forensics — check the token before you touch it

One question, one answer: **should this token be touched at all?** Returns a letter grade, an activity score, and the on-chain evidence in plain words. Base and Ethereum.

- **Site:** https://onchainforensics.dev
- **API origin:** https://solene-fa2010da.base44.app/functions
- **Free sample responses:** https://onchainforensics.dev/samples.html
- **Grades for 500 tokens:** https://onchainforensics.dev/t/

## Why an agent should call this before a swap

A trading agent's expensive mistakes are not bad entries, they are bad tokens: no exit liquidity, wash-traded volume, a mint authority that can print, holders that are three wallets. This is the check that runs **before** the swap, in about 400ms on the cached path, for a penny.

It does not predict price. It tells you whether the market around the token is real.

## The grade

| Grade | Score | Meaning | What an agent should do |
| --- | --- | --- | --- |
| **A** | 80-100 | Real flow, broad distribution | Safe to size normally |
| **B** | 65-79 | Real but thinner | Halve the size |
| **C** | 45-64 | Mixed signals | Small probe only, wide stop |
| **D** | 25-44 | Thin, quiet, few wallets | Skip, or treat as a lottery ticket |
| **F** | 0-24 | Almost no flow, or dangerous | Do not touch |

The score is `activity_score_0_100`. Grades also carry a `grade_label` (e.g. `LIVE AND BROAD`) and a `verdict_tier` (e.g. `RED_HOT`). Reads are reported honestly: `activity_status` and the `logs_coverage` block say whether the window was fully scanned (`exact`, `truncated`, `logs_batches_failed`), so a failed chain read shows up as a coverage flag rather than a fake zero.

## Quick peek, no wallet needed

The first cached verdict from a new caller each day is free.

```bash
curl -s "https://solene-fa2010da.base44.app/functions/verdictFast?address=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&chain=base"
```

Response (abridged, a real payload):

```json
{
  "sample": true,
  "paid": "$0.00 (free sample, one per caller per day)",
  "cache": { "hit": true, "age_seconds": 9605 },
  "data": {
    "token_symbol": "USDC",
    "chain": "base-mainnet",
    "grade": "A",
    "grade_label": "LIVE AND BROAD",
    "activity_score_0_100": 88,
    "verdict_tier": "RED_HOT",
    "transfers_recent": 1234,
    "unique_wallets_recent": 764,
    "activity_status": "OK",
    "plain_take": "USD Coin (USDC) moved 1,234 transfers across 764 unique wallets in the last 33 minutes...",
    "next_calls": [
      { "route": "settlesafe", "price_usd": 0.02, "ask": "Can I settle against this token right now without eating a honeypot or a pause?" },
      { "route": "mints", "price_usd": 0.02, "ask": "Who is adding supply in this window, and how much?" }
    ]
  }
}
```

## Free developer key (10,000 checks per month)

No card, no signature. One key per email, works on the cached verdict route.

```bash
# 1. mint a key (returned fxk_... exactly once)
curl -s -X POST "https://solene-fa2010da.base44.app/functions/devKeys" \
  -H "content-type: application/json" -d '{"email":"you@example.com"}'

# 2. use it
curl -s "https://solene-fa2010da.base44.app/functions/verdictFast?address=0x...&chain=base" \
  -H "X-Dev-Key: fxk_..."
```

Remaining quota comes back in `X-Dev-Quota-Remaining`. Cache misses do not burn quota. An exhausted key returns `429` with the prepaid upgrade path.

## Paid routes (x402, USDC on Base)

Every route answers a bare GET or POST with a standard x402 `402` challenge that carries price, USDC asset, `payTo` and `network: eip155:8453`. A Bankr agent wallet settles it automatically.

| Route | Price | The question it answers |
| --- | --- | --- |
| `verdictFast` | $0.001 | Is this token alive and how risky? (cached, ~400ms) |
| `forensicsVerdict` | $0.02 | Same question, live chain read |
| `forensicsSettlesafe` | $0.02 | Can I settle against this token, or is it a honeypot/paused? |
| `forensicsMints` | $0.02 | Who is adding supply in this window, and how much? |
| `forensicsWallet` | $0.05 | Does this wallet actually hold what it claims? |
| `forensicsToken` | $0.05 | Full token profile: supply, holders, concentration |
| `forensicsCanton` / `forensicsLinea` / `forensicsDerivs` / `forensicsOptions` | $0.05 | Chain and instrument specific reads |
| `forensicsMemo` / `forensicsSweep` | $0.25 | Deep diligence memo / portfolio sweep across many tokens |
| `verdictBatch` | $1 / 25 tokens, $3 / 100, $6 / 250, $10 / 500 | Screen a whole list before a batch trade |
| `forensicsCredits` | $1 to $250 prepaid packs | Keys that spend without a per-call signature |
| `alertsSubscribe` | $29 / 30 days, $75 / 90 days | Watchlist alerts when a grade changes |

Pay per call:

```bash
npx awal x402 pay "https://solene-fa2010da.base44.app/functions/forensicsVerdict?address=0x4200000000000000000000000000000000000006&chain=base"
```

Cheapest path to a decision, three calls for $0.06: verdict, settlement safety, mint activity. The gateway at `/functions/forensicsGateway` returns the full route menu and starter bundle for free.

## As an MCP server

```bash
npx -y github:leohoudinisanders-byte/forensics-mcp
```

Six tools: `token_verdict`, `token_mints`, `settlesafe_check`, `token_profile`, `wallet_profile`, `forensics_catalog`. Set `FORENSICS_DEV_KEY` to run on the free tier. When a free allowance is spent, the tool returns the decoded x402 challenge instead of an error, so a paying agent proceeds and a non-paying one still learns the exact price.

## Patterns that work

**Before every memecoin buy:**
```
verdict -> if grade D or F, do not buy, and say why in one line
        -> if grade A or B, check mints for a supply print in the last 24h
```

**Before a batch or rotation:**
```
verdictBatch on the shortlist ($1 for 25) -> trade only the A and B names
```

**Before trusting a wallet's claim of holdings:**
```
forensicsWallet -> compare claimed vs actually held
```

**RWA / tokenized asset safety:**
```
forensicsSettlesafe -> KNOWN_CANONICAL pass, or a failure with the reason
```

## Honest limits

- Not a price prediction. No chart analysis, no entry or exit signals.
- Scores measure market **quality** (flow, liquidity, distribution), not future return.
- Live routes take seconds; the cached route is roughly 0.4s. Fine before a trade, not inside a per-swap hook.
- Coverage today is roughly 683 cached tokens across Base and Ethereum. An uncached token triggers a live read at the higher price.
