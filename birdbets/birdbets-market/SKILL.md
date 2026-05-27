---
name: birdbets-market
description: Bet on BirdBets prediction markets, read odds and payout previews, acquire MYKCLAWD on Base, and summarize BirdBuddy market stats.
tags: [trading, defi, base, prediction-markets, birdbets]
version: 1
visibility: public
---

# BirdBets Market

Use this skill when the user asks about BirdBets, BirdBuddy bird visit markets, MYKCLAWD betting, tomorrow's YES/NO market, odds, payouts, or today's market stats.

BirdBets is a Base prediction market. Each market asks whether bird visits will be greater than the threshold. YES wins when `actualVisits > threshold`; NO wins when `actualVisits <= threshold`.

## Primary Sources

- Fetch machine-readable context first: `https://birdbets.mykclawd.xyz/api/bankr/context`
- Fetch canonical market data next: `https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow`
- For today's stats, use `https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Today` and `https://birdbets.mykclawd.xyz/api/birdbuddy/visits?days=7`
- For full workflow detail, read `references/workflows.md`.
- For contract constants and ABI fragments, read `references/contracts.md`.

## Betting Rules

Before placing a bet:

1. Require an explicit side: `YES` or `NO`.
2. Require an explicit MYKCLAWD amount.
3. Fetch the Tomorrow snapshot and verify `market.exists === true`, `market.resolved === false`, and `market.isOpen === true`.
4. Explain the threshold, current odds, pools, and payout preview to the user before submitting transactions.
5. Check the Bankr wallet's MYKCLAWD balance and allowance.
6. If the wallet needs MYKCLAWD, swap only enough on Base for the requested bet plus a small cushion.
7. Approve the prediction market contract to spend the bet amount if allowance is insufficient.
8. Call `betYes(marketId, amountWei)` or `betNo(marketId, amountWei)` on the prediction market contract.

Never call BirdBets oracle or admin endpoints. They are not for bettors.

## Read-Only Mode

If the Bankr API key or wallet session is read-only, provide odds, payout previews, and market stats only. Do not attempt swaps, approvals, or bets.

## Safety

- Use Base mainnet unless the context endpoint says otherwise.
- Use the prediction market and token addresses from the context endpoint.
- Do not hardcode secrets, API keys, private keys, oracle secrets, or admin secrets.
- Do not bet on a missing, resolved, or closed market.
- If the snapshot endpoint is unavailable, fall back to direct on-chain reads using `references/contracts.md`.
