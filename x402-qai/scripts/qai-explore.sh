#!/usr/bin/env bash
set -euo pipefail

query="${1-}"
limit="${2-}"

params=""
if [ -n "$query" ]; then
  encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))" 2>/dev/null || echo "$query")
  params="q=$encoded"
fi
if [ -n "$limit" ]; then
  if [ -n "$params" ]; then
    params="$params&limit=$limit"
  else
    params="limit=$limit"
  fi
fi

"$(dirname "$0")/qai-get.sh" "/api/explore" "$params"
