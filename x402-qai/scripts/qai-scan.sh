#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: qai-scan.sh <url>" >&2
  echo "Example: qai-scan.sh https://example.com/api/resource" >&2
  exit 1
fi

url="$1"

result=$("$(dirname "$0")/qai-post.sh" "/api/scan" "{\"url\":\"$url\"}")

score=$(echo "$result" | jq -r '.score.total // .score // empty')
if [ -z "$score" ]; then
  echo "$result" | jq .
  exit 0
fi

if [ "$score" -ge 90 ]; then
  grade="A"
elif [ "$score" -ge 80 ]; then
  grade="B"
elif [ "$score" -ge 70 ]; then
  grade="C"
elif [ "$score" -ge 60 ]; then
  grade="D"
else
  grade="F"
fi

passed=$(echo "$result" | jq -r '.passed')
echo "Score: $score/100 (Grade: $grade) | Passed: $passed"
echo ""
echo "$result" | jq -r '
  if .score.categories then
    "Categories:",
    (.score.categories[] | "  \(.category): \(.score)/\(.maxScore)")
  else empty end
'
echo ""
echo "Full result:"
echo "$result" | jq .
