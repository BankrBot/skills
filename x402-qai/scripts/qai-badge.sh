#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: qai-badge.sh <url>" >&2
  echo "Example: qai-badge.sh https://example.com/api/resource" >&2
  exit 1
fi

url="$1"
encoded=$(echo -n "$url" | base64 | tr '+/' '-_' | tr -d '=')

base="${QAI_BASE_URL:-https://qai.0x402.sh}"
badge_url="${base}/api/badge/${encoded}"
report_url="${base}/report/${encoded}"

echo "Badge URL: $badge_url"
echo ""
echo "Markdown embed:"
echo "[![x402 Compliance]($badge_url)]($report_url)"
