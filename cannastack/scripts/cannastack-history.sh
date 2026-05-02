#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: cannastack-history.sh <strain> <location> [days]" >&2
  echo "Example: cannastack-history.sh \"Blue Dream\" \"Phoenix, AZ\" 30" >&2
  exit 1
fi

strain="$1"
location="$2"
days="${3-}"

body="{\"strain\":\"$strain\",\"location\":\"$location\""
if [ -n "$days" ]; then
  body="$body,\"days\":$days"
fi
body="$body}"

"$(dirname "$0")/cannastack-post.sh" "/api/price-history" "$body"
