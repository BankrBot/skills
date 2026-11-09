# Market Data, Errors & Limits Reference

## Mark Price

```
GET https://og.nexustradinglabs.com/mark-price?symbol=BTC
```

Returns `{ symbol, markPrice, indexPrice, lastPrice, openInterest, volume24h }`.

Use before placing a trade when the user asks "what's BTC at?" or to size a position. Accepts shorthand (BTC, ETH, SOL) or full form (PERP_BTC_USDC).

---

## Funding Rate

```
GET https://og.nexustradinglabs.com/funding-rate?symbol=BTC
```

Returns `{ symbol, fundingRate, fundingRatePct, nextFundingTime, estFundingRate }`.

High positive funding → longs pay shorts → bearish signal. High negative → shorts pay longs → bullish signal. Check this before sizing a leveraged position.

---

## 24h Market Stats

```
GET https://og.nexustradinglabs.com/24h-stats?symbol=BTC
```

Returns `{ symbol, markPrice, indexPrice, lastPrice, change24h, high24h, low24h, volume24h, openInterest, fundingRate, nextFundingTime }`.

All price + market data for a symbol in one call.

---

## Error Reference

| HTTP | Meaning |
|---|---|
| 400 | Bad request — missing params, validation failed, or Orderly error |
| 401 | Auth failure — missing or expired session, a missing challenge, or invalid Bankr API key |
| 403 | Forbidden — Bankr key has `allowedRecipients` set |
| 404 | Not found — symbol, order, or resource doesn't exist |
| 500 | Worker internal error — do not retry |
| 502 | Upstream failure — Orderly or Bankr returned an error |

| `error` field | Cause | Fix |
|---|---|---|
| `session_required` | Session missing, expired (24h) or ended | `GET /v2/session/new`, sign `message`, retry |
| `key_required` | No trading key for this wallet | `POST /v2/key/bankr-register`, retry |
| `key_expired` | The 30-day trading key lapsed | `POST /v2/key/bankr-register` (rotates), retry |
| `challenge_required` | Going live without the challenge | `GET /auth/challenge?wallet=&action=`, sign, resend with `nonce` + `v2Sig` |
| `challenge_unknown_or_expired` | Challenge used already or older than 120 s | Fetch a fresh one |
| `pick_one_auth` | Both `session` and `walletSig` sent | Send the session only |
| `insufficient_free_collateral` | Nothing free to withdraw | Read the `hint` (position / unsettled loss / orders) |
| `settle_failed` | Orderly refused the settle | Nothing moved; retry once |
| `wallet_not_registered` | No Orderly account (older routes) | Run Key Registration (`/v2/key/bankr-register`) |
| `insufficient_margin` | Not enough free collateral | Reduce size, add leverage, or deposit |
| `below_min_notional` | Order below Orderly minimum (~$10) | Increase notional |
| `no_open_position` | https://og.nexustradinglabs.com/set-sl-tp with no position | Open position first |
| `deposit_requires_wallet_execution` | allowedRecipients blocking tx | Use a dedicated temporary key (no allowedRecipients), revoke after — don't clear it on the main key |
| Orderly code 78 | Unsettled negative PnL blocking withdrawal | Server auto-handles; manual: settle-pnl then re-check free_collateral |
| Orderly code 29 | EIP-712 signature invalid | Internal error — contact Nexus |

### Retry strategy

- **401 session_required** → new session, then retry once
- **409 key_required / key_expired** → Key Registration, then retry
- **400 insufficient_margin** → check /balance, reduce size or prompt deposit
- **400 below_min_notional** → minimum ~$10 notional, increase size
- **502** → retry once after 2s; if persistent, Orderly may be degraded
- **500** → do not retry; surface error to user

---

## Rate Limits

| Layer | Limit |
|---|---|
| Nexus Worker | No hard cap (Cloudflare — 100k req/day free, unlimited paid) |
| Orderly private API | ~10 req/s per account; sustained bursts return 429 |
| Orderly public API | ~20 req/s |
| Bankr /wallet/sign | Avoid calling more than once per trade |

**Best practice:** One session signature per 24 hours. Reuse the `session` for all endpoints — don't re-sign before each call. Only going live takes an extra (single-use) challenge signature.

---

## Testnet

- Orderly testnet API: `https://testnet-api-evm.orderly.org`
- Chain: Arbitrum Sepolia (chainId 421614)
- Faucet: request testnet USDC in Orderly Discord (#testnet-faucet)
- Nexus Worker targets mainnet only — for testnet, point directly to Orderly testnet API
- ThesisRegistry testnet: `0x6eE20a021F83c7ddD9FA3d15ed6798fCF6A6f468` (Arbitrum Sepolia)
