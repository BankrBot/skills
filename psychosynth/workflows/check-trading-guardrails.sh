#!/usr/bin/env bash
# check-trading-guardrails.sh — Check trade setups against cognitive bias models
set -euo pipefail

: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

SETUP_INFO="${1:-"Long position on leverage following recent price surge"}"

echo "=== Trading Guardrails Check ==="
echo "Analyzing trade setup: \"$SETUP_INFO\""
echo "Fetching cognitive bias models from Psychosynth..."

BIASES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/cognitive-bias-simulator")

echo ""
echo "=== Guardrails Report ==="
echo "$BIASES" | jq -r '.records[]? | "Bias: \(.name) (\(.slug))\nDescription: \(.description)\nMitigation: \(.mitigation)\n---"'

echo "Guardrails evaluation finished."
