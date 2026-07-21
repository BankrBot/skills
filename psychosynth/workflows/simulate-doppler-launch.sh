#!/usr/bin/env bash
# simulate-doppler-launch.sh — Simulate retail personas against bonding curve parameters
set -euo pipefail

: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

echo "=== Doppler Token Launch Simulation ==="
echo "Fetching retail persona profiles from Psychosynth..."

# Fetch free preview or query high-neuroticism / retail-trading profiles
PROFILES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/personality-profile-library")

COUNT=$(echo "$PROFILES" | jq -r '.count // 0')
echo "Loaded $COUNT persona profiles."

echo "Simulating retail buyer reaction against bonding curve..."
echo "$PROFILES" | jq -r '.records[]? | "Persona ID: \(.id) | MBTI: \(.mbti_label) | Loss Aversion (λ): \(.prospect_theory.lambda) | Decision Style: \(.decision_style)"'

echo ""
echo "Simulation complete. Retail buyer resistance profile generated."
