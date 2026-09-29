# Leverage Trading Reference

Long or short with leverage on **Hyperliquid** (primary) or **Avantis** on Base. For spot ownership of tokenized stocks rather than leveraged exposure, see [tokenized-stocks.md](tokenized-stocks.md).

| | Hyperliquid | Avantis |
|---|---|---|
| Where | Hyperliquid L1 order book | Base |
| Collateral | USDC on the venue (deposited from EVM chains) | USDC in your Base wallet |
| Markets | Crypto perps, stocks and RWAs via HIP-3, spot tokens | Crypto, equities, forex and commodities |
| Leverage | 1x default, up to each asset's cap (at most 50x) | 1x default, up to 75x within each pair's own limit |
| Full reference | [hyperliquid.md](hyperliquid.md) · https://docs.bankr.bot/features/hyperliquid | Below · https://docs.bankr.bot/features/leveraged-trading |

Name the venue in the prompt ("on hyperliquid", "on avantis"). A broad "show my positions" covers Avantis, Hyperliquid and Polymarket together.

## Avantis

**Prompt examples**
- "Long TSLA with 5x leverage on avantis" · "Short $50 of NVDA on avantis"
- "Buy $10 of GOLD with 5x leverage on avantis" · "5x long EUR/USD on avantis with stop loss at 1.08"
- "Long ETH 5x on avantis with $100, stop loss at $3000 and 200% take profit"
- "Set my stop loss to $2900 on my Avantis ETH long"
- "Show my Avantis positions" · "Close my ETH long on avantis" · "Close all my Avantis positions"

**Markets** come from Avantis' live pair list — ask "What can I trade on Avantis?" or "Search Avantis for silver". GOLD, SILVER and OIL map to XAU, XAG and USOILSPOT. Equity, forex and commodity pairs trade only while their underlying market is open; an order on a closed pair fails with "Market for this pair is closed. Please try again later." Crypto pairs trade around the clock.

**Sizing.** The dollar amount is collateral; position size is collateral × leverage, and each pair has a minimum position size, so a small position may need more collateral or leverage. Slippage must stay below 0.8%. USDC approval for Avantis is handled automatically.

**TP/SL.** On a new position, give an absolute price, an ROE percent ("200% take profit") or a price move ("stop loss if price drops by $5000"). A stop loss at or past the liquidation price, or a take profit on the wrong side of entry, is refused before anything is sent. On an open position, changing TP/SL is a signed request to Avantis: the reply shows the levels Avantis actually stored (it may cap a take profit at the pair's maximum gain), or says the change isn't visible yet — check the position before relying on it. Connected wallets change TP/SL in the Avantis app.

**Pricing.** Opens are priced from Avantis' own feed and fail if the feed is unavailable. **Closing never depends on the price feed** — a close is a market close and still goes through when pricing is down; only the PnL card is less detailed.

## Common Issues (Avantis)

| Issue | Resolution |
|-------|------------|
| "Market for this pair is closed" | Wait for the underlying market to open |
| "Position size … is below the minimum" | Increase collateral or leverage |
| "Insufficient USDC balance" | Hold USDC on Base; an explicit trade lets Bankr swap owned native tokens or stablecoins into it first |
| "Avantis is currently experiencing issues and trading pairs are unavailable" | Avantis' API is down; retry later — closes still work |
| "Asset '…' not found" | Search the pair list for the right name |
