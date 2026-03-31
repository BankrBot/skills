# DexScreener API Reference

Base URL: `https://api.dexscreener.com`
Auth: None required (free)
Docs: https://docs.dexscreener.com

## Token Pairs Endpoint

```
GET /latest/dex/tokens/{tokenAddress}
```

Returns all DEX pairs for a token address.

### Key Response Fields

| Field | Path | Meaning |
|-------|------|---------|
| DEX name | `.pairs[].dexId` | E.g. `uniswap-v3`, `aerodrome` |
| Pair address | `.pairs[].pairAddress` | LP contract address |
| Liquidity USD | `.pairs[].liquidity.usd` | Total liquidity in USD |
| Volume 24h | `.pairs[].volume.h24` | 24h trading volume in USD |
| Price USD | `.pairs[].priceUsd` | Current token price |
| FDV | `.pairs[].fdv` | Fully diluted valuation |
| Price change 24h | `.pairs[].priceChange.h24` | % price change last 24h |
| Created at | `.pairs[].pairCreatedAt` | Unix timestamp in ms |
| Chain | `.pairs[].chainId` | E.g. `base`, `ethereum` |

### Example Request

```bash
curl -s "https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006" \
  | jq '.pairs[0] | {dex: .dexId, liquidity: .liquidity.usd, created: .pairCreatedAt}'
```

### Risk Signals

| Signal | Threshold | Action |
|--------|-----------|--------|
| Liquidity | < $10,000 | +20 risk score |
| Pair age | < 24h | +15 risk score |
| 24h price change | > ±80% | Flag for review |
| No pairs returned | pairs = [] | AVOID — no market |

## Search Endpoint

```
GET /latest/dex/search?q={query}
```

Search by token name, symbol, or address.

## Rate Limits

- No documented rate limit, but use respectfully
- Cache responses when possible to reduce calls
