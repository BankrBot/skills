#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: cannastack-deals.sh <location> [category]" >&2
  echo "Example: cannastack-deals.sh \"Denver, CO\" edible" >&2
  exit 1
fi

location="$1"
category="${2-}"

body="{\"location\":\"$location\""
if [ -n "$category" ]; then
  body="$body,\"category\":\"$category\""
fi
body="$body}"

"$(dirname "$0")/cannastack-post.sh" "/api/deal-scout" "$body"
