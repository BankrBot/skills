# Bankr API keys (`bk_…`) — agent rules

## Never in public tweets

- **Never** ask the user to paste `bk_…` in a reply to @bankrbot on X.
- **Never** echo or repeat a user's API key in any public channel.
- **Never** store the key in skill files or commit it to git.

## Path A — site one-time setup (recommended)

Fee recipient pastes `bk_…` once on **bankr.space** → Edit profile → Bankr project sync.

After that, profile saves and posts **auto-sync** to `bankr.bot/agents` server-side. The agent does not need the key for ongoing Space → project sync.

## Path B — X agent create/sync

`POST https://www.bankr.space/api/agent/bankr-project-payload` requires:

```
X-API-Key: bk_…
x-wallet-address: 0xFEE_RECIPIENT
```

Use only when:

1. User has **Agent API access** enabled on the key (`bankr.bot/api-keys`).
2. Key is provided via **DM**, Bankr secure channel, or platform-linked account — **not** a public tweet.
3. Fee recipient check passes: `GET /api/holders/{token}?wallet={linked}`.

If `Agent API access not enabled` → direct user to enable on bankr.bot/api-keys or use Path A on site.

## Path C — project → Space

`GET/POST /api/agent/space-from-bankr-project` — optional `X-API-Key` for unapproved owner profiles. Same DM-only rule for keys.

## Read-only Bankr calls

Public reads (no key):

```
GET https://api.bankr.bot/agent-profiles/{tokenAddress}
GET https://api.bankr.bot/agent-profiles/{tokenAddress}/tweets
```

## If Bankr rejects a write

Stop and surface the error. **Do not** instruct users to bypass Bankr security controls or paste keys in public threads.
