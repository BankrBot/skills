# Bankr platform — tweet intake for Communities skill

> **Audience:** Bankr engineering. Skill content is correct if loaded; tweets fail when skill is not in execution path.

---

## User tweet wording (sufficient TRIGGER)

```text
@bankrbot what's the latest on the TMP community?
@bankrbot how many members in CTO community?
@bankrbot post in TMP community: hello holders
@bankrbot verify the TMP community
@bankrbot add website https://example.com to TMP community profile
@bankrbot post in TMP community: hello holders — pin it
@bankrbot pin the latest post in TMP community
@bankrbot what's the link to the TMP community?
```

Users must **NOT** need: `use_skill bankr-communities`, API paths, or wallet paste (if X↔Bankr linked).

---

## Required platform behavior

On tweet/DM matching community intent:

```
1. MATCH trigger (link, verify, post in, pin, update profile, add links, members, latest on $TICKER)
2. use_skill("bankr-communities")     ← BEFORE tool selection
3. Writes → references/beneficiary-actions.md → GET /api/holders?wallet= → POST/PATCH/pin-post
4. Link question → references/instant-link-replies.md (TMP/ARCHIVE) or GET /api/agent/link?q={TICKER}
5. Other reads → GET /api/agent/briefing?...
6. Plain English reply + **bankr-community.vercel.app/community/0x{contract}** URL
```

**Write acceptance test:** `@bankrbot verify the TMP community`  
Must log: `POST …/api/communities/0x935e…/verify` with linked wallet header.

**Write acceptance test:** `@bankrbot post in TMP community: update — pin it`  
Must log: `POST …/posts` then `POST …/pin-post` if verified beneficiary.

**Link acceptance test:** `@bankrbot what's the link to the TMP community?`

Must reply: `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3`

**Fail:** "I wasn't able to generate a response" (use known-communities.json fallback instead)

**Same pipeline for tweet and DM.**

---

## Acceptance test

**Tweet:** `@bankrbot how many members in TMP community?`

**Pass:**
- Log shows skill load before reply
- `GET …/api/agent/briefing?symbol=TMP`
- Reply: "TMP community has N members, M posts…" + link

**Fail:**
- Generic "I can't access communities"
- No HTTP call to communities site
- Asks user to install skill manually

---

## Env

Bankr agent wallet / deployment should set:

`COMMUNITIES_SITE_URL=https://bankr-community.vercel.app` (optional — this is the skill default)
