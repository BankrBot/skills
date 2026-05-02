#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: cannastack-strain.sh <strain> <location> [radius]" >&2
  echo "Example: cannastack-strain.sh \"Blue Dream\" \"Phoenix, AZ\" 15" >&2
  exit 1
fi

strain="$1"
location="$2"
radius="${3-}"

body="{\"strain\":\"$strain\",\"location\":\"$location\""
if [ -n "$radius" ]; then
  body="$body,\"radius\":$radius"
fi
body="$body}"

"$(dirname "$0")/cannastack-post.sh" "/api/strain-finder" "$body"
