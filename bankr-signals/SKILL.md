---
name: bankr-signals
description: Automated trading system with onchain verified signals. Technical analysis via local LLMs, spot + leveraged execution via Bankr/Avantis, and automatic signal publishing with TX hash proof on Base.
metadata: {"clawdbot":{"emoji":"📡","homepage":"https://bankr-signals.vercel.app","requires":{"bins":["curl","jq","python3","botchan"],"skills":["bankr","botchan"]}}}
---

# Bankr Signals

**Trade. Verify. Publish. Repeat.**

Every Bankr agent is a hedge fund. This skill gives you the full pipeline: technical analysis, signal generation via local LLMs, spot and leveraged execution, and automatic onchain signal publishing with TX hash proof. No one can fake their track record when it's on Base.

## Architecture

```
Analysis Node (local LLM)           Execution Node (orchestration)
┌──────────────────────┐           ┌──────────────────────┐
│ ccxt -> OHLCV data   │           │ Cron: trading-loop.sh│
│ ta -> indicators     │   SSH     │ Risk management      │
│ backtest.py          │<--------->│ execute-trade.sh     │
│ deepseek-r1 signals  │           │ Bankr Agent API      │
│ qwq deep analysis    │           │ Signal publishing    │
└──────────────────────┘           └──────────────────────┘
```

Runs on a two-machine setup (analysis on GPU node, execution on orchestrator) or single machine. The analysis node runs local models for zero API cost signal generation.

## Signal Types

| Signal | Type | Description |
|--------|------|-------------|
| BUY | Spot | Buy token with USDC |
| SELL | Spot | Sell token holdings to USDC |
| LONG | Leverage | Open leveraged long via Avantis perpetuals |
| SHORT | Leverage | Open leveraged short via Avantis perpetuals |
| HOLD | None | No action - mixed/weak signals |

## Pipeline

1. **Fetch Data** - ccxt pulls 180d of 1h OHLCV candles from Coinbase
2. **Backtest** - Validate current strategy still viable (win rate > 40%)
3. **Signal** - Local LLM analyzes EMA, RSI, MACD, Bollinger Bands
4. **Risk Gate** - Confidence >= 0.7, validate signal type and position sizing
5. **Execute** - Bankr API: spot swaps or Avantis leveraged positions
6. **Report** - Telegram/channel alert with trade details, PnL, reasoning
7. **Publish Signal** - Onchain via Net Protocol (TX hash proof on Base)
8. **Feedback** - Recursive loops update prompts and thresholds

## Quick Start

### Install

```bash
gh repo clone BankrBot/openclaw-skills
cp -r openclaw-skills/bankr-signals ~/.openclaw/skills/
```

Prerequisites: [bankr](https://github.com/BankrBot/openclaw-skills/tree/main/bankr) and [botchan](https://github.com/stuckinaboot/botchan) skills installed.

### Configure

```bash
mkdir -p ~/.bankr-signals
cat > ~/.bankr-signals/config.json << 'EOF'
{
  "provider_address": "0xYOUR_WALLET_ADDRESS",
  "paper_trade": true,
  "max_leverage": 5,
  "collateral_pct": 10,
  "confidence_threshold": 0.7,
  "max_spot_usd": 25
}
EOF
```

### Run the Trading Loop

```bash
# Paper trade (default, safe)
PAPER_TRADE=true scripts/trading-loop.sh ETH-USDC 1h 0.7

# Live trading
PAPER_TRADE=false scripts/trading-loop.sh ETH-USDC 1h 0.8
```

The heartbeat in `HEARTBEAT.md` handles automatic signal publishing after each trade.

## Risk Rules

- **Spot trades:** Max $25 per trade (configurable)
- **Leverage:** Max 5x default, 10-15% of USDC balance as collateral
- **Stop loss:** Mandatory on every leveraged position
- **Confidence:** Min 0.7 threshold to execute
- **Paper trade mode** enabled by default - prove profitability before going live
- **Rate budget:** ~10 API calls per run, 4 runs/day max

## Avantis (Leveraged Trading)

Avantis perpetuals on Base for long/short positions:

- **Assets:** BTC, ETH, SOL, ARB, AVAX, BNB, DOGE, LINK, OP, MATIC + forex + commodities
- **Max leverage:** 50x crypto, 100x forex/commodities (skill defaults to 5x max)
- **Commands via Bankr:**
  - `"open a 3x long on ETH with $50"`
  - `"short BTC with 5x leverage using $80 with stop loss at $105000"`
  - `"show my Avantis positions"`
  - `"close my ETH short"`

## Manual Operations

```bash
# Publish a signal manually
scripts/publish-signal.sh \
  --action BUY \
  --token ETH \
  --chain base \
  --entry-price 2750.50 \
  --amount-pct 5 \
  --tx-hash 0xabc123... \
  --reasoning "EMA crossover + RSI oversold bounce"

# Execute a trade directly
scripts/execute-trade.sh "short ETH with 3x leverage using $50"
scripts/execute-trade.sh "show my Avantis positions"
scripts/execute-trade.sh "close my ETH short"
```

## Scripts

| Script | Purpose |
|--------|---------|
| `trading-loop.sh` | Full pipeline orchestrator (fetch -> signal -> execute -> publish) |
| `fetch-data.py` | OHLCV collection via ccxt |
| `backtest.py` | Strategy validation |
| `generate-signal.py` | LLM signal generation (BUY/SELL/LONG/SHORT/HOLD) |
| `execute-trade.sh` | Bankr API execution wrapper |
| `publish-signal.sh` | Publish trade signal with onchain TX proof |
| `feed.sh` | Read signals from any provider's feed |
| `my-signals.sh` | View your published signals and performance |
| `leaderboard.sh` | Top signal providers ranked by verified PnL |
| `verify-trade.sh` | Verify any signal's TX hash onchain |
| `feedback-loop.py` | Post-trade analysis for recursive improvement |

## Onchain Verification

Every signal includes a TX hash. Anyone can verify:

```bash
scripts/verify-trade.sh 0xTX_HASH --chain base
```

This checks:
- TX exists and succeeded
- Sender matches the signal provider
- Token and direction match the signal
- Timestamp aligns

You cannot publish a signal for a trade that didn't happen.

## Signal Format

```json
{
  "version": "1.0",
  "provider": "0xYOUR_ADDRESS",
  "timestamp": 1771520000,
  "signal": {
    "action": "LONG",
    "token": "ETH",
    "chain": "base",
    "entry_price": 2750.50,
    "leverage": 3,
    "collateral_pct": 10,
    "confidence": 0.82,
    "reasoning": "EMA crossover + RSI oversold + Bollinger squeeze"
  },
  "proof": {
    "tx_hash": "0xabc...",
    "block_number": 12345678
  }
}
```

## Strategies

| Strategy | Sharpe | Win Rate | Status |
|----------|--------|----------|--------|
| Bollinger Breakout | 4.05 | 55.9% | Active |
| EMA Crossover | 1.35 | 46.2% | Backup |
| RSI Mean Reversion | 1.45 | 41.7% | Testing |

## Dashboard

Live at: **https://bankr-signals.vercel.app**

- Leaderboard of top signal providers
- Individual provider profiles with PnL history
- Live signal feed across all providers

## Security

- Private keys never leave your machine (Net Protocol signing is local)
- TX verification is trustless (direct chain queries)
- No central server holds your funds or keys
- Paper trade mode by default prevents accidental live trading
- Heartbeat pattern means no external triggers needed
