#!/bin/bash
# CLI wrapper for Arcadia Finance MCP server.
# Uses curl + jq to call tools over Streamable HTTP.
#
# Usage:
#   ./arcadia.sh <tool_name> '<json_args>'
#   ./arcadia.sh --list
#
# Requires: curl, jq

set -euo pipefail

MCP_URL="${ARCADIA_MCP_URL:-https://mcp.arcadia.finance/mcp}"

for bin in curl jq; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "Required: $bin" >&2
    exit 1
  fi
done

TOOL_NAME="${1:-}"
ARGS_JSON="${2:-"{}"}"

if [[ -z "$TOOL_NAME" ]]; then
  echo "Usage: $0 <tool_name> '<json_args>'"
  echo "       $0 --list"
  exit 1
fi

# Request metadata MCP 2026-07-28 requires on every call.
META='{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"arcadia-bankr","version":"1.5.0"}}'

# POST one request; the body is plain JSON or a single SSE data: line.
mcp_post() {
  local method="$1" name="$2" payload="$3" body json message
  body=$(curl -sf -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Protocol-Version: 2026-07-28" \
    -H "Mcp-Method: $method" \
    ${name:+-H "Mcp-Name: $name"} \
    -d "$payload") || { echo "ERROR: request to $MCP_URL failed" >&2; return 1; }
  json=$(printf '%s\n' "$body" | sed -n 's/^data: //p; /^{/p' | head -1)
  message=$(jq -r '.error.message // empty' <<<"$json")
  if [[ -n "$message" ]]; then
    echo "ERROR: $message" >&2
    return 1
  fi
  printf '%s\n' "$json"
}

if [[ "$TOOL_NAME" == "--list" ]]; then
  PAYLOAD=$(jq -nc --argjson meta "$META" '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{"_meta":$meta}}')

  mcp_post "tools/list" "" "$PAYLOAD" | jq -r '.result.tools | sort_by(.name)[] | "\(.name): \(.description[0:120])"'
else
  if ! echo "$ARGS_JSON" | jq . >/dev/null 2>&1; then
    echo "ERROR: Invalid JSON arguments: $ARGS_JSON" >&2
    exit 1
  fi

  PAYLOAD=$(jq -nc --arg name "$TOOL_NAME" --argjson args "$ARGS_JSON" --argjson meta "$META" \
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":$name,"arguments":$args,"_meta":$meta}}')

  RESULT=$(mcp_post "tools/call" "$TOOL_NAME" "$PAYLOAD")
  IS_ERROR=$(echo "$RESULT" | jq -r '.result.isError // false')
  TEXT=$(echo "$RESULT" | jq -r '.result.content[0].text // empty')

  if [[ "$IS_ERROR" == "true" ]]; then
    if echo "$TEXT" | grep -qi "internal exception\|500\|internal server error"; then
      echo "ERROR: Request failed. Check that IDs and addresses are valid. Details: $TEXT" >&2
    else
      echo "ERROR: $TEXT" >&2
    fi
    exit 1
  else
    echo "$TEXT"
  fi
fi
