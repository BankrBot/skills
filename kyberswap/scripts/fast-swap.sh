#!/usr/bin/env bash
# fast-swap.sh — End-to-end KyberSwap swap: resolve tokens → get route → build tx
#
# Usage: fast-swap.sh <amount> <tokenIn> <tokenOut> <chain> <sender> [recipient] [slippage_bps]
# Output: JSON to stdout, progress to stderr
# Dependencies: curl, jq
# Docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────

BASE_URL="https://aggregator-api.kyberswap.com"
TOKEN_API="https://token-api.kyberswap.com/api/v1/public/tokens"
CLIENT_ID="ai-agent-skills"
NATIVE="0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE"

# ── Helpers ─────────────────────────────────────────────────────────────────

log() { echo ":: $*" >&2; }

die() {
  local msg="$*"
  jq -nc --arg error "$msg" '{ok: false, error: $error}'
  exit 1
}

# URL-encode a string (requires jq)
urlencode() { printf '%s' "$1" | jq -sRr @uri; }

usage() {
  cat >&2 <<'EOF'
Usage: fast-swap.sh <amount> <tokenIn> <tokenOut> <chain> <sender> [recipient] [slippage_bps]

  amount        Human-readable amount to swap (e.g. 1, 0.5, 100)
  tokenIn       Input token symbol (e.g. ETH, USDC)
  tokenOut      Output token symbol (e.g. USDC, ETH)
  chain         Chain slug (e.g. ethereum, arbitrum, polygon)
  sender        Sender wallet address (0x...)
  recipient     Recipient address (default: sender)
  slippage_bps  Slippage tolerance in basis points (default: 50)
EOF
  exit 1
}

# Convert human-readable amount to wei (plain integer string, no decimals/sci notation)
to_wei() {
  local amount="$1" decimals="$2"
  local int_part dec_part dec_len pad_len result

  # Validate: must be a non-negative number (digits with optional single dot)
  if ! [[ "$amount" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    die "Invalid amount for to_wei: '$amount'. Must be a non-negative number."
  fi

  if [[ "$amount" == *.* ]]; then
    int_part="${amount%%.*}"
    dec_part="${amount#*.}"
  else
    int_part="$amount"
    dec_part=""
  fi

  [[ -z "$int_part" ]] && int_part="0"
  dec_len=${#dec_part}

  if (( dec_len >= decimals )); then
    # Truncate excess decimal places
    result="${int_part}${dec_part:0:$decimals}"
  else
    # Pad with trailing zeros
    pad_len=$((decimals - dec_len))
    result="${int_part}${dec_part}$(printf '%0*d' "$pad_len" 0)"
  fi

  # Strip leading zeros, keep at least "0"
  result="$(echo "$result" | sed 's/^0*//')"
  echo "${result:-0}"
}

# Convert wei to human-readable amount
from_wei() {
  local wei="$1" decimals="$2"
  local len int_part dec_part

  [[ -z "$wei" || "$wei" == "0" ]] && echo "0" && return

  # Strip leading zeros from input
  wei="$(echo "$wei" | sed 's/^0*//')"
  [[ -z "$wei" ]] && echo "0" && return

  len=${#wei}

  if (( decimals == 0 )); then
    echo "$wei"
  elif (( len <= decimals )); then
    local pad=$((decimals - len))
    if (( pad > 0 )); then
      dec_part="$(printf '%0*d' "$pad" 0)${wei}"
    else
      dec_part="$wei"
    fi
    dec_part="$(echo "$dec_part" | sed 's/0*$//')"
    [[ -z "$dec_part" ]] && echo "0" && return
    echo "0.${dec_part}"
  else
    int_part="${wei:0:$((len - decimals))}"
    dec_part="${wei:$((len - decimals))}"
    dec_part="$(echo "$dec_part" | sed 's/0*$//')"
    if [[ -z "$dec_part" ]]; then
      echo "$int_part"
    else
      echo "${int_part}.${dec_part}"
    fi
  fi
}

# Get chain ID from slug
get_chain_id() {
  case "$1" in
    ethereum)   echo 1 ;;
    bsc)        echo 56 ;;
    arbitrum)   echo 42161 ;;
    polygon)    echo 137 ;;
    optimism)   echo 10 ;;
    base)       echo 8453 ;;
    avalanche)  echo 43114 ;;
    linea)      echo 59144 ;;
    mantle)     echo 5000 ;;
    sonic)      echo 146 ;;
    berachain)  echo 80094 ;;
    ronin)      echo 2020 ;;
    unichain)   echo 130 ;;
    hyperevm)   echo 999 ;;
    plasma)     echo 9745 ;;
    etherlink)  echo 42793 ;;
    monad)      echo 143 ;;
    megaeth)    echo 4326 ;;
    *) return 1 ;;
  esac
}

# Look up token in built-in registry. Outputs: "address decimals"
lookup_token() {
  local chain="$1" sym
  sym=$(echo "$2" | tr '[:lower:]' '[:upper:]')

  case "$chain:$sym" in
    # ── Native tokens ──
    ethereum:ETH|arbitrum:ETH|optimism:ETH|base:ETH|linea:ETH|unichain:ETH|megaeth:ETH)
      echo "$NATIVE 18" ;;
    bsc:BNB)                    echo "$NATIVE 18" ;;
    polygon:POL|polygon:MATIC)  echo "$NATIVE 18" ;;
    avalanche:AVAX)             echo "$NATIVE 18" ;;
    mantle:MNT)                 echo "$NATIVE 18" ;;
    sonic:S)                    echo "$NATIVE 18" ;;
    berachain:BERA)             echo "$NATIVE 18" ;;
    ronin:RON)                  echo "$NATIVE 18" ;;
    etherlink:XTZ)              echo "$NATIVE 18" ;;
    monad:MON)                  echo "$NATIVE 18" ;;

    # ── Stablecoins: Ethereum ──
    ethereum:USDC) echo "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 6" ;;
    ethereum:USDT) echo "0xdAC17F958D2ee523a2206206994597C13D831ec7 6" ;;

    # ── Stablecoins: BSC ──
    bsc:USDC)      echo "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d 18" ;;
    bsc:USDT)      echo "0x55d398326f99059fF775485246999027B3197955 18" ;;

    # ── Stablecoins: Arbitrum ──
    arbitrum:USDC) echo "0xaf88d065e77c8cC2239327C5EDb3A432268e5831 6" ;;
    arbitrum:USDT) echo "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9 6" ;;

    # ── Stablecoins: Polygon ──
    polygon:USDC)  echo "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 6" ;;
    polygon:USDT)  echo "0xc2132D05D31c914a87C6611C10748AEb04B58e8F 6" ;;

    # ── Stablecoins: Optimism ──
    optimism:USDC) echo "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 6" ;;
    optimism:USDT) echo "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58 6" ;;

    # ── Stablecoins: Base ──
    base:USDC)     echo "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 6" ;;

    # ── Stablecoins: Avalanche ──
    avalanche:USDC) echo "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E 6" ;;
    avalanche:USDT) echo "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7 6" ;;

    # ── Stablecoins: Linea ──
    linea:USDC)    echo "0x176211869cA2b568f2A7D4EE941E073a821EE1ff 6" ;;
    linea:USDT)    echo "0xA219439258ca9da29E9Cc4cE5596924745e12B93 6" ;;

    # ── Stablecoins: Sonic ──
    sonic:USDC.E|sonic:USDC) echo "0x29219dd400f2Bf60E5a23d13Be72B486D4038894 6" ;;

    # ── Stablecoins: Mantle ──
    mantle:USDC) echo "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9 6" ;;

    *) return 1 ;;
  esac
}

# Resolve token via KyberSwap Token API (fallback). Outputs: "address decimals"
resolve_token_api() {
  local chain_id="$1" symbol="$2"
  local resp match

  log "Looking up $symbol via Token API (chain $chain_id)..."

  local encoded_symbol
  encoded_symbol=$(urlencode "$symbol")

  # Try symbol search first (exact match, most reliable)
  resp=$(curl -s --connect-timeout 10 --max-time 30 "${TOKEN_API}?chainIds=${chain_id}&symbol=${encoded_symbol}&isWhitelisted=true" \
    -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || true

  if [[ -n "$resp" ]]; then
    match=$(echo "$resp" | jq -r --arg s "$symbol" \
      '[.data.tokens[] | select(.symbol | ascii_downcase == ($s | ascii_downcase))] | sort_by(-(.marketCap // 0)) | first // empty | "\(.address) \(.decimals)"' 2>/dev/null) || true

    if [[ -n "$match" && "$match" != " " ]]; then
      echo "$match"
      return 0
    fi
  fi

  # Fall back to unfiltered symbol search (for non-whitelisted tokens)
  resp=$(curl -s --connect-timeout 10 --max-time 30 "${TOKEN_API}?chainIds=${chain_id}&symbol=${encoded_symbol}" \
    -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || true

  if [[ -n "$resp" ]]; then
    match=$(echo "$resp" | jq -r --arg s "$symbol" \
      '[.data.tokens[] | select(.symbol | ascii_downcase == ($s | ascii_downcase)) | select(.isVerified == true or (.marketCap // 0) > 0)] | sort_by(-(.marketCap // 0)) | first // empty | "\(.address) \(.decimals)"' 2>/dev/null) || true

    if [[ -n "$match" && "$match" != " " ]]; then
      echo "$match"
      return 0
    fi
  fi

  # Fall back to name search (substring match on token name)
  resp=$(curl -s --connect-timeout 10 --max-time 30 "${TOKEN_API}?chainIds=${chain_id}&name=${encoded_symbol}&isWhitelisted=true" \
    -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || true

  if [[ -n "$resp" ]]; then
    match=$(echo "$resp" | jq -r --arg s "$symbol" \
      '[.data.tokens[] | select(.symbol | ascii_downcase == ($s | ascii_downcase))] | sort_by(-(.marketCap // 0)) | first // empty | "\(.address) \(.decimals)"' 2>/dev/null) || true

    if [[ -n "$match" && "$match" != " " ]]; then
      echo "$match"
      return 0
    fi
  fi

  # Fall back to browsing by market cap
  local page
  for page in 1 2 3; do
    resp=$(curl -s --connect-timeout 10 --max-time 30 "${TOKEN_API}?chainIds=${chain_id}&page=${page}&pageSize=100" \
      -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || continue

    match=$(echo "$resp" | jq -r --arg s "$symbol" \
      '[.data.tokens[] | select(.symbol | ascii_downcase == ($s | ascii_downcase)) | select(.isVerified == true or (.marketCap // 0) > 0)] | sort_by(-(.marketCap // 0)) | first // empty | "\(.address) \(.decimals)"' 2>/dev/null) || continue

    if [[ -n "$match" && "$match" != " " ]]; then
      echo "$match"
      return 0
    fi
  done

  return 1
}

# Resolve token: built-in registry first, then Token API fallback
resolve_token() {
  local chain="$1" symbol="$2" chain_id="$3"
  local result

  if result=$(lookup_token "$chain" "$symbol"); then
    echo "$result"
    return 0
  fi

  if result=$(resolve_token_api "$chain_id" "$symbol"); then
    echo "$result"
    return 0
  fi

  return 1
}

# Map API error codes to human-readable messages
api_error_msg() {
  case "$1" in
    4001) echo "Query parameters are malformed. Double-check token addresses and amount format." ;;
    4002) echo "Request body is malformed. Ensure routeSummary is the exact object from the route response." ;;
    4005) echo "feeAmount is greater than amountIn." ;;
    4007) echo "feeAmount is greater than amountOut." ;;
    4008) echo "Route not found. No route available for this pair/amount." ;;
    4009) echo "amountIn is greater than max allowed. Try a smaller amount." ;;
    4010) echo "No pool is eligible to find a route for this pair." ;;
    4011) echo "tokenIn or tokenOut cannot be found. Verify the token addresses." ;;
    4221) echo "WETH is not configured on this network." ;;
    *)    echo "Unknown API error (code $1)." ;;
  esac
}

# ── Main ────────────────────────────────────────────────────────────────────

main() {
  # Check dependencies
  for cmd in curl jq; do
    command -v "$cmd" &>/dev/null || die "Required command not found: ${cmd}. Install it and try again."
  done

  # Parse arguments
  case "${1:-}" in -h|--help) usage ;; esac
  [[ $# -lt 5 ]] && usage

  local amount="$1"
  local token_in_sym="$2"
  local token_out_sym="$3"
  local chain="$4"
  local sender="$5"
  local recipient="${6:-$sender}"
  local slippage="${7:-50}"

  # Validate token inputs: either a symbol (e.g. ETH, USDC) or pre-resolved address:decimals (e.g. 0xA0b8...:6)
  if [[ "$token_in_sym" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    :  # Pre-resolved address:decimals — validated by regex
  elif [[ "$token_in_sym" =~ ^[a-zA-Z0-9.]+$ ]]; then
    :  # Symbol — validated by regex
  else
    die "Invalid token input: $token_in_sym. Must be a symbol (e.g. ETH) or address:decimals (e.g. 0xA0b8...:6)"
  fi
  if [[ "$token_out_sym" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    :  # Pre-resolved address:decimals — validated by regex
  elif [[ "$token_out_sym" =~ ^[a-zA-Z0-9.]+$ ]]; then
    :  # Symbol — validated by regex
  else
    die "Invalid token output: $token_out_sym. Must be a symbol (e.g. USDC) or address:decimals (e.g. 0xA0b8...:6)"
  fi

  # Validate addresses
  [[ "$sender" =~ ^0x[a-fA-F0-9]{40}$ ]] || die "Invalid sender address: $sender"
  # Reject zero address and native token sentinel as sender
  local sender_lower
  sender_lower=$(echo "$sender" | tr '[:upper:]' '[:lower:]')
  if [[ "$sender_lower" == "0x0000000000000000000000000000000000000000" ]]; then
    die "Cannot use zero address as sender. Please provide your actual wallet address."
  fi
  if [[ "$sender_lower" == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ]]; then
    die "Cannot use the native token sentinel address as sender. Please provide your actual wallet address."
  fi
  [[ -z "$recipient" ]] && recipient="$sender"
  [[ "$recipient" =~ ^0x[a-fA-F0-9]{40}$ ]] || die "Invalid recipient address: $recipient"
  # Reject zero address and native token sentinel as recipient
  local recipient_lower
  recipient_lower=$(echo "$recipient" | tr '[:upper:]' '[:lower:]')
  if [[ "$recipient_lower" == "0x0000000000000000000000000000000000000000" ]]; then
    die "Cannot use zero address as recipient. Please provide your actual wallet address."
  fi
  if [[ "$recipient_lower" == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" ]]; then
    die "Cannot use the native token sentinel address as recipient. Please provide your actual wallet address."
  fi

  # Validate slippage
  if ! [[ "$slippage" =~ ^[0-9]+$ ]] || (( slippage > 2000 )); then
    die "Slippage must be 0-2000 basis points (0-20%). Got: ${slippage}. If you intentionally need higher slippage, this is likely a mistake."
  fi

  local slippage_bps=$slippage
  if (( slippage_bps > 500 )); then
    if command -v bc &>/dev/null; then
      log "WARNING: High slippage of ${slippage_bps} bps ($(echo "scale=1; $slippage_bps / 100" | bc)%). Most swaps use 50-300 bps."
    else
      log "WARNING: High slippage of ${slippage_bps} bps. Most swaps use 50-300 bps."
    fi
  fi

  # Validate chain
  local chain_id
  chain_id=$(get_chain_id "$chain") || \
    die "Unsupported chain: ${chain}. Check supported chains at https://common-service.kyberswap.com/api/v1/aggregator/supported-chains"

  # ── Step 1: Resolve tokens ──────────────────────────────────────────────

  local tin_addr tin_dec tout_addr tout_dec

  # If tokenIn is pre-resolved address:decimals, split and skip resolution
  if [[ "$token_in_sym" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    tin_addr="${token_in_sym%%:*}"
    tin_dec="${token_in_sym##*:}"
    log "Using pre-resolved tokenIn: ${tin_addr} (${tin_dec} decimals)"
  else
    log "Resolving ${token_in_sym} on ${chain}..."
    local tin_info
    tin_info=$(resolve_token "$chain" "$token_in_sym" "$chain_id") || \
      die "Token '${token_in_sym}' not found on ${chain}. Verify the symbol or provide a contract address."
    tin_addr=$(echo "$tin_info" | awk '{print $1}')
    tin_dec=$(echo "$tin_info" | awk '{print $2}')
    [[ "$tin_addr" =~ ^0x[a-fA-F0-9]{40}$ ]] || die "Invalid token address for $token_in_sym: $tin_addr"
    log "  ${token_in_sym} = ${tin_addr} (${tin_dec} decimals)"
  fi

  # If tokenOut is pre-resolved address:decimals, split and skip resolution
  if [[ "$token_out_sym" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    tout_addr="${token_out_sym%%:*}"
    tout_dec="${token_out_sym##*:}"
    log "Using pre-resolved tokenOut: ${tout_addr} (${tout_dec} decimals)"
  else
    log "Resolving ${token_out_sym} on ${chain}..."
    local tout_info
    tout_info=$(resolve_token "$chain" "$token_out_sym" "$chain_id") || \
      die "Token '${token_out_sym}' not found on ${chain}. Verify the symbol or provide a contract address."
    tout_addr=$(echo "$tout_info" | awk '{print $1}')
    tout_dec=$(echo "$tout_info" | awk '{print $2}')
    [[ "$tout_addr" =~ ^0x[a-fA-F0-9]{40}$ ]] || die "Invalid token address for $token_out_sym: $tout_addr"
    log "  ${token_out_sym} = ${tout_addr} (${tout_dec} decimals)"
  fi

  local tin_is_native="false" tout_is_native="false"
  [[ "$tin_addr" == "$NATIVE" ]] && tin_is_native="true"
  [[ "$tout_addr" == "$NATIVE" ]] && tout_is_native="true"

  # ── Step 1b: Honeypot / FOT check ────────────────────────────────────

  check_honeypot() {
    local addr="$1" symbol="$2" is_native="$3"
    [[ "$is_native" == "true" ]] && return 0

    # Validate address format before using in API URL
    [[ "$addr" =~ ^0x[a-fA-F0-9]{40}$ ]] || return 1

    local resp hp fot tax
    resp=$(curl -s --connect-timeout 10 --max-time 30 "${TOKEN_API}/honeypot-fot-info?chainId=${chain_id}&address=${addr}" \
      -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || { log "WARNING: Token safety API unreachable for ${symbol}. Proceeding without honeypot/FOT check."; return 0; }

    hp=$(echo "$resp" | jq -r '.data.isHoneypot // false' 2>/dev/null) || { log "WARNING: Could not parse safety data for ${symbol}."; return 0; }
    fot=$(echo "$resp" | jq -r '.data.isFOT // false' 2>/dev/null) || { log "WARNING: Could not parse FOT data for ${symbol}."; return 0; }
    tax=$(echo "$resp" | jq -r '.data.tax // 0' 2>/dev/null) || return 0

    if [[ "$hp" == "true" ]]; then
      die "HONEYPOT DETECTED: ${symbol} (${addr}) is flagged as a honeypot. You will not be able to sell this token. Swap aborted."
    fi

    if [[ "$fot" == "true" ]]; then
      log "WARNING: ${symbol} has a fee-on-transfer (tax: ${tax}%). The actual received amount will be less than the swap output."
    fi
  }

  log "Checking token safety..."
  check_honeypot "$tin_addr" "$token_in_sym" "$tin_is_native"
  check_honeypot "$tout_addr" "$token_out_sym" "$tout_is_native"

  # ── Step 2: Convert amount to wei ───────────────────────────────────────

  local amount_wei
  amount_wei=$(to_wei "$amount" "$tin_dec")
  log "Amount: ${amount} ${token_in_sym} = ${amount_wei} wei"

  # ── Step 3: GET route ───────────────────────────────────────────────────

  fetch_route() {
    log "Fetching route..."
    local encoded_sender
    encoded_sender=$(urlencode "$sender")
    local url="${BASE_URL}/${chain}/api/v1/routes?tokenIn=${tin_addr}&tokenOut=${tout_addr}&amountIn=${amount_wei}&source=${CLIENT_ID}&origin=${encoded_sender}"

    local resp code
    resp=$(curl -s --connect-timeout 10 --max-time 30 "$url" -H "X-Client-Id: ${CLIENT_ID}" 2>/dev/null) || \
      die "Network error: failed to reach KyberSwap route API."

    code=$(echo "$resp" | jq -r '.code' 2>/dev/null) || \
      die "Route API returned an invalid response."

    if [[ "$code" != "0" ]]; then
      die "Route error (${code}): $(api_error_msg "$code")"
    fi

    local summary
    summary=$(echo "$resp" | jq -c '.data.routeSummary' 2>/dev/null)
    if [[ -z "$summary" || "$summary" == "null" ]]; then
      die "Route API returned no route data."
    fi

    echo "$resp"
  }

  local route_resp
  route_resp=$(fetch_route)

  # Extract route data
  local route_summary router_address amount_out amount_in_usd amount_out_usd
  local route_gas route_gas_usd l1_fee_usd

  route_summary=$(echo "$route_resp" | jq -c '.data.routeSummary')
  router_address=$(echo "$route_resp" | jq -r '.data.routerAddress')

  # Verify router address matches expected KyberSwap router
  # Override with EXPECTED_ROUTER_OVERRIDE env var if KyberSwap deploys a new router version
  local expected_router="${EXPECTED_ROUTER_OVERRIDE:-0x6131B5fae19EA4f9D964eAc0408E4408b66337b5}"
  if [[ -n "${EXPECTED_ROUTER_OVERRIDE:-}" ]]; then
    if ! [[ "$expected_router" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
      die "Invalid EXPECTED_ROUTER_OVERRIDE format. Must be a valid Ethereum address (0x + 40 hex chars)."
    fi
    log "WARNING: Using custom router override: $expected_router"
  fi
  local router_lower expected_lower
  router_lower=$(echo "$router_address" | tr '[:upper:]' '[:lower:]')
  expected_lower=$(echo "$expected_router" | tr '[:upper:]' '[:lower:]')
  if [[ "$router_lower" != "$expected_lower" ]]; then
    die "Unexpected router address from API: $router_address. Expected: $expected_router. This could indicate a compromised API response."
  fi

  amount_out=$(echo "$route_resp" | jq -r '.data.routeSummary.amountOut')
  [[ "$amount_out" =~ ^[0-9]+$ ]] && (( amount_out > 0 )) || die "Invalid amountOut from API: '$amount_out'. Possible API corruption."
  amount_in_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.amountInUsd')
  amount_out_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.amountOutUsd')
  route_gas=$(echo "$route_resp" | jq -r '.data.routeSummary.gas')
  route_gas_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.gasUsd')
  l1_fee_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.l1FeeUsd // "0"')

  local amount_out_human
  amount_out_human=$(from_wei "$amount_out" "$tout_dec")
  log "Route found: ${amount} ${token_in_sym} -> ${amount_out_human} ${token_out_sym}"

  # ── Step 3b: Dust amount check ─────────────────────────────────────────
  # Reject swaps where the value is so small that gas fees dwarf the trade.

  if command -v bc &>/dev/null && [[ "$amount_in_usd" =~ ^[0-9]*\.?[0-9]+$ ]] && [[ "$route_gas_usd" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    # Check 1: Swap value < $0.10
    if (( $(echo "$amount_in_usd < 0.10" | bc -l 2>/dev/null || echo 0) )); then
      die "Dust amount detected: swap value is ~\$${amount_in_usd} (< \$0.10). Gas fees (~\$${route_gas_usd}) would far exceed the swap value. Use a larger amount."
    fi

    # Check 2: Gas cost > swap value
    if (( $(echo "$route_gas_usd > $amount_in_usd" | bc -l 2>/dev/null || echo 0) )); then
      die "Uneconomical swap: gas cost (~\$${route_gas_usd}) exceeds swap value (~\$${amount_in_usd}). Use a larger amount to make this trade worthwhile."
    fi
  fi

  # ── Step 4: POST build ──────────────────────────────────────────────────

  build_tx() {
    local rs="$1"
    log "Building transaction..."

    local deadline
    deadline=$(($(date +%s) + 1200))

    local body
    body=$(jq -nc \
      --argjson routeSummary "$rs" \
      --arg sender "$sender" \
      --arg recipient "$recipient" \
      --argjson slippage "$slippage" \
      --argjson deadline "$deadline" \
      '{
        routeSummary: $routeSummary,
        sender: $sender,
        recipient: $recipient,
        origin: $sender,
        slippageTolerance: $slippage,
        deadline: $deadline,
        source: "ai-agent-skills"
      }')

    local resp
    resp=$(curl -s --connect-timeout 10 --max-time 30 -X POST "${BASE_URL}/${chain}/api/v1/route/build" \
      -H "Content-Type: application/json" \
      -H "X-Client-Id: ${CLIENT_ID}" \
      -d "$body" 2>/dev/null) || \
      die "Network error: failed to reach KyberSwap build API."

    echo "$resp"
  }

  local build_resp build_code
  build_resp=$(build_tx "$route_summary")
  build_code=$(echo "$build_resp" | jq -r '.code' 2>/dev/null) || \
    die "Build API returned an invalid response."

  # Retry once on stale route (4008)
  if [[ "$build_code" == "4008" ]]; then
    log "Route may be stale, re-fetching..."
    route_resp=$(fetch_route)
    route_summary=$(echo "$route_resp" | jq -c '.data.routeSummary')
    router_address=$(echo "$route_resp" | jq -r '.data.routerAddress')
    # Re-validate router address on retry path
    router_lower=$(echo "$router_address" | tr '[:upper:]' '[:lower:]')
    if [[ "$router_lower" != "$expected_lower" ]]; then
      die "Unexpected router address from API on retry: $router_address. Expected: $expected_router."
    fi
    amount_out=$(echo "$route_resp" | jq -r '.data.routeSummary.amountOut')
    [[ "$amount_out" =~ ^[0-9]+$ ]] && (( amount_out > 0 )) || die "Invalid amountOut from API on retry: '$amount_out'."
    amount_in_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.amountInUsd')
    amount_out_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.amountOutUsd')
    route_gas=$(echo "$route_resp" | jq -r '.data.routeSummary.gas')
    route_gas_usd=$(echo "$route_resp" | jq -r '.data.routeSummary.gasUsd')
    amount_out_human=$(from_wei "$amount_out" "$tout_dec")

    build_resp=$(build_tx "$route_summary")
    build_code=$(echo "$build_resp" | jq -r '.code' 2>/dev/null) || \
      die "Build API returned an invalid response on retry."
  fi

  if [[ "$build_code" != "0" ]]; then
    die "Build error (${build_code}): $(api_error_msg "$build_code")"
  fi

  # Extract build data
  local tx_data tx_value tx_gas tx_gas_usd tx_amount_out tx_amount_out_usd
  local additional_cost_usd additional_cost_msg

  tx_data=$(echo "$build_resp" | jq -r '.data.data')
  tx_value=$(echo "$build_resp" | jq -r '.data.transactionValue')
  tx_gas=$(echo "$build_resp" | jq -r '.data.gas')
  tx_gas_usd=$(echo "$build_resp" | jq -r '.data.gasUsd')
  tx_amount_out=$(echo "$build_resp" | jq -r '.data.amountOut')
  tx_amount_out_usd=$(echo "$build_resp" | jq -r '.data.amountOutUsd')
  additional_cost_usd=$(echo "$build_resp" | jq -r '.data.additionalCostUsd // "0"')
  additional_cost_msg=$(echo "$build_resp" | jq -r '.data.additionalCostMessage // ""')

  local tx_amount_out_human
  tx_amount_out_human=$(from_wei "$tx_amount_out" "$tout_dec")
  log "Transaction built: ${tx_amount_out_human} ${token_out_sym}"

  # ── Step 5: Output JSON ────────────────────────────────────────────────

  jq -n \
    --argjson ok true \
    --arg chain "$chain" \
    --arg sender "$sender" \
    --arg recipient "$recipient" \
    --argjson slippageBps "$slippage" \
    --arg tokenInSymbol "$token_in_sym" \
    --arg tokenInAddress "$tin_addr" \
    --argjson tokenInDecimals "$tin_dec" \
    --argjson tokenInIsNative "$tin_is_native" \
    --arg tokenOutSymbol "$token_out_sym" \
    --arg tokenOutAddress "$tout_addr" \
    --argjson tokenOutDecimals "$tout_dec" \
    --argjson tokenOutIsNative "$tout_is_native" \
    --arg amountIn "$amount" \
    --arg amountInWei "$amount_wei" \
    --arg amountInUsd "$amount_in_usd" \
    --arg amountOut "$amount_out_human" \
    --arg amountOutWei "$amount_out" \
    --arg amountOutUsd "$amount_out_usd" \
    --arg quoteGas "$route_gas" \
    --arg quoteGasUsd "$route_gas_usd" \
    --arg l1FeeUsd "$l1_fee_usd" \
    --arg routerAddress "$router_address" \
    --argjson route "$(echo "$route_resp" | jq -c '.data.routeSummary.route')" \
    --arg txTo "$router_address" \
    --arg txData "$tx_data" \
    --arg txValue "$tx_value" \
    --arg txGas "$tx_gas" \
    --arg txGasUsd "$tx_gas_usd" \
    --arg txAmountOut "$tx_amount_out_human" \
    --arg txAmountOutWei "$tx_amount_out" \
    --arg txAmountOutUsd "$tx_amount_out_usd" \
    --arg additionalCostUsd "$additional_cost_usd" \
    --arg additionalCostMsg "$additional_cost_msg" \
    '{
      ok: $ok,
      chain: $chain,
      sender: $sender,
      recipient: $recipient,
      slippageBps: $slippageBps,
      tokenIn: {
        symbol: $tokenInSymbol,
        address: $tokenInAddress,
        decimals: $tokenInDecimals,
        isNative: $tokenInIsNative
      },
      tokenOut: {
        symbol: $tokenOutSymbol,
        address: $tokenOutAddress,
        decimals: $tokenOutDecimals,
        isNative: $tokenOutIsNative
      },
      quote: {
        amountIn: $amountIn,
        amountInWei: $amountInWei,
        amountInUsd: $amountInUsd,
        amountOut: $amountOut,
        amountOutWei: $amountOutWei,
        amountOutUsd: $amountOutUsd,
        gas: $quoteGas,
        gasUsd: $quoteGasUsd,
        l1FeeUsd: $l1FeeUsd,
        routerAddress: $routerAddress,
        route: $route
      },
      tx: {
        to: $txTo,
        data: $txData,
        value: $txValue,
        gas: $txGas,
        gasUsd: $txGasUsd,
        amountOut: $txAmountOut,
        amountOutWei: $txAmountOutWei,
        amountOutUsd: $txAmountOutUsd,
        additionalCostUsd: $additionalCostUsd,
        additionalCostMessage: $additionalCostMsg
      }
    }'
}

main "$@"
