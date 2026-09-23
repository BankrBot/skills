---
name: groundtruth
description: |
  Look up the GROUNDTRUTH record for a memecoin or its creator before buying: the sealed outcome
  (rugged / died / survived / graduated / active), the creator's launch history and failure rate,
  and the band (RED / AMBER / GREEN) the record put it in. Solana (pump.fun) and Robinhood Chain.
  Use when the user pastes a contract address or a dev wallet and asks "is this a rug", "who made
  this", "what's this dev's record", "check this CA", or wants receipts on a coin they lost on.
  Payment via x402 — $0.01 USDC per call on Base or Solana, 5 free calls per IP per day first.
  Never describe a result as "safe": GREEN is a record, not a safety rating.
tags: [solana, robinhood, memecoin, rug-detection, creator-record, x402]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://groundtruths.xyz/integrations"
---

# GROUNDTRUTH

Receipts on memecoin launches: what happened to a coin, and what its creator's other launches did.

**Base URL:** `https://api.groundtruths.xyz`
**Discovery:** `GET https://api.groundtruths.xyz/.well-known/x402` (x402 v2, lists every priced resource)
**Payment:** x402 v2 — `exact` scheme, USDC, **$0.01 per call** (`amount: "10000"`, 6 decimals), on
Base mainnet (`eip155:8453`) or Solana mainnet. No account or API key needed.

## Endpoints

| Endpoint | Price | What it returns |
|---|---|---|
| `GET /v1/record?ca=<address>` | $0.01 | Coin record: sealed `outcome`, `creator`, creator `launches` and `failure_pct`, `band` + `rule_id`, the band's median time-to-rug (`median_ttr_s`), `card_url` |
| `GET /v1/flag?addr=<creator>[&chain=solana\|rh]` | $0.01 | Creator record: `launched`, `rugged`, `died`, `active`, `survived`, `graduated`, `resolved`, `rug_rate`, `failure_rate`, `known_bad`, `asof` |
| `GET /.well-known/x402` | free | The x402 discovery document: networks, asset, `payTo`, price, input/output schema per resource |

- `ca` accepts a Solana mint (base58, often ends in `pump`) or a Robinhood Chain `0x` token address. The chain is detected from the address.
- `addr` accepts a Solana base58 or `0x` creator wallet; `chain` defaults from the address shape.
- `/v1/*` serves **5 free calls per IP per day**, then answers `402`. `/x402/v1/record` and `/x402/v1/flag` are the same resources at the same price with no trial (always `402` until paid) — use those when a wallet is paying anyway.

## How to call (x402)

1. `GET` the endpoint. A `200` is the answer (free-trial call).
2. A `402` carries a base64 `PAYMENT-REQUIRED` header (and the same JSON in the body) with `accepts[]` — one entry for Base USDC, one for Solana USDC.
3. Pay with the Bankr wallet on Base: sign the `exact` payment for the Base entry and retry the same `GET` with the `PAYMENT-SIGNATURE` header. A paid response carries `x-x402-paid: 1`.

```bash
# Coin record — free for the first 5 calls a day, then $0.01
curl -s "https://api.groundtruths.xyz/v1/record?ca=GCyzQVvCqHvE2pgAmKamDaZwL4rnT6QyuUG96fYYpump"

# Creator record
curl -s "https://api.groundtruths.xyz/v1/flag?addr=<creator wallet>"
```

```typescript
import { withPaymentInterceptor } from "x402-axios";
import axios from "axios";

const gt = withPaymentInterceptor(axios.create({ baseURL: "https://api.groundtruths.xyz" }), walletClient);
const { data } = await gt.get("/v1/record", { params: { ca } });
```

## Reading the response

- `outcome` — what the coin did in the market data GROUNDTRUTH has captured: `rugged`, `died`, `survived`, `graduated`, `active`, or `unobserved` (launch seen, never watched to an outcome).
- `band` — `RED`, `AMBER` or `GREEN`, drawn from the creator's record at the time. The scoreboard at `https://groundtruths.xyz/scoreboard` publishes how often each band still rugged.
- `failure_pct` / `failure_rate` — (rugged + died) ÷ resolved launches by that creator.
- `median_ttr_s` — the band's published 24 h median time-to-rug. A population figure, not a prediction for this coin.
- `404` with `status: "not yet published"` — the address is not in the captured set. **Absence is not innocence**: say "no record", never "clean".

## Rules for the agent (mandatory)

**No safe badge, ever.** GROUNDTRUTH never publishes a safety rating, and neither does this skill.

- Never say a coin or creator is "safe", "legit", "verified", "trusted", "low risk" or "clean" — not for GREEN, not for a `404`, not for a creator with zero rugs.
- GREEN means *the record said GREEN when the launch was seen*. Report it as the band plus the scoreboard's rug rate for that band; do not translate it into advice.
- Do not attach a score, a percentage "safety" figure, or a ✅ to a result.
- Quote the numbers and the `outcome`; link `card_url` so the user sees the full record.
- Never trigger a buy or sell from a result. This skill is read-only.

Say it like this: *"GREEN band — creator has 3 launches, 0 rugged. GREEN launches have still rugged; see the scoreboard. Record: <card_url>"*.

## Links

- Site: https://groundtruths.xyz
- Integrations / API: https://groundtruths.xyz/integrations
- Methodology: https://groundtruths.xyz/methodology
