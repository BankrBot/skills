#!/usr/bin/env bash
# x402-negotiation-sim.sh — Simulate counterparty negotiation responses for x402 services
set -euo pipefail

: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

CATEGORY="${1:-trading}"

echo "=== x402 Counterparty Negotiation Simulation ==="
echo "Fetching behavioral responses for category: $CATEGORY..."

RESPONSES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/behavioral-response-library")

echo ""
echo "=== Counterparty Reactions ==="
echo "$RESPONSES" | jq -r '.records[]? | "Scenario: \(.scenario.title)\nResponse: \(.response)\nReasoning: \(.reasoning_chain)\nConfidence: \(.confidence)\n---"'

echo "Negotiation simulation complete."
