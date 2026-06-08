#!/usr/bin/env bash
# Fetch community link for a ticker (plain-text API response).
# Usage: get-community-link.sh TICKER
set -euo pipefail

TICKER="${1:?Usage: get-community-link.sh TICKER}"
SITE="${COMMUNITIES_SITE_URL:-https://bankr-community.vercel.app}"
curl -sf "${SITE}/api/agent/link?q=${TICKER}"
