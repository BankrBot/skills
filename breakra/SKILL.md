---
name: breakra
description: Check whether an OpenAPI 3.0 change breaks API consumers. Send the old and new contract; get every change classified (breaking / potentially_breaking / unknown / compatible / non_contract) with evidence and a recommended action. Paid per call, $0.02 USDC on Base via x402.
---

# Breakra: OpenAPI compatibility check for agents

Breakra compares two OpenAPI 3.0 JSON contracts and tells you which changes may break existing callers, where they are, and what to do about them. Results are deterministic: the same two contracts always give the same `analysis_id` and the same findings.

- **Endpoint:** `POST https://x402.bankr.bot/0xb98f0de777eea8c481b64e33d3e0066cea38fa91/breakra-analyze`
- **Price:** $0.02 USDC on Base (x402 v2, scheme `exact`, network `eip155:8453`, amount `20000`). **Only a 200 is charged.** Every error (4xx/5xx) is free.
- **Contract:** [`openapi.json`](https://breakra.dev/openapi.json). Example request and response: [`examples/`](https://github.com/danbuildss/breakra/tree/main/examples).

## When to use it

- Before merging or releasing a change to an OpenAPI contract: "does this PR break clients?"
- When upgrading to a new version of a third-party API: "what changed that affects my integration?"
- When writing release notes or a migration guide: you get a list of changes with reasons and actions.

Don't use it for: OpenAPI 3.1, Swagger 2.0, YAML (convert to JSON first), contracts given only as URLs (fetch them yourself), or a combined request body over 1 MB.

## Request

```json
{ "before": { "openapi": "3.0.3", "info": { "title": "…", "version": "1" }, "paths": { } },
  "after":  { "openapi": "3.0.3", "info": { "title": "…", "version": "2" }, "paths": { } } }
```

- Exactly two fields, `before` and `after`, each a whole inline OpenAPI 3.0.0–3.0.4 document.
- Local `$ref`s (`#/…`) are resolved, including circular ones. External `$ref`s are **never fetched**: they're listed in `limitations`. Inline them first if they matter.
- Limits: 1 MB body (1,048,576 bytes for the whole JSON request), nesting 64, 5,000 operations, 75,000 nodes once `$ref`s are expanded. Over a limit → a free 413 or 422.

## Paying (x402)

1. `POST` the body with no payment. You get **402** with the terms in the `payment-required` header (base64 JSON). The 402 comes before your body is validated, so a bad request is only rejected (free) on the paid attempt.
2. **Check the terms before signing.** Refuse anything that differs:

   | Field | Expected |
   |---|---|
   | `x402Version` | `2` |
   | `scheme` | `exact` |
   | `network` | `eip155:8453` (Base) |
   | `asset` | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
   | `amount` | `20000` or less (USDC has 6 decimals, so $0.02) |
   | `payTo` | `0x8AEE621035D93Deb3C0C1177fac252dC2dd501a0` (Bankr's fee router, which forwards to the service owner in the same transaction) |
   | `maxTimeoutSeconds` | `60` (how long your signature stays valid) |
   | `extra.assetTransferMethod` | absent or `eip3009` (a USDC `TransferWithAuthorization`, not Permit2) |

3. Sign **one** EIP-3009 USDC authorization and resend the **same body** with the `PAYMENT-SIGNATURE` header. With `@x402/core` + `@x402/evm`, call `x402HTTPClient.getPaymentRequiredResponse`, `createPaymentPayload` and `encodePaymentSignatureHeader` yourself. Don't use `wrapFetchWithPayment`, which can re-sign and resend on its own.

Rules:
- **One signature per call.** Don't let a client library re-sign and resend automatically: if the first paid attempt succeeded, a second signature is a second charge. A reused signature gets `402 Payment already used`.
- No payment receipt header is returned. A 200 means you paid; any other status means you didn't.
- Retrying after an error is safe and free until you get a 200. Only `ANALYSIS_FAILED` (500) is worth retrying with the same input; other errors will repeat. A retry starts over: unpaid request, new 402, new signature (the old signature can't be reused).
- If the paid request dies in transit (timeout, reset) you can't know whether it was charged. Don't re-sign straight away: wait at least 60 s (the signature then expires and can't settle any more) and check your wallet's USDC transfers to `payTo` before trying again.
- A whole call takes about 3–20 s depending on size (a 940 KB pair took 18 s end to end). Use a timeout of at least 30 s.

A complete, safe client (checks terms, signs once): [`examples/client.ts`](https://raw.githubusercontent.com/danbuildss/breakra/main/examples/client.ts).

## Reading the result

```json
{
  "status": "success",
  "analysis_id": "sha256:…",
  "compatibility": "breaking",
  "summary": { "total_changes": 15, "breaking": 1, "potentially_breaking": 10, "unknown": 0, "compatible": 2, "non_contract": 2 },
  "changes": [
    {
      "id": "change-002",
      "rule": "request.required_parameter_added",
      "compatibility": "potentially_breaking",
      "direction": "request",
      "operation": { "method": "GET", "path": "/orders" },
      "location": { "in": "query", "name": "customer_id" },
      "reason": "A new required query parameter `customer_id` was added to GET /orders. Callers that do not send it may be rejected.",
      "recommended_action": "Update callers of GET /orders to send `customer_id`.",
      "evidence": { "path": ["paths", "/orders", "get", "parameters", "query:customer_id"], "before": null, "after": { "…": "…" } }
    }
  ],
  "limitations": [],
  "metadata": { "changes_omitted": 0, "…": "…" }
}
```

| `compatibility` | Meaning | What to do |
|---|---|---|
| `breaking` | Existing callers **will** fail (a removed operation) | Block the release, or ship as a new major version with a migration path |
| `potentially_breaking` | Some callers **may** fail, depending on how they use it | Review each finding. Request side: callers' current inputs may be rejected. Response side: callers may get values they don't handle |
| `unknown` | Changed in a way the rules don't evaluate | Review by hand. Never treat as safe |
| `compatible` | Additive; well-behaved callers are unaffected | Nothing required |
| `non_contract` | Docs or metadata only | Nothing required |

- The top-level `compatibility` is the most severe class found. Use it as the pass/fail gate: fail on `breaking`, and on `potentially_breaking` or `unknown` unless a reviewer accepts them.
- `direction` says who is affected: `request` (what callers send), `response` (what callers receive), `operation`, `security` or `document`.
- `changes` is sorted most severe first and capped at 500. `summary` always counts everything; `metadata.changes_omitted` says how many weren't listed.
- Always read `limitations` (an array of plain-English strings). A result with external `$refs` didn't see what those refs point to.
- Rules are versioned (`rule_set_version`). The full rule table is in [`RULES.md`](https://github.com/danbuildss/breakra/blob/main/RULES.md).

## Errors (never charged)

| HTTP | `error.code` | Fix |
|---|---|---|
| 400 | `INVALID_REQUEST` | Send JSON with exactly `before` and `after`, each an object |
| 405 | `METHOD_NOT_ALLOWED` | Use POST |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 1 MB: drop unrelated paths from both contracts and compare in parts |
| 422 | `INVALID_SPECIFICATION` | Missing `openapi`/`info`/`paths`, a malformed path or operation, or a `$ref` that doesn't resolve |
| 422 | `UNSUPPORTED_OPENAPI_VERSION` | Only OpenAPI 3.0.x JSON is supported |
| 422 | `SPEC_TOO_COMPLEX` | Too deep, too many operations, or `$ref`s expand too far: compare a subset of paths |
| 500 | `ANALYSIS_FAILED` | Unexpected; retry once with the same input |

Error bodies look like `{"status":"error","error":{"code":"…","message":"…","retryable":false}}` and never echo your input.

## Privacy

Breakra's code does not store or log submitted contracts. Its logs hold only the outcome, size, change count, duration and the paying address. Requests pass through Bankr x402 Cloud (the host); don't send contracts you aren't allowed to share with a third-party service.
