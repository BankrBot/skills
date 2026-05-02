#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: qai-report.sh <url>" >&2
  echo "Example: qai-report.sh https://example.com/api/resource" >&2
  exit 1
fi

url="$1"
encoded=$(echo -n "$url" | base64 | tr '+/' '-_' | tr -d '=')

base="${QAI_BASE_URL:-https://qai.0x402.sh}"
echo "${base}/report/${encoded}"
