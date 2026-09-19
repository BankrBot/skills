# AskGrokWallet API — the parts this skill uses

Base URL `https://askgrokwallet.io`. Everything below was exercised live on
2026-09-18; response bodies are trimmed to the fields that matter.

## Auth

| Identity | How | Use for |
| --- | --- | --- |
| `source: "demo"` | no header | trying the gate, demos, this skill out of the box |
| anything else | `Authorization: Bearer <token>` + `source: "<label>"` | real rows; unauthenticated non-demo writes are rejected `401` |

## POST /api/approvals — evaluate (and record) a spend request

Body: `source`, `requester`, `summary`, `amountUsd`, `target`, `assets`,
`counterparty`, `intentKind`, `policyText`, optional `logResolved`, optional `execute`
intent, optional `drawdownUsd` / `lossTodayUsd`.

`target` is the venue (`uniswap`); `assets` (array, max 10) and `counterparty` name the
thing being moved and the other side. A `never X` rule is matched against all of them
plus `summary` — see *Deny semantics* below for why that matters.

`logResolved: true` persists a receipt for an `allow` or `deny` verdict (which
otherwise persist nothing) and returns it with its `id`.

`intentKind` accepts `transfer · purchase · billPay · refund · trade · cancel ·
downgrade · upgrade · delete · send · apply · update`. Payment kinds fall through to
the amount rules; consequential kinds with no explicit rule default to `ask`.

**Three verdicts, three shapes — all of them 2xx:**

```jsonc
// allow — HTTP 200, nothing persisted unless you asked for it.
// With "logResolved": true this is HTTP 201 and carries the stored receipt + its id;
// without it there is no id to keep, and ?status=auto-allowed is a status-wide list,
// not a way to recover your row.
{ "ok": true,
  "verdict": { "verdict": "allow", "reasons": ["amount $5 within auto threshold $10"], "resizedToUsd": null },
  "policy": { "autoBelowUsd": 10, "askAboveUsd": 10, "…": "…" },
  "note": "Inside the policy — no human step needed. Nothing was persisted: pass logResolved to keep a receipt." }

// allow with logResolved — HTTP 201
{ "ok": true,
  "approval": { "id": "appr_…", "status": "auto-allowed", "verdict": "allow", "signature": "…" },
  "verdict": { "verdict": "allow", "reasons": ["amount $5 within auto threshold $10"] } }

// ask — HTTP 201
{ "ok": true,
  "approval": { "id": "appr_f1635341-fa9", "verdict": "ask", "status": "pending",
                "reason": "amount $25 exceeds ask threshold $10", "amountUsd": 25,
                "target": "uniswap", "requester": "bankr-agent",
                "signature": "pQ+OCSbe…", "sigAlg": "ED25519", "sigVersion": 3,
                "signedAt": "2026-09-18T07:17:02.684Z" },
  "verdict": { "verdict": "ask", "reasons": ["amount $25 exceeds ask threshold $10"] } }

// deny — HTTP 200
{ "ok": true,
  "verdict": { "verdict": "deny", "reasons": ["deny rule \"pumpdump\" matched summary: swap 25 USDC for PUMPDUMP"] },
  "note": "Forbidden by policy — no human step exists for this. Nothing was persisted: pass logResolved to keep a receipt." }
```

Rules the client must follow:

1. Read `verdict.verdict` from the body. A verdict is an answer, not an error — before
   2026-09-18 `allow`/`deny` answered 409 with the reason in an `error` field, so
   branching on the status was wrong then and is unnecessary now.
2. Treat a body with no `verdict` as the real failure case (400 validation, 401 auth,
   429 rate limit; the route still uses 409 for genuine conflicts such as a reused
   `idempotencyKey`).
3. Never execute on `ask` or `deny`.

### Deny semantics, measured (2026-09-19)

A deny keyword is matched, case-insensitively, against the request's **whole stated
identity**: `target`, `assets`, `counterparty`, `recipient`, `payee`, `merchant`,
`token`, `pair`, `market`, and `summary`. The reason names the field it matched, so a
denial is reproducible rather than mysterious.

| policy | request | verdict |
| --- | --- | --- |
| `never trade PUMPDUMP` | `target: "uniswap"`, `summary: "swap 25 USDC for PUMPDUMP"` | `deny` — *deny rule "pumpdump" matched summary* |
| `never trade PUMPDUMP` | `target: "PUMPDUMP"` | `deny` — *deny rule "pumpdump" matched target* |
| `never trade PUMPDUMP` | `target: "uniswap"`, `assets: ["PUMPDUMP"]` | `deny` — *deny rule "pumpdump" matched assets* |
| `never trade PUMPDUMP` | `target: "uniswap"`, `summary: "swap 5 USDC for ETH"` | `allow` — the rule is about the asset, and the asset is not in the plan |
| `never trade PUMPDUMP` | no asset, counterparty or plan named | `ask` — *policy forbids "pumpdump" but the request names no asset, counterparty or plan to check it against* |
| `never pay blacklisted merchants` | `target: "blacklisted-merchant"` | `deny` — *deny rule "blacklisted" matched target* |
| `never trade pumpdump-coin` | `target: "pumpdump-coin"` | `deny` — keyword `pumpdump-coin`, a hyphenated name stays one keyword |
| `never pay coinbase` | `target: "openai"` | `allow` — keywords are whole words; the older substring matching turned this rule into the keyword `base` |
| `never delete anything` | `intentKind: "delete"` | `deny` — *action type delete is denied by policy* |

Before 2026-09-19 this search ran over `target` alone, so `never trade PUMPDUMP` was
cleared by sending the venue and putting the asset only in the summary. If you cached
that behaviour anywhere, re-run it.

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
BASE=https://github.com/askgrokwallet/askgrokwallet/releases/download/verify-receipt-v1.0.1
curl -LO $BASE/verify-receipt.mjs && curl -LO $BASE/test-verify-receipt.mjs
curl -sLO $BASE/SHA256SUMS
shasum -a 256 -c SHA256SUMS           # check the bytes BEFORE running them
node verify-receipt.mjs --version     # 1.0.1 + sha256 of the bytes you hold
node test-verify-receipt.mjs          # checks the verifier itself, offline
node verify-receipt.mjs receipt.json  # signature / chain / onchain / verdict
node verify-receipt.mjs receipt.json --json   # structured result, for branching
```

`--version` reporting its own hash *after* it runs is not an integrity gate — it is a
claim by the thing you are checking. Verify against the published `SHA256SUMS` (or the
hash in the release notes) first.

### What the four lines do and do not say

- `signature ✓` — these exact fields were signed by the key this file pins.
- `chain ✓` — this record sits at this position in the issuer's append-only log.
- `onchain ✓` — that log's head is in a transaction that executed. An anchor that is
  only broadcast, that reverted, or whose outcome the node would not report is `~`.
- `verdict ✓` — genuine, and fixed onchain. **It is a statement about the record, not
  about a payment.** An approval receipt, a denial receipt, and a receipt with
  `txHash: null` all authenticate exactly as well as a payment. `~` means *unverified*
  and must never be read as a pass. "Did the money move" is a separate question,
  answered by reading the transaction the receipt names.

## Rate limits

Public reads are rate limited per client; the receipt log re-hashes the chain on
every call. `429` responses carry `retry-after` in seconds.
