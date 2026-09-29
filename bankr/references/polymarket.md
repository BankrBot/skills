# Polymarket Reference

Search prediction markets, check odds, place and sell bets, and redeem winnings on Polymarket (Polygon). Docs: https://docs.bankr.bot/features/polymarket

## Prompt Examples

- **Search**: "Search Polymarket for election markets" · "What prediction markets are trending?"
- **Odds**: "What are the odds the Eagles win this weekend?" · "Polymarket odds for a Fed rate cut"
- **Bet**: "Bet $10 on Yes for [market]" · "Put $5 on the Eagles to win tonight"
- **Sell**: "Sell my Yes shares on [market]"
- **Positions**: "Show my Polymarket positions" · "How did my bets go?"
- **Redeem**: "Redeem my Polymarket winnings"

A share's price is the market's implied probability ($0.60 ≈ 60%); a winning share redeems for $1. Bets are placed in dollars, and "bet on [team] to win" means the moneyline market. When a request matches several markets or outcomes, Bankr asks which one.

## Placing a Bet

- **Collateral** is Polymarket's pUSD or USDC.e on Polygon — both count, and USDC.e is wrapped automatically. Bankr quotes balances in dollars rather than token names.
- **Funding**: an explicit bet authorizes the funding it needs, without a separate confirmation. If collateral is short, Bankr swaps or bridges owned native tokens or USD stablecoins from any supported chain into Polygon collateral, verifies arrival, then places the bet. It never borrows, asks before selling any other holding, and respects a named source and your spending limits.
- When spendable collateral is within 10% of the bet, the bet can be placed for the available amount rather than the exact figure — read the confirmed size in the reply.
- A market that has already resolved is refused: "This market has already resolved, so it can no longer be bet on."
- Polymarket requires the Bankr wallet — connected (external) wallets can't bet, sell, redeem or sweep.

## Deposit Wallet

Bets settle through a Polymarket **deposit wallet** tied to your Bankr wallet: Bankr tops it up on Polygon when you bet and sweeps proceeds back after a sell. **It only works on Polygon — never send funds to it directly, and never on another chain**: funds sent there on Base, Ethereum or any other chain are stranded for good.

A non-zero balance left in it is unspent collateral — not a position and not winnings. The positions view **reports that balance whenever it's non-zero**, including when you have no positions at all. Bet with it, or recover it:

```
"sweep my polymarket deposit wallet"
```

This matters because "$0.00 claimable" is a truthful answer that can still hide money — the collateral isn't redeemable, because it was never staked. If a balance looks unaccounted for, check here before concluding the funds are gone.

## Positions and Redemption

"Show my Polymarket positions" lists open bets, claimable winnings, and losing bets resolved in the last 48 hours. Older resolved losses (a lost market settles at $0) are hidden and only counted — ask explicitly to see them:

```
"show all my losing polymarket bets"
```

Redeeming only claims positions worth more than $0 — resolved losers have nothing to claim, so they're skipped rather than reported as failed redemptions.

Positions are read through the agent (`/agent/prompt` or `bankr agent prompt`); there is no API-key REST endpoint for them.

## Common Issues

| Issue | Resolution |
|-------|------------|
| Market not found | Try different search terms, or give the Polymarket URL |
| "Insufficient Polymarket collateral" | Nothing eligible covered the shortfall; fund the wallet or name a source to swap from |
| Low liquidity / slippage | Large bets on thin markets fill at worse prices |
| "… not supported when trusted-recipient restrictions are configured" | The API key carries a recipient allowlist. Polymarket trades pay an exchange contract that can't be validated against it, so buys and sells are refused outright — see [safety.md](safety.md). Use a key without an allowlist for this workflow |
