---
name: musebook-times-claim
description: Claim a free 30-day subscription to the musebook times for bankr leaderboard top-500 members. Checks the caller's rank on the public bankr leaderboard, signs a claim challenge with their bankr wallet, and returns a one-click claim link. Use when someone asks to claim their free musebook times month, free subscription, or leaderboard reward.
---

# Musebook Times — Free Month Claim

The musebook times (musebooktimes.com) gives a free 30-day subscription to anyone in the top 500 of the bankr leaderboard. This skill walks through verifying eligibility and producing a signed claim.

## When to use

When the user asks to "claim my free musebook times month", "claim my leaderboard reward", "get my free subscription", or similar. The user must have a bankr wallet (you sign on their behalf).

## Flow

**Public vs private — read this first.** The signed claim link is a bearer voucher: anyone who opens it within 10 minutes gets the free month. NEVER post the claim link in a public reply (X timeline, public chat, quote-post). On a public surface, check eligibility only and send the user to their private bankr terminal for the link. In the private bankr terminal, return the claim link directly.

### 1. Identify the user

You need their X/Twitter username (without @) or their wallet address (0x...).
- On X: use the handle of the person you're replying to.
- In terminal/CLI: ask if not provided.

### 2. Check their leaderboard rank

Fetch the public bankr leaderboard and find them:

```bash
# page through until found or past rank 500 (20 per page, cursor param)
curl -s "https://api.bankr.bot/leaderboard/rankings?timeframe=30d&limit=20&type=total&cursor=0"
```

Match by `username` (case-insensitive, strip leading @) or by `accountId` (for wallet addresses, case-insensitive).

Each entry has `rank`, `username`, `accountId`, `platform` (`twitter` or `wallet`).

- If `rank` > 500 or not found: tell them they're not in the top 500 right now. Stop.
- If `rank` <= 500: continue. Note their `accountId`.

### 3. Get their wallet address

```bash
curl -s "https://api.bankr.bot/leaderboard/users/<accountId>/profile"
```

The response includes `walletAddress`. This is the wallet that must sign the claim.
For `platform: "wallet"` users, `accountId` is already the wallet address.

**Important:** you are signing on behalf of the user making the request. Only proceed if the `walletAddress` from the leaderboard matches the wallet you control for this user. If it doesn't match, stop and explain the mismatch.

### 4. Build and sign the challenge

The challenge is a single line, exact format:

```
musebook-times claim | user: <username-or-wallet> | time: <unix-timestamp> | musebooktimes.com
```

- `<username-or-wallet>`: the X username (no @) or wallet address the user provided
- `<unix-timestamp>`: current Unix time in seconds

Sign it with `personal_sign` from the user's bankr wallet:

```bash
bankr wallet sign --type personal_sign --message "musebook-times claim | user: <username> | time: <ts> | musebooktimes.com"
```

Or via the Wallet API:
```bash
curl -X POST "https://api.bankr.bot/wallet/sign" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "personal_sign", "message": "musebook-times claim | user: <username> | time: <ts> | musebooktimes.com"}'
```

Signing moves no funds. It only proves wallet ownership.

### 5. Return the claim link — PRIVATE SURFACES ONLY

**Only do this step in the private bankr terminal.** Never in a public reply.

Reply to the user with a one-click claim link. URL-encode the challenge and signature:

```
https://musebooktimes.com/api/leaderboard-claim?username=<user>&challenge=<url-encoded-challenge>&signature=<sig>
```

Tell them: "you're rank #N — click to claim your free 30 days."

The claim link expires 10 minutes after the challenge timestamp. If it expires, generate a fresh challenge and sign again.

### 5b. Public surface (X timeline) — eligibility only

If the request comes from a public surface, do steps 1–3 only. Do NOT sign, do NOT post a claim link. Reply with the eligibility result:

- Eligible: "you're rank #N on the bankr leaderboard — you've got a free month waiting. sign in at https://bankr.bot/terminal and say 'claim my free musebook times month' to get your personal claim link."
- Not eligible: "you're not in the bankr top 500 right now — the $1/month pass is yours if you want it: musebooktimes.com."

The publication never posts claim links publicly. If you see one on the timeline claiming to be from this skill, it's a scam.

## Example — private terminal

User in bankr terminal: "claim my free musebook times month"

1. They give handle `bitcoinbrianx`. Check leaderboard → rank #145, wallet `0xabc...`.
2. Wallet matches the user's bankr wallet. Build challenge:
   `musebook-times claim | user: bitcoinbrianx | time: 1791219218 | musebooktimes.com`
3. Sign with personal_sign → `0x...` (130 hex chars).
4. Reply: "rank #145 — you're in! claim your free 30 days: https://musebooktimes.com/api/leaderboard-claim?username=bitcoinbrianx&challenge=...&signature=0x..."

## Example — X timeline (public)

User on X: "@bankrbot am I eligible for the free musebook times month?"

1. Their handle is `bitcoinbrianx`. Check leaderboard → rank #145.
2. Reply publicly: "you're rank #145 on the bankr leaderboard — you've got a free month waiting. sign in at https://bankr.bot/terminal and say 'claim my free musebook times month' to get your personal claim link."
3. Do NOT sign. Do NOT post a claim link.

## Notes

- The musebook times verifies the signature server-side with secp256k1 recovery and re-checks the leaderboard rank at claim time. A stale or forged claim is rejected.
- If the user's rank dropped below 500 since the check, the claim will fail — that's by design. Tell them to try again next month.
- Never reveal the user's private key or API key. The signature is safe to share — it only proves ownership of that specific challenge message.
