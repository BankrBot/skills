#!/usr/bin/env bash
# personalize-app.sh — Extract prospect-theory vectors for app UX personalization
set -euo pipefail

: "${PSYCHOSYNTH_BASE_URL:=https://psychosynth.vercel.app}"

echo "=== App Personalization Engine ==="
echo "Fetching prospect-theory profiles from Psychosynth..."

PROFILES=$(curl -sS "$PSYCHOSYNTH_BASE_URL/api/v1/preview/personality-profile-library")

echo ""
echo "=== Tailored UX Configurations ==="
echo "$PROFILES" | jq -r '.records[]? | {
  user_id: .id,
  mbti: .mbti_label,
  loss_aversion_lambda: .prospect_theory.lambda,
  ux_config: (
    if (.prospect_theory.lambda > 2.0) then 
      { risk_style: "conservative", warning_banner: "high_prominence", signal_style: "detailed_risk" }
    else 
      { risk_style: "aggressive", warning_banner: "subtle", signal_style: "action_oriented" }
    end
  )
}'

echo "Personalization profiles generated."
