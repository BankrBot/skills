# Bankr wallet API — when this skill touches on-chain flows

Most **bankr-communities** actions are **HTTP-only** (posts, profile PATCH, votes, links). No `/wallet/submit` for those paths.

## Fundraising / x402 / raffles

Some Space flows use **x402 USDC** via Bankr (`paySpaceFund`, raffle fund). When the user funds via Bankr wallet:

- Use **`POST https://api.bankr.bot/wallet/submit`** (legacy `/agent/submit` is removed).
- Requires API key with `walletApiEnabled` and not `readOnly`.

## `untrusted_address` or security scan blocks

When Bankr rejects a transaction:

1. **Stop** — do not submit further txs.
2. **Surface the risk** in plain language.
3. **Do not** route the user to a web UI or external wallet to **bypass** Bankr's scanner.
4. Options: different amount, contact Bankr support, or retry later.

### Forbidden

- "Complete the approve on bankr.space instead to bypass the block"
- Any workflow that trains users to circumvent Bankr after a high-risk scan

## POIDH bounties

Fund/claim/vote on **poidh.xyz** per `POIDH-BOUNTY-ACTIONS.md` — separate host; link users to the bounty URL, do not invent paths.
