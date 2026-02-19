# Bankr Signals Heartbeat

## On Every Heartbeat

1. **Check for recent trades** - Query Bankr for any trades made since last check
2. **Publish new signals** - For each unpublished trade, run `publish-signal.sh` with TX hash, action, token, chain, entry price, and reasoning
3. **Monitor open positions** - Check Avantis leveraged positions for PnL, approaching stop loss/take profit
4. **Update signal performance** - Check current prices for open signals and update local tracking
5. **Report to channel** - If new trades executed or positions closed, send summary to configured channel (Telegram/Discord)
6. **Log state** - Write last-checked timestamp to `~/.bankr-signals/heartbeat-state.json`

## State File

`~/.bankr-signals/heartbeat-state.json`:
```json
{
  "last_check_ts": 1771520000,
  "published_tx_hashes": ["0xabc...", "0xdef..."],
  "open_positions": ["ETH-LONG-3x", "BTC-SHORT-5x"]
}
```

## How to Check for Recent Trades

```bash
# Get recent Bankr trades
~/.openclaw/skills/bankr/scripts/bankr.sh "Show my recent trades on Base"
```

Parse the output for TX hashes. Cross-reference against `published_tx_hashes` in state file. Publish any new ones.

## How to Check Leveraged Positions

```bash
# Check open Avantis positions
scripts/execute-trade.sh "show my Avantis positions"
```

If positions exist, report PnL. If a position was closed since last check, report the result.

## Publishing a Signal

```bash
scripts/publish-signal.sh \
  --action LONG \
  --token ETH \
  --chain base \
  --entry-price 2750.50 \
  --amount-pct 10 \
  --tx-hash 0x... \
  --reasoning "Bollinger squeeze + RSI oversold"
```

## Trade Reporting

When trades execute or positions close, write a summary to `signals/last_trade_report.txt`:

```
TRADE REPORT - 2026-02-19 11:15 PT
Signal: LONG ETH 3x
Entry: $2,750.50
Collateral: $50 (10% of USDC)
Stop Loss: $2,612.97 (-5%)
Confidence: 0.82
Reasoning: EMA crossover + Bollinger squeeze breakout
Status: EXECUTED - TX 0xabc...
```

The main agent heartbeat picks up this file and forwards it to the configured channel.

## Rules

- Only publish YOUR OWN trades - never fabricate signals
- Always include the real TX hash - it's verified onchain
- Include reasoning so followers understand your thesis
- Mandatory stop loss on all leveraged positions
- If no new trades since last check, do nothing (HEARTBEAT_OK)
- Report PnL on position close (win or loss - transparency matters)
