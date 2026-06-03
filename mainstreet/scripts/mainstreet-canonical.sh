#!/usr/bin/env bash
# mainstreet-canonical.sh — unified identity (basename + ERC-8004 + agent.json + tier)
set -euo pipefail
[ -z "${1:-}" ] && { echo "usage: mainstreet-canonical.sh <0x-address>"; exit 1; }
curl -sS "https://avisradar-production.up.railway.app/api/agent/canonical-id/$1"
