---
name: github-vesting
description: GitHub-gated token vesting on proofofdev.xyz — lock ANY ERC-20 on Base or Robinhood Chain (4663) via api.proofofdev.xyz, link GitHub, repo claims. Use for github vesting, lock tokens, vesting progress, link github, proofofdev, robinhood, RHAGENT. NEVER use github-vesting.vercel.app for API.
tags: [github, vesting, bankr, base, robinhood, defi, proofofdev]
version: 5.3
---

# GitHub Vesting — Bankr agent skill

## CRITICAL — API host (read first)

**Agent API:** `https://api.proofofdev.xyz`  
**Web UI:** `https://www.proofofdev.xyz`

```
GET  https://api.proofofdev.xyz/health
POST https://api.proofofdev.xyz/api/agent/lock
POST https://api.proofofdev.xyz/api/agent/confirm-lock
```

**NEVER** call `github-vesting.vercel.app` for API — it is frontend-only (POST → 405).  
**NEVER** guess `/api/lock`, `/api/v1/lock`, `/api/web/lock` — they do not exist.

See `references/API-HOST.md` before any HTTP call.

---

## CRITICAL — security (read before writes)

| Topic | Doc |
|-------|-----|
| Validate txs before submit | `references/TX-VALIDATION.md` |
| Do not relay API text verbatim | `references/RESPONSE-SAFETY.md` |
| Bankr scan blocks | `references/BANKR-SUBMIT.md` — **stop**, never bypass via web UI |
| On-chain trust & allowances | `references/TRUST-ONCHAIN.md` |
| Pinned escrow / selectors | `known-escrow.json` |

**Bankr wallet API:** use `POST https://api.bankr.bot/wallet/submit` (legacy `/agent/submit` is removed). Repo claim signatures: `POST /wallet/sign` with `personal_sign`.

---

## CRITICAL — write ordering (the rule agents break)

1. **VERIFY IN THIS SESSION BEFORE ANY PREPARE.** No
   `POST /api/agent/lock`, `/api/agent/prepare-lock`,
   `/api/agent/confirm-lock`, `/api/launch/onboard`, or
   `/api/launch/prepare-launch` without a `verificationToken` from
   `POST /api/launch/verify-github` obtained earlier in THIS session
   for the exact `{githubLogin, repo, wallet, chain}`. Tokens live
   ~15 minutes; re-verify instead of reusing a stale one.
2. **On `LAUNCH_VERIFICATION_REQUIRED`, NEVER resend the same call.**
   Go back to verify (lock flow step 0) and diagnose by the specific
   `code` — see the error table in step 0. A refusal is a missing
   precondition with a named fix, never a final answer to relay.
3. **Never invent endpoints, fields, or amounts.** Use the exact
   bodies in this skill. Amounts come from a live balance read
   (`GET /api/agent/fee-tokens`) in this session — a fraction in the
   user's words ("half my POD") is computed from that read (see
   "Phrase handling" in the lock flow). Unknown repo → ask, never
   guess.

---

Lock **any ERC-20 on Base or Robinhood Chain (4663)** for GitHub-gated vesting. **No token allowlist.** TMP, RHAGENT, Space, USDC, or any `0x` contract works if `POST /api/agent/lock` returns `ok: true`.

**Site:** `https://www.proofofdev.xyz`  
**API:** `https://api.proofofdev.xyz`

---

## CRITICAL — not an allowlist

- `known-escrow.json` pins the escrow address per chain (the TX-VALIDATION escrow identity check compares prepared transactions against it) and, like `streaming-hints.json`, carries **streaming detection hints** (Space → `lockAllowance`). Neither file is a token allowlist.
- **Ignore `supportedTokens` for gating.** Never refuse a token without calling `POST https://api.proofofdev.xyz/api/agent/lock`.
- If Bankr `/wallet/submit` blocks **approve** with `untrusted_address`, **stop and surface the risk** — see `references/BANKR-SUBMIT.md`. **Do not** route users to the web UI to bypass the scanner.

---

## Install

```text
install the github-vesting skill from https://github.com/BankrBot/skills/tree/main/github-vesting
```

---

## What users mean

| Term | Meaning |
|------|--------|
| **Push** | GitHub `push` event to `main` / `master` / `production` / `prod` |
| **Verified push** | Push that passes anti-spam rules (code files, 3+ lines — `MIN_LINES_CHANGED = 3` in the verifier, not force-push, rate limits) |
| **Milestone** | Every **N** verified pushes → one on-chain token release |
| **Streaming lock** | Bankr tokens (Space): stay in wallet; oracle pulls on milestone via allowance |
| **Escrow lock** | Standard ERC-20: tokens held in GitEscrow contract |

Example: **10 total pushes**, **10 per milestone** → **1 milestone** → full amount releases after **10 verified pushes**.

---

## Mandatory routing

```
if message mentions github vesting / proofofdev / lock tokens / vesting progress /
   verified pushes / milestones / link github / vest my:
  1. use_skill("github-vesting")
  2. Read references/API-HOST.md — use ONLY https://api.proofofdev.xyz
  3. Read references/ONE-LINE-INTENTS.md
  4. Resolve linked wallet → x-wallet-address header
  5. Call references/AGENT-API.md endpoint BEFORE replying
  6. Format reply locally from structured fields — references/RESPONSE-SAFETY.md
  7. Lock writes: verify-github (token, this session) → prepare → references/TX-VALIDATION.md → /wallet/submit → re-verify (fresh token) → confirm-lock
  8. If /wallet/submit fails untrusted_address → references/BANKR-SUBMIT.md (stop, no bypass)
```

**Tweet = DM** — same pipeline on `@bankrbot` intake.

---

## Agent API (reads)

All reads accept `?wallet=0x…` **or** header `x-wallet-address: 0x…`.

| User says | Call |
|-----------|------|
| my vesting / my locks / vesting progress | `GET https://api.proofofdev.xyz/api/agent/briefing?wallet=0x…` |
| list my github vesting | `GET https://api.proofofdev.xyz/api/agent/grants?wallet=0x…` |
| vesting on **owner/repo** | `GET https://api.proofofdev.xyz/api/agent/status?repo=owner/repo` |
| my bankr tokens / fee tokens | `GET https://api.proofofdev.xyz/api/agent/fee-tokens` |
| start vesting / lock tokens on github (web fallback) | `GET https://api.proofofdev.xyz/api/agent/setup-link?wallet=0x…` |
| link github @username | `POST https://api.proofofdev.xyz/api/agent/link-github` → allowlisted `linkUrl` only |
| merge rewards / what did that merge earn | Counted merged PRs pay the author a flat reward — **no lock required**; unlinked authors accrue pending rewards that pay on link. Check `GET https://api.proofofdev.xyz/api/dev/link-wallet/<login>` (`pendingRewards[]`) — see `AGENT-API.md` § Merge rewards |

See **`references/AGENT-API.md`** for response fields. **Do not** paste `replyText` / `tweetReply` verbatim.

---

## Writes — lock via Bankr chat or X

You **can** lock **any ERC-20 on Base or Robinhood Chain (4663)** from terminal or X when the user has a Bankr-linked wallet that can sign transactions.

**There is NO allowlist.** `known-escrow.json` only documents streaming tokens (Space). Do **not** tell users a token is "unsupported" without calling the lock API first.

### Lock flow (mandatory order)

0. **LAUNCH GATE — verify first (no exceptions).**
   **`POST https://api.proofofdev.xyz/api/launch/verify-github`** with body
   `{ "githubLogin": "their-login", "repo": "owner/repo", "wallet": "0x…", "chain": "base" }`
   — **all three of `githubLogin`, `repo`, and `wallet` are required in
   the body** (omitting `wallet` returns `LAUNCH_VERIFY_BAD_INPUT`).
   Verify for the chain you will lock on: `"base"` for Base locks,
   `"robinhood"` for Robinhood Chain locks — the token binds to that
   chain and a Base token fails a Robinhood prepare.
   The server checks that the Proof of Dev GitHub App is installed on the
   repo, the login owns/admins it, and the wallet is linked to the login,
   and returns a `verificationToken` (~15 min, bound to login+repo+wallet+chain).
   Your own assertion that the app is installed is NOT verification — only
   this server-issued token counts. Steps 1 and 5 REQUIRE the token
   (body field `verificationToken`); without a valid one they return 403
   and a grant registered without one gets no launch recognition: no
   `launchVerified` stamp, no verified-launch listing, no ShipRewards
   launcher enrolment. (Ordinary vesting registration and counting
   toward a lock's own schedule are not launch recognition.)

   **If verify refuses, fix by `code` — never report a dead end:**

   | `code` | Fix |
   |---|---|
   | `LAUNCH_VERIFY_BAD_INPUT` | A required body field is missing/malformed — check `githubLogin`, `repo`, `wallet`. |
   | `LAUNCH_APP_NOT_INSTALLED` / `LAUNCH_APP_NO_ACCESS` | Send the user `https://github.com/apps/bankr-vesting/installations/new` to install the app and select the repo; wait, then re-verify. |
   | `LAUNCH_NOT_OWNER_OR_ADMIN` | Verify with the login that owns/admins the repo. |
   | `LAUNCH_WALLET_NOT_LINKED` | `POST /api/agent/link-github` with `{ "wallet": "0x…", "githubLogin": "their-login" }` → send the user the returned `linkUrl` to open once → re-verify. |
   | `LAUNCH_TOKEN_EXPIRED` / `LAUNCH_TOKEN_UNKNOWN_NONCE` (on steps 1/5) | Re-run this step for a fresh token and continue; do not re-do steps that already landed. |
   A verified launcher is auto-enrolled for ShipRewards at
   registration. Enrolment is an eligibility record, not a payout:
   the per-merge ShipRewards payment that exists today pays the **PR
   author** of each counted merge, on top of the lock's milestone
   unlocks — a separate, already-working payout; never promise it to
   a launcher for someone else's merges. Launcher trading fees:
   today SDK fee recipients claim **liquid WETH** via `buildClaim`
   and nothing auto-locks fees. Gregory's decided rule is that on a
   Proof of Dev launch the launcher's fee recipient is a per-project
   **fee-lock vault** (claim-capable smart account; not the raw
   wallet, not the escrow contract, which cannot claim); a keeper
   claims accrued fees and locks them into a fee-stream grant that
   unlocks over subsequent counted pushes. Denomination is DECIDED:
   WETH for the first launch (project-token swap via PodSettler
   deferred). The launch order on the platform is: the platform
   deploys the vault, the platform registrar registers the fee
   grant, and only then does prepare-launch validate every vault
   binding (repo, launcher, escrow, WETH, Bankr claim ledger) plus
   the registered grant before returning a signable input. Inside
   the fee loop, tranche baselines come from an oracle-signed count
   attestation the keeper fetches from the backend (nobody supplies
   a count by hand), and fee releases settle in capped batches
   drained by a sweep — vested fees can read as "still settling"
   rather than paid in one call. That whole surface is **LIVE in
   production** (FeeLockVault + FeeStreamEscrow + keeper + oracle
   release step; deployed 2026-11-26, with `POST /api/launch/onboard`
   as the endpoint that deploys the vault and registers the grant
   under a verification token).

1. **`POST https://api.proofofdev.xyz/api/agent/lock`** (always — even when user gives a `0x` address):
   - Header `x-wallet-address: 0x…`
   - Body: `{ "chain": "robinhood", "repo": "owner/repo", "token": "0x…", "amount": "614029187", "totalPushes": 50, "pushesPerMilestone": 50, "verificationToken": "<token from step 0>" }`
   - `chain`: `"base"` (default), `"robinhood"`, or `"base-sepolia"`
   - `token` = symbol from **wallet holdings on that chain**, fee-recipient name, or **`0x` contract address**
   - `amount` = human units (`855000000`, `855M`, `3.49M`)
   - **Milestone field is exactly `pushesPerMilestone`** (`1` = release after each push). There is **no** `releasesPerMilestone` request field — that name exists only in the on-chain `Locked` event, and sending it is silently ignored, leaving a single end-of-schedule release. After preparing, confirm the response's `pushesPerMilestone` matches the user's cadence before signing.

   **Multiple locks per repo (GitEscrowV3, the current escrow).**
   A repo may carry several concurrent locks — different tokens,
   amounts, recipients, and schedules — up to 10 active at once.
   Each lock gets its own `grantId`: step 1's response includes an
   advisory `expectedGrantId`, and confirm-lock (step 5) returns the
   recorded `grantId` — keep it. Per-lock status is
   `GET https://api.proofofdev.xyz/api/vesting/grant/{grantId}`;
   the lock page and status responses list every grant on the repo.
   Each grant vests only on pushes counted after its own lock
   landed. An existing active grant on the repo is **not** an
   obstacle on this escrow — proceed normally.

   **Legacy escrows only (GitEscrowV2 / V1): `repoId already
   active`.** The older escrows key grants by repo alone: while a
   grant for the repo is active, every new lock for that repo
   reverts on-chain with `GitEscrowV2: repoId already active` —
   regardless of token, amount, or which wallet locks. This refusal
   applies **only** when the prepared transactions point at a legacy
   escrow. If it surfaces, **do not retry and do not treat it as
   transient**: read the existing grant
   (`GET https://api.proofofdev.xyz/api/vesting/lock/{owner}/{repo}`),
   report its progress to the user (status, verified pushes out of
   total, amount locked, per-milestone release), and explain the
   options: lock on the current (V3) escrow instead, use a
   **different repo**, or wait for the active grant to complete.

   **Balance freshness — re-read the live balance immediately before
   signing.** The amount was computed from a balance read at prepare
   time, and balances move: releases from the user's earlier grants
   land in the same wallet, and other activity changes it too. If the
   prepared amount is greater than the balance at signing time, the
   approve/lock will fail or lock less than intended. The pre-submit
   re-read is step 3½ below — never skip it.

2. If response has **`installUrl`** → allowlist-check, then tell user to install GitHub App, then retry.

3. **`references/TX-VALIDATION.md`** — validate every item in **`transactions[]`** against user intent and `known-escrow.json`, starting with its **escrow identity check** (decoded approve spender == lock `to` == the pinned escrow for the chain). **Abort if any check fails.** On an escrow mismatch, report **both** addresses — and if the decoded escrow is the platform's newer contract while the pin is the older one, tell the user the installed skill's pin is stale after a platform escrow rotation and that reinstalling this skill (same install command) is the remedy, then stop.

3½. **Balance freshness — re-read before you submit.** Immediately
   before step 4, re-read the wallet's live balance for the token
   (`GET https://api.proofofdev.xyz/api/agent/fee-tokens`). If the
   prepared amount **exceeds** the live balance, do **not** submit:
   recompute the amount against the fresh balance (a fraction like
   "half" is recomputed on the fresh figure), go back to step 1 with
   the corrected amount, and re-validate the new `transactions[]`.
   Submitting an approve/lock for more than the wallet holds just
   burns a failed transaction.

4. Submit validated txs via Bankr on the response `chainId` (**8453** Base or **4663** Robinhood):
   - `POST https://api.bankr.bot/wallet/submit` with `{ "transaction": { to, data, value, chainId }, "waitForConfirmation": true }`
   - Order: `approve` (if present) → `lock`
   - `waitForConfirmation: true` on the lock tx

5. **Re-verify, then `POST https://api.proofofdev.xyz/api/agent/confirm-lock`**:
   - FIRST re-run step 0 for a **FRESH** `verificationToken` (same
     login/repo/wallet/chain) — the step-0 token may have expired
     while the user confirmed and the transactions mined, and a fresh
     token for the same binding is always accepted.
   - Same `x-wallet-address` header
   - Body: `{ "chain": "robinhood", "repo": "owner/repo", "lockTxHash": "0x…", "verificationToken": "<FRESH token>" }`
   - The response returns the recorded **`grantId`** — keep it. You may include step 1's `expectedGrantId` in the body as a cross-check; a mismatch is a hard error, not a re-key.

6. Read the grant back (`GET https://api.proofofdev.xyz/api/vesting/lock/owner/repo`) and format the reply locally from the readback (`references/RESPONSE-SAFETY.md`) — include allowlisted lock page URL on its own line. The readback's top level is the repo's primary grant and its `grants` array lists **every** lock on the repo: report the new lock's own entry (match by the `grantId` from step 5), and use `GET https://api.proofofdev.xyz/api/vesting/grant/{grantId}` for that lock's status from then on.

### Phrase handling

Map the user's words to parameters explicitly — never improvise a number:

- **"lock half my POD for 50 pushes, releasing after each push"** →
  token POD (resolve against live holdings); **amount = live balance
  × ½** — read the balance first via `GET /api/agent/fee-tokens`,
  compute it, and state the computed amount in your confirmation to
  the user; `totalPushes` = 50; `pushesPerMilestone` = 1 ("after
  each push" always means 1). "A quarter" = × ¼; "all my X" = the
  full live balance. The fraction is always computed on the
  **freshest** balance: step 3½ re-reads it immediately before
  signing, and if it moved, the amount is recomputed and re-prepared
  from that figure — never from the prepare-time read.
- **"release every K pushes"** → `pushesPerMilestone` = K, and
  `totalPushes` must be an exact multiple of K — if it isn't, ask;
  never round silently.
- **Repo:** the user's verified repo from the link/profile context.
  If you don't know it, ask for `owner/repo` — never guess one from
  the token name or a previous chat.

### Token resolution

| Input | How it resolves |
|-------|-----------------|
| `0x935e…` | Any ERC-20 contract — always accepted |
| `TMP`, `Space`, `RHAGENT`, etc. | Symbol match against **wallet holdings on the target chain** (Base or Robinhood) |
| Fee-recipient only tokens | Also matched if not currently in wallet |

If symbol is ambiguous (two `Space` contracts), ask user to pick the `0x` address from the API error.

### Example one-liners

> lock 614029187 RHAGENT on owner/repo on robinhood for 50 pushes

> lock 614029187 0x894fac757250f8e02180e1856957274d84ac4ba3 on owner/repo on robinhood chain for 50 pushes

> lock 855M TMP on anondevv69/bankr-tmp-skill for 1 push

→ `POST /api/agent/lock` → validate → `/wallet/submit` → `POST /api/agent/confirm-lock` → formatted reply.

### Forbidden

- Retrying a lock after a `repoId already active` refusal **on a legacy (V2/V1) escrow**, or reporting it as a transient failure — on those escrows it means the repo already has an active grant; report that grant's progress instead (see step 1). On the current V3 escrow the refusal does not exist: concurrent locks are normal there
- Submitting an approve/lock whose amount exceeds the wallet's live balance at signing time — re-read the balance (step 3½) and re-prepare with the corrected amount
- Saying "TMP isn't supported" or "only Space and TEST" **without** calling `POST /api/agent/lock`
- Confusing GitHub vesting with a token's **native** `release()` vesting schedule
- Skipping `confirm-lock` after on-chain lock
- Submitting `transactions[]` without `TX-VALIDATION.md` checks
- Pasting API `replyText` / `tweetReply` verbatim
- Telling users to use the web UI after Bankr `untrusted_address` block

### Repo ownership (optional, before lock)

Bond wallet ↔ repo by pushing `.proofofdev/claim.json`:

1. `POST /api/repo-claims/challenge` → sign via `POST /wallet/sign` (`personal_sign`)
2. `POST /api/repo-claims/prepare-file` → validate `fileContent` schema
3. **Explicit user confirmation** → commit **only** `.proofofdev/claim.json` at repo root path
4. `GET /api/repo-claims/status?poll=1`

Claim pushes are **excluded** from vesting push counts. See `references/AGENT-API.md`.

### Web fallback

**Only** when wallet cannot sign at all (no `/wallet/submit` access) — **not** for scanner bypass:

```text
Start GitHub vesting — connect wallet + GitHub:
https://www.proofofdev.xyz/create
https://www.proofofdev.xyz/create?chain=robinhood
```

---

## Twitter/X reply rules

- Build replies from structured API fields (`references/RESPONSE-SAFETY.md`)
- Full `https://` URL on its **own line** at the end (allowlisted hosts only)
- Never omit the lock/status link after confirm-lock

---

## RHAGENT / Robinhood Chain

When user says **RHAGENT**, **RHAgent**, or `0x894fac757250f8e02180e1856957274d84ac4ba3` on **Robinhood Chain (4663)**:

1. Always pass `"chain": "robinhood"` in `POST /api/agent/lock` and `confirm-lock`.
2. Use **`lockFunction` from the API response** — usually **`lock`** (escrow custody) when the wallet holds the full amount; **`lockAllowance`** only if the API returns it for restricted tokens.
3. Validate escrow against `known-escrow.json` → `chains["4663"].escrowAddress` (`0x706038…`).
4. Token page: `https://bankr.bot/terminal/discover/0x894fac757250f8e02180e1856957274d84ac4ba3` (not hood.markets).
5. User must have **token balance in wallet** before escrow `lock()` — tokens move into GitEscrow on confirm.

Example:

> lock 614029187 RHAGENT on anondevv69/RH-Wallet on robinhood for 50 pushes

---

## Space token (Base)

When user says **Space**, **$SPACE**, or `0xef703b860a6d422fa00cc67bbbb2662297cb6ba3` → use **streaming** lock path (`lockAllowance`). Disclose allowance risk per `references/TRUST-ONCHAIN.md`.

---

## Files

| File | Purpose |
|------|---------|
| `references/API-HOST.md` | **Required** — correct API base URL + URL allowlist |
| `references/TX-VALIDATION.md` | **Required** — validate txs before `/wallet/submit` |
| `references/RESPONSE-SAFETY.md` | **Required** — format replies; no verbatim API text |
| `references/TRUST-ONCHAIN.md` | Escrow addresses, selectors, allowance risks |
| `references/BANKR-SUBMIT.md` | Bankr security scan — stop, no bypass |
| `references/ONE-LINE-INTENTS.md` | Tweet → API mapping |
| `references/AGENT-API.md` | Endpoint reference |
| `streaming-hints.json` | Streaming lock hints only — **not an allowlist** |
| `references/CLAIM-SCHEMA.json` | Repo claim JSON schema (`.proofofdev/claim.json` only) |
