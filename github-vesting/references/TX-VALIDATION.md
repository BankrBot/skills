# Transaction validation — required before Bankr `/wallet/submit`

`POST /api/agent/lock` returns `transactions[]` from a **third-party hosted API**. Treat every field as untrusted until locally validated against `known-escrow.json` and the user's stated lock intent.

**Never** call `POST https://api.bankr.bot/wallet/submit` until **all** checks below pass. On any failure: **stop**, explain what failed, and do **not** submit.

Read `known-escrow.json` for pinned addresses, chain ID, and allowed selectors.

---

## Escrow identity check (run FIRST, before every other check)

The prepared transactions come from a hosted API. Before validating
anything else, establish **which escrow this lock would actually use**,
from the transactions themselves:

1. **Decode the approve spender** (calldata arg 1) if an approve tx is
   present, and **note the lock tx's `to`**. (If there is no approve —
   streaming locks — the lock tx's `to` alone is the escrow.)
2. **They must equal each other.** Approve spender ≠ lock `to` → stop.
3. **Compare against the pin** for the request chain:
   `known-escrow.json` → `escrowAddress` (Base) or
   `chains["4663"].escrowAddress` (Robinhood) — the same values as
   `references/TRUST-ONCHAIN.md`. No API endpoint publishes the current
   escrow address; the prepared transactions carry it only inside
   their calldata/`to`, so this pin comparison **is** the live check.
4. **On any mismatch: stop, sign nothing, and report BOTH addresses**
   — the escrow decoded from the prepared transactions AND the pinned
   escrow — plus the chain. Do not "fix" the transactions and do not
   proceed with either address.
   - One cause has a user remedy: if the platform has rotated its
     escrow, an older installed skill still pins the previous escrow
     and every new lock will mismatch. Say so in your report — the
     user should **reinstall this skill** (same install command as
     the original install) to pick up the current pin, then
     re-prepare. A mismatch is a stop, but it is not a dead end:
     name the remedy.

The superseded Base escrows listed in `known-escrow.json`
(`escrowHistory`) and `TRUST-ONCHAIN.md` are never valid here: they
serve legacy grants only, and a new prepare response pointing at one
of them is a mismatch like any other.

---

## User intent to pin

Before calling the lock API, record from the user's message:

| Field | Example |
|-------|---------|
| `repo` | `anondevv69/bankr-tmp-skill` |
| `token` | symbol or `0x` address |
| `amount` | human units (`855M`, `3.49M`) |
| `totalPushes` | default `10` if omitted |
| `pushesPerMilestone` | default = `totalPushes` |

**The milestone request field is exactly `pushesPerMilestone`.**
There is **no** `releasesPerMilestone` request field — that name
exists only as a parameter of the on-chain `Locked` event. Sending
`releasesPerMilestone` is silently ignored and the lock falls back
to a single release of the full amount after `totalPushes`. When the
user asks for release "after each push", the body must carry
`"pushesPerMilestone": 1`, and the response's `pushesPerMilestone`
must read back `1` before you continue.

After `POST /api/agent/lock`, also pin from the JSON response (structured fields only):

- `amountWei`, `tokenSymbol`, `lockFunction` (`lock` or `lockAllowance`)
- `totalPushes`, `pushesPerMilestone`
- resolved token contract address (from response or your prior resolution)

Compute expected `repoId` = `keccak256(bytes(utf8(repo.trim())))` — same as Solidity `keccak256(abi.encodePacked(repo))`.

**Balance freshness (run after pinning, before any submit).**
Balances move between prepare and signing — releases from the
user's earlier grants land in the same wallet. Re-read the wallet's
live balance for the token (`GET /api/agent/fee-tokens`) immediately
before submitting. If `amountWei` **exceeds** the live balance, stop:
do not submit, do not trim the calldata yourself. Recompute the
amount from the fresh balance (fractions like "half" are recomputed
on the fresh figure), re-run `POST /api/agent/lock` with the
corrected amount, and validate the new batch from the top.

**Existing active grant.** On the current escrow (GitEscrowV3),
an existing active grant for the repo is normal and blocks nothing:
the repo may carry up to 10 concurrent grants, each with its own
`grantId`. The one-grant refusal exists **only on legacy escrows**:
if the lock API, a simulation, or the submit reports an active
grant for the repo with the on-chain revert `GitEscrowV2: repoId
already active` **and the decoded escrow is a legacy (V2/V1)
address**, that is final, not transient — those escrows allow
exactly one active grant per repo. Never retry the lock. Read the
grant back (`GET /api/vesting/lock/{owner}/{repo}`), report its
progress, and tell the user the options: lock on the current (V3)
escrow instead, use a different repo, or wait for the active grant
to complete.

---

## Batch rules

| Rule | Requirement |
|------|-------------|
| Count | **1 or 2** transactions only |
| Order | optional `approve` → then `lock` |
| Extra txs | **reject** — no third tx, no hidden steps |
| Steps | only `approve` and/or `lock` in `step` field |

---

## Per-transaction checks (every tx)

| Field | Requirement |
|-------|-------------|
| `chainId` | **8453** (Base) or **4663** (Robinhood Chain) — must match `chain` in lock API request and `known-escrow.json` → `chains` |
| `value` | exactly **`0x0`** or **`0`** (zero ETH) |
| `to` | valid checksummed address — see step-specific rules |
| `data` | non-empty hex; selector must be allowlisted |

---

## Approve tx (if present)

| Check | Requirement |
|-------|-------------|
| Selector | `0x095ea7b3` (`approve(address,uint256)`) |
| `to` | **token contract** — must equal token address in lock calldata |
| Spender (arg 1) | exactly the escrow established by the **Escrow identity check** above (decoded spender == lock `to` == the pin for the request chain) |
| Amount (arg 2) | **≤ `amountWei`** from lock API response **and** ≤ amount user requested |
| No infinite approve | reject `type(uint256).max` unless user explicitly requested max (they did not) |

---

## Lock tx (required)

| Check | Requirement |
|-------|-------------|
| `to` | exactly the escrow established by the **Escrow identity check** above, matching request `chainId` |
| Selector | `0xc9c2dca6` (`lock`) **or** `0xf2bc8198` (`lockAllowance`) only |
| Forbidden selectors | reject `lockWithPermit`, `release`, `cancel`, `setOracle`, transfers, or anything else |
| Arg 0 `repoId` | matches `keccak256(bytes(userRepo))` |
| Arg 1 `token` | matches resolved token for this lock |
| Arg 2 `amount` | equals `amountWei` from API response |
| Arg 3 `totalPushes` | matches user intent / API response |
| Arg 4 `pushesPerMilestone` | matches user intent / API response |
| `lockFunction` | Must match API response `lockFunction` — **`lock`** (escrow) or **`lockAllowance`** (streaming). Do **not** assume all Robinhood tokens use `lockAllowance`; RHAGENT uses **`lock`** when balance is sufficient. |

---

## Bankr submit format

Legacy `/agent/submit` is **removed**. Use:

```http
POST https://api.bankr.bot/wallet/submit
X-API-Key: …
Content-Type: application/json

{
  "transaction": {
    "to": "0x…",
    "chainId": 8453,
    "value": "0",
    "data": "0x…"
  },
  "description": "Proof of Dev: approve TMP for GitEscrow",
  "waitForConfirmation": true
}
```

Set `waitForConfirmation: true` on the **lock** tx (final step). Approve may use `false` unless you need the allowance before lock.

Requires API key with `walletApiEnabled` and **not** `readOnly`. See `bankr/references/sign-submit-api.md` in this repo.

---

## After submit

Only after lock tx confirms:

```http
POST https://api.proofofdev.xyz/api/agent/confirm-lock
```

Body: `{ "repo": "owner/repo", "lockTxHash": "0x…", "chain": "base" | "robinhood" }` — `repo` must match validated intent; hash from Bankr submit response; `chain` must match lock request.
