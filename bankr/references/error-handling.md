# Error Handling Reference

What Bankr's errors mean and what to do about them. Every endpoint's exact error bodies are in the OpenAPI spec (`https://docs.bankr.bot/openapi/api.yaml`).

## Checking a key

- **CLI:** `bankr whoami` shows which key is in use and where it came from (`BANKR_API_KEY` or the config file), then loads the account with it.
- **REST:** call `GET /wallet/me` with the key. `200` means it works, `401` means it's missing, wrong or revoked, and `403` means something like an IP allowlist is blocking it. Don't test a key against `/_health`: that endpoint ignores the key and always answers `200`.

The CLI's `Not authenticated` means it found no key in `BANKR_API_KEY` or `~/.bankr/config.json`. To log in, follow [Get an API key](../SKILL.md#get-an-api-key) in SKILL.md. In a sandbox where the host supplies the credential, read [Host-Managed Credentials](safety.md#host-managed-credentials-no-key-on-disk) first.

## Authentication and access errors

| Status | `error` | Cause | Fix |
|--------|---------|-------|-----|
| 401 | `API key required`, `Authentication required`, `No wallet associated with API key` | No key was sent, or the key isn't linked to a wallet | Send `X-API-Key` or `Authorization: Bearer`; if you did, mint a new key |
| 401 | `Invalid API key` | The key is wrong, revoked or rotated | Use the current key, or mint one at [bankr.bot/api-keys](https://bankr.bot/api-keys) |
| 403 | `IP address not allowed` | The request came from outside the key's `allowedIps` | Call from an allowed IP, or edit the allowlist |
| 403 | `Agent API access not enabled`, `Wallet API access not enabled`, `LLM Gateway access not enabled` | The key lacks that capability flag | Enable it at [bankr.bot/api-keys](https://bankr.bot/api-keys) |
| 403 | `Read-only API key` | A write on a read-only key | Use a read-write key |
| 403 | `Restricted API key` | The key's recipient allowlist blocks raw submission, transaction or typed-data signing, or this fee recipient | Use `/agent/prompt`, or a key without an allowlist |
| 403 | `subscription_required` | `/agent/prompt` without Bankr Club or Max Mode credit | Follow the `remediation` list in the body |
| 403 | `Wallet paused`, `Arbitrary contract calls disabled`, or a body with `errorCode` | A wallet security setting | See [sign-submit-api.md](sign-submit-api.md#wallet-security-settings-apply) |

The flags, allowlists and wallet settings behind these are explained in [safety.md](safety.md).

Minting a key from the dashboard or `bankr login email` can fail with `400 Name already exists` when an active key already has that name (choose another `--key-name`, or omit it for a unique `CLI-<date>-<time>` name), or with `400 API key limit reached` at 30 active keys (revoke stale ones at [bankr.bot/api-keys](https://bankr.bot/api-keys)). Every mint path, `bankr login siwe` included, shares a cap of 20 attempts per hour per IP: past it you get `429 Too many API key creations`, or `503` if the counter is briefly unavailable. Wait before retrying.

## HTTP status codes

| Code | On Bankr | What to do |
|------|----------|------------|
| 400 | An invalid request, or an operation that failed (`success: false` with `error`) | Fix the request. On `/wallet/submit`, a `400` that carries a `transactionHash` was broadcast |
| 401, 403 | See the table above | |
| 402 | LLM gateway credits are exhausted, or the wallet can't fund a credit top-up | Top up with `bankr llm credits add <usd>` or at [bankr.bot/terminal/llm?tab=credits](https://bankr.bot/terminal/llm?tab=credits); see [llm-gateway.md](llm-gateway.md) |
| 404 | A job or thread that doesn't exist on this account | Check the ID and which account the key belongs to |
| 409 | `/wallet/swap`: the same `idempotencyKey` is still in flight, or a pending transaction is in the way | Wait and check the wallet's activity; don't resubmit under a new key |
| 429 | A rate limit, or the daily prompt quota | Back off; for the quota, wait until `resetAt`. See [safety.md](safety.md#rate-limits) |
| 500, 503 | A server-side failure | Retry after a delay; for swaps, only with the same `idempotencyKey` |
| 502, 504 | An upstream failure, or a confirmation that timed out | For swaps, see below |

Agent jobs work differently: a job that fails still answers `200`, with `status: "failed"` and the agent's own explanation in `error`. See [agent-api-workflow.md](agent-api-workflow.md).

## Retrying swaps safely

Send an `idempotencyKey` (a UUID) with every `/wallet/swap`, and retry only with the same key. A failure before broadcast releases the key, so the retry runs normally. A failure after broadcast is recorded under the key for 24 hours, so a retry replays that response and never swaps twice. While the original request is still running, a retry gets `409 duplicate_request`.

After the responses below, retrying under a **new** key can execute a second swap. Check the wallet's activity for the hash first:

| Response | What happened |
|----------|---------------|
| `504 receipt_pending` | The swap was broadcast; only the confirmation is missing |
| `502 fill_unconfirmed` | A Solana LaunchLab fill was broadcast but couldn't be confirmed |
| `502 fill_failed` | A cross-chain fill failed after the origin transaction landed; the input is being returned to the wallet |

Other `502`s, such as no fresh quote or a signing failure, happen before broadcast. `/wallet/submit` takes no idempotency key; see [sign-submit-api.md](sign-submit-api.md#confirmation-and-failures).

## Getting help

Report the job ID, the exact error text, a timestamp, and the chain and tokens involved, but never the API key (`bankr config get` masks it). Support is at [help.bankr.bot](https://help.bankr.bot) and [support@bankr.bot](mailto:support@bankr.bot). Bankr never DMs first and never asks for a seed phrase or private key.
