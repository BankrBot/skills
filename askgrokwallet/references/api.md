# AskGrokWallet API — the parts this skill uses

Base URL `https://askgrokwallet.io`. Everything below was exercised live on
2026-09-18; response bodies are trimmed to the fields that matter.

## Auth

| Identity | How | Use for |
| --- | --- | --- |
| `source: "demo"` | no header | trying the gate, demos, this skill out of the box |
| anything else | `Authorization: Bearer <token>` + `source: "<label>"` | real rows; unauthenticated non-demo writes are rejected `401` |

## POST /api/approvals — evaluate (and record) a spend request

Body: `source`, `requester`, `summary`, `amountUsd`, `target`, `intentKind`,
`policyText`, optional `execute` intent, optional `drawdownUsd` / `lossTodayUsd`.

`intentKind` accepts `transfer · purchase · billPay · refund · trade · cancel ·
downgrade · upgrade · delete · send · apply · update`. Payment kinds fall through to
the amount rules; consequential kinds with no explicit rule default to `ask`.

**Three verdicts, three shapes — and the two non-`ask` ones answer 409:**

```jsonc
// allow — HTTP 409, no approval id (the row is created; list it with ?status=auto-allowed)
{ "error": "Request does not need human approval (allow).",
  "verdict": { "verdict": "allow", "reasons": ["amount $5 within auto threshold $10"], "resizedToUsd": null },
  "policy": { "autoBelowUsd": 10, "askAboveUsd": 10, "…": "…" } }

// ask — HTTP 201
{ "ok": true,
  "approval": { "id": "appr_f1635341-fa9", "verdict": "ask", "status": "pending",
                "reason": "amount $25 exceeds ask threshold $10", "amountUsd": 25,
                "target": "uniswap", "requester": "bankr-agent",
                "signature": "pQ+OCSbe…", "sigAlg": "ED25519", "sigVersion": 3,
                "signedAt": "2026-09-18T07:17:02.684Z" },
  "verdict": { "verdict": "ask", "reasons": ["amount $25 exceeds ask threshold $10"] } }

// deny — HTTP 409
{ "error": "Request does not need human approval (deny).",
  "verdict": { "verdict": "deny", "reasons": ["target matches deny rule: pumpdump"] } }
```

Rules the client must follow:

1. Read `verdict.verdict` from the body. **Do not** branch on the HTTP status: 409
   is the normal answer for `allow` and `deny`.
2. Treat a body with no `verdict` as the real failure case (400 validation, 401
   auth, 429 rate limit).
3. Never execute on `ask` or `deny`.

### Deny semantics, measured

- `never trade PUMPDUMP` + `target: "PUMPDUMP"` → `deny` — *"target matches deny rule: pumpdump"*.
- `never pay blacklisted merchants` + `target: "blacklisted-merchant"` → `deny` — *"target matches deny rule: blacklisted"*.
- `never delete anything` + `intentKind: "delete"` → `deny` — *"action type delete is denied by policy"*.
- A deny keyword is matched against the **`target`** field (case-insensitive
  substring). It is not matched against `summary`: `never trade PUMPDUMP` with
  `target: "pumpdump-coin"` and a summary mentioning it still returns `allow`.
  Send a real target string.

### Policy fields produced by `policyText`

`autoBelowUsd`, `askAboveUsd`, `dailyBudgetUsd`, `maxDrawdownUsd`, `maxDailyLossUsd`,
`allowActions`, `askActions`, `denyActions`, `denyKeywords`, `allowKeywords`,
`allowlistedRecipients`. The parsed policy comes back in the response as `policy`,
which is worth logging: it is what the engine actually understood, not what you meant.

## GET /api/approvals?status=…

`pending`, `approved`, `denied`, `auto-allowed`. Returns `{ "rows": [ … ] }` with the
same row shape as the `ask` response (signature included for signed rows).

## POST /api/approvals/{id} — record the human decision

```bash
curl -s -X POST https://askgrokwallet.io/api/approvals/appr_f1635341-fa9 \
  -H 'content-type: application/json' \
  -d '{ "decision": "approve", "by": "operator@example.com" }'
```

Returns the updated row: `status: "approved"`, `decision: "approve"`,
`decidedBy`, a fresh Ed25519 `signature`, `sigVersion: 3`. `decision` is `approve`
or `deny`; `deny` is final.

## GET /api/presets

`shopping-checkout`, `bill-pay`, `refund-recovery`, `trading-desk`,
`account-change-guard` — starting policies you can suggest to a user who has not
written theirs yet.

## GET /api/receipts/chain — the public log

Fingerprints only (`chainSeq`, `receiptId`, `event`, `prevHash`, `entryHash`,
`signedAt`), plus `anchors` and an `intact` flag. Holding a receipt lets you find
its entry and recompute its hash; not holding one tells you nothing about its
contents, which is deliberate.

## POST /api/receipts/verify — hosted check

Answers `{ "verified": true }` for an untampered receipt. Weaker than the
standalone verifier by construction — it asks the issuer whether the issuer's own
receipt is good. Prefer the released one-file verifier:

```bash
BASE=https://github.com/askgrokwallet/askgrokwallet/releases/download/verify-receipt-v1.0.0
curl -LO $BASE/verify-receipt.mjs && curl -LO $BASE/test-verify-receipt.mjs
node verify-receipt.mjs --version      # 1.0.0 + sha256 of the bytes you hold
node test-verify-receipt.mjs           # checks the verifier itself, offline
node verify-receipt.mjs receipt.json   # signature / chain / onchain / verdict
```

## Rate limits

Public reads are rate limited per client; the receipt log re-hashes the chain on
every call. `429` responses carry `retry-after` in seconds.
