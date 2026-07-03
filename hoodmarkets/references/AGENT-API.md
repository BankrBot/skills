# Agent API reference

**API base:** `https://api.hood.markets`  
**Web:** `https://hood.markets`  
**Chain:** Robinhood (`chainId` **4663**)

Wallet on all agent routes: `x-wallet-address: 0x…` and/or `?wallet=0x…` and/or JSON `"wallet"`.

---

## Contracts (simple / V3 — default launch)

| Role | Address |
|------|---------|
| HoodMarketsV3 factory | `0xcFE4D69Ac8e5F79a95d99e991162902f68029f09` |
| HoodMarketsV3 LP locker | `0x209eFAA86568f0Ea0E25d1F0E62f92e81c51a72a` |
| Platform 5% fees | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

Full pin list: `../known-contracts.json` (repo root: `skills/hoodmarkets/known-contracts.json`).

---

## GET /health

```http
GET https://api.hood.markets/health
```

---

## GET /api/agent/briefing

Deployments where this wallet is the **fee recipient**.

```http
GET https://api.hood.markets/api/agent/briefing?wallet=0x…
```

**Response:** `deploymentCount`, `deployments[]` (`launchType`: `simple`|`pro`), `links`, `feeSplitSimple`.

---

## GET /api/agent/preflight-deploy

Check deploy blockers **before** captcha (ticker/name taken, wallet cooldown, launch mode).

```http
GET https://api.hood.markets/api/agent/preflight-deploy?wallet=0x…&name=My+Token&symbol=MTK&launchMode=simple
```

**200** when `canDeploy: true`. **409** when blocked.

**Response fields:** `blocks[]`, `warnings[]`, `blockMessage`, `replyHint` on each issue, `cooldownHours`.

| `blocks[].code` | User-facing meaning |
|-----------------|---------------------|
| `ticker_cooldown` | Symbol already launched globally — wait or pick another |
| `name_cooldown` | Name already used recently |
| `ticker_reserved` / `name_reserved` | Blocklist |
| `fee_recipient_cooldown` | Wallet already had a launch in the cooldown window (legacy mode only — **not** hood.markets web-only) |
| `duplicate_deployer_name_symbol` | Same wallet already launched this exact name+ticker |
| `launch_mode_unavailable` | V3 or V4 not configured on API |

| `warnings[].code` | Meaning |
|-------------------|---------|
| `rate_limit_would_force_platform_fee` | Deploy allowed — fees on this token go to hood.markets platform (same as website) |
| `rate_limit_would_force_burn` | Legacy non-web-only mode only — fees → burn |
| `third_party_rolling_warning` | Recent launch on this wallet — fees may burn |

| `blocks[].code` | User-facing meaning |
|-----------------|---------------------|
| `agent_x_daily_limit` | **1 X launch/day used** — `replyHint` + `xDailyLimit.todayToken` + `resetsAtEastern`; send user to hood.markets for more |

`POST` with JSON `{ wallet, name, symbol, launchMode }` also supported.

---

## GET /api/agent/token-info

Resolve catalog token + **Simple vs Pro** routing for buy/sell.

```http
GET https://api.hood.markets/api/agent/token-info?token=0x…
GET https://api.hood.markets/api/agent/token-info?symbol=MTK
```

**Response:** `launchType` (`simple`|`pro`), `swapMode` (`uniswap`|`hoodmarkets-helper`), `oneClickSwapOnHoodmarkets`, `uniswapSwapUrl`, `tokenPageUrl`.

- **simple** → do not call prepare-buy/sell; share Uniswap link
- **pro** → use prepare-buy / prepare-sell + Bankr submit

See `streaming-hints.json` for detection rules.

---

## POST /api/agent/resolve-deploy-image

Resolve token logo before deploy. **On X, pass `tweetId` and/or `tweetImageUrl` from `extended_entities.media[0].media_url_https`.**

```http
POST https://api.hood.markets/api/agent/resolve-deploy-image
Content-Type: application/json

{
  "tweetId": "1990000000000000000",
  "tweetUrl": "https://x.com/Rayblancoeth/status/…",
  "tweetImageUrl": "https://pbs.twimg.com/media/….jpg",
  "tweet": { "extended_entities": { "media": [{ "type": "photo", "media_url_https": "https://pbs.twimg.com/…" }] } }
}
```

**200:** `{ "ok": true, "imageUrl": "https://pbs.twimg.com/…", "imageSource": "tweet_syndication" }`  
Resolves: `tweetImageUrl` → `tweet` object → **syndication API** (`tweetId`/`tweetUrl`) → oEmbed fallback.

**400:** only after all methods fail — use `replyHint`.

---

## POST /api/agent/prepare-deploy

Returns deploy checklist (server deploy — **no** Bankr submit). Runs **preflight** automatically.

**X / Twitter:** pass `"agentChannel": "x"`, **`tweetUrl`** (status URL of launch tweet), and **`xUsername`** (requester's @handle without `@`). API resolves logo via oEmbed → `user_confirm` with `confirmSummary`, then deploy. Token page shows requester + how many tokens they launched on hood.markets.

**Image (required):** pass `tweetUrl` on X (preferred), or `tweetImageUrl`, `imageUrl`, `tweetMedia`, `tweet`, or `tweetText` with inline URL. **400** if missing — use `replyHint`.

```http
POST https://api.hood.markets/api/agent/prepare-deploy
Content-Type: application/json

{
  "wallet": "0x…",
  "name": "My Token",
  "symbol": "MTK",
  "launchMode": "simple",
  "agentChannel": "x",
  "xUsername": "Rayblancoeth",
  "tweetUrl": "https://x.com/Rayblancoeth/status/…",
  "tweetText": "launch My Token $MTK on hoodmarkets"
}
```

**409** when preflight blocks — use `blocks[0].replyHint` and `blocks[0].existingToken` (token address when ticker/name taken).

**200 response fields:** `steps[]`, `captchaRequired`, `confirmSummary`, `confirmReplyHint` (no launch mode line), `imageUrl`, `imageSource`. The deploy step **`body`** includes **`xUsername`**, **`tweetUrl`**, and **`sourceUrl`** when available — required for token page requester + tweet embed.

**Deploy success:** `POST /api/deploy` returns `deployReplyHint` — post verbatim on X (no DexScreener/simple-mode footer). Token page shows **who requested** the launch and their **hood.markets launch count**, plus the original tweet when `sourceUrl` is stored.

### Deploy — X channel (after user confirms)

Use **`steps[deploy].body`** from prepare-deploy (includes `xUsername`, `tweetUrl` when available). Do not strip `xUsername`, `tweetUrl`, or `sourceUrl`.

```http
POST https://api.hood.markets/api/deploy
x-wallet-address: 0x…
x-agent-channel: x
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "agentChannel": "x",
  "launchMode": "simple",
  "imageUrl": "https://…",
  "tweetUrl": "https://x.com/user/status/…",
  "sourceUrl": "https://x.com/user/status/…"
}
```

### Deploy — non-X (after haiku captcha)

```http
POST https://api.hood.markets/api/deploy
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "name": "My Token",
  "symbol": "MTK",
  "feeTarget": "agent_wallet",
  "clientKind": "agent",
  "agentProvider": "bankr",
  "launchMode": "simple",
  "imageUrl": "https://…"
}
```

**Response:** `tokenAddress`, `transactionHash`, `links` (dexscreener, hood.markets, explorer).

---

## POST /api/agent/prepare-buy

Pro (V4) tokens only. Returns `transactions[]` for Bankr submit.

```http
POST https://api.hood.markets/api/agent/prepare-buy
Content-Type: application/json

{
  "wallet": "0x…",
  "tokenAddress": "0x…",
  "amountEth": "0.01"
}
```

**Response:** `transactions[]`, `chainId: 4663`, `tokenPageUrl`, `uniswapSwapUrl`.

---

## POST /api/agent/prepare-sell

```http
POST https://api.hood.markets/api/agent/prepare-sell
Content-Type: application/json

{
  "wallet": "0x…",
  "tokenAddress": "0x…",
  "amount": "1000000"
}
```

May include `approve` step then `sell`. Amount in token units (`1M`, `1000000`).

---

## POST /api/agent/claim-for-recipient

**Third-party / helper claim** — anyone (including Bankr on X) can trigger. Funds go to the **catalog fee recipient**, not the caller.

```http
POST https://api.hood.markets/api/agent/claim-for-recipient
Content-Type: application/json

{ "tokenAddress": "0x78594eD700e343846B4d0Bbba79Ee0cb50Deaa8D" }
```

No JWT. **Do not call Bankr `/wallet/submit`** — hood.markets broadcasts the claim.

Response: `ok`, `replyHint` (**post verbatim**), `claimReplyHint` (same text), `completed`, `bankrWalletSubmitRequired: false`, `transactionHash`, `txHash`, `feeRecipientAddress`, `tokenName`, `tokenSymbol`, `feeModel`, `launchType`, `tokenPageUrl`, optional `feeAmountEth`.

**If `ok: true`, claim succeeded** — post `replyHint`. Do not use Bankr `/wallet/submit`. Do not say Bankr failed to submit.

---

## POST /api/agent/claim

Server broadcasts claim (gas paid by hood.markets). Requires haiku JWT.

**V3 vs V4 (automatic):**

- **Simple (V3)** — `poolId` prefix `v3:` or V3 factory `0xcFE4…9f09` → calls `HoodMarketsV3.claimRewards(tokenAddress)`. One step; WETH to fee wallet.
- **Pro (V4)** → collects LP fees into locker, then claims WETH from fee locker.

```http
POST https://api.hood.markets/api/agent/claim
X-Agent-Captcha-JWT: <jwt>
Content-Type: application/json

{
  "tokenAddress": "0x…",
  "tokenSymbol": "MTK"
}
```

Success includes `replyHint`, `claimReplyHint`, `completed`, `bankrWalletSubmitRequired: false`, `transactionHash`, `feeModel`, `launchType`.

**No Bankr `/wallet/submit`.** Post `replyHint` when `ok: true`.

---

## Captcha (deploy + claim)

```http
GET  https://api.hood.markets/api/agent-captcha/challenge
POST https://api.hood.markets/api/agent-captcha/verify
```

Haiku: exactly 3 lines, must mention topic word. JWT valid **8 hours**.

---

## GET /api/deployments

Public catalog.

```http
GET https://api.hood.markets/api/deployments?limit=50
GET https://api.hood.markets/api/deployments/0x…
```

---

## Bankr wallet submit

After `prepare-buy` / `prepare-sell`, for each validated tx:

```http
POST https://api.bankr.bot/wallet/submit
```

`chainId` must be **4663**. See `references/BANKR-SUBMIT.md` and `references/TX-VALIDATION.md`.
