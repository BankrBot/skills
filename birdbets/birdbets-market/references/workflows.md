# BirdBets Workflows

These workflows assume a Bankr wallet on Base mainnet.

## Get Context

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/bankr/context
```

Use this response for chain ID, market contract address, MYKCLAWD token address, token decimals, endpoint URLs, and the current Today/Tomorrow market IDs.

If the context endpoint returns no `contracts.predictionMarket`, stop and explain that BirdBets has not published a prediction market address.

## Read Tomorrow Odds And Payouts

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow
```

To preview a bet, include `side` and `stake`:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow&side=YES&stake=10
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Tomorrow&side=NO&stake=10
```

Report:

- `market.threshold`
- `market.isOpen`
- `market.yesPoolFormatted`, `market.noPoolFormatted`, and `market.totalPoolFormatted`
- `odds.yesPercent` and `odds.noPercent`
- `payoutPreview.estimatedPayoutFormatted`, `estimatedProfitFormatted`, and `estimatedProfitPercent` when present
- `market.bettingClosesAtIso`

If `odds.historyUnavailableReason` is present, explain that historical odds are unavailable but current on-chain odds may still be valid.

## Bet YES Or NO On Tomorrow

Inputs required from the user:

- Side: `YES` or `NO`
- Amount: human-readable MYKCLAWD, for example `10`

Workflow:

1. Fetch context.
2. Fetch Tomorrow snapshot with `side` and `stake`.
3. Confirm `market.exists`, `!market.resolved`, and `market.isOpen`.
4. Convert amount to wei using `bettingToken.decimals`.
5. Check Bankr wallet MYKCLAWD balance with ERC-20 `balanceOf(wallet)`.
6. If balance is below the amount, acquire MYKCLAWD on Base using Bankr swap tooling. Swap only enough for the requested bet plus a small cushion for rounding/slippage.
7. Check allowance with ERC-20 `allowance(wallet, predictionMarket)`.
8. If allowance is below the amount, submit `approve(predictionMarket, amountWei)`.
9. Submit the market transaction:
   - YES: `betYes(marketId, amountWei)`
   - NO: `betNo(marketId, amountWei)`
10. Return the transaction hash and summarize the resulting side, amount, market date, and threshold.

Do not place a bet if the user has not explicitly chosen side and amount.

## Acquire MYKCLAWD

Use Bankr's swap capability on Base. Prefer swapping from the wallet's most liquid available Base asset into MYKCLAWD.

Before swapping:

- Fetch context for the MYKCLAWD address.
- Check whether the wallet already has enough MYKCLAWD.
- Avoid swapping more than needed for the intended bet plus a small cushion.

After swapping:

- Re-check `balanceOf(wallet)`.
- Continue to approval and betting only if the requested amount is available.

## Get Today's Market Stats

Fetch:

```text
GET https://birdbets.mykclawd.xyz/api/markets/snapshot?market=Today
GET https://birdbets.mykclawd.xyz/api/birdbuddy/visits?days=7
```

Summarize:

- Today's market ID and date
- Threshold and current bird visit count
- Whether YES is currently ahead based on current visits
- Current YES/NO odds and pools
- Recent visit history
- Whether betting is open, closed, or resolved

Remember: the live BirdBuddy count may lag actual feeder activity.

## Fallback If Snapshot Fails

If `/api/markets/snapshot` fails:

1. Fetch `/api/bankr/context`.
2. Compute the market ID from the context response if present, or use `YYYYMMDD` in the BirdBets timezone.
3. Read the prediction market contract directly:
   - `markets(marketId)`
   - `oddsBps(marketId)`
4. For payout preview, use post-bet pools:
   - `sidePoolAfter = sidePoolBefore + stake`
   - `totalPoolAfter = yesPool + noPool + stake`
   - `estimatedPayout = stake * totalPoolAfter / sidePoolAfter`

If direct chain reads fail too, stop and explain that market state is unavailable.
