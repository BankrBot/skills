#!/usr/bin/env bash
#
# execute-swap.sh - Build and execute a KyberSwap swap in one step
#
# WARNING: This script must be executed, not sourced. Do NOT run: source execute-swap.sh
#          Sourcing would leak ETH_PRIVATE_KEY into the parent shell environment.
#
# Usage:
#   ./execute-swap.sh <amount> <tokenIn> <tokenOut> <chain> <sender> [recipient] [slippage_bps] [wallet_method] [keystore_name]
#
# Arguments:
#   amount         Human-readable amount (e.g. 1, 0.5, 100)
#   tokenIn        Input token symbol (e.g. ETH, USDC)
#   tokenOut       Output token symbol (e.g. USDC, ETH)
#   chain          Chain slug (e.g. ethereum, arbitrum, base)
#   sender         Sender wallet address
#   recipient      Recipient address (default: same as sender)
#   slippage_bps   Slippage in basis points (default: 50)
#   wallet_method  keystore | env | ledger | trezor (default: keystore)
#   keystore_name  Keystore account name (default: mykey)
#
# Environment:
#   PRIVATE_KEY             Required if wallet_method=env
#   KEYSTORE_PASSWORD_FILE  Override default ~/.foundry/.password
#   RPC_URL_OVERRIDE        Override chain RPC URL
#   FAST_SWAP_MAX_USD       Override $1000 USD threshold (default: 1000)
#
# Example:
#   ./execute-swap.sh 1 USDC ETH base 0xYourAddress "" 50 keystore mykey
#
set -euo pipefail

# Ensure ETH_PRIVATE_KEY is always cleared on exit (normal, error, or signal)
trap 'unset ETH_PRIVATE_KEY 2>/dev/null' EXIT

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAST_SWAP_SCRIPT="${SCRIPT_DIR}/fast-swap.sh"
PASSWORD_FILE="${KEYSTORE_PASSWORD_FILE:-$HOME/.foundry/.password}"

# Get RPC URL for chain
get_rpc_url() {
  local chain="$1"
  case "$chain" in
    ethereum)   echo "https://rpc.ankr.com/eth" ;;
    arbitrum)   echo "https://arb1.arbitrum.io/rpc" ;;
    polygon)    echo "https://polygon-rpc.com" ;;
    optimism)   echo "https://mainnet.optimism.io" ;;
    base)       echo "https://mainnet.base.org" ;;
    bsc)        echo "https://bsc-dataseed.binance.org" ;;
    avalanche)  echo "https://api.avax.network/ext/bc/C/rpc" ;;
    linea)      echo "https://rpc.linea.build" ;;
    mantle)     echo "https://rpc.mantle.xyz" ;;
    sonic)      echo "https://rpc.soniclabs.com" ;;
    berachain)  echo "https://rpc.berachain.com" ;;
    ronin)      echo "https://api.roninchain.com/rpc" ;;
    unichain)   echo "https://rpc.unichain.org" ;;
    hyperevm)   echo "https://rpc.hyperliquid.xyz/evm" ;;
    plasma)     echo "https://plasma.drpc.org" ;;
    etherlink)  echo "https://node.mainnet.etherlink.com" ;;
    monad)      echo "https://rpc.monad.xyz" ;;
    # MegaETH: state=new in KyberSwap API, RPC not confirmed as of 2026-02-19
    megaeth)    echo "https://rpc.megaeth.com" ;;
    *)          echo "" ;;
  esac
}

# Get fallback RPC URL for chain (used when primary RPC fails)
get_fallback_rpc_url() {
  local chain="$1"
  case "$chain" in
    ethereum)   echo "https://eth.llamarpc.com" ;;
    arbitrum)   echo "https://rpc.ankr.com/arbitrum" ;;
    polygon)    echo "https://rpc.ankr.com/polygon" ;;
    optimism)   echo "https://rpc.ankr.com/optimism" ;;
    base)       echo "https://rpc.ankr.com/base" ;;
    bsc)        echo "https://bsc-dataseed1.defibit.io" ;;
    avalanche)  echo "https://rpc.ankr.com/avalanche" ;;
    *)          echo "" ;;
  esac
}

# Get block explorer URL for chain
get_explorer_url() {
  local chain="$1"
  case "$chain" in
    ethereum)   echo "https://etherscan.io" ;;
    arbitrum)   echo "https://arbiscan.io" ;;
    polygon)    echo "https://polygonscan.com" ;;
    optimism)   echo "https://optimistic.etherscan.io" ;;
    base)       echo "https://basescan.org" ;;
    bsc)        echo "https://bscscan.com" ;;
    avalanche)  echo "https://snowtrace.io" ;;
    linea)      echo "https://lineascan.build" ;;
    mantle)     echo "https://mantlescan.xyz" ;;
    sonic)      echo "https://sonicscan.io" ;;
    berachain)  echo "https://berascan.com" ;;
    ronin)      echo "https://app.roninchain.com" ;;
    unichain)   echo "https://uniscan.xyz" ;;
    hyperevm)   echo "https://explorer.hyperliquid.xyz" ;;
    plasma)     echo "https://plasmascan.io" ;;
    etherlink)  echo "https://explorer.etherlink.com" ;;
    monad)      echo "https://explorer.monad.xyz" ;;
    megaeth)    echo "https://explorer.megaeth.com" ;;
    *)          echo "https://etherscan.io" ;;
  esac
}

# Get expected chain ID for chain slug (AC-3: chain ID verification)
get_expected_chain_id() {
  local chain="$1"
  case "$chain" in
    ethereum)   echo "1" ;;
    arbitrum)   echo "42161" ;;
    polygon)    echo "137" ;;
    optimism)   echo "10" ;;
    base)       echo "8453" ;;
    bsc)        echo "56" ;;
    avalanche)  echo "43114" ;;
    linea)      echo "59144" ;;
    mantle)     echo "5000" ;;
    sonic)      echo "146" ;;
    berachain)  echo "80094" ;;
    ronin)      echo "2020" ;;
    unichain)   echo "130" ;;
    hyperevm)   echo "999" ;;
    plasma)     echo "9745" ;;
    etherlink)  echo "42793" ;;
    monad)      echo "143" ;;
    megaeth)    echo "4326" ;;
    *)          echo "" ;;
  esac
}

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

log() { echo "[execute-swap] $*" >&2; }
error() { echo "[execute-swap] ERROR: $*" >&2; }

json_output() {
  local ok="$1"
  shift
  if [[ "$ok" == "true" ]]; then
    echo "$@"
  else
    jq -n --arg error "$1" '{"ok": false, "error": $error}'
  fi
}

usage() {
  cat >&2 <<EOF
Usage: $0 <amount> <tokenIn> <tokenOut> <chain> <sender> [recipient] [slippage_bps] [wallet_method] [keystore_name]

Arguments:
  amount         Human-readable amount (e.g. 1, 0.5, 100)
  tokenIn        Input token symbol (e.g. ETH, USDC)
  tokenOut       Output token symbol (e.g. USDC, ETH)
  chain          Chain slug (e.g. ethereum, arbitrum, base)
  sender         Sender wallet address
  recipient      Recipient address (default: same as sender)
  slippage_bps   Slippage in basis points (default: 50)
  wallet_method  keystore | env | ledger | trezor (default: keystore)
  keystore_name  Keystore account name (default: mykey)

Examples:
  $0 1 ETH USDC ethereum 0xYourAddress
  $0 100 USDC ETH arbitrum 0xYourAddress "" 50 keystore mykey
  $0 0.5 WBTC DAI polygon 0xSender 0xRecipient 100 env
  $0 1 ETH USDC base 0xYourAddress "" 50 ledger
EOF
  exit 1
}

# -----------------------------------------------------------------------------
# Validation
# -----------------------------------------------------------------------------

check_dependencies() {
  if ! command -v cast &>/dev/null; then
    json_output false "Swap failed (pre-flight): cast not found. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup. No transaction was submitted."
    exit 1
  fi
  if ! command -v jq &>/dev/null; then
    json_output false "Swap failed (pre-flight): jq not found. Install: brew install jq (mac) or apt install jq (linux). No transaction was submitted."
    exit 1
  fi
  if ! command -v curl &>/dev/null; then
    json_output false "Swap failed (pre-flight): curl not found. Install: brew install curl (mac) or apt install curl (linux). No transaction was submitted."
    exit 1
  fi
  if [[ ! -f "$FAST_SWAP_SCRIPT" ]]; then
    json_output false "Swap failed (pre-flight): fast-swap.sh not found at: $FAST_SWAP_SCRIPT. No transaction was submitted."
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

main() {
  check_dependencies

  # Parse arguments
  local amount="${1:-}"
  local token_in="${2:-}"
  local token_out="${3:-}"
  local chain="${4:-}"
  local sender="${5:-}"
  local recipient="${6:-$sender}"
  local slippage_bps="${7:-50}"
  local wallet_method="${8:-keystore}"
  local keystore_name="${9:-mykey}"

  # Validate required arguments
  if [[ -z "$amount" || -z "$token_in" || -z "$token_out" || -z "$chain" || -z "$sender" ]]; then
    usage
  fi

  # M-9: Input format validation to prevent injection attacks
  if ! [[ "$amount" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid amount format '$amount'. Must be a positive number (e.g. 1, 0.5, 100). No transaction was submitted."
    exit 1
  fi
  if ! [[ "$token_in" =~ ^[a-zA-Z0-9.]+$ ]] && ! [[ "$token_in" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid tokenIn '$token_in'. Must be a symbol (e.g. ETH) or address:decimals (e.g. 0xA0b8...:6). No transaction was submitted."
    exit 1
  fi
  if ! [[ "$token_out" =~ ^[a-zA-Z0-9.]+$ ]] && ! [[ "$token_out" =~ ^0x[a-fA-F0-9]{40}:[0-9]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid tokenOut '$token_out'. Must be a symbol (e.g. USDC) or address:decimals (e.g. 0xA0b8...:6). No transaction was submitted."
    exit 1
  fi
  if ! [[ "$chain" =~ ^[a-z0-9-]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid chain slug '$chain'. Must contain only lowercase letters, digits, and hyphens. No transaction was submitted."
    exit 1
  fi

  # H-4: Validate sender/recipient address format
  if ! [[ "$sender" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid sender address '$sender'. Must be a valid Ethereum address (0x + 40 hex chars). No transaction was submitted."
    exit 1
  fi
  if [[ -n "$recipient" ]] && ! [[ "$recipient" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid recipient address '$recipient'. Must be a valid Ethereum address (0x + 40 hex chars). No transaction was submitted."
    exit 1
  fi

  # H-5: Validate slippage_bps and keystore_name
  if [[ -n "$slippage_bps" ]] && ! [[ "$slippage_bps" =~ ^[0-9]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid slippage '$slippage_bps'. Must be a non-negative integer (basis points). No transaction was submitted."
    exit 1
  fi
  if [[ -n "$keystore_name" ]] && ! [[ "$keystore_name" =~ ^[a-zA-Z0-9_.-]+$ ]]; then
    json_output false "Swap failed (pre-flight): Invalid keystore name '$keystore_name'. Must contain only letters, digits, underscores, dots, and hyphens. No transaction was submitted."
    exit 1
  fi

  # Default recipient to sender if empty
  if [[ -z "$recipient" ]]; then
    recipient="$sender"
  fi

  log "Building swap: $amount $token_in → $token_out on $chain"
  log "Sender: $sender"
  log "Recipient: $recipient"
  log "Slippage: ${slippage_bps} bps"

  # ─────────────────────────────────────────────────────────────────────────
  # Step 1: Build the swap using fast-swap.sh
  # ─────────────────────────────────────────────────────────────────────────

  log "Calling fast-swap.sh to build transaction..."

  local build_output
  local build_stderr
  local build_exit_code=0

  # Capture stdout (JSON) separately from stderr (debug messages)
  # stderr flows through to user, stdout is captured for parsing
  build_output=$(bash "$FAST_SWAP_SCRIPT" "$amount" "$token_in" "$token_out" "$chain" "$sender" "$recipient" "$slippage_bps") || build_exit_code=$?

  # Validate JSON is parseable
  if ! echo "$build_output" | jq -e . >/dev/null 2>&1; then
    # Try to extract JSON from potentially mixed output (fallback)
    local extracted_json
    extracted_json=$(echo "$build_output" | grep -o '{.*}' | tail -1 2>/dev/null || true)
    if [[ -n "$extracted_json" ]] && echo "$extracted_json" | jq -e . >/dev/null 2>&1; then
      build_output="$extracted_json"
    else
      json_output false "Swap failed (pre-flight): Invalid JSON output from fast-swap.sh. No transaction was submitted."
      exit 1
    fi
  fi

  # Check if build succeeded
  local build_ok
  build_ok=$(echo "$build_output" | jq -r '.ok // "false"' 2>/dev/null || echo "false")

  if [[ "$build_ok" != "true" ]]; then
    local build_error
    build_error=$(echo "$build_output" | jq -r '.error // empty' 2>/dev/null || echo "$build_output")
    json_output false "Swap failed (pre-flight): Build failed — $build_error. No transaction was submitted."
    exit 1
  fi

  log "Swap built successfully"

  # H-2: Enforce USD threshold for fast swap safety
  local max_usd="${FAST_SWAP_MAX_USD:-1000}"
  if ! [[ "$max_usd" =~ ^[0-9]+$ ]]; then max_usd=1000; fi
  local amount_in_usd
  amount_in_usd=$(echo "$build_output" | jq -r '.quote.amountInUsd // .amountInUsd // "0"' 2>/dev/null || echo "0")
  # Sanitize: must be a valid number (integer or decimal)
  if ! [[ "$amount_in_usd" =~ ^[0-9]*\.?[0-9]+$ ]]; then
    amount_in_usd="0"
  fi
  if command -v bc &>/dev/null && [[ "$amount_in_usd" != "0" ]]; then
    if (( $(echo "$amount_in_usd > $max_usd" | bc -l 2>/dev/null || echo 0) )); then
      json_output false "Swap failed (pre-flight): Swap value \$${amount_in_usd} USD exceeds fast-swap safety threshold of \$${max_usd} USD. For large swaps, use /swap-build + /swap-execute for manual review. No transaction was submitted."
      exit 1
    fi
    log "USD value check: \$${amount_in_usd} within \$${max_usd} threshold"
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Step 2: Extract transaction data
  # ─────────────────────────────────────────────────────────────────────────

  local to data value gas gas_original
  to=$(echo "$build_output" | jq -r '.tx.to // empty')
  data=$(echo "$build_output" | jq -r '.tx.data // empty')
  value=$(echo "$build_output" | jq -r '.tx.value // "0"')
  gas=$(echo "$build_output" | jq -r '.tx.gas // "500000"')

  # Sanitize value and gas: must be numeric to prevent bc injection
  [[ "$value" =~ ^[0-9]+$ ]] || value="0"

  # Sanitize gas: must be numeric to prevent bc injection
  [[ "$gas" =~ ^[0-9]+$ ]] || gas="500000"

  # Apply 20% buffer to gas limit for safety margin
  if [[ "$gas" =~ ^[0-9]+$ ]]; then
    gas_original="$gas"
    gas=$(( gas + gas / 5 ))
    log "Gas limit: ${gas_original} → ${gas} (+20% buffer)"
  fi

  if [[ -z "$to" || -z "$data" ]]; then
    json_output false "Swap failed (pre-flight): Invalid build output — missing tx.to or tx.data. No transaction was submitted."
    exit 1
  fi

  # Verify router address matches expected KyberSwap router
  # Override with EXPECTED_ROUTER_OVERRIDE env var if KyberSwap deploys a new router version
  local expected_router="${EXPECTED_ROUTER_OVERRIDE:-0x6131B5fae19EA4f9D964eAc0408E4408b66337b5}"
  if [[ -n "${EXPECTED_ROUTER_OVERRIDE:-}" ]]; then
    if ! [[ "$expected_router" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
      json_output false "Swap failed (pre-flight): Invalid EXPECTED_ROUTER_OVERRIDE format. Must be a valid Ethereum address (0x + 40 hex chars). No transaction was submitted."
      exit 1
    fi
    log "WARNING: Using custom router override: $expected_router"
  fi
  local to_lower
  to_lower=$(echo "$to" | tr '[:upper:]' '[:lower:]')
  local expected_lower
  expected_lower=$(echo "$expected_router" | tr '[:upper:]' '[:lower:]')
  if [[ "$to_lower" != "$expected_lower" ]]; then
    json_output false "Swap failed (pre-flight): Unexpected router address '$to'. Expected KyberSwap router: $expected_router. This could indicate a compromised API response. No transaction was submitted."
    exit 1
  fi

  # Get quote info for output
  local amount_in amount_out token_in_symbol token_out_symbol
  amount_in=$(echo "$build_output" | jq -r '.quote.amountIn // "?"')
  amount_out=$(echo "$build_output" | jq -r '.tx.amountOut // .quote.amountOut // "?"')
  token_in_symbol=$(echo "$build_output" | jq -r '.tokenIn.symbol // "?"')
  token_out_symbol=$(echo "$build_output" | jq -r '.tokenOut.symbol // "?"')

  # Get token info for approval check
  local token_in_address token_in_is_native amount_in_wei router_address
  token_in_address=$(echo "$build_output" | jq -r '.tokenIn.address // empty')
  token_in_is_native=$(echo "$build_output" | jq -r '.tokenIn.isNative // false')
  amount_in_wei=$(echo "$build_output" | jq -r '.quote.amountInWei // empty')
  # Sanitize amount_in_wei: must be numeric for bc comparisons
  [[ "$amount_in_wei" =~ ^[0-9]+$ ]] || amount_in_wei=""
  router_address="$to"

  # Resolve RPC URL (needed for all on-chain pre-flight checks)
  local rpc_url="${RPC_URL_OVERRIDE:-$(get_rpc_url "$chain")}"
  if [[ -z "$rpc_url" ]]; then
    json_output false "Swap failed (pre-flight): Unknown chain '$chain'. Set RPC_URL_OVERRIDE env var. No transaction was submitted."
    exit 1
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Step 3: Pre-flight balance checks
  #   Order matters: native balance → token balance → allowance
  #   No point approving if you don't have the tokens or gas.
  # ─────────────────────────────────────────────────────────────────────────

  # 3a) Native balance: covers gas + tx.value
  log "Checking gas price and native balance..."

  local gas_price_wei
  gas_price_wei=$(cast gas-price --rpc-url "$rpc_url" 2>/dev/null || echo "0")
  gas_price_wei="${gas_price_wei%%[^0-9]*}"
  gas_price_wei="${gas_price_wei:-0}"

  # Retry with fallback RPC if primary fails for gas price
  if [[ "$gas_price_wei" == "0" ]]; then
    local fallback_rpc
    fallback_rpc=$(get_fallback_rpc_url "$chain")
    if [[ -n "$fallback_rpc" && "$fallback_rpc" != "$rpc_url" ]]; then
      log "Primary RPC failed for gas price, trying fallback..."
      gas_price_wei=$(cast gas-price --rpc-url "$fallback_rpc" 2>/dev/null || echo "0")
      gas_price_wei="${gas_price_wei%%[^0-9]*}"
      gas_price_wei="${gas_price_wei:-0}"
      # Switch to fallback for remaining calls if it works
      if [[ "$gas_price_wei" != "0" ]]; then
        rpc_url="$fallback_rpc"
        log "Switched to fallback RPC: $rpc_url"
      fi
    fi
  fi

  if [[ "$gas_price_wei" =~ ^[0-9]+$ ]] && (( gas_price_wei > 0 )); then
    local gas_price_gwei
    gas_price_gwei=$(echo "scale=2; $gas_price_wei / 1000000000" | bc -l 2>/dev/null || echo "?")
    log "Gas price: ${gas_price_gwei} gwei"

    local gas_cost_wei total_native_needed
    gas_cost_wei=$(echo "$gas * $gas_price_wei" | bc 2>/dev/null || echo "0")
    total_native_needed=$(echo "$value + $gas_cost_wei" | bc 2>/dev/null || echo "0")

    local native_balance
    native_balance=$(cast balance --rpc-url "$rpc_url" "$sender" 2>/dev/null || echo "0")
    native_balance="${native_balance%%[^0-9]*}"
    native_balance="${native_balance:-0}"

    if [[ "$native_balance" =~ ^[0-9]+$ ]] && [[ "$total_native_needed" =~ ^[0-9]+$ ]] && command -v bc &>/dev/null; then
      if (( $(echo "$native_balance < $total_native_needed" | bc -l) )); then
        json_output false "Swap failed (pre-flight): Insufficient native token balance. Have: ${native_balance} wei, Need: ~${total_native_needed} wei (value: ${value} + gas: ~${gas_cost_wei}). No transaction was submitted."
        exit 1
      fi
    fi
    log "Native balance OK: ${native_balance} wei (need ~${total_native_needed})"
  else
    log "Could not fetch gas price — skipping native balance pre-check"
  fi

  # 3b) ERC-20 token balance + allowance (only for non-native input)
  if [[ "$token_in_is_native" != "true" && -n "$token_in_address" && -n "$amount_in_wei" ]]; then

    # Check balance FIRST — no point approving if you don't have the tokens
    log "Checking $token_in_symbol balance..."
    local balance_hex balance_dec
    balance_hex=$(cast call \
      --rpc-url "$rpc_url" \
      "$token_in_address" \
      "balanceOf(address)(uint256)" \
      "$sender" 2>/dev/null || echo "0")

    if [[ "$balance_hex" == 0x* ]]; then
      balance_dec=$(printf "%d" "$balance_hex" 2>/dev/null || echo "0")
    else
      balance_dec="${balance_hex%%[^0-9]*}"
      balance_dec="${balance_dec:-0}"
    fi

    if [[ "$balance_dec" =~ ^[0-9]+$ ]] && [[ "$amount_in_wei" =~ ^[0-9]+$ ]] && command -v bc &>/dev/null; then
      if (( $(echo "$balance_dec < $amount_in_wei" | bc -l) )); then
        json_output false "Swap failed (pre-flight): Insufficient $token_in_symbol balance. Have: $balance_dec wei, Need: $amount_in_wei wei. Top up your $token_in_symbol before swapping. No transaction was submitted."
        exit 1
      fi
    fi
    log "$token_in_symbol balance OK"

    # Check allowance AFTER balance is confirmed
    log "Checking ERC-20 allowance for $token_in_symbol..."
    local allowance_hex allowance_dec
    allowance_hex=$(cast call \
      --rpc-url "$rpc_url" \
      "$token_in_address" \
      "allowance(address,address)(uint256)" \
      "$sender" \
      "$router_address" 2>/dev/null || echo "0")

    if [[ "$allowance_hex" == 0x* ]]; then
      allowance_dec=$(printf "%d" "$allowance_hex" 2>/dev/null || echo "0")
    else
      allowance_dec="${allowance_hex%%[^0-9]*}"
      allowance_dec="${allowance_dec:-0}"
    fi

    log "Current allowance: $allowance_dec"
    log "Required amount: $amount_in_wei"

    if command -v bc &>/dev/null; then
      if [[ "$allowance_dec" =~ ^[0-9]+$ ]] && [[ "$amount_in_wei" =~ ^[0-9]+$ ]] && (( $(echo "$allowance_dec < $amount_in_wei" | bc -l) )); then
        json_output false "Swap failed (pre-flight): Insufficient allowance for $token_in_symbol. Current: $allowance_dec, Required: $amount_in_wei. No transaction was submitted. Run: cast send --rpc-url $rpc_url [WALLET_FLAGS] $token_in_address 'approve(address,uint256)' $router_address $amount_in_wei"
        exit 1
      fi
    else
      if [[ ${#allowance_dec} -lt ${#amount_in_wei} ]] || \
         [[ ${#allowance_dec} -eq ${#amount_in_wei} && "$allowance_dec" < "$amount_in_wei" ]]; then
        json_output false "Swap failed (pre-flight): Insufficient allowance for $token_in_symbol. Current: $allowance_dec, Required: $amount_in_wei. No transaction was submitted. Approve the router first."
        exit 1
      fi
    fi

    log "Allowance OK"
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Step 4: Configure wallet
  # ─────────────────────────────────────────────────────────────────────────

  local wallet_flags=()
  case "$wallet_method" in
    keystore)
      if [[ ! -f "$PASSWORD_FILE" ]]; then
        json_output false "Swap failed (pre-flight): Password file not found: $PASSWORD_FILE. Create it or set KEYSTORE_PASSWORD_FILE. No transaction was submitted."
        exit 1
      fi
      # Check password file permissions
      local pw_perms
      if [[ "$(uname)" == "Darwin" ]]; then
        pw_perms=$(stat -f '%Lp' "$PASSWORD_FILE" 2>/dev/null || echo "unknown")
      else
        pw_perms=$(stat -c '%a' "$PASSWORD_FILE" 2>/dev/null || echo "unknown")
      fi
      if [[ "$pw_perms" != "600" && "$pw_perms" != "unknown" ]]; then
        json_output false "Swap failed (pre-flight): Password file $PASSWORD_FILE has insecure permissions ($pw_perms). Required: 600. Fix with: chmod 600 $PASSWORD_FILE. No transaction was submitted."
        exit 1
      fi
      # Validate keystore exists
      local keystore_dir="${HOME}/.foundry/keystores"
      if [[ ! -f "${keystore_dir}/${keystore_name}" ]]; then
        json_output false "Swap failed (pre-flight): Keystore '${keystore_name}' not found in ${keystore_dir}. List keystores with: cast wallet list. No transaction was submitted."
        exit 1
      fi
      wallet_flags=(--account "$keystore_name" --password-file "$PASSWORD_FILE")
      log "Using keystore: $keystore_name"
      ;;
    env)
      if [[ -z "${PRIVATE_KEY:-}" ]]; then
        json_output false "Swap failed (pre-flight): PRIVATE_KEY environment variable not set. No transaction was submitted."
        exit 1
      fi
      export ETH_PRIVATE_KEY="$PRIVATE_KEY"
      wallet_flags=()
      log "Using private key from env (via ETH_PRIVATE_KEY)"
      log "WARNING: env method is less secure than keystore. Private key is in process environment."
      ;;
    ledger)
      wallet_flags=(--ledger)
      log "Using Ledger (confirm on device)"
      ;;
    trezor)
      wallet_flags=(--trezor)
      log "Using Trezor (confirm on device)"
      ;;
    *)
      json_output false "Swap failed (pre-flight): Unknown wallet method '$wallet_method'. Use: keystore, env, ledger, trezor. No transaction was submitted."
      exit 1
      ;;
  esac

  # ─────────────────────────────────────────────────────────────────────────
  # Step 5: Execute transaction
  # ─────────────────────────────────────────────────────────────────────────

  local explorer
  explorer=$(get_explorer_url "$chain")

  log "Chain: $chain"
  log "Router: $to"
  log "Value: $value wei"
  log "Gas limit: $gas"
  log "RPC: $rpc_url"

  # AC-3: Verify chain ID before broadcasting to prevent sending on wrong network
  local expected_chain_id actual_chain_id
  expected_chain_id=$(get_expected_chain_id "$chain")
  if [[ -n "$expected_chain_id" ]]; then
    actual_chain_id=$(cast chain-id --rpc-url "$rpc_url" 2>/dev/null || echo "")
    actual_chain_id="${actual_chain_id%%[^0-9]*}"
    if [[ -z "$actual_chain_id" ]]; then
      json_output false "Swap failed (pre-flight): Could not verify chain ID from RPC $rpc_url. The RPC may be down. No transaction was submitted."
      exit 1
    fi
    if [[ "$actual_chain_id" != "$expected_chain_id" ]]; then
      json_output false "Swap failed (pre-flight): Chain ID mismatch! RPC returned chain ID $actual_chain_id but expected $expected_chain_id for '$chain'. This could indicate a misconfigured or malicious RPC. No transaction was submitted."
      exit 1
    fi
    log "Chain ID verified: $actual_chain_id"
  else
    log "WARNING: No expected chain ID configured for '$chain' — skipping chain ID verification"
  fi

  log "Executing transaction..."

  local tx_output
  local tx_hash
  local exit_code=0

  tx_output=$(cast send \
    --rpc-url "$rpc_url" \
    "${wallet_flags[@]}" \
    --gas-limit "$gas" \
    --value "$value" \
    --json \
    "$to" \
    "$data" 2>&1) || exit_code=$?

  # Retry with fallback RPC on rate limit (429) or connection errors
  if [[ $exit_code -ne 0 ]] && echo "$tx_output" | grep -qiE '429|rate.limit|too many|connection refused'; then
    local fallback_rpc
    fallback_rpc=$(get_fallback_rpc_url "$chain")
    if [[ -n "$fallback_rpc" && "$fallback_rpc" != "$rpc_url" ]]; then
      log "Primary RPC failed (rate limited), retrying with fallback: $fallback_rpc"
      sleep 2
      exit_code=0
      tx_output=$(cast send \
        --rpc-url "$fallback_rpc" \
        "${wallet_flags[@]}" \
        --gas-limit "$gas" \
        --value "$value" \
        --json \
        "$to" \
        "$data" 2>&1) || exit_code=$?
    fi
  fi

  if [[ $exit_code -ne 0 ]]; then
    # Sanitize output to prevent private key leakage in error messages
    local safe_output
    safe_output=$(echo "$tx_output" | sed -E \
      -e 's/--private-key [^ ]*/--private-key [REDACTED]/g' \
      -e 's/"private[Kk]ey"[[:space:]]*:[[:space:]]*"[^"]*"/"privateKey": "[REDACTED]"/g' \
      -e 's/ETH_PRIVATE_KEY=[^ ]*/ETH_PRIVATE_KEY=[REDACTED]/g' \
      -e 's/PRIVATE_KEY=[^ ]*/PRIVATE_KEY=[REDACTED]/g' \
      -e 's/0x[a-fA-F0-9]{64}/[REDACTED_HEX]/g')
    json_output false "Transaction was broadcast but failed on-chain: $safe_output"
    exit 1
  fi

  # ─────────────────────────────────────────────────────────────────────────
  # Step 6: Parse result and output
  # ─────────────────────────────────────────────────────────────────────────

  tx_hash=$(echo "$tx_output" | jq -r '.transactionHash // empty')

  if [[ -z "$tx_hash" ]]; then
    # Try parsing as plain hash (older cast versions)
    tx_hash=$(echo "$tx_output" | grep -oE '0x[a-fA-F0-9]{64}' | head -1 || true)
  fi

  if [[ -z "$tx_hash" ]]; then
    # L-1: Apply same redaction as the error path above to prevent key leakage
    local safe_tx_output
    safe_tx_output=$(echo "$tx_output" | sed -E \
      -e 's/--private-key [^ ]*/--private-key [REDACTED]/g' \
      -e 's/"private[Kk]ey"[[:space:]]*:[[:space:]]*"[^"]*"/"privateKey": "[REDACTED]"/g' \
      -e 's/ETH_PRIVATE_KEY=[^ ]*/ETH_PRIVATE_KEY=[REDACTED]/g' \
      -e 's/PRIVATE_KEY=[^ ]*/PRIVATE_KEY=[REDACTED]/g' \
      -e 's/0x[a-fA-F0-9]{64}/[REDACTED_HEX]/g')
    json_output false "Transaction was broadcast but could not parse transaction hash from output: $safe_tx_output"
    exit 1
  fi

  local block_number gas_used status
  block_number=$(echo "$tx_output" | jq -r '.blockNumber // "pending"')
  gas_used=$(echo "$tx_output" | jq -r '.gasUsed // "unknown"')
  status=$(echo "$tx_output" | jq -r '.status // "1"')

  log "Transaction submitted!"
  log "Hash: $tx_hash"
  log "Explorer: $explorer/tx/$tx_hash"

  # Output JSON result
  jq -n \
    --arg chain "$chain" \
    --arg txHash "$tx_hash" \
    --arg blockNumber "$block_number" \
    --arg gasUsed "$gas_used" \
    --arg status "$status" \
    --arg explorer "$explorer/tx/$tx_hash" \
    --arg sender "$sender" \
    --arg recipient "$recipient" \
    --arg router "$to" \
    --arg value "$value" \
    --arg tokenInSymbol "$token_in_symbol" \
    --arg tokenInAmount "$amount_in" \
    --arg tokenOutSymbol "$token_out_symbol" \
    --arg tokenOutAmount "$amount_out" \
    --arg slippageBps "$slippage_bps" \
    --arg walletMethod "$wallet_method" \
    '{
      "ok": true,
      "chain": $chain,
      "txHash": $txHash,
      "blockNumber": $blockNumber,
      "gasUsed": $gasUsed,
      "status": $status,
      "explorerUrl": $explorer,
      "swap": {
        "tokenIn": {"symbol": $tokenInSymbol, "amount": $tokenInAmount},
        "tokenOut": {"symbol": $tokenOutSymbol, "amount": $tokenOutAmount},
        "slippageBps": $slippageBps
      },
      "tx": {
        "sender": $sender,
        "recipient": $recipient,
        "router": $router,
        "value": $value
      },
      "walletMethod": $walletMethod
    }'
}

main "$@"
