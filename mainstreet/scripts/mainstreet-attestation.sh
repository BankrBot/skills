#!/usr/bin/env bash
# mainstreet-attestation.sh — fetch EIP-712 signed attestation (free)
set -euo pipefail
[ -z "${1:-}" ] && { echo "usage: mainstreet-attestation.sh <0x-address>"; exit 1; }
curl -sS "https://avisradar-production.up.railway.app/api/agent/attestation/$1"
