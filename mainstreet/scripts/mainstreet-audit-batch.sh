#!/usr/bin/env bash
# mainstreet-audit-batch.sh — bulk audit up to 10 addresses ($1 USDC via x402)
# usage: pass addresses as args. needs x402 wallet env (AGENT_PRIVATE_KEY).
set -euo pipefail
[ $# -lt 1 ] && { echo "usage: mainstreet-audit-batch.sh <addr1> [addr2] ..."; exit 1; }
ADDRS=$(printf '"%s",' "$@" | sed 's/,$//')
echo "POST https://avisradar-production.up.railway.app/api/agent/audit-batch"
echo "Body: {\"addresses\":[$ADDRS]}"
echo "Cost: \$1 USDC via x402. Sign with @x402/axios or x402-axios v1."
