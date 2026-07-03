# Write auth — `x-wallet-address` and server verification

Agents send **`x-wallet-address: 0x…`** on write requests. The header alone is **not** proof of identity — **api.hood.markets verifies server-side** before any mutation.

---

## What the server checks (not spoofable by header alone)

| Action | Server verification |
|--------|---------------------|
| **Deploy (X / Bankr)** | Bankr-linked wallet bound by platform; X daily limit per wallet; haiku JWT for non-X agents |
| **Deploy (haiku path)** | Valid `X-Agent-Captcha-JWT` tied to `agentFeeRecipient` wallet |
| **Claim own fees** | `POST /api/agent/claim` — wallet must match on-chain **fee recipient** for token (or valid haiku JWT) |
| **Claim for recipient** | `POST /api/agent/claim-for-recipient` — **no wallet required**; server sends fees to catalog/on-chain fee recipient only |
| **Buy / sell (Pro)** | Bankr `/wallet/submit` — txs validated per `references/TX-VALIDATION.md` and `known-contracts.json` |
| **Prepare-deploy / prepare-buy / prepare-sell** | Structured preflight; does not mutate chain state |

Fee recipient and deployer are resolved from **on-chain launch data and catalog**, not from untrusted request text alone.

---

## Agent rules

1. Set `x-wallet-address` to the **user's linked Bankr wallet** performing the action.
2. **Do not** assume the header grants access — if API returns `403` / `401`, surface it; do not retry with a different wallet without user instruction.
3. **Do not** document or imply that agents can impersonate arbitrary addresses — writes fail unless server checks pass.
4. For @bankrbot on X, Bankr platform should bind the linked wallet to the authenticated user before calling api.hood.markets (platform responsibility).

---

## Reads

Public `GET` endpoints (briefing, token-info, deployments, health) need **no** wallet header unless filtering by wallet.
