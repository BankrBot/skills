#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: qai-post.sh <path> <json_body>" >&2
  echo "Example: qai-post.sh /api/scan '{\"url\":\"https://example.com\"}'" >&2
  exit 1
fi

path="$1"
body="$2"

if [[ "$path" != /* ]]; then
  echo "qai-post.sh: path must start with /" >&2
  exit 1
fi

base="${QAI_BASE_URL:-https://qai.0x402.sh}"
url="$base$path"

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

http_code=$(curl -sS --connect-timeout 10 --max-time 30 -X POST \
  -H "User-Agent: x402-qai-skill/1.0" \
  -H "Content-Type: application/json" \
  -d "$body" \
  -w '%{http_code}' \
  -o "$tmp_body" \
  "$url") || {
  echo "qai-post.sh: curl transport error (exit $?)" >&2
  exit 1
}

if [[ "$http_code" =~ ^2 ]]; then
  cat "$tmp_body"
  exit 0
fi

echo "qai-post.sh: HTTP $http_code error" >&2
cat "$tmp_body" >&2
exit 1
