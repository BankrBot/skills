# Timestamp Pricing Skill

Get historical USD prices for any cryptocurrency at a specific timestamp.

## Description

This skill allows you to query the historical price of any cryptocurrency token at a specific point in time. Perfect for analyzing past trading decisions, historical portfolio valuations, tax calculations, price verification, and trend analysis.

## Features

- Historical price lookup at any timestamp
- Multi-token support for thousands of cryptocurrencies
- Flexible time formats (Unix timestamps, ISO dates, natural language)
- Multiple data sources (CoinGecko, CoinMarketCap)
- Cache support for fast repeated queries

## Usage Examples

Get the price of ETH on January 1, 2024
Get BTC price at timestamp 1704067200
Show GHST price on 2024-01-15 12:00:00 UTC
Get prices for ETH, BTC, and GHST on December 31, 2023

## Configuration

Optional: Create config.json with API keys for higher rate limits

## Supported Tokens

All tokens available on CoinGecko and CoinMarketCap including major cryptocurrencies, DeFi tokens, gaming tokens, and stablecoins.

Use token symbol (ETH) or CoinGecko ID (ethereum).

## Technical Details

- Prices based on volume-weighted averages
- Data aggregated from multiple exchanges
- Hourly precision for recent dates
- Daily precision for historical dates
- Free tier: 10-50 calls/minute
- Timestamps interpreted as UTC

Version: 1.0.0
Last Updated: 2026-02-10

## Smart Price Lookup (NEW!)

### smart-price-lookup.sh

Intelligently chooses the best data source based on timestamp age:

- **Recent prices (< 24 hours)**: Uses Bankr for real-time, minute-level precision
- **Historical prices (> 24 hours)**: Uses CoinGecko for daily historical data

### Usage

```bash
# Recent timestamp (uses Bankr - real-time)
./smart-price-lookup.sh GHST "2026-02-10 11:45:00"

# Older timestamp (uses CoinGecko - historical)
./smart-price-lookup.sh ETH "2026-01-15"

# Unix timestamp
./smart-price-lookup.sh BTC 1704067200
```

### Benefits

- **Automatic routing**: No need to choose between real-time and historical
- **Best accuracy**: Real-time for recent, historical snapshots for older
- **Full precision**: Hours, minutes, seconds for recent timestamps
- **Seamless fallback**: If Bankr unavailable, falls back to CoinGecko

