#!/usr/bin/env bash
set -euo pipefail

# vigil-revoke.sh — Revoke a token approval through Bankr (signed onchain tx).
# Usage: ./vigil-revoke.sh <token_address> <spender_address> [chain]
#
# Revocation is a STATE-CHANGING action and is intentionally NOT part of the
# read-only VIGIL endpoint. It is executed through the Bankr agent, which holds
# the signing key in its secure enclave. Requires the `bankr` CLI to be
# installed and authenticated (bankr login ... --read-write).

. "$(dirname "$0")/_vigil_lib.sh"

TOKEN=$(vigil_validate_addr "${1:?Usage: vigil-revoke.sh <token> <spender> [chain]}")
SPENDER=$(vigil_validate_addr "${2:?Usage: vigil-revoke.sh <token> <spender> [chain]}")
CHAIN=$(vigil_validate_chain "${3:-base}")

if ! command -v bankr >/dev/null 2>&1; then
  echo "Error: 'bankr' CLI not found. Install and authenticate Bankr first:" >&2
  echo "  bankr login email your@email.com   # then enable --read-write" >&2
  exit 1
fi

echo "🔓 Revoking approval via Bankr"
echo "  Token:   $TOKEN"
echo "  Spender: $SPENDER"
echo "  Chain:   $CHAIN"
echo ""

# Bankr understands natural-language intents and handles building + signing
# + submitting the revoke transaction. setApproval(spender, 0) == revoke.
exec bankr agent "revoke the ERC-20 approval for token $TOKEN granted to spender $SPENDER on $CHAIN (set allowance to 0)"
