#!/usr/bin/env bash
# LP and liquidity check via DexScreener
# Usage: ./liquidity.sh <contract_address>

set -euo pipefail
ADDRESS="${1:-}"
if [[ -z "$ADDRESS" ]]; then
  echo "Usage: $0 <contract_address>" >&2; exit 1
fi

DS=$(curl -sf --max-time 15 "https://api.dexscreener.com/latest/dex/tokens/${ADDRESS}")

echo "$DS" | jq '.pairs[] | {
  dex:        .dexId,
  pair:       .pairAddress,
  liquidity:  .liquidity.usd,
  volume_24h: .volume.h24,
  price_usd:  .priceUsd,
  fdv:        .fdv,
  created_at: .pairCreatedAt
}' 2>/dev/null || echo "No pairs found for $ADDRESS"
