#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: cannastack-prices.sh <category> <location> [genetics] [limit]" >&2
  echo "Example: cannastack-prices.sh flower \"Los Angeles, CA\" sativa 20" >&2
  exit 1
fi

category="$1"
location="$2"
genetics="${3-}"
limit="${4-}"

body="{\"category\":\"$category\",\"location\":\"$location\""
if [ -n "$genetics" ]; then
  body="$body,\"genetics\":\"$genetics\""
fi
if [ -n "$limit" ]; then
  body="$body,\"limit\":$limit"
fi
body="$body}"

"$(dirname "$0")/cannastack-post.sh" "/api/price-compare" "$body"
