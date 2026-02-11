# Garden Temp Market (GTM)

Bet on daily garden temperature predictions on Base.

## Contract

- **Address**: `0xA3F09E6792351e95d1fd9d966447504B5668daF6`
- **Chain**: Base (8453)
- **Source**: https://github.com/Potdealer/prediction-market

## What is GTM?

A daily prediction market: "Will today's 18:00 UTC garden temperature be HIGHER than yesterday's?"

- **HIGHER**: Bet the temperature will increase
- **LOWER**: Bet the temperature will stay the same or decrease
- Winners split 98% of the pot proportionally
- Settlement: 18:00 UTC daily
- Data source: Netclawd's SensorNet

## Commands

### Bet HIGHER

Bet that today's temperature will be higher than yesterday's baseline.

**Trigger phrases:**
- "bet [amount] ETH on higher at GTM"
- "bet higher on garden temp market"
- "GTM bet higher [amount]"

**Transaction:**
```json
{
  "to": "0xA3F09E6792351e95d1fd9d966447504B5668daF6",
  "data": "0xb3dd0f5a",
  "value": "<amount_in_wei>",
  "chainId": 8453
}
```

**Example:** "bet 0.01 ETH on higher at GTM"

### Bet LOWER

Bet that today's temperature will be the same or lower than yesterday's baseline.

**Trigger phrases:**
- "bet [amount] ETH on lower at GTM"
- "bet lower on garden temp market"
- "GTM bet lower [amount]"

**Transaction:**
```json
{
  "to": "0xA3F09E6792351e95d1fd9d966447504B5668daF6",
  "data": "0x7a5ce755",
  "value": "<amount_in_wei>",
  "chainId": 8453
}
```

**Example:** "bet 0.005 ETH on lower at GTM"

## Value Conversions

| ETH | Wei |
|-----|-----|
| 0.001 (min) | 1000000000000000 |
| 0.005 | 5000000000000000 |
| 0.01 | 10000000000000000 |
| 0.05 | 50000000000000000 |
| 0.1 | 100000000000000000 |

## Rules

- **Minimum bet**: 0.001 ETH
- **One bet per round**: Cannot bet both HIGHER and LOWER
- **Betting closes**: 12:00 UTC (6 hours before settlement)
- **Settlement**: 18:00 UTC daily
- **Ties**: Pot rolls over to next day
- **One-sided market**: Everyone gets refunded

## Function Selectors

| Function | Selector | Description |
|----------|----------|-------------|
| `betHigher()` | `0xb3dd0f5a` | Bet temperature goes up |
| `betLower()` | `0x7a5ce755` | Bet temperature stays same or goes down |

## Links

- **Basescan**: https://basescan.org/address/0xA3F09E6792351e95d1fd9d966447504B5668daF6
- **GitHub**: https://github.com/Potdealer/prediction-market
- **ClawhHub**: `clawhub install prediction-market`

## Credits

Built by **potdealer x Ollie** for **Netclawd's SensorNet**
