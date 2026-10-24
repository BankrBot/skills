# Submitting Flash transactions

`scripts/flash.mjs` never signs or broadcasts. Every write command prints a JSON **plan**:

```json
{
  "ok": true, "status": "ready", "action": "swap",
  "summary": { "...": "what the user is about to do: amounts, minimum out, gas" },
  "warnings": ["..."],
  "transactions": [ { "to": "0x...", "data": "0x...", "value": "<wei, decimal>", "gas": "<optional>", "description": "..." } ],
  "sendCalls": { "chain": "base", "calls": [ { "to": "0x...", "value": "0x<hex wei>", "data": "0x..." } ] },
  "simulation": { "method": "eth_simulateV1", "ok": true, "gasUsed": ["..."] },
  "chainId": 8453, "expiresAt": "<ISO time, 20 min>"
}
```

- `status: "ready"`: the whole ordered list (approvals, then the action) was simulated from the user's wallet in one block with `eth_simulateV1`. Every swap carries its gas limit, and that limit was enforced in the simulation.
- `status: "would-revert"` (`ok: false`): do **not** submit. Relay `error`, which holds the decoded revert reason (see [ERRORS.md](ERRORS.md)).
- `status: "needs-signature"`: an EIP-712 signature is needed first (smart-wallet referral bind). Sign `typedData` with the wallet, then re-run with `--signature`.
- `status: "info"`: a read; nothing to submit.

Before every submit, show the user `summary` and `warnings`, and validate each transaction against [TX-VALIDATION.md](TX-VALIDATION.md).

## Bankr

1. Get the wallet with `bankr whoami` (or `BANKR_WALLET_ADDRESS`; the CLI reads it), then run the command with `--wallet`.
2. Submit `transactions[]` **in order, one at a time**, each with `waitForConfirmation: true`:
   ```bash
   curl -s -X POST https://api.bankr.bot/wallet/submit -H "X-API-Key: $BANKR_API_KEY" -H "Content-Type: application/json" \
     -d '{"transaction":{"to":"<to>","data":"<data>","value":"<value wei>","chainId":8453,"gas":"<gas if present>"},"description":"<description>","waitForConfirmation":true}'
   ```
   Use the REST call whenever a transaction has a non-zero `value` or a `gas` field: `value` is wei there. Hook swaps **need** their `gas` field, because a limit below the pool floor reverts `GasFloor()`.
3. If the plan started with approvals, re-run the same command after they confirm. The final transaction then gets an `eth_estimateGas`-sized limit and fresh minimums. Never reuse a plan older than `expiresAt`.
4. A response with a `transactionHash` was broadcast, even if it failed. Look the hash up before doing anything else: a blind retry can execute twice.
5. If Bankr refuses (arbitrary calls disabled, spend limit, `untrusted_address`, security scan), **stop** and tell the user. Never work around a protection.

## Base MCP (Coinbase wallet MCP)

Pass `sendCalls` straight to the Base MCP `send_calls` tool. It is an EIP-5792 batch: approvals and the action execute atomically under one user approval, and the wallet sizes the gas. Then follow the approval-URL / status-poll flow. Chain name `base`, values as hex wei. Without a shell, use the Flash Base MCP plugin (`plugins/flash.md`). It covers `chain_rpc_request` reads, verified swap calldata templates and single-word claim calls.

## Any other wallet

- **EOA (`eth_sendTransaction`):** send `transactions[]` in order, waiting for each receipt, and keep `gas` where it is given.
- **Smart wallet:** send `sendCalls.calls` with `wallet_sendCalls`.

## Gas budget

All Flash calls are far below Base's 16,777,216 gas per-transaction cap. The largest measured are a launch create (~8.7M used, ~11.5M limit with padding) and a BTC2xL buy paid in FLASH (~10.8M limit). Gas is paid in ETH on Base. Keep a small ETH balance (about 0.0001 ETH covers a 3M-gas swap at typical Base fees).
