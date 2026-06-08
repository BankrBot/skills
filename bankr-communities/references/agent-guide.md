# Bankr Communities — agent guide

**Human site:** https://bankr-community.vercel.app

**Public agent guide:** https://bankr-community.vercel.app/agent.md

---

## Golden rules

1. **One sentence → full flow** — no "open the website" if API works.
2. **Briefing first** — `GET /api/agent/briefing` for "latest / members / opportunities".
3. **Holder-gated posts** — always `GET /api/holders/{token}?wallet=` before post/react.
4. **Owner verify** — only fee recipient / deployer.
5. **Reply with links** — full community URL, not "check the app".

---

## Intent → API

| User says | First call |
|-----------|------------|
| Latest on $TMP | `/api/agent/briefing?symbol=TMP` |
| Member count | briefing → stats.memberCount |
| Post in community | holders check → POST posts |
| Verify community | POST verify |
| Create community | search → POST communities |
| List all | GET /api/communities |
| Link to $TMP | instant table or GET /api/agent/link?q=TMP |

Full table: **`references/one-line-intents.md`**

---

## Install

```text
install the bankr-communities skill from https://github.com/BankrBot/skills/tree/main/bankr-communities
```

Self-hosted mirror (same content):

```text
install Bankr Communities skill at https://github.com/anondevv69/bankr-community/tree/main/skills/bankr-communities
```

---

## Key reference files

| File | When to read |
|------|--------------|
| `references/instant-link-replies.md` | Link questions (TMP/ARCHIVE) |
| `references/beneficiary-actions.md` | Verify, profile, pin, post+pin |
| `references/community-autopilot.md` | Step-by-step flows |
| `references/community-api-reference.md` | Endpoint details |
