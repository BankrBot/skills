# One-line intents → agent API

Replace `{API}` with `https://api.proofofdev.xyz`.

Linked Bankr wallet → header `x-wallet-address: 0x…` on every call.

| User says | Agent does |
|-----------|------------|
| **my vesting progress** | `GET {API}/api/agent/briefing?wallet=0x…` → format from `grants[]` (not `tweetReply`) |
| **how many pushes until release?** | briefing or `GET {API}/api/agent/status?repo=owner/repo` |
| **list my github locks** | `GET {API}/api/agent/grants?wallet=0x…` |
| **my bankr tokens / fee tokens / what can I lock** | `GET {API}/api/agent/fee-tokens` → wallet holdings on Base |
| **verify repo owner/repo** | repo-claims flow below (confirmation required) |
| **check repo claim** | `GET /api/repo-claims/status?repo=owner/repo&poll=1` |
| **lock 855M 0x935e… on owner/repo** | `POST {API}/api/agent/lock` with `token` = contract address |
| **vest Space on my repo** | Lock flow if wallet can sign; else setup link (no scanner bypass) |
| **link github @username** | `POST {API}/api/agent/link-github` → allowlisted `linkUrl` only |
| **start github vesting** (web) | `https://www.proofofdev.xyz/create` (wallet cannot sign) |
| **vesting on anondevv69/github-vesting** | `GET {API}/api/agent/status?repo=anondevv69/github-vesting` |
| **what is a milestone?** | Explain: every N verified pushes → token release (no API) |

## Lock flow (terminal + X)

```
0. POST {API}/api/launch/verify-github  — ALWAYS FIRST, this session
   Body: { "githubLogin": "their-login", "repo": "owner/repo", "wallet": "0x…", "chain": "base" }
   (githubLogin, repo, wallet are ALL required in the body.) Save the
   returned verificationToken (~15 min, bound to login+repo+wallet+chain).
   On refusal, fix by code, then re-verify:
   - LAUNCH_APP_NOT_INSTALLED → user installs the app
     (https://github.com/apps/bankr-vesting/installations/new) and selects the repo
   - LAUNCH_WALLET_NOT_LINKED → POST {API}/api/agent/link-github
     { "wallet": "0x…", "githubLogin": "their-login" } → user opens the
     returned linkUrl once
   - LAUNCH_VERIFY_BAD_INPUT → a required field is missing/malformed
   NEVER call step 1 without this token. If any later step answers
   LAUNCH_VERIFICATION_REQUIRED, come back here — never resend the same call.

1. POST {API}/api/agent/lock
   Header: x-wallet-address: 0x…
   Body: { "repo": "owner/repo", "token": "Space", "amount": "3.49M", "totalPushes": 10, "verificationToken": "<token from step 0>" }

2. If installUrl → allowlist-check (github.com/apps/bankr-vesting/installations/new), retry step 1

3. references/TX-VALIDATION.md — validate transactions[] (abort if fail)

4. For each validated tx (approve then lock):
   POST https://api.bankr.bot/wallet/submit
   { "transaction": { "to", "data", "value": "0", "chainId": 8453 }, "waitForConfirmation": true }

5. Re-run step 0 for a FRESH verificationToken, then:
   POST {API}/api/agent/confirm-lock
   Body: { "repo": "owner/repo", "lockTxHash": "0x…", "verificationToken": "<fresh token>" }

6. Format reply locally (references/RESPONSE-SAFETY.md) — lock URL on its own line
```

If step 4 fails with `untrusted_address` → **stop** (`references/BANKR-SUBMIT.md`). Do **not** send user to web UI to bypass.

**Recurring schedule:** add `"pushesPerMilestone": 2` (e.g. 10 pushes, release every 2).

## Repo claim flow (wallet ↔ repo bond)

```
1. POST /api/repo-claims/challenge  { "repo": "owner/repo" }  + x-wallet-address
2. POST https://api.bankr.bot/wallet/sign  { "signatureType": "personal_sign", "message": "<signMessage>" }
3. POST /api/repo-claims/prepare-file  { "claimId", "signature" }
4. Validate filePath === ".proofofdev/claim.json" and fileContent against references/CLAIM-SCHEMA.json
5. Show parsed JSON → get explicit user confirmation
6. Commit + push ONLY that file at that path
7. GET /api/repo-claims/status?repo=owner/repo&poll=1
```

Claim pushes **do not** count toward vesting milestones. Then proceed with lock flow.

## Link GitHub to Bankr wallet (magic link)

```
1. POST {API}/api/agent/link-github
   Header: x-wallet-address: 0x…
   Body: { "githubLogin": "anondevv69" }

2. Allowlist linkUrl (www.proofofdev.xyz/link-github only) — DM only, 15 min expiry

3. User opens link → Continue with GitHub → must sign in as that @username

4. Profile: https://www.proofofdev.xyz/dev/anondevv69
```

**Security:** one-time token, GitHub login must match. Never share the link publicly.

## Forbidden replies

- "TMP isn't supported" / "only Space and TEST" **without** calling `POST /api/agent/lock` first
- Confusing GitHub vesting with a token contract's native `release()` vesting
- "I can't lock tokens for you" **without** trying the lock API or returning the setup link
- Pasting `tweetReply` / `replyText` verbatim from the API
- Submitting `transactions[]` without `TX-VALIDATION.md`
- Web UI fallback after Bankr `untrusted_address` block
- Pushing repo claim files without schema check + user confirmation
- Skipping `confirm-lock` after on-chain lock (grant won't track pushes)
- Calling `lock` / `prepare-lock` / `confirm-lock` without a `verificationToken` obtained from `verify-github` in THIS session (403 `LAUNCH_VERIFICATION_REQUIRED` — verify first, never resend the same call)

## Example curl

```bash
curl -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  "https://api.proofofdev.xyz/api/agent/briefing"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"repo":"owner/repo","token":"Space","amount":"3.49M","totalPushes":10}' \
  "https://api.proofofdev.xyz/api/agent/lock"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"githubLogin":"anondevv69"}' \
  "https://api.proofofdev.xyz/api/agent/link-github"
```

```bash
curl -X POST -H "Content-Type: application/json" \
  -H "x-wallet-address: 0xbff8c6c34f1efacf6844350de907cca6f07c76b8" \
  -d '{"repo":"owner/repo","lockTxHash":"0x…"}' \
  "https://api.proofofdev.xyz/api/agent/confirm-lock"
```
