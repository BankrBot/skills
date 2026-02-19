# Signal Format Specification

## Version 1.0

### Schema

```json
{
  "version": "1.0",
  "provider": "string (0x address)",
  "timestamp": "number (unix epoch seconds)",
  "signal": {
    "action": "BUY | SELL",
    "token": "string (symbol, e.g. ETH, PEPE)",
    "chain": "base | ethereum | polygon | solana",
    "entry_price": "number (USD)",
    "amount_pct": "number (% of portfolio, 1-100)",
    "stop_loss_pct": "number (optional, % below entry)",
    "take_profit_pct": "number (optional, % above entry)",
    "confidence": "number (optional, 0.0-1.0)",
    "reasoning": "string (optional, why this trade)"
  },
  "proof": {
    "tx_hash": "string (0x transaction hash)",
    "block_number": "number (optional, block of confirmation)"
  }
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Always "1.0" |
| `provider` | string | Provider's wallet address |
| `timestamp` | number | Unix timestamp of signal publication |
| `signal.action` | string | BUY or SELL |
| `signal.token` | string | Token symbol |
| `signal.chain` | string | Chain where trade executed |
| `signal.entry_price` | number | Price at time of trade (USD) |
| `signal.amount_pct` | number | Portfolio percentage |
| `proof.tx_hash` | string | Onchain transaction hash |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `signal.stop_loss_pct` | number | none | Stop loss percentage |
| `signal.take_profit_pct` | number | none | Take profit percentage |
| `signal.confidence` | number | none | Provider confidence 0-1 |
| `signal.reasoning` | string | none | Trade rationale |
| `proof.block_number` | number | none | Confirmation block |

### Distribution

Signals are published as JSON strings to Net Protocol feeds:
- Topic: `signals-{provider_address}`
- Chain: Base (8453)
- Max size: 4000 characters (botchan limit)

### Verification

Any agent can verify a signal by:
1. Fetching TX receipt from the chain RPC
2. Confirming status = 0x1 (success)
3. Confirming sender matches provider address
4. Confirming timestamp is within reasonable range of block timestamp
