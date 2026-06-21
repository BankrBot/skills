#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: helixa-search.sh <query>" >&2
    echo "Example: helixa-search.sh clawdbot" >&2
    exit 1
fi

query_input="$1"

query=$(
python3 - "$query_input" <<'PY'
import sys
import urllib.parse

print(urllib.parse.quote(sys.argv[1]))
PY
)

"$(dirname "$0")/helixa-get.sh" "/api/v2/agents" "search=$query"
