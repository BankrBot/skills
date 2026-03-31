#!/usr/bin/env bash
# Full contract risk scan using GoPlus + DexScreener
# Usage: ./scan.sh <chain> <contract_address>
# Example: ./scan.sh base 0x4200000000000000000000000000000000000006

set -euo pipefail

CHAIN="${1:-}"
ADDRESS="${2:-}"

CHAIN_IDS=( [base]=8453 [ethereum]=1 [polygon]=137 [bsc]=56 [arbitrum]=42161 )

if [[ -z "$CHAIN" || -z "$ADDRESS" ]]; then
  echo "Usage: $0 <chain> <contract_address>" >&2
  exit 1
fi

if [[ ! "$ADDRESS" =~ ^0x[0-9a-fA-F]{40}$ ]]; then
  echo "Error: invalid EVM address format" >&2
  exit 1
fi

CHAIN_ID="${CHAIN_IDS[$CHAIN]:-}"
if [[ -z "$CHAIN_ID" ]]; then
  echo "Error: unsupported chain. Use: base, ethereum, polygon, bsc, arbitrum" >&2
  exit 1
fi

ADDRESS_LOWER=$(echo "$ADDRESS" | tr '[:upper:]' '[:lower:]')

echo "Scanning $ADDRESS on $CHAIN (chain_id=$CHAIN_ID) ..."

# --- GoPlus call ---
GP=$(curl -sf --max-time 15 \
  "https://api.gopluslabs.io/api/v1/token_security/${CHAIN_ID}?contract_addresses=${ADDRESS_LOWER}" \
  2>/dev/null || true)

if [[ -z "$GP" || "$(echo "$GP" | jq -r '.code' 2>/dev/null)" != "1" ]]; then
  echo "Warning: GoPlus API unreachable or returned error — partial report only" >&2
fi

IS_HONEYPOT=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].is_honeypot // "unknown"')
BUY_TAX=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].buy_tax // "unknown"')
SELL_TAX=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].sell_tax // "unknown"')
OWNER_ADDR=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].owner_address // ""')
IS_MINTABLE=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].is_mintable // "0"')
HIDDEN_OWNER=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].hidden_owner // "0"')
IS_OPEN_SOURCE=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].is_open_source // "0"')
TRANSFER_PAUSABLE=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].transfer_pausable // "0"')
SLIPPAGE_MOD=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].slippage_modifiable // "0"')
CANNOT_SELL_ALL=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].cannot_sell_all // "0"')
IS_PROXY=$(echo "$GP" | jq -r --arg a "$ADDRESS_LOWER" '.result[$a].is_proxy // "0"')

# --- DexScreener call ---
DS=$(curl -sf --max-time 15 \
  "https://api.dexscreener.com/latest/dex/tokens/${ADDRESS}" \
  2>/dev/null || true)

LIQ=$(echo "$DS" | jq -r '.pairs[0].liquidity.usd // 0')
PAIR_AGE_MS=$(echo "$DS" | jq -r '.pairs[0].pairCreatedAt // 0')
DEX=$(echo "$DS" | jq -r '.pairs[0].dexId // "unknown"')
PAIR_AGE_HRS=0
if [[ "$PAIR_AGE_MS" -gt 0 ]]; then
  NOW_MS=$(date +%s%3N)
  PAIR_AGE_HRS=$(( (NOW_MS - PAIR_AGE_MS) / 3600000 ))
fi

# --- Scoring ---
SCORE=0
FINDINGS=()

if [[ "$IS_HONEYPOT" == "1" ]]; then
  SCORE=$((SCORE + 60))
  FINDINGS+=("[CRITICAL] Honeypot detected — token cannot be sold")
fi
if [[ "$CANNOT_SELL_ALL" == "1" ]]; then
  SCORE=$((SCORE + 40))
  FINDINGS+=("[HIGH] Cannot sell full balance (cannot_sell_all = 1)")
fi
if [[ "$TRANSFER_PAUSABLE" == "1" ]]; then
  SCORE=$((SCORE + 30))
  FINDINGS+=("[HIGH] Owner can pause all transfers")
fi
if [[ "$IS_MINTABLE" == "1" && -n "$OWNER_ADDR" ]]; then
  SCORE=$((SCORE + 25))
  FINDINGS+=("[HIGH] Owner can mint unlimited supply and is not renounced")
fi
if [[ "$SLIPPAGE_MOD" == "1" ]]; then
  SCORE=$((SCORE + 20))
  FINDINGS+=("[HIGH] Owner can modify sell tax at will")
fi
if [[ "$HIDDEN_OWNER" == "1" ]]; then
  SCORE=$((SCORE + 20))
  FINDINGS+=("[HIGH] Hidden owner detected")
fi
if [[ "$IS_PROXY" == "1" && "$IS_OPEN_SOURCE" == "0" ]]; then
  SCORE=$((SCORE + 15))
  FINDINGS+=("[MEDIUM] Unverified proxy contract — implementation unknown")
fi
if [[ "$IS_OPEN_SOURCE" == "0" ]]; then
  SCORE=$((SCORE + 15))
  FINDINGS+=("[MEDIUM] Contract not verified on-chain")
fi
if (( $(echo "$LIQ < 10000" | bc -l 2>/dev/null || echo 0) )); then
  SCORE=$((SCORE + 20))
  FINDINGS+=("[HIGH] Liquidity \$${LIQ} USD — dangerously thin")
fi
if [[ "$PAIR_AGE_HRS" -gt 0 && "$PAIR_AGE_HRS" -lt 24 ]]; then
  SCORE=$((SCORE + 15))
  FINDINGS+=("[MEDIUM] Token pair only ${PAIR_AGE_HRS}h old — very new")
fi

# Cap score at 100
if [[ $SCORE -gt 100 ]]; then SCORE=100; fi

# Recommendation
if [[ $SCORE -ge 60 ]]; then
  REC="AVOID"
elif [[ $SCORE -ge 30 ]]; then
  REC="CAUTION"
else
  REC="GO"
fi

# Severity
if [[ $SCORE -ge 60 ]]; then SEV="CRITICAL"
elif [[ $SCORE -ge 40 ]]; then SEV="HIGH"
elif [[ $SCORE -ge 20 ]]; then SEV="MEDIUM"
else SEV="LOW"; fi

# --- Output ---
echo ""
echo "CONTRACT RISK REPORT"
echo "────────────────────"
echo "Token:       $ADDRESS"
echo "Chain:       $CHAIN (chain_id=$CHAIN_ID)"
echo "DEX:         $DEX"
echo "Liquidity:   \$$LIQ USD"
echo "Risk Score:  $SCORE / 100"
echo "Severity:    $SEV"
echo ""
echo "FINDINGS:"
for i in "${!FINDINGS[@]}"; do
  echo "$((i+1)). ${FINDINGS[$i]}"
done
if [[ ${#FINDINGS[@]} -eq 0 ]]; then
  echo "   No critical findings detected."
fi
echo ""
echo "RECOMMENDATION: $REC"
echo "────────────────────"
if [[ "$REC" == "AVOID" ]]; then
  echo "Do not execute swap."
elif [[ "$REC" == "CAUTION" ]]; then
  echo "Proceed with strict limits: max \$50, slippage 25%, verify liquidity."
else
  echo "No critical blockers. Proceed normally."
fi
if [[ -n "$BUY_TAX" && "$BUY_TAX" != "unknown" ]]; then
  echo ""
  echo "Tax info: buy=$BUY_TAX  sell=$SELL_TAX"
fi
