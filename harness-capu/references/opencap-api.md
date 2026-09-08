# OpenCAP account and inference API

Use this reference for wallet sign-in, key creation/rotation, and quota.
The account API and inference API have different credentials and paths.

| Purpose | Base | Credential |
| --- | --- | --- |
| Nonce and wallet verification | `https://gw.capminal.ai/api/account/siwe` | Nonce, then signed SIWE message |
| Account/key/quota management | `https://gw.capminal.ai/api/account` | `Authorization: Bearer <accountToken>` |
| Model discovery and inference | `https://gw.capminal.ai/api/inference/v1` | `Authorization: Bearer <key>` |

`OPENCAP_ACCOUNT_TOKEN` is this skill's secret-store label for `accountToken`;
`OPENCAP_API_KEY` is the documented inference environment variable.
No credentials are needed from Venice or Capminal's trading-wallet API.

## Verification status and source

Checked 2026-09-06 against the official public
[gateway dashboard](https://www.capminal.ai/gateway) and its deployed code:

- [Gateway API client](https://www.capminal.ai/_next/static/chunks/0172u~59lmgxi.js):
  constants, routes, HTTP methods, auth header, and error names.
- [Dashboard and SIWE client](https://www.capminal.ai/_next/static/chunks/0_6x9g5.~qb~g.js):
  sign-in message construction, response fields, key form, quota display.
- [Published OpenCAP guide](https://github.com/Capminal/capminal-gitbook/blob/7e128d64b22ae1cc63db73412b348ffcc1d76967/capminal/opencap.md):
  browser setup, inference base URL, billing order, budgets, and key distinction.

Live read-only checks using curl: nonce returned HTTP 200 with `nonce` and
`expiresAt`; unauthenticated key/quota reads returned HTTP 401
`unauthorized`; unauthenticated model listing returned HTTP 401 with an API
key requirement. No wallet was signed in and no key was created, revoked,
or used for inference during authoring. The authenticated request shapes
below come from deployed first-party code, not a published OpenAPI contract
or a completed end-to-end test.

Chunk filenames can change on deployment. If these links stop working,
inspect the current public dashboard's scripts and search for
`SIWE_DOMAIN`, `fetchNonce`, `verifySiwe`, `createKey`, and `getQuota`.
If the wire format changes, confirm the new first-party flow or use the
documented dashboard; do not improvise an endpoint or weaken SIWE binding.

## 1. Get a nonce

```http
GET https://gw.capminal.ai/api/account/siwe/nonce
```

Response fields observed live: `nonce` (string) and `expiresAt` (Unix epoch
milliseconds). Use a freshly fetched nonce, check the returned expiry, and
do not hardcode an assumed lifetime or reuse a nonce after verification.

## 2. Construct and sign the message

Use these constants exactly as the deployed dashboard does:

| SIWE field | Value |
| --- | --- |
| domain | `www.capminal.ai` |
| uri | `https://www.capminal.ai` |
| statement | `Sign in to CapRouter.` |
| version | `1` |
| chainId | `8453` |
| address | Owning wallet's checksummed EVM address |
| nonce | Fresh nonce from step 1 |
| issuedAt | Current UTC ISO 8601 time |

The name `CapRouter` is the actual login statement used by OpenCAP. Do not
change it to CAPU, Capminal, Harness, or Venice.

Use an existing SIWE/EIP-4361 serializer when available. The resulting text
has this layout, with real LF newlines, a blank line after the address and
after the statement, and no added trailing newline:

```text
www.capminal.ai wants you to sign in with your Ethereum account:
<checksummed wallet address>

Sign in to CapRouter.

URI: https://www.capminal.ai
Version: 1
Chain ID: 8453
Nonce: <fresh nonce>
Issued At: <current UTC ISO timestamp>
```

Sign the UTF-8 message with the owning wallet's EIP-191 personal-message
signer (`personal_sign` / `signMessage`). Follow the host signer's parameter
convention and locally verify the recovered signer where supported. Do not
sign just the nonce or sign a transaction/typed permit instead. Do not
export a private key. Smart-contract wallet signature support has not been
verified; use the dashboard if the wallet's supported signer cannot complete
this flow.

## 3. Exchange the signature for an account session

```http
POST https://gw.capminal.ai/api/account/siwe/verify
Content-Type: application/json
```

Serialize a JSON object with exactly these fields:

```json
{
  "message": "<the exact SIWE text that was signed>",
  "signature": "<0x-prefixed personal-message signature>"
}
```

Use a JSON serializer so message newlines survive exactly. Capture the
response in memory; the dashboard consumes `accountToken`, `accountId`,
and `walletAddress`. Require a nonempty token and a `walletAddress` matching
the intended wallet (case-insensitive address comparison) before making
account requests. Store the session privately as `OPENCAP_ACCOUNT_TOKEN`.
Do not print the signature response or token, embed it in an artifact, or
give this management token to an inference app.

No fixed session lifetime was established. On HTTP 401, discard the failed
session and authenticate afresh. Retry authentication once for an expired or
used nonce using a newly fetched nonce and newly signed message; persistent
failure requires diagnosis or browser handoff, not a buying/staking attempt.

## 4. Create an inference key

```http
POST https://gw.capminal.ai/api/account/keys
Authorization: Bearer <accountToken>
Content-Type: application/json
```

Example body (the dollar cap is illustrative, not a default authorization):

```json
{
  "name": "harness-capu inference",
  "dailyBudgetUSD": 1
}
```

The dashboard sends optional `name`, `dailyBudgetUSD` (nonnegative JSON
number), and `expiresAt` (future ISO 8601 timestamp). Omit unspecified
optional fields. No daily budget means no per-key cap beyond the account's
available pool; **zero stops the key**, it does not mean unlimited. Do not
invent an expiry or a minimum staked-CAPU requirement.

The full one-time inference secret is **`key`** in the create response. Save
it to the approved secret store as `OPENCAP_API_KEY` before the private
handoff. Do not print raw create responses to obtain the secret. Record
the key ID from actual response metadata or `GET /keys`; do not assume the
secret itself is the ID. The dashboard list returns `keys`, an array of
metadata containing `id`, `name`, `dailyBudgetUSD`, `expiresAt`, and
`isActive` among other fields. Do not assume a hardcoded secret prefix:
published examples and dashboard samples differ.

On an ambiguous create timeout, list keys and identify the attempted
creation before retrying. List metadata cannot reproduce a lost full secret.
Revoke only the identified orphan key; if identification is uncertain, resolve
it with the owner instead of deleting other keys.

## 5. Account reads and key management

All paths below are relative to `https://gw.capminal.ai` and require the
**account token**, not the inference key.

| Method and path | Body / result |
| --- | --- |
| `GET /api/account/keys` | Key metadata in `keys` |
| `GET /api/account/quota` | `dailyQuotaUSD`, `spentTodayUSD`, `reservedTodayUSD`, `remainingUSD` as consumed by the dashboard |
| `GET /api/account/keys/{id}/usage?days=14` | Per-key usage; use returned schema, do not invent aggregate fields |
| `GET /api/account/activity?period=7d` | Account activity; optional `keyId` query parameter |
| `PATCH /api/account/keys/{id}` | `{"dailyBudgetUSD": 1}` changes cap; `{"dailyBudgetUSD": null}` removes cap |
| `PATCH /api/account/keys/{id}` | `{"expiresAt": "<future ISO timestamp>"}` changes expiry; null removes expiry |
| `DELETE /api/account/keys/{id}` | Revoke the selected key |

URL-encode actual key IDs when constructing paths. Changing a budget does
not reset today's spending. Remaining quota accounts for billed spend and
reservations for in-flight requests; use the API's value, not just quota
minus spend. Treat absent fields as unknown; the dashboard displays a null
`remainingUSD` as unlimited, not zero. Do not infer prepaid USDC balances
from these quota fields; check the authenticated dashboard for that balance.

Revocation is immediate according to the dashboard. Confirm successful
revocation through the HTTP result and refreshed key metadata. Do not claim
rotation succeeded while the old key's revocation is unresolved.

## 6. Inference client setup and validation

Set the app's base URL to `https://gw.capminal.ai/api/inference/v1`, and inject
`OPENCAP_API_KEY` from the secret store. A client that appends
`/chat/completions` should receive this base URL, not the bare gateway host.

```http
GET https://gw.capminal.ai/api/inference/v1/models
Authorization: Bearer <inference key>
```

Use model IDs returned by the authenticated model endpoint or the current
[model catalog](https://www.capminal.ai/models). Model listing checks
authentication without generating paid output. It does not verify funding.
An authorized inference test uses:

```http
POST https://gw.capminal.ai/api/inference/v1/chat/completions
Authorization: Bearer <inference key>
Content-Type: application/json
```

```json
{
  "model": "<current model ID>",
  "messages": [{"role": "user", "content": "Reply with OK."}],
  "max_tokens": 8,
  "stream": false
}
```

Use a model supporting the chosen output limit; adapt to an explicit model
parameter error rather than repeatedly sending billable test requests.
Capture errors without logging credentials. On insufficient quota, a key
budget stop, or expiry, inspect the corresponding state before proposing
funding or rotation. Never silently buy prepaid credits.

## Useful observed errors

The dashboard handles `unauthorized`, `key_limit_reached`, `rate_limited`,
`service_unavailable`, `bad_domain`, `wrong_chain`, `bad_signature`,
`bad_nonce`, `nonce_invalid_or_used`, `malformed_message`,
`expired_or_not_yet_valid`, and expiry-validation errors. A key-limit error
may include `max`; use the returned limit instead of hardcoding the UI's
fallback value. Respect rate-limit backoff. A schema mismatch or persistent
authentication failure is a reason to inspect current docs/dashboard or ask
the team, not to copy Venice's API flow.
