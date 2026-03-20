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

HEADERS_FILE=$(mktemp)
trap 'rm -f "$HEADERS_FILE"' EXIT

# Parse SSE response: extract the data: line and parse as JSON
parse_sse() {
  grep '^data: ' | head -1 | sed 's/^data: //'
}

# Initialize session
INIT_RESPONSE=$(curl -sf -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -D "$HEADERS_FILE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"arcadia-bankr","version":"1.0.0"}}}')

SESSION_ID=$(grep -i 'mcp-session-id' "$HEADERS_FILE" | awk '{print $2}' | tr -d '\r')

# Send initialized notification
curl -sf -X POST "$MCP_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Mcp-Session-Id: $SESSION_ID" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  -o /dev/null 2>/dev/null || true

if [[ "$TOOL_NAME" == "--list" ]]; then
  RESPONSE=$(curl -sf -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')

  echo "$RESPONSE" | parse_sse | jq -r '.result.tools | sort_by(.name)[] | "\(.name): \(.description[0:120])"'
else
  PAYLOAD=$(jq -nc --arg name "$TOOL_NAME" --argjson args "$ARGS_JSON" \
    '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":$name,"arguments":$args}}')

  RESPONSE=$(curl -sf -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $SESSION_ID" \
    -d "$PAYLOAD")

  RESULT=$(echo "$RESPONSE" | parse_sse)
  IS_ERROR=$(echo "$RESULT" | jq -r '.result.isError // false')
  TEXT=$(echo "$RESULT" | jq -r '.result.content[0].text // empty')

  if [[ "$IS_ERROR" == "true" ]]; then
    echo "ERROR: $TEXT" >&2
    exit 1
  else
    echo "$TEXT"
  fi
fi

# Cleanup session
curl -sf -X DELETE "$MCP_URL" -H "Mcp-Session-Id: $SESSION_ID" -o /dev/null 2>/dev/null || true
