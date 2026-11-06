---
name: mangrove
description: Mangrove gives trading agents guardrails. Built-in risk management (circuit breakers, drawdown and daily loss limits, automatic risk-based position sizing, automatic stop-loss and take-profit orders) plus 100+ tools for strategy R&D across 12+ venues, over REST and MCP. Use when the user wants crypto market data or regime reads, signal search, strategy evaluation or backtesting, or a Mangrove strategy checked before it trades. Pay per call in USDC on Base via x402, or use a free Mangrove API key.
---

# Mangrove: Guardrails for Trading Agents

Mangrove gives trading agents guardrails. Every order an agent places through Mangrove goes through built-in risk management: circuit breakers, drawdown and daily loss limits, automatic risk-based position sizing, and automatically generated stop-loss and take-profit orders. Behind that sit more than 100 tools for strategy research and development, backtesting and live execution across 12+ exchange venues.

- API: `https://api.mangrovedeveloper.ai`
- OpenAPI: `https://api.mangrovedeveloper.ai/openapi.json` (each paid operation carries `x-payment-info`)
- MCP: `https://api.mangrovedeveloper.ai/mcp/`
- Docs: `https://mangrovedeveloper.ai`
- Contact: tim.darrah@mangrove.ai

## Access

Two ways in. Ask the user which they want before the first paid call.

1. **x402 (no account):** pay per call in USDC on Base (`eip155:8453`) from the Bankr wallet. Payee `0xDA913CF1D855A40560e39a1a2e0387a5f3117A2e`.
2. **API key (free):** get a key at https://mangrovedeveloper.ai and send `Authorization: Bearer $MANGROVE_API_KEY`. The user provisions the key; never ask for it in chat or write it to a file.

## Calling with x402

```bash
bankr x402 schema https://api.mangrovedeveloper.ai/api/v1/crypto-assets/global-market
bankr x402 call https://api.mangrovedeveloper.ai/api/v1/crypto-assets/global-market --max-payment 0.05
bankr x402 call https://api.mangrovedeveloper.ai/api/v1/market-data/regime/BTC --max-payment 0.05
```

The unpaid 402 response is the price. Read `accepts[0].amount` (atomic USDC, 6 decimals) from the base64 `PAYMENT-REQUIRED` header, confirm `payTo` and `network` match the values above, and tell the user the price before paying.

## Endpoints

| Method | Path | Price | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/signals/` | free | List signals |
| POST | `/api/v1/signals/search` | free | Search signals |
| GET | `/api/v1/crypto-assets/global-market` | 0.005 USDC | Global crypto market snapshot |
| GET | `/api/v1/market-data/regime/{asset}` | 0.02 USDC | Direction over 90/180/365 days plus volatility |
| POST | `/api/v1/execution/evaluate` | free for the first 30 calls per wallet per UTC day, then 0.05 USDC | Evaluate a strategy against current market data |

The live 402 header wins over any price in this file. Browse the rest of the catalog in the OpenAPI document.

## Rules

- Confirm the price with the user before every paid call and set `--max-payment` just above it. Never raise the cap silently.
- x402 payments are irreversible. Do not retry a payment whose outcome is unknown; check the response first.
- Live order execution runs inside Mangrove against the user's own Mangrove account and venue connections, with Mangrove's risk controls applied. It uses an API key, never an x402 payment from this skill. Confirm every live order with the user and never place one silently.
- Risk controls limit losses; they do not remove market risk.
