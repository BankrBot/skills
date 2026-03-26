---
name: asterpay
description: EUR settlement for AI agents via SEPA Instant. Use when the user wants to convert USDC to EUR, send EUR to a European bank account, check EUR/USDC exchange rates, settle x402 payments in EUR, or off-ramp crypto earnings to fiat EUR. Supports Base network. Processes USDC → EUR conversion in under 10 seconds via SEPA Instant. MiCA-compliant via licensed European settlement partners.
metadata:
  {
    "clawdbot":
      {
        "emoji": "💶",
        "homepage": "https://asterpay.io",
      },
  }
---

# AsterPay — EUR Settlement for AI Agents

Convert USDC earnings to EUR and send to any European bank account via SEPA Instant. Settlement in under 10 seconds. Built for AI agents operating in the European market.

## Why EUR Settlement?

AI agents earn in crypto (USDC), but European merchants, service providers, and freelancers need EUR. AsterPay bridges this gap:

- **<10 second settlement** via SEPA Instant
- **MiCA-compliant** via licensed European partners
- **x402-native** — pay-per-call, no API keys needed
- **Machine-first** — designed for autonomous agents

## Quick Start

### Check EUR/USDC Rate

```bash
./scripts/check-rate.sh
```

### Convert USDC to EUR

Convert USDC to EUR and settle via SEPA Instant:

```bash
./scripts/offramp.sh <amount_usdc> <iban>
```

Example: Convert 100 USDC to EUR and send to a German bank account:
```bash
./scripts/offramp.sh 100 DE89370400440532013000
```

### Query AsterPay Data API

AsterPay provides 13 pay-per-call endpoints at $0.001 USDC each via x402:

```bash
# Get market data
./scripts/api-query.sh market-data BTC

# Get sentiment analysis
./scripts/api-query.sh sentiment ETH

# Get DeFi analytics
./scripts/api-query.sh defi-analytics AAVE
```

## How It Works

```
Agent earns USDC on Base
        │
        ▼
┌─────────────────────┐
│  AsterPay receives   │
│  USDC via x402       │
│  protocol on Base    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Licensed partner    │
│  converts USDC→EUR   │
│  (MiCA-compliant)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  SEPA Instant sends  │
│  EUR to recipient    │
│  in <10 seconds      │
└─────────────────────┘
```

## EUR Off-Ramp via Bankr

Bankr agents can use AsterPay to convert on-chain earnings to EUR. The integration uses Bankr's arbitrary transaction feature to interact with AsterPay's x402-enabled settlement API.

### Step-by-Step: Bankr Agent → EUR

```bash
# 1. Check your USDC balance
bankr prompt "What is my USDC balance on Base?"

# 2. Check current EUR rate
./scripts/check-rate.sh

# 3. Convert and send EUR
./scripts/offramp.sh 50 DE89370400440532013000

# 4. Verify settlement (typically <10 seconds)
./scripts/check-settlement.sh <transaction_id>
```

### Use Cases for Bankr Agents

| Scenario | Command |
|----------|---------|
| Agent earned swap fees, needs to pay EU hosting | `./scripts/offramp.sh 25 <hosting_provider_iban>` |
| Agent wants to pay a European freelancer | `./scripts/offramp.sh 100 <freelancer_iban>` |
| Agent needs to settle an invoice in EUR | `./scripts/offramp.sh 500 <merchant_iban>` |
| Check best conversion rate | `./scripts/check-rate.sh` |
| Query market data (pay-per-call) | `./scripts/api-query.sh market-data ETH` |

## Data API Endpoints

AsterPay provides 13 pay-per-call data endpoints via x402 protocol. Each call costs $0.001 USDC, no API keys required:

| Endpoint | Description |
|----------|-------------|
| `market-data` | Real-time price, volume, market cap |
| `sentiment` | Social sentiment analysis for any token |
| `defi-analytics` | Protocol TVL, yields, risk metrics |
| `price-history` | Historical OHLCV data |
| `whale-tracking` | Large transaction monitoring |
| `gas-tracker` | Multi-chain gas price feeds |
| `token-metrics` | On-chain token analytics |
| `liquidity-scan` | DEX liquidity depth analysis |
| `correlation` | Cross-asset correlation matrix |
| `volatility` | Historical and implied volatility |
| `funding-rates` | Perpetual futures funding rates |
| `on-chain-flow` | Exchange inflow/outflow tracking |
| `ai-summary` | AI-generated market briefing |

**Live API**: https://x402-api-production-ba87.up.railway.app/discovery/resources

## Supported Regions

EUR settlement via SEPA Instant is available in all 36 SEPA countries:

- All 27 EU member states
- EEA countries (Norway, Iceland, Liechtenstein)
- Switzerland, UK, Monaco, San Marino, Andorra, Vatican City

## Configuration

No API keys required. AsterPay uses the x402 protocol for authentication — payments are handled on-chain via USDC on Base.

| Parameter | Value |
|-----------|-------|
| Network | Base (Chain ID: 8453) |
| Payment Token | USDC |
| Settlement Currency | EUR |
| Settlement Rail | SEPA Instant |
| Settlement Time | <10 seconds |
| API Cost | $0.001 USDC per call |
| Facilitator | Coinbase CDP |

## Compliance

AsterPay operates through MiCA-licensed European settlement partners:

- **MiCA-compliant** — Full compliance with EU Markets in Crypto-Assets regulation
- **EU-native entity** — Registered in Finland, EU jurisdiction
- **Licensed partners** — Settlement through regulated European financial institutions
- **KYB/AML** — Business verification for enterprise clients

## Resources

- **Website**: https://asterpay.io
- **Live API**: https://x402-api-production-ba87.up.railway.app/discovery/resources
- **MCP Server**: `npm install @asterpay/mcp-server`
- **x402 Ecosystem**: Listed in Coinbase x402 ecosystem
- **Twitter**: @Asterpayment
- **Telegram**: t.me/asterpaycommunity

## Reference Documentation

- [EUR Settlement Flow](references/eur-settlement.md) — Detailed settlement pipeline
- [x402 Integration](references/x402-integration.md) — How x402 protocol works with AsterPay
