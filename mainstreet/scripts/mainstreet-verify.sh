#!/usr/bin/env bash
# mainstreet-verify.sh — verify a signed attestation server-side
# usage: pipe the attestation JSON in, optionally with MIN_SCORE env var
set -euo pipefail
MIN_SCORE="${MIN_SCORE:-0}"
ATT_JSON="${1:-$(cat)}"
PAYLOAD=$(echo "$ATT_JSON" | jq '.payload')
SIG=$(echo "$ATT_JSON" | jq -r '.signature')
curl -sS -X POST "https://avisradar-production.up.railway.app/api/agent/verify" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --argjson p "$PAYLOAD" --arg s "$SIG" --arg m "$MIN_SCORE" '{payload:$p,signature:$s,minScore:($m|tonumber)}')"
