---
name: endpoint-record
description: |
  Pre-trade safety decision for a token on Base via the Endpoint Record API.
  Use BEFORE buying, swapping into, or recommending any Base token, especially fresh
  or unlisted ones. Returns one machine-actionable action (ALLOW / RECHECK / BLOCK)
  with fixed reason codes, backed by contract checks, two independent honeypot sources,
  its own sell simulation of a real holder, and an on-chain liquidity history that
  catches pools the creator already drained.
  Triggers: "is this token safe", "check 0x... before I buy", "rug check", "honeypot check",
  "can I sell this token", any buy or swap of a token that is not a well-known asset.
  Payments via x402: 0.02 USDC on Base per call, no API key or account needed.
---

# Endpoint Record

One call, one decision: should an agent trade this Base token right now?

**Endpoint:** `POST https://api.endpointrecord.com/scan`
**Schema:** `https://api.endpointrecord.com/openapi.json`
**Free example responses:** `https://api.endpointrecord.com/examples.json`
**Payment:** x402 v2, 0.02 USDC on Base mainnet per call, no account, no API key.

## What it checks

More than a honeypot flag. Every response says what was checked and what was not.

| Check | What it means for the agent |
|---|---|
| **Action** `ALLOW` / `RECHECK` / `BLOCK` | One decision to act on, plus fixed reason codes for your own policy. |
| **Liquidity history on chain** | Reads the pool's deposits and withdrawals for Uniswap v2/v4 pools younger than 26 h. If the token creator already withdrew at least half of the liquidity within 24 h, the action is `BLOCK` (`LIQUIDITY_REMOVED`), even when aggregator data still shows the old liquidity. Measured in liquidity units, so a price drop is not mistaken for a withdrawal. |
| **Own sell simulation** | Simulates a sale by a real holder, also on Uniswap v4 pools. A blocked or heavily taxed sale gives `BLOCK`. |
| **Two honeypot sources with consensus** | A contract-code check and a buy/sell simulation are compared. Agreement confirms a trap; disagreement is reported as `HONEYPOT_SOURCES_DISAGREE` instead of being hidden. |
| **Uniswap v4 hooks** | A main pool with a hook is flagged `V4_HOOK_UNCHECKED` (hooks can restrict selling). |
| **Fresh tokens** | Unlisted tokens younger than 24 h get `RECHECK` (`NEW_TOKEN`): most drains happen in the first hours. |
| **Admin rights** | Mint, blacklist, pause, upgradeability, owner balance control, taxes. Rights alone are `CAUTION`, not `SCAM`. Canonical Base bridge tokens are recognised. |
| **Coverage** | `coverage` lists exactly which checks ran. A verdict only covers what is marked there. |

## How to call

Request body:

```json
{ "requestKey": "<random secret, 16-128 chars>", "tokenAddress": "0x..." }
```

- `requestKey`: choose a random secret per question. Repeating the same `requestKey` and
  `tokenAddress` within 24 h never charges twice (safe retries).
- `frisch` (optional, `true`): force a fresh scan instead of a recent cached result.

Without payment the endpoint answers `402` with an x402 v2 challenge in the
`PAYMENT-REQUIRED` header (exact scheme, EIP-3009, USDC on Base). An x402 client signs
it and repeats the request with `PAYMENT-SIGNATURE`; the receipt comes back in
`PAYMENT-RESPONSE`. Typical latency is 5 to 9 seconds.

With Bankr:

```bash
bankr prompt "Use the endpoint-record skill to check 0x<token> on Base before buying. Only buy if action is ALLOW."
```

## Acting on the answer

| `action` | Recommended agent behaviour |
|---|---|
| `BLOCK` | Do not buy. Read `reasons` for why (e.g. `LIQUIDITY_REMOVED`, `HONEYPOT_CONFIRMED`, `SELL_SIMULATION_FAILED`, `NOT_TRADABLE`). |
| `RECHECK` | Do not buy now. Data is unclear or the token is too new. Ask again later (`NEW_TOKEN` clears after 24 h). |
| `ALLOW` | No blocking finding. Apply your own limits; `CAUTION` reasons (e.g. `MINTABLE`, `LOW_LIQUIDITY`) are still listed. |

Always check `dataAgeSeconds` and `checkedAt` before acting: the answer describes the
chain at `block`, not the future. Verdicts are automated risk signals, not investment advice.

## Key fields

- `verdict`: `SAFE` / `CAUTION` / `SCAM`. `SCAM` only with evidence of a trap.
- `action`: `ALLOW` / `RECHECK` / `BLOCK`. Act on this.
- `reasons[]`: `{ code, level }`, level `scam` / `caution` / `note`. Codes are stable within a `ruleVersion`.
- `riskAreas`: the same reasons grouped into `tradability`, `adminControl`, `fraudSignals`, `dataQuality`.
- `contract.liquidityHistory`: `result` (`removed` / `held` / `unclear` / `not_applicable`), `remainingShareOfPeak`, `creatorNetWithdrawnShareOfPeak`, `minutesUntilHalfRemoved`.
- `contract.sellSimulation`: `result` (`ok` / `blocked` / `high_loss` / `not_tested`), `loss`.
- `coverage`: which checks ran (`contractCode`, `tradeSimulation`, `liquidity`, `poolHook`, `ownSellSimulation`, `liquidityHistory`).
- `checkedAt`, `dataAgeSeconds`, `block`, `ruleVersion`.

All reason codes: [references/reason-codes.md](references/reason-codes.md)

## Limits

Base only. The liquidity history covers Uniswap v2 and v4 pools younger than 26 hours;
withdrawals below 50 % or after 24 h, and losses from selling pressure, are outside that
rule. A check describes the moment it ran; a pool can still be drained afterwards.
