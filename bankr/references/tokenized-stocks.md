# Tokenized Stocks Reference

Trade tokenized stocks and ETFs — real-world equities issued as on-chain tokens — with a plain prompt, like any other asset.

## Venues

| Venue | What you get | Examples | Location verification |
|-------|--------------|----------|-----------------------|
| Robinhood Chain | Spot tokens issued by Robinhood — 190+ stocks and ETFs | NVDA, AAPL, TSLA, SPY, QQQ | **Required** |
| Base — B20 equities | Spot equity tokens issued by Coinbase (13 names) | NVDA, AAPL, GOOGL, META, COIN | **Required** |
| Solana | Spot tokens from third-party issuers (e.g. xStocks) | AAPLx, TSLAx | Not required |
| Base — third-party issuers | Spot tokens from other issuers | varies by listing | Not required |
| Avantis (Base) | Leveraged equity perpetuals (long/short) | NVDA, TSLA, HOOD, META | Not required |

Stock perpetuals are also available on Hyperliquid (HIP-3) — see [leverage-trading.md](leverage-trading.md) and [hyperliquid.md](hyperliquid.md).

```
"buy $100 of NVDA on robinhood"
"buy $100 of NVDA on base"
"buy $50 of AAPLx on solana"
"long TSLA with 5x leverage on avantis"
"short HOOD on hyperliquid"
```

**Tickers collide across chains.** All thirteen B20 tickers also exist on Robinhood Chain, and a bare ticker resolves to the Robinhood Chain listing first. Say "on base" (or use the B20's c-suffixed symbol, below) when you mean the Base token.

## Robinhood Chain (spot)

Large caps (NVDA, AAPL, MSFT, AMZN), ETFs (SPY, QQQ, SOXX) and pre-IPO names.

```
"swap $50 of ETH to SPY on robinhood"
"sell half my AAPL on robinhood"
"send $30 of AAPL to @friend on X"
"DCA $50 into SPY every friday"
"TWAP: buy $500 of NVDA on robinhood over the next 2 hours"
```

Trades settle against **USDG (Global Dollar)**, Robinhood Chain's stablecoin; Bankr routes through it, so a purchase can be funded from ETH, USDG or any token on the chain in one command. Stocks have no AMM pool of their own — they fill through market makers quoting against USDG — while ordinary Robinhood Chain pairs keep their thin-pool protection. DCA and TWAP orders work on Robinhood Chain stocks. Limit and stop orders (trailing included) don't: a stock has no AMM pool to watch, so the agent declines them and offers a DCA or TWAP instead. Other Robinhood Chain tokens support all four. Stock fills go through market makers, so a DCA or TWAP run outside market hours fails and retries.

## Base B20 equities (spot)

**AAPL, AMZN, COIN, CRCL, GOOGL, INTC, META, MSFT, MSTR, NVDA, SNDK, SPCX, TSLA**

```
"buy $100 of NVDA on base"
"swap $50 of USDC to GOOGL on base"
```

- **Two spellings, one token.** A B20's on-chain `symbol()` is c-suffixed (`AAPLc`, `NVDAc`, …) — the spelling on explorers and DEX front-ends. Both it and the bare ticker resolve; the c-suffixed form pins the Base token and keeps the lookup away from memecoins on near-identical tickers.
- B20 is an ERC-20 extension: price = the underlying equity × an on-chain multiplier that moves on corporate actions (splits, dividends), so Bankr prices B20s off the equity, even before any Base liquidity exists. Issuer policy can block transfers.
- B20s have **8 decimals** (Robinhood stocks have 18) — mind this when reading raw API amounts.

## Location verification

Robinhood Chain stocks and Base B20 equities are **not available in the US, the UK, sanctioned countries or regions, or anywhere local law prohibits them.** One check covers both venues.

1. Log in to the [Bankr console](https://bankr.bot). Location is verified automatically from your connection — no forms, nothing to upload.
2. Once verified, trade from any platform — X, Telegram, the console or the API.
3. Verification expires after 30 days; logging in again renews it.

An unverified (or lapsed) trade is blocked and Bankr asks you to log in first. Only trading these stocks is gated — swaps and orders, on either leg. Holding and transferring them, memecoins on Robinhood Chain, other Base tokens and bridging need no verification. Over the Wallet API, a gated stock swap returns `403` with instructions; quotes are not gated, so a successful quote is not clearance.

## Solana and third-party issuers on Base (spot)

Third-party tokenized stocks — xStocks (AAPLx, TSLAx, …) on Solana — trade like any other token, with no verification: swaps plus, on Solana, limit and stop orders (DCA and TWAP are EVM-only). Liquidity lives in ordinary AMM pools and varies by listing, so thin markets show up in the quote. Ask Bankr for the token's details first if you're unsure you have the canonical issuer's contract.

## Leveraged stocks (perps)

For long/short exposure without owning the token, use **Avantis** (Base) or **Hyperliquid**. Avantis lists NVDA, TSLA, AAPL, AMZN, MSFT, META, COIN, HOOD and more alongside crypto, forex and commodities; its equity pairs trade only during the underlying market's hours, so orders placed while the market is closed fail. No location verification. See [leverage-trading.md](leverage-trading.md).
