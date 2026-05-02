#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: qai-estimate.sh <workflow_json>" >&2
  echo "Example: qai-estimate.sh '{\"steps\":[{\"url\":\"https://example.com/api\"}]}'" >&2
  exit 1
fi

"$(dirname "$0")/qai-post.sh" "/api/workflows/estimate" "$1"
