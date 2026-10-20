---
name: bnkr-score-tracker
description: Track your Bankr Score and leaderboard rank — snapshot all score categories, 30-day trend, and generate a shareable SVG progress card. Use when the user asks about their Bankr Score, leaderboard rank, score progress, or wants a leaderboard card ("my bankr score", "how is my rank", "score card", "leaderboard tracking").
---

# BNKR Score Tracker

Track your **Bankr Score** (the bankr.bot/leaderboard ranking) with zero setup —
the data comes from Bankr's public leaderboard API, no API key or Bankr Club
needed. Everything is read-only.

## What it does

1. **Snapshot** — resolves any X username to its leaderboard profile and prints:
   - current Bankr Score + rank, Bankr Club / OG tier
   - every score category (BNKR staked, Builder, Deployer, Social, PnL, Partner,
     NFTs, Referral, LLM Gateway, OG) with its normalized contribution
   - the score trend over the API's history window and the delta since your last
     local snapshot, plus which category is the main engine right now
2. **History** — every snapshot is appended to `~/.bnkr-score-tracker/history.jsonl`,
   because Bankr does not expose your own historical trend except through this
   API's rolling window. Run `track` regularly (a Bankr automation or cron is ideal)
   to build a real time series.
3. **Card** — generates an SVG progress card (rank, score, top categories, trend
   sparkline) ready to share on X.

## Commands

Run the script with Python 3 (stdlib only, no dependencies):

```bash
# Full snapshot for an X username
python3 scripts/score_tracker.py track chopiou

# Top 20 for a timeframe: 24h (default) | 7d | 30d | total
python3 scripts/score_tracker.py top 30d

# SVG progress card (prints the output path)
python3 scripts/score_tracker.py card chopiou
```

## How to talk about results

- Lead with rank and score, then the ONE category that dominates (that is the
  lever the user can actually pull to climb: Builder = publish skills, Deployer =
  launch a token, BNKR = stake more, Social = post and engage).
- Be honest about tiny scores — early accounts score ~0.001–0.05 and that is
  normal; the trend matters more than the level.
- Suggest running `track` daily so the local history becomes a genuine trend line.

## Endpoints used (all public, GET, no auth)

| Endpoint | Purpose |
| --- | --- |
| `/leaderboard/search?searchQuery=<username>` | username → socialAccountId |
| `/leaderboard/users/<id>/profile` | rank, score, wallet, club/OG tier |
| `/leaderboard/users/<id>/scores?timeframe=30d` | per-category scores |
| `/leaderboard/users/<id>/score-progress` | historical score series |
| `/leaderboard/rankings?timeframe=...&limit=20&type=total` | top 20 (limit must be 20) |
