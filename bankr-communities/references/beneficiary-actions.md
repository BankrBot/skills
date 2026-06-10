# Beneficiary actions — verify, profile, pin (tweet + terminal)

> Same pipeline as **post in space**. User does NOT need to say `use_skill`. Load `bankr-communities` → call API → plain English reply + space URL.

**Site:** `https://bankr.space`  
**Writes:** header `x-wallet-address: {user's linked Bankr wallet}` — never the thread starter's wallet.

---

## Who can do what

| Action | Who | Space must be verified? |
|--------|-----|----------------------------|
| **Verify** | Fee beneficiary only | No (this creates verified) |
| **Update profile / social links** | Fee beneficiary only | No |
| **Post / comment** | Holder OR beneficiary OR deployer | No |
| **Pin / unpin post** | Fee beneficiary only | **Yes** |

Check before writes:

```http
GET /api/holders/{tokenAddress}?wallet={linked}
```

Use: `canEditProfile`, `canPinPosts`, `canPost`, `isBeneficiary`.

---

## Verify space

**User says:**
```text
@bankrbot verify the TMP space
@bankrbot verify space for $TMP
```

**Steps:**
```
1. GET /api/agent/briefing?symbol=TMP  → get tokenAddress, community.verified
2. If already verified → "TMP space is already verified" + communityLink → STOP
3. POST /api/communities/{tokenAddress}/verify
   Header: x-wallet-address: {linked}
4. Reply: "Verified $TMP space ✓" + communityLink on its own line → STOP
5. 403 → "Only the token fee beneficiary can verify" + communityLink
```

---

## Update profile / add social links

**User says:**
```text
@bankrbot add website https://tokenmarketplace.shop to TMP space
@bankrbot update TMP space profile: website tokenmarketplace.shop telegram t.me/tmp
@bankrbot set TMP space description: Token marketplace for holders
@bankrbot add these links to TMP token info: x @MyToken github myorg/repo
```

**Editable fields:** `description`, `socialLinks.x`, `socialLinks.website`, `socialLinks.github`, `socialLinks.telegram`, `socialLinks.discord`

**NOT editable via API:** beneficiary wallet (from Bankr launch data).

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canEditProfile → 403 message → STOP
2. GET /api/communities/{tokenAddress} → read current description + socialLinks
3. Merge user-requested fields into body (keep existing fields not mentioned)
4. PATCH /api/communities/{tokenAddress}
   Body: { "description": "...", "socialLinks": { "website": "...", "x": "...", ... } }
   Header: x-wallet-address: {linked}
5. Reply: "Updated $TMP space profile" + list what changed + communityLink → STOP
```

**PATCH body example:**
```json
{
  "description": "Token Market Place for holders.",
  "socialLinks": {
    "website": "https://tokenmarketplace.shop",
    "x": "https://x.com/MyToken",
    "telegram": "https://t.me/mytoken",
    "discord": "https://discord.gg/mytoken"
  }
}
```

---

## Pin a post

**User says:**
```text
@bankrbot pin post post_123 in TMP space
@bankrbot unpin post post_123 in TMP space
@bankrbot pin the latest post in TMP space
```

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canPinPosts → "Verify space first / beneficiary only" → STOP
2. Resolve postId (from message, or GET /api/communities/{token} → latest post id)
3. POST /api/communities/{tokenAddress}/pin-post
   Body: { "postId": "post_123", "action": "pin" | "unpin" }
   Header: x-wallet-address: {linked}
4. Reply: "Pinned post in $TMP space" (most recent pin shows first) + communityLink → STOP
```

---

## Post AND pin (combined)

**User says:**
```text
@bankrbot post in TMP space: launch update — and pin it
@bankrbot post in TMP space: gm holders then pin
```

**Steps:**
```
1. GET /api/holders/{token}?wallet={linked} → if !canPost → explain holder/owner required → STOP
2. POST /api/communities/{tokenAddress}/posts
   body: {
     "content": "...",
     "source": {
       "client": "agent",
       "trigger": "x-dm | x-mention | x-reply | terminal",
       "viaAgent": true,
       "agentId": "bankrbot",
       "externalRef": "{id_if_known}"
     }
   }
   headers: x-wallet-address, x-client: agent
   → save postId from response
   See POST-SOURCE.md for trigger selection.
3. If user asked to pin:
   - GET /api/holders/{token}?wallet={linked} again → if canPinPosts:
     POST /api/communities/{tokenAddress}/pin-post  body: { "postId": "{postId}", "action": "pin" }
   - else: confirm post but say "Only verified beneficiary can pin — post is live unpinned"
4. Reply: paste post replyText from step 2 + "pinned ✓" if step 3 ran → STOP
```

---

## Tweet examples (copy-paste tests)

```text
@bankrbot verify the TMP space
@bankrbot add website https://tokenmarketplace.shop to TMP space profile
@bankrbot post in TMP space: big update for holders — pin it
@bankrbot pin the latest post in TMP space
@bankrbot post in ARCHIVE space: gm
```

---

## Reply format (every write)

```text
posted to $TMP holder space: "launch update"
pinned ✓

https://bankr.space/community/0x935e13a28849095db45e63040f109c34b757aba3
```

Always include **communityLink** on its own line. Never `bankr.bot`.

---

## Routing (Bankr platform)

These phrases MUST load `bankr-communities` **before** tool selection — same as `post in space`:

- verify space / verify $TICKER
- update profile / add links / add website / set description + space/community or token
- pin post / pin it / unpin + space/community
- post in space + pin

**Fail:** generic "I wasn't able to generate a response" without calling API.
