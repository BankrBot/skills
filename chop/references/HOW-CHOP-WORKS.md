# How Chop works

Chop is a fork of Peapods Finance on Robinhood Chain (4663), with $CHOP as the reward token.
Contracts call a log a "pod"/"index". The product calls it a **log**, and its token a **log token** (`chTOKEN`).

## A log

- Holds one **underlying** token (e.g. VRAX). Wrapping (`bond`) deposits the underlying and mints log tokens.
  Unwrapping (`debond`) burns log tokens and returns the underlying **pro rata at backing**, no pool price
  involved. The last holder out pays no unwrap fee.
- Has a Uniswap **V2 pool** of log token vs. its **paired** token ($CHOP, WETH or USDG). Buying and selling
  log tokens happens there.
- Has a **staking pool**. Staking the V2 LP makes you a farmer. Staked receipts are locked for
  **10 minutes** after staking (rounded up to the minute). Rewards newly earned against fresh stake mature on
  the same clock.
- Has a **rewards contract** (TokenRewards) that pays farmers in **$CHOP**.

## Fees (basis points of the amount)

| Fee set | Wrap | Unwrap | Buy | Sell | Burn share |
|---|---|---|---|---|---|
| Volatile (memes, volatile tokens) | 100 | 100 | 50 | 50 | 1500 |
| Stable (tokenized stocks, calm tokens) | 20 | 30 | 30 | 30 | 1500 |

A log can also carry a **partner fee** of 0–5% of fees (default 0), routed to a partner wallet before the swap.
Buying and selling also pay the V2 pool's 0.3% LP fee, which goes to the LPs (the farmers).

## Where each fee goes

1. **15%** is burned as log tokens straight away. Supply shrinks while the underlying stays, so **backing per
   log token rises**. This is the only yield plain holders get.
2. The remaining log-token fees accumulate in the log and are **processed** periodically: sold in the log's
   pool for the paired token and sent to the rewards contract. Anyone can trigger this with `process-fees`.
   It is rate-limited, has a minimum size, and prices the swap with a 10-minute TWAP fee oracle that the keeper
   (or anyone, via `update-oracle`) keeps fresh.
3. The rewards contract converts the paired token into **$CHOP**: directly when the pair is $CHOP, or through
   the reviewed Uniswap V4 reward route (run by the Chop keeper) for WETH/USDG pairs.
4. Of the $CHOP bought, **20% is burned** and **80% is credited to farmers** pro rata to their staked LP.
5. **0%** goes to a treasury.

Per 100 of fees: 15 burned as log tokens, 17 of $CHOP bought and burned, 68 of $CHOP to farmers.

## Yield figures the CLI reports

- `farmerAprHistorical`: cumulative $CHOP deposited for farmers, valued in the paired token at the current
  $CHOP price, divided by the pool's current value (2 × paired reserve), annualized since the log was created.
  **Backward-looking, not a forecast.** It falls when volume and volatility cool off.
- `backingApyHistorical`: growth of underlying-per-log-token since creation, annualized (shown after one day).
- Never present either as a promise. Always mention impermanent loss for farming, and that wrapping and
  unwrapping cost fees, so short round trips lose money.

## Who earns what

| Position | Earns |
|---|---|
| Hold the log token | Backing growth from the 15% burn |
| Farm (staked LP) | 68% of fees in $CHOP, plus the 0.3% pool fee, minus impermanent loss |
| Hold $CHOP | Buy pressure and supply burn from every log's fees (17% of fees bought and burned) |
| Arbitrage | Closes gaps between a log's pool price and its backing; pays fees that feed all of the above |
