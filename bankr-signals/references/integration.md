# Integration Guide

## Hook Into Existing Trading Crons

### Pattern: Publish After Every Trade

Add signal publishing to your existing Bankr trading automation:

```bash
#!/bin/bash
# Example: trading cron that publishes signals

BANKR="~/.openclaw/skills/bankr/scripts/bankr.sh"
PUBLISH="~/.openclaw/skills/bankr-signals/scripts/publish-signal.sh"

# Your trading logic
RESULT=$($BANKR "Buy \$50 of ETH on Base")
TX_HASH=$(echo "$RESULT" | jq -r '.result.txHash // empty')

if [ -n "$TX_HASH" ]; then
  $PUBLISH \
    --action BUY \
    --token ETH \
    --chain base \
    --entry-price "$(echo "$RESULT" | jq -r '.result.price // 0')" \
    --amount-pct 5 \
    --tx-hash "$TX_HASH" \
    --reasoning "Automated: weekly DCA"
fi
```

### Pattern: Auto-Copy Cron

Poll followed providers and execute:

```bash
#!/bin/bash
# Run every 5 minutes via cron

FEED="~/.openclaw/skills/bankr-signals/scripts/feed.sh"
AUTOCOPY="~/.openclaw/skills/bankr-signals/scripts/auto-copy.sh"

# Check each provider with auto-copy enabled
jq -r '.auto_copy | to_entries[] | select(.value.enabled == true) | .key' \
  ~/.bankr-signals/config.json | while read PROVIDER; do
  $AUTOCOPY --provider "$PROVIDER" --execute
done
```

### Pattern: Selective Publishing

Only publish signals above a confidence threshold:

```bash
# In your analysis script
CONFIDENCE=$(python3 analyze.py "$TOKEN")

if (( $(echo "$CONFIDENCE > 0.7" | bc -l) )); then
  publish-signal.sh \
    --action BUY --token "$TOKEN" --chain base \
    --entry-price "$PRICE" --amount-pct 3 \
    --tx-hash "$TX" --confidence "$CONFIDENCE" \
    --reasoning "High-confidence signal: RSI + volume breakout"
fi
```

## Configuration

### Setup

```bash
mkdir -p ~/.bankr-signals
cat > ~/.bankr-signals/config.json << 'EOF'
{
  "provider_address": "0xYOUR_WALLET_ADDRESS",
  "risk": {
    "max_position_pct": 5,
    "daily_loss_limit": 100,
    "max_providers": 10
  },
  "auto_copy": {}
}
EOF
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BASE_RPC_URL` | https://mainnet.base.org | Base chain RPC |
| `ETH_RPC_URL` | https://eth.llamarpc.com | Ethereum RPC |
| `NET_PRIVATE_KEY` | (from keychain) | For signing botchan posts |
