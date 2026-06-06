#!/usr/bin/env bash
# _vigil_lib.sh — shared helpers for VIGIL Bankr skill scripts.
#
# Source this from each script:  . "$(dirname "$0")/_vigil_lib.sh"
#
# Provides:
#   vigil_validate_addr <addr>      -> echoes lowercase 0x addr, or exits 1
#   vigil_validate_chain <chain>    -> echoes chain, or exits 1
#   vigil_call <tool> <args_json>   -> echoes JSON result, or exits 1 on error
#   risk_icon <risk>                -> echoes an emoji for a risk level

# Public read-only endpoint (JSON-RPC 2.0). No API key required.
VIGIL_ENDPOINT="${VIGIL_ENDPOINT:-https://mcp.vigil.codes/tools/call}"

# Strict allowlist: 0x + exactly 40 hex chars. Rejects quotes, spaces, and
# any shell/JSON metacharacter, so the value is safe to interpolate.
vigil_validate_addr () {
  local addr="$1"
  if ! printf '%s' "$addr" | grep -qiE '^0x[0-9a-f]{40}$'; then
    echo "Error: invalid address '$addr' (expected 0x + 40 hex chars)" >&2
    exit 1
  fi
  printf '%s' "$addr" | tr '[:upper:]' '[:lower:]'
}

vigil_validate_chain () {
  local chain="${1:-base}"
  case "$chain" in
    base|ethereum|polygon|arbitrum) printf '%s' "$chain" ;;
    *) echo "Error: unsupported chain '$chain' (use base|ethereum|polygon|arbitrum)" >&2; exit 1 ;;
  esac
}

# vigil_call <tool> <args_json>
# Posts a JSON-RPC tools/call and returns the .result object. Fails loudly on
# a non-200 HTTP status or a JSON-RPC error body instead of emitting null.
vigil_call () {
  local name="$1" args="$2" body http code
  body=$(curl -m 40 -s -w '\n%{http_code}' "$VIGIL_ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}") || {
      echo "Error: request to $VIGIL_ENDPOINT failed" >&2; exit 1; }
  code=$(printf '%s' "$body" | tail -n1)
  http=$(printf '%s' "$body" | sed '$d')
  if [ "$code" != "200" ]; then
    echo "Error: HTTP $code calling $name" >&2; exit 1
  fi
  if printf '%s' "$http" | jq -e '.error' >/dev/null 2>&1; then
    echo "Error: $(printf '%s' "$http" | jq -c '.error')" >&2; exit 1
  fi
  printf '%s' "$http" | jq '.result'
}

risk_icon () {
  case "$1" in
    critical) printf '🔴' ;;
    high)     printf '🟠' ;;
    medium)   printf '🟡' ;;
    low)      printf '🟢' ;;
    safe)     printf '✅' ;;
    *)        printf '❓' ;;
  esac
}
