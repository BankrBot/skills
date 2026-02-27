# deployer-intelligence

**Analyze Base token deployer wallet history to identify serial deployers and track record patterns.**

## Description

This skill analyzes any Base token's deployer wallet to surface:
- Total contracts deployed by this wallet
- How many survived past 7 days / 30 days
- Average peak market caps of previous tokens
- A 0-100 deployer score based on track record

Use this as a **veto filter** before trading — avoid tokens from deployers with proven failure patterns. Designed specifically for sub-$5M Base tokens where deployer credibility matters.

## Use Cases

- **Pre-trade filter:** Check deployer history before entering a position
- **Risk assessment:** Identify first-time deployers vs serial launchers
- **Track record analysis:** Distinguish between proven builders and serial rug artists
- **Intelligence layer:** Add deployer context to trading decisions

## Usage

```javascript
// Scan a token's deployer
lexispawn deployer-intelligence scan <TOKEN_CONTRACT_ADDRESS>

// Example:
lexispawn deployer-intelligence scan 0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb

// Returns:
// {
//   "token": "CLANKER",
//   "deployer": "0x250c9fb2b411b48273f69879007803790a6aea47",
//   "deployerHistory": {
//     "totalContractsCreated": 11,
//     "tokensWithMarketData": 1,
//     "survivedPast7Days": 1,
//     "survivedPast30Days": 1,
//     "avgPeakMcap": 29196896
//   },
//   "deployerScore": 65
// }
```

## Scoring Methodology

**Base score:** 50 (neutral)

**Positive signals:**
- +10 if any token survived 30+ days
- +5 per token survived 7+ days (max +20)
- +10 if average peak mcap > $500K

**Negative signals:**
- -10 per token dead <72h (max -30)
- -20 if 5+ tokens deployed with 0 survivors
- -15 if >10 contracts but <30% have market data (most never got liquidity)

**Range:** 0-100

**Interpretation:**
- **0-30:** Red flag - proven failure pattern or serial rugger
- **30-50:** Neutral/unknown - first-time deployer or mixed track record
- **50-70:** Moderate credibility - some survivors, not all failures
- **70-100:** Strong track record - consistent survival rates, proven builder

## Data Sources

- **Routescan API:** Contract creation history via `txlistinternal` endpoint
- **DexScreener API:** Token market data (mcap, liquidity, age)

Designed for Base chain (ERC-20 tokens). Works with both factory-deployed contracts and traditional EOA deployers. Limited visibility into ERC-4337 Account Abstraction wallet deployment history (API constraint).

## Installation

Prerequisites:
- Node.js 18+
- Routescan API key (free tier: https://routescan.io/api)
- Network: Base mainnet

Install:
```bash
openclaw skills install lexispawn/deployer-intelligence
```

Configure:
```bash
export ROUTESCAN_API_KEY="your_api_key"
```

## Output Format

```json
{
  "token": "SYMBOL",
  "tokenName": "Full Name",
  "ca": "0x...",
  "deployer": "0x...",
  "deployerHistory": {
    "totalContractsCreated": 11,
    "tokensWithMarketData": 1,
    "dataRate": 9,
    "survivedPast7Days": 1,
    "survivedPast30Days": 1,
    "avgPeakMcap": 29196896,
    "previousTokens": [
      {
        "ca": "0x...",
        "symbol": "TOKEN",
        "name": "Token Name",
        "currentMcap": 1000000,
        "peakMcap": 2000000,
        "volume24h": 500000,
        "liquidity": 100000,
        "status": "active",
        "daysOld": 45,
        "priceUsd": 0.001
      }
    ]
  },
  "deployerScore": 65,
  "timestamp": "2026-02-27T19:20:00.000Z"
}
```

## Known Limitations

1. **ERC-4337 AA wallets:** Most 2026 Base tokens use Account Abstraction. Deployment history is embedded in UserOp data, not visible via standard `txlistinternal`. These deployers will show 0 history even if they've deployed multiple tokens.

2. **Coverage:** Only tokens with active trading pairs on DexScreener are included in history analysis. Dead tokens with zero liquidity won't appear.

3. **Recency:** No time-weighting — a token that died 6 months ago counts the same as one that died yesterday.

4. **Network:** Base only. Multi-chain support planned.

## Roadmap

- [ ] Multi-chain support (Ethereum, Polygon, Arbitrum)
- [ ] UserOp decoding for ERC-4337 deployer visibility
- [ ] Time-weighted scoring (recent failures penalized more)
- [ ] Deployer watchlist alerts (notify when proven deployer launches new token)
- [ ] Integration with 15 MINDS analysis pipeline

## Author

Built by **Lexispawn** (@lexispawn)
- X: https://twitter.com/lexispawn
- Farcaster: https://warpcast.com/lexispawn
- Intelligence hub: https://lexispawn.xyz

Part of the **15 MINDS** trading intelligence system on Base.

## License

MIT
