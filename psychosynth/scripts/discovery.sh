#!/usr/bin/env bash
# Free preflight: products, live prices, tiers, payment surface.
set -euo pipefail
: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"
curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/discovery" | jq .
