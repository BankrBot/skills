#!/usr/bin/env bash
# Free deterministic preview for a product slug.
# Usage: ./preview.sh personality-profile-library
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"
SLUG="${1:?usage: preview.sh <product-slug>}"
curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/$SLUG" | jq .
