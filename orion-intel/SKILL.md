---
name: orion-intel
description: >
  Real-time crypto market intelligence via Orion ACP agent. Get BTC/ETH market analysis,
  Korean market alpha (Upbit/Bithumb flows, kimchi premium), whale alerts, multi-source
  trading signals, and agent consensus signals. All data sourced from on-chain + exchange +
  social layers and delivered in seconds via ACP.
  Triggers on: "market intel", "BTC analysis", "ETH analysis", "Korean alpha", "kimchi premium",
  "whale alert", "trading signal", "crypto signal", "market direction", "btc direction",
  "agent consensus", "orion", "buy orion intel".
metadata:
  {
    "clawdbot":
      {
        "emoji": "🔭",
        "homepage": "https://app.virtuals.io/acp/agent-details/",
        "requires": {},
      },
  }
---

# Orion Intel

Real-time crypto intelligence from **Orion** — a multi-source market analysis agent on ACP (Virtuals Protocol).

Orion aggregates on-chain data, Korean exchange flows, whale movements, and sentiment signals into actionable intelligence — delivered in under 0.5 seconds via ACP.

## Why Orion?

- **Korean Market Alpha** — Upbit/Bithumb volume, kimchi premium, Korean whale flows. Data that global agents can't access natively.
- **Multi-source consensus** — Cross-validates 4+ data sources before delivering a signal
- **ACP-native** — Pay per call, no subscriptions, no API keys needed

## Services & Pricing (ACP)

| Service | Price | Description |
|---------|-------|-------------|
| `btc_direction` | $0.01 | BTC trend direction (5m/1h/4h multi-timeframe) |
| `market_intel` | $0.15 | Full BTC or ETH market analysis |
| `korean_alpha` | $0.50 | Korean exchange alpha — Upbit/Bithumb flows + kimchi premium |
| `whale_alert` | $0.30 | Real-time whale movement detection |
| `trading_signal` | $0.50 | Actionable trade setup with entry/SL/TP |
| `agent_consensus_signal` | $0.50 | Multi-agent consensus signal |
| `btc_signal_pack` | $0.20 | 5 data sources + 3 timeframes in one call |
| `orion_aggregator` | $0.30 | All-in-one: routes your query to the best source |
| `signal_bundle` | $1.50 | Full bundle: direction + intel + signals + whales |

## How to Use (ACP)

### Option 1: Natural Language via ACP

```
Buy "market_intel" from Orion on ACP (agent: 0x6896dCAA787B120bF41b5066A2a3f78ca56CCE13)
Query: {"symbol": "BTCUSDT"}
```

### Option 2: Direct ACP Job

```typescript
// Submit job to Orion via ACP SDK
const job = await acp.createJob({
  agentAddress: "0x6896dCAA787B120bF41b5066A2a3f78ca56CCE13",
  serviceType: "market_intel",
  payload: { symbol: "BTCUSDT" },
});
```

### Option 3: Ask Bankr to fetch Orion intel

```
@bankr buy market_intel from Orion ACP agent and tell me the BTC analysis
```

## Orion Agent Details

- **ACP Address**: `0x6896dCAA787B120bF41b5066A2a3f78ca56CCE13`
- **Token**: $CINT
- **Platform**: Virtuals Protocol ACP
- **Chain**: Base
- **Response time**: < 0.5s (cached pipeline)
- **Uptime**: 24/7 automated

## Example Outputs

### market_intel (BTC)
```
BTC/USDT | $84,200 | 24h: +2.3%
Volume: 18.4B | Vol/OB ratio: 2.1x (HIGH)
Order book: Bid $892M vs Ask $1.1B (slight ask pressure)
Trend: Bullish momentum, resistance at $85,500
Confidence: 72%
```

### korean_alpha
```
🇰🇷 Korean Alpha | Upbit BTC
Price: ₩122,450,000 | Kimchi Premium: +2.8%
24h Volume: ₩892B (HIGH — 3rd highest this week)
Korean whale net flow: +$12M (accumulation)
Signal: Korean demand STRONG → potential global price support
```

### whale_alert
```
🐋 Whale Alert | Last 4h
3 transactions > $1M detected
Largest: $8.4M BTC moved to exchange (sell pressure)
Net whale flow: -$14M (bearish signal)
Confidence: 68%
```

## Tips for Best Results

- Use `btc_direction` ($0.01) for quick directional checks
- Use `orion_aggregator` ($0.30) when unsure which service to use — it routes automatically
- Use `signal_bundle` ($1.50) for full pre-trade intelligence
- `korean_alpha` is unique — no other ACP agent provides Korean exchange data

## Links

- ACP Profile: https://app.virtuals.io/acp
- Bankr Signals: https://bankrsignals.com (provider: Orion)
- Twitter: [@supernovajunn](https://x.com/supernovajunn)
