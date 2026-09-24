# Hyperliquid Reference

Trade perpetual futures (crypto, plus stocks and RWAs via HIP-3) and spot tokens on Hyperliquid's on-chain order book. Docs: https://docs.bankr.bot/features/hyperliquid

**Venue**: Hyperliquid L1, funded through Arbitrum · **Collateral**: USDC · **Address**: the same as your Bankr EVM wallet

> **Hyperliquid requires a Bankr-managed wallet.** Signing is refused for connected/external wallets with "Hyperliquid signing is only supported for Bankr-managed wallets" — the connected wallet's settings are left untouched.

## Unified Account

Before placing any perps or spot order, Bankr puts the wallet into Hyperliquid's **unified account** mode — a single USDC collateral pool backing both spot and perps. If the mode can't be read or the switch fails, **the order is refused** rather than placed ("Could not enable Hyperliquid unified account. No order was placed.") — treat that as a hard failure, not something to retry blindly.

| | Never-traded wallet (split spot / perps) | Unified account (after the first order) |
|---|---|---|
| Balance display | `Perps Account` block — account value, margin used, withdrawable | One shared block — `USDC Balance` and `Available USDC after holds and margin` |
| Spot → perps transfer | Moves USDC between the two accounts | Not needed — declined as a no-op, nothing is submitted |

Parse balance output for the shared block first and treat the `Perps Account` block as the legacy shape. Never script a spot-to-perps transfer as a precondition for opening a position.

> **Portfolio margin is not supported for trading.** A `portfolioMargin` account also reports one shared USDC pool on balance reads, but Bankr **refuses spot and perps orders** on it — "Portfolio margin accounts are not supported for this operation." The two shared-collateral modes read alike and behave differently on writes.

## Prompt Examples

- **Open**: "Long $100 of BTC on hyperliquid with 10x" · "Short ETH with 5x on hyperliquid" · "Long TSLA with 5x leverage on hyperliquid"
- **Limit**: "Long $100 of BTC at $60000 on hyperliquid"
- **Spot**: "Buy $50 of HYPE on hyperliquid" · "Sell 100 PURR on hyperliquid"
- **TP/SL**: "Long BTC with 10x, take profit at $70000 and stop loss at $55000" · "Long ETH with 200% ROE take profit" · "Set take profit at $70000 on 50% of my BTC position"
- **Manage**: "Show my hyperliquid positions" (positions and open orders) · "Close 50% of my ETH position" · "Set my BTC leverage to 20x" · "Add $500 margin to my BTC position" · "Change my BTC limit order price to $62000" · "Cancel all my hyperliquid orders"
- **Market data**: "What's the funding rate for SOL on hyperliquid?" · "What stocks can I trade on hyperliquid?"

The dollar amount is **margin**, not position size: $100 at 10x opens about $1,000 of notional. Bankr asks when the intended size is ambiguous.

## Order Parameters

| Parameter | Behavior |
|-----------|----------|
| Leverage | Default 1x, up to the asset's own maximum (at most 50x); a higher request is refused with the asset's cap |
| Margin mode | Isolated by default, or cross. Some assets are isolated-only |
| Order type | Market (default) fills immediately or cancels, with 0.5% default slippage (max 3%); limit orders rest until filled or cancelled |
| TP/SL on a new position | Absolute price ("TP at $70000"), ROE percent ("5% ROE SL"), or a dollar move from the current price ("SL if price rises by $2000") |
| TP/SL on an existing position | Absolute prices only, optionally on a percentage of the position; the triggers resize as the position changes |
| Leverage change | Lowering leverage on an isolated position adds the required margin automatically |
| Margin add/remove | Isolated positions only |

**Closing** always reports the position's realised PnL and ROE, derived from the price the close was quoted at — the fill price when the order filled, the limit price while it's still resting, the mid as a fallback — and sized on the amount actually filled. A **partial** fill is flagged as such rather than reported as a full close, so don't treat a close reply as proof the position is flat. Transient venue rate limits (`429`) are retried with backoff rather than surfacing as a failed order.

**Fees**: Hyperliquid's own trading fees, plus a Bankr builder fee of 0.1% on perps orders (opens, closes and TP/SL fills) and 1% on spot orders.

## Funding the Venue (Deposit / Withdraw)

Hyperliquid is a trading **venue**, not a chain, so moving USDC in and out of it is venue funding rather than bridging — and deposit and withdraw are separate operations with fixed destinations. A deposit only ever reaches Hyperliquid; a withdrawal only ever lands on **Arbitrum**. To get withdrawn funds somewhere else, follow it with an ordinary cross-chain swap ("withdraw $500 from hyperliquid, then move it to Base").

| | Deposit | Withdraw |
|---|---|---|
| Prompt | "Deposit $500 USDC to hyperliquid" · "Deposit $1000 to hyperliquid from base" | "Withdraw $500 from hyperliquid" |
| Minimum | 5 USDC | More than 1 USDC |
| Source / destination | USDC on Arbitrum, Base, Polygon or Ethereum; one chain must cover the whole amount. Arbitrum is preferred; USDC from another chain is routed through Arbitrum and arrives net of routing fees | Arbitrum only |
| Time | ~1 minute | ~3-4 minutes |
| Fee | No venue fee | Flat 1 USDC, taken out of the requested amount |

**Withdrawal fee.** Request 100, receive 99. Your **full withdrawable balance is requestable** — you don't need to leave a dollar behind for the fee — and a request of $1 or less is refused rather than netting to zero. Amounts are rounded down to the cent.

**Name the venue when you mean the venue.** Say "hyperliquid" (or "hl") rather than a bare "bridge" or "withdraw"; a generic verb with a non-Hyperliquid destination is a request for that destination, and Bankr will treat it as one.

**Trading funds itself.** An explicit trade authorizes the funding it needs, without a separate confirmation: if the shared balance is short, Bankr deposits the shortfall — first swapping or bridging owned native tokens or USD stablecoins into USDC when that's what you hold — waits for the deposit to settle, then places the unchanged trade. It never borrows, asks before selling any other holding, and respects a named source ("…using my Base USDC") and your spending limits.

## HIP-3 Assets (Stocks, RWAs)

Equities and real-world assets trade as perps on HIP-3 builder-deployed dexes, with the same prompts and unified account as crypto perps.

- A bare ticker ("NVDA") resolves to a core Hyperliquid listing if there is one, otherwise to the highest-volume HIP-3 dex listing it; use the dex-prefixed name (e.g. `xyz:NVDA`) to pick a specific dex
- Some company names are aliased — "Long spacex on hyperliquid" resolves to **SPCX**
- Discover with "What stocks can I trade on hyperliquid?" or "Search for TSLA on hyperliquid"
- Each asset has its own leverage cap

## Common Issues

| Issue | Resolution |
|-------|------------|
| "Insufficient available USDC on Hyperliquid" | Deposit, or let the trade fund itself from your EVM balances |
| "This account shares its balance across spot and perps" on a transfer | Expected on a unified or portfolio-margin account; nothing was submitted |
| "Could not read Hyperliquid account mode" / "Could not enable Hyperliquid unified account" | The account-mode check or switch failed; no order was placed |
| "Maximum leverage for X is Nx" | Lower the leverage to the asset's cap |
| "Margin adjustment is only available for isolated positions" | The position is cross margin |
| "Asset '…' not found on Hyperliquid" | Check the symbol with a search prompt |
