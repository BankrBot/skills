---
name: levra
description: Read a wallet's Levra margin positions on tokenized stocks (Base, Monad, X Layer), their health and the market session, and prepare a close, a collateral change or a new long or short that the user reviews and signs in the Levra app. Use when the user asks about Levra, their leveraged stock positions, liquidation risk before the market closes, or wants to open, close or add collateral on Levra.
---

# Levra

Levra is a margin account for tokenized stocks: buy a stock with leverage (long), profit when it falls (short), or lend for interest. Positions live in the user's own Morpho position; Levra never holds funds. Live on Base (8453), Monad (143) and X Layer (196).

This skill reads Levra's public API and prepares actions. It never signs and never sends a transaction: every action comes back as a link, the user opens it in the Levra app, sees a fresh quote and signs with their own wallet.

Base URL: `https://api.levra.finance`. No key. JSON in and out. Default to Base (`8453`) unless the user names another chain.

## Read

| What | Call |
|---|---|
| Live chains | `GET /v1/chains` |
| Market session (open, closed, next close) | `GET /v1/{chainId}/session` |
| Markets, prices, limits | `GET /v1/{chainId}/markets` |
| A wallet's positions and health | `GET /v1/{chainId}/accounts/{wallet}` |

```bash
curl -s https://api.levra.finance/v1/8453/accounts/0xYourWallet
curl -s https://api.levra.finance/v1/8453/session
```

How to answer:
- Units: USDC amounts are base units with 6 decimals (`"25000000"` is 25 USDC). `*E8` values are dollars with 8 decimals. `*Wad` values are fractions where `1e18` is 100%. Times are unix seconds.
- Health: each position has `ltvWad`, the soft limit that applies now (`softLtvWad`), the liquidation limit (`lltvWad`), `liqPriceE8` and `liqDistanceBps`, and `overSoftLimit`. Before the market closes the soft limit drops to the market's `softLtvClosedWad` (the closed regime), so warn when `session.nextCloseAt` is near and `ltvWad` is above it; the user can add collateral or reduce. `gapScenarios` shows the position after the stock's worst historical overnight and weekend moves.
- On X Layer a position also carries `circuit`, the check by Levra's on-chain TapeOut risk circuit; say whether it agrees (`matches`).
- An `oraclePriceE8` of `"0"` means the market has no oracle price right now: only a full close works then.

## Prepare an action

`POST /v1/{chainId}/agent/prepare` with one action. The answer has `summary` (one sentence from a real quote) and `url`. Show both, and tell the user to open the link to review and sign. The link expires at `expiresAt`.

```bash
# Close half of a position (fractionWad 5e17 = 50%), 0.5% slippage
curl -s -X POST https://api.levra.finance/v1/8453/agent/prepare \
  -H 'content-type: application/json' \
  -d '{"kind":"close","request":{"user":"0xYourWallet","marketId":"0x7934...b398","fractionWad":"500000000000000000","slippageBps":50}}'
```

| Action | `kind` | `request` |
|---|---|---|
| Open a long or short | `open` | `user`, `symbol` (for example `AAPL`), `side` (`long` or `short`), `marginRaw` (USDC, 6 decimals), `leverageE2` (200 is 2x, above 100), `slippageBps` |
| Close part or all | `close` | `user`, `marketId` (from the account or markets answer), `fractionWad` (`1000000000000000000` is all), `slippageBps` |
| Add or remove collateral, repay | `collateral` | `user`, `marketId`, `action` (`add`, `remove` or `repay`), `amountRaw` (in the collateral token's decimals; USDC for a short's collateral and for a repay) |

Use `slippageBps: 50` unless the user asks for another value. Take `marketId` from the user's position for close and collateral actions; for an open, check the symbol is in the markets list of that chain.

## When it says no

Errors come as `{"error":{"code","message"}}`. Pass the message on in plain words.
- `REGION_BLOCKED` or `TERMS_NOT_ACCEPTED` on an open: Levra checks the user's region and accepted terms, which it cannot see through an agent. Ask the user to open the position in the app at `https://app.levra.finance`. Closing, reducing and adding collateral are never gated.
- `RATE_LIMITED`: wait for the seconds in the message.
- `QUOTE_EXPIRED` on an old link: prepare it again.

## Notes
- Leverage, limits and fees are Levra's initial proposals, not tested guarantees. Do not promise a liquidation price will hold through a market gap.
- Levra also has an MCP server at `https://api.levra.finance/mcp` with the same reads and prepared actions, for MCP clients.
