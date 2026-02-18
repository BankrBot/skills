# API Reference

## CoinGecko API

### Historical Price Endpoint

```
GET https://api.coingecko.com/api/v3/coins/{id}/history?date={DD-MM-YYYY}
```

**Parameters:**
- `id`: CoinGecko coin ID (e.g., "bitcoin", "ethereum")
- `date`: Date in DD-MM-YYYY format

**Response:**
```json
{
  "id": "ethereum",
  "symbol": "eth",
  "name": "Ethereum",
  "market_data": {
    "current_price": {
      "usd": 2345.67
    }
  }
}
```

**Rate Limits:**
- Free tier: 10-50 calls/minute
- Historical data: Past 365 days only

## Bankr API

### Price Query

Uses Bankr's natural language API for real-time pricing.

**Query Format:**
```
"What is the current price of {TOKEN}?"
```

**Response:**
- Multi-chain pricing
- 24h price changes
- Market cap and volume
- Security scan results

**Rate Limits:**
- Depends on API key tier
- Typical: 100+ calls/day

## Token ID Mapping

| Symbol | CoinGecko ID |
|--------|--------------|
| BTC | bitcoin |
| ETH | ethereum |
| GHST | aavegotchi |
| MATIC | matic-network |
| USDC | usd-coin |
| UNI | uniswap |
| AAVE | aave |
| LINK | chainlink |
| SOL | solana |

## Error Codes

- `10012`: Time range exceeds free tier (> 365 days)
- `429`: Rate limit exceeded
- `404`: Token not found
- `500`: API server error
