#!/usr/bin/env bash
# Prepare one AZL crowdfund pledge. This script does not send a transaction.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
INSPECT=(node "${SCRIPT_DIR}/pledge-inspect.mjs")
COMMAND="${1:-prepare}"

case "$COMMAND" in
  inspect)
    if [[ -z "${2:-}" ]]; then
      echo "usage: pledge.sh inspect <campaignId-or-url> [standard|micro]" >&2
      exit 2
    fi
    "${INSPECT[@]}" inspect "$2" "${3:-}"
    ;;
  prepare)
    if [[ -z "${2:-}" || -z "${3:-}" || -z "${4:-}" ]]; then
      echo "usage: pledge.sh prepare <campaignId-or-url> <wallet> <amountAzl> [standard|micro]" >&2
      exit 2
    fi
    "${INSPECT[@]}" prepare "$2" "$3" "$4" "${5:-}"
    ;;
  *)
    echo "usage: pledge.sh inspect <campaignId-or-url> [standard|micro] | prepare <campaignId-or-url> <wallet> <amountAzl> [standard|micro]" >&2
    exit 2
    ;;
esac
