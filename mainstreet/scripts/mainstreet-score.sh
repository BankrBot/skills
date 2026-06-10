#!/usr/bin/env bash
# mainstreet-score.sh — fetch free MainStreet reputation score for any Base address
set -euo pipefail
[ -z "${1:-}" ] && { echo "usage: mainstreet-score.sh <0x-address>"; exit 1; }
curl -sS "https://avisradar-production.up.railway.app/api/agent/score/$1"
