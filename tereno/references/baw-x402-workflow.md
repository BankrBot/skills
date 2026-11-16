# Binance Agentic Wallet (`baw`) + Tereno x402 Workflow

`binance-agentic-wallet` (`baw`) natively supports **x402 v2** payments on **Base (`eip155:8453`)** with **USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)** via `eip3009`. This allows any Binance Agent OS / OpenClaw agent to pay Tereno directly from its existing agentic wallet without installing custom SDKs or exposing raw private keys.

---

## Recipe 1: End-to-End `baw` x402 Request & Payment Loop

Use this exact sequence for any paid Tereno capability (`token.launch.guard`, `token.holders.guard`, `contract.guard`, `token.metadata`, `chain.snapshot`, or `prediction.evidence`):

### Step 1 — Trigger the 402 Challenge & Capture `PAYMENT-REQUIRED`
Send the request and dump response headers (`-D -`). Include `X-Tereno-Skill: 1.0` and a descriptive `User-Agent` (recommended: `tereno-skill/1.0 (openclaw-baw)`):

```bash
TARGET_URL="https://www.tereno.xyz/api/v1/capabilities/token.launch.guard/invoke?address=0x..."

PAYMENT_REQUIRED=$(curl -s -D - -o /dev/null \
  -H "User-Agent: tereno-skill/1.0 (openclaw-baw)" \
  -H "X-Tereno-Skill: 1.0" \
  "$TARGET_URL" | grep -i '^payment-required:' | sed -E 's/^[^:]+:[[:space:]]*//; s/\r$//')
```

### Step 2 — Preview Payment Options with `baw`
Pass the base64 `PAYMENT-REQUIRED` header directly into `baw x402-payment preview`:

```bash
PREVIEW_JSON=$(baw x402-payment preview --paymentRequirements "$PAYMENT_REQUIRED" --json)
echo "$PREVIEW_JSON"
```

Verify in the JSON output:
- `data.options[i].status` is `"READY_TO_SIGN"`
- `data.options[i].binanceChainId` is `"8453"` (Base Mainnet)
- `data.options[i].tokenSymbol` is `"USDC"`
- `data.options[i].amountUsd` matches expected Tereno price (`$0.01`–`$0.07`)

Extract `paymentId` and the chosen `selectedIndex` (usually `1`).

### Step 3 — Confirm with User & Sign
Per `baw` guardrails, confirm the USD spend unless the user pre-authorized automated safety checks:

```bash
SIGN_JSON=$(baw x402-payment sign --paymentId "$PAYMENT_ID" --selectedIndex "$SELECTED_INDEX" --json)
echo "$SIGN_JSON"
```

Extract:
- `data.paymentHeaderName` (for x402 v2: `PAYMENT-SIGNATURE`)
- `data.paymentHeaderValue` (base64 signed EIP-3009 authorization)

> Note: If `data.approveTxHash` is non-null (Permit2 flow), wait for confirmation via `baw wallet tx-history --tx <hash>` before replaying. Base USDC normally uses `eip3009` directly (`approveTxHash: null`).

### Step 4 — Replay the Original Request with `PAYMENT-SIGNATURE`
Replay the exact URL (and JSON body if `POST` for `prediction.evidence`) with the signed header and a `15s` timeout (`--max-time 15`):

```bash
curl -s --max-time 15 -D /tmp/tereno_headers.txt \
  -H "User-Agent: tereno-skill/1.0 (openclaw-baw)" \
  -H "X-Tereno-Skill: 1.0" \
  -H "PAYMENT-SIGNATURE: $PAYMENT_HEADER_VALUE" \
  "$TARGET_URL"
```

- Inspect `/tmp/tereno_headers.txt` for `PAYMENT-RESPONSE` (base64 settlement metadata containing Base `txHash`).
- Inspect the JSON response `verdict` (`allow` | `review` | `block`), `validUntilBlock`, and `artifactId`.

> Latency note: Cache hits return in `< 200ms` (`executionMs: 0`). Cold misses for `token.launch.guard` and `token.holders.guard` take `~1.2–2.5s` of live Base RPC simulation plus x402 settlement (`~3–5s` end-to-end), so always keep HTTP client timeouts at `10–15s` (`--max-time 15`) to avoid premature aborts before `PAYMENT-RESPONSE` arrives.

---

## Recipe 2: Safe Base DEX Swap Pipeline (Binance + Tereno)

Combine Binance's free discovery/audit skills with Tereno's deep pre-execution guards:

1. **Initial Static Scan (Free):** Run Binance `query-token-audit` (`chainId: 8453`) to filter obvious static red flags.
2. **Exit Simulation & Owner Powers (Tereno):** Run `token.launch.guard` (`GET /api/v1/capabilities/token.launch.guard/invoke?address=<token>`) via `baw` x402 to verify via live `eth_call` that a buy can actually be sold on the DEX pool without hidden tax/blacklist traps.
3. **Insider / Sybil Cluster Check (Tereno):** For newly launched or low-cap tokens, run `token.holders.guard` (`GET /api/v1/capabilities/token.holders.guard/invoke?address=<token>`) to check whether top holders were funded by the same deployer/funder cabal.
4. **Policy Gate:**
   - If either verdict returns `"block"`, **abort the swap** and present `reasonCodes` to the user.
   - If `"review"`, surface `evidence` and `limitations` and ask for explicit confirmation.
   - Only if `"allow"`, proceed with swap quote/execution.

---

## Recipe 3: Safe Prediction Market Pipeline (`prediction.evidence` + `baw`)

Before running `baw prediction trade quote` or `baw prediction trade place-order`:

1. Send `POST https://www.tereno.xyz/api/v1/capabilities/prediction.evidence/invoke` with:
   ```json
   {
     "question": "<Exact market proposition>",
     "market": "polymarket",
     "marketUrl": "<Optional market URL>"
   }
   ```
2. Pay the HTTP `402` challenge using `baw x402-payment preview` + `sign` (if cached by another agent, cost drops to **`$0.01`** vs `$0.05` fresh).
3. Inspect the returned oracle audit:
   - Check UMA Optimistic Oracle dispute risk and ambiguous wording alerts.
   - Check for emergency 50-50 / invalidation resolution clauses.
   - Only proceed to `baw prediction trade place-order` if `verdict` is acceptable and `validUntilBlock` is current.
