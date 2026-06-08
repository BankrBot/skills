# GET link — run exactly like terminal curl

> **Highest priority.** User asks for a community **link**, **URL**, or **where is** $TICKER community.

## Do this (3 steps)

```
1. Extract ticker from user message (strip $ and "community" words)
   Example: "what's the link to the TMP community?" → TMP

2. HTTP GET (same as terminal curl):
   https://bankr-community.vercel.app/api/agent/link?q=TMP

   Bankr terminal equivalent:
   curl "https://bankr-community.vercel.app/api/agent/link?q=TMP"

   Script equivalent:
   ./scripts/get-community-link.sh TMP

3. Tweet reply = response body verbatim. One line. Do not add text before or after.
```

**The API returns plain text — not JSON.** The entire response body is what you paste in the tweet.

---

## Examples

| User says | GET URL | Tweet reply (response body) |
|-----------|---------|----------------------------|
| link to **TMP** community | `.../api/agent/link?q=TMP` | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| link to **ARCHIVE** | `.../api/agent/link?q=ARCHIVE` | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |
| token exists, no community yet | `.../api/agent/link?q=FOO` | `No $FOO community yet — TokenName is on Bankr. Would you like me to create the community?` |

Replace `TMP` with whatever ticker/name/address the user asked for.

---

## If HTTP GET fails — use fallback (never fail silently)

Read `known-communities.json`. Never reply "I wasn't able to generate a response."

| Symbol | communityLink |
|--------|---------------|
| TMP | `https://bankr-community.vercel.app/community/0x935e13a28849095db45e63040f109c34b757aba3` |
| ARCHIVE | `https://bankr-community.vercel.app/community/0x76aba8089e4ba07f705fb886d17dd41793ad2ba3` |

For TMP/ARCHIVE link questions, prefer **`references/instant-link-replies.md`** (no HTTP required).

---

## JSON alternative (if you need fields)

```http
GET https://bankr-community.vercel.app/api/agent/resolve-community?q=TMP
```

Use field `communityLink` or `tweetReply` from JSON.

Plain text is preferred: `GET .../api/agent/link?q=TMP`

---

## FORBIDDEN

- `bankr.bot`, `t.co`, `/community/TMP` (symbol in path)
- Empty reply or "I wasn't able to generate a response"
- FAQ when user only asked for a link
- Inventing URLs without GET or known-communities fallback
