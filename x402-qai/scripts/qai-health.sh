#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: qai-health.sh <url>" >&2
  echo "Example: qai-health.sh https://example.com/api/resource" >&2
  exit 1
fi

url="$1"

tmp_body=$(mktemp)
trap 'rm -f "$tmp_body"' EXIT

http_code=$(curl -sS --connect-timeout 10 --max-time 15 \
  -H "User-Agent: x402-qai-skill/1.0" \
  -w '%{http_code}' \
  -o "$tmp_body" \
  "$url" 2>/dev/null) || {
  echo "DEAD: $url (connection failed)" >&2
  exit 1
}

echo "HTTP $http_code: $url"

if [ "$http_code" = "402" ]; then
  echo "x402: YES -- endpoint returns 402 Payment Required"
else
  echo "x402: NO -- endpoint returned $http_code (expected 402)"
fi
