# Timestamp Pricing - OpenClaw Skill

> Get historical and real-time cryptocurrency prices at any specific timestamp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-blue.svg)](https://openclaw.ai)

## Overview

Timestamp Pricing is an intelligent OpenClaw skill that fetches cryptocurrency prices at specific timestamps. It automatically routes between **Bankr** (real-time) and **CoinGecko** (historical) APIs based on how recent the timestamp is, giving you the most accurate price data available.

## Features

- 🎯 **Smart Routing** - Automatically chooses best data source
- ⚡ **Real-time Prices** - Uses Bankr for timestamps < 24 hours old
- 📊 **Historical Data** - Uses CoinGecko for older timestamps
- 🔄 **Multi-format Support** - Unix timestamps, ISO dates, natural language
- 🌐 **Multi-chain** - Supports prices across Base, Polygon, Ethereum
- 💰 **Thousands of Tokens** - BTC, ETH, GHST, MATIC, and more
- 🔁 **Automatic Fallback** - Seamless failover between data sources

## Quick Start

### Installation

1. Clone this repository into your OpenClaw skills directory:

```bash
cd ~/.openclaw/skills/
git clone https://github.com/YOUR_USERNAME/timestamp-pricing.git
```

2. Ensure you have the Bankr skill installed for real-time pricing:

```bash
# Bankr skill should be at ~/.openclaw/skills/bankr/
```

3. (Optional) Add API keys for higher rate limits:

```bash
cp config.json.example config.json
# Edit config.json with your API keys
```

### Usage

#### Smart Price Lookup (Recommended)

The smart lookup automatically chooses the best data source:

```bash
# Recent timestamp (uses Bankr - real-time)
bash scripts/smart-price-lookup.sh AAI "2026-02-10 04:20:00"

# Older timestamp (uses CoinGecko - historical)
bash scripts/smart-price-lookup.sh ETH "2026-01-15"

# Unix timestamp
bash scripts/smart-price-lookup.sh BTC 1704067200
```

#### Direct Historical Lookup

For direct access to CoinGecko historical data:

```bash
bash scripts/price-lookup.sh ETH 01-01-2026
bash scripts/price-lookup.sh GHST 15-01-2026
```

## Examples

### Example 1: Real-time Price (Today)

```bash
$ bash scripts/smart-price-lookup.sh AAI "2026-02-10 04:20:00"
```

Output:
```
=== Smart Timestamp Pricing ===
Token: GHST
Timestamp: 2026-02-10 11:45:00 UTC
Age: 11 hours ago

Using Bankr (real-time pricing)...

GHST on Base: $0.1806
GHST on Polygon: $0.1784
GHST on Ethereum: $0.1863
24h Change: +120.60%
```

### Example 2: Historical Price

```bash
$ bash scripts/smart-price-lookup.sh ETH "2026-01-15"
```

Output:
```
=== Smart Timestamp Pricing ===
Token: ETH
Timestamp: 2026-01-15 00:00:00 UTC
Age: 632 hours ago

Using CoinGecko (historical data)...

Ethereum (ETH)
Date: 15-01-2026
Price: $2,445.67 USD
```

## How It Works

### Smart Routing Logic

```
Timestamp Age < 24 hours?
    ↓ YES → Use Bankr (Real-time)
    ↓ NO  → Use CoinGecko (Historical)
```

- **Recent prices (< 24h)**: Uses Bankr API for minute-level precision
- **Historical prices (> 24h)**: Uses CoinGecko for daily snapshots
- **Automatic fallback**: If primary source fails, falls back to alternative

### Supported Tokens

All tokens available on CoinGecko and Bankr, including:

- **Major**: BTC, ETH, SOL, MATIC, AVAX
- **DeFi**: UNI, AAVE, COMP, LINK, SUSHI
- **Gaming**: GHST, AXS, MANA, SAND, ENJ
- **Stablecoins**: USDC, USDT, DAI, FRAX

Use token symbol (e.g., `ETH`) or CoinGecko ID (e.g., `ethereum`).

### Timestamp Formats

- **ISO Date**: `2026-02-10 11:45:00`
- **Short Date**: `2026-01-15`
- **Unix Timestamp**: `1704067200`
- **Date Format**: `15-01-2026` (DD-MM-YYYY)

## Configuration

### Optional: API Keys

Create `config.json` for higher rate limits:

```json
{
  "coingeckoApiKey": "your-coingecko-api-key",
  "coinmarketcapApiKey": "your-coinmarketcap-api-key"
}
```

Free tier limits:
- CoinGecko: 10-50 calls/minute
- Historical data: Past 365 days (free tier)

## Use Cases

- 📈 **Trading Analysis** - Backtest strategies with historical prices
- 💼 **Portfolio Tracking** - Calculate historical portfolio values
- 📊 **Tax Reporting** - Get exact prices for tax calculations
- 🔍 **Research** - Analyze price movements over time
- 🤖 **Bot Integration** - Automated price lookups for trading bots

## Dependencies

- **Bash** (built-in)
- **curl** (for API calls)
- **jq** (for JSON parsing)
- **date** (for timestamp conversion)
- **Node.js** (optional, for .cjs script)
- **Bankr skill** (for real-time pricing)

Install dependencies:
```bash
# Ubuntu/Debian
sudo apt-get install curl jq

# macOS
brew install curl jq
```

## API Rate Limits

- **CoinGecko Free**: 10-50 calls/minute, 365 days historical
- **Bankr**: Depends on your API key tier
- **Recommendation**: Use smart-price-lookup.sh to minimize API calls

## Limitations

- CoinGecko free tier only provides last 365 days of historical data
- Historical prices are daily snapshots (not intraday)
- Real-time prices require Bankr skill installation
- Some low-cap tokens may have limited historical data

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Support

- **Issues**: Report bugs or request features via GitHub Issues
- **OpenClaw**: https://openclaw.ai
- **Documentation**: See SKILL.md for detailed documentation

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built for the OpenClaw community
- Uses CoinGecko API for historical data
- Integrates with Bankr skill for real-time pricing
- Inspired by the need for accurate timestamp-based pricing

## Changelog

### v1.0.0 (2026-02-10)
- Initial release
- Smart routing between Bankr and CoinGecko
- Support for multiple timestamp formats
- Multi-chain pricing support
- Automatic fallback mechanism

---

Made with 🦞 for the OpenClaw community
