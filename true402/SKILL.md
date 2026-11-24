---
name: true402
description: >
  Rug-check a token before buying it. true402 runs an executed buy/sell honeypot simulation plus
  liquidity, ownership and mint/pause controls on Base, Ethereum and BSC (a lighter check on Solana),
  and returns OK / CAUTION / AVOID with reasons. Pay per call in USDC on Base via x402 — no account,
  no API key. Use before any buy of an unfamiliar token.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🧪",
        "homepage": "https://true402.dev",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# true402 — rug check before you buy

**Base URL:** `https://true402.dev/api`
**Pay with:** `bankr x402 call` (x402 v2, USDC on Base). A request is only charged when it returns 2xx.

## When to use

Before buying any token the user has not traded before — especially a new launch, a contract
address pasted from a post, or anything whose name matches a better-known token. Run the check,
read the verdict, and tell the user what it found **before** the swap.

- **AVOID** — do not buy. Say why (the reasons list it: sell reverted, prohibitive round-trip tax,
  no real liquidity, a dangerous owner control).
- **CAUTION** — tell the user the reasons and let them decide.
- **OK** — no blocking finding in what was checked. It is not a guarantee: an owner can still
  change a contract or pull liquidity later.

## Endpoints

All are `POST` with a JSON body.

| Endpoint | Price | Body | Returns |
|---|---|---|---|
| `/v1/base/token-report` (also `/v1/ethereum/…`, `/v1/bsc/…`) | $0.008 | `{"token":"0x…"}` | Verdict + reasons, executed buy/sell simulation (`safety.honeypot`: sellable, round-trip cost in bps), liquidity by pool, ownership/mint/restriction controls, DexScreener price and liquidity |
| `/v1/base/dossier` | $0.10 | `{"token":"0x…"}` | Everything above plus the deployer's history and every liquidity removal observed on the token, with plain-language reasons and what could not be established |
| `/v1/base/liquidity-history` | $0.005 | `{"token":"0x…"}` | Liquidity removals already observed for the token, and other tokens drained in the same transaction |
| `/v1/base/deployer-check` | $0.008 | `{"token":"0x…"}` | Who deployed the token and how established that wallet is: age, balance, and whether it is a fresh throwaway made for the launch |
| `/v1/base/tx-preflight` | $0.008 | `{"from":"0x…","to":"0x…","data":"0x…"}` | Simulates an unsigned transaction, decodes unlimited approvals, checks the counterparty. Takes no key or signature |
| `/v1/solana/token-safety` | $0.005 | `{"token":"<mint>"}` | Mint and freeze authority (freeze = the Solana honeypot), Token-2022 traps such as a permanent delegate, liquidity (no buy/sell simulation on Solana) |

## Examples

```bash
# Check a Base token before buying (cap the payment at 1 cent)
bankr x402 call https://true402.dev/api/v1/base/token-report -X POST \
  -d '{"token":"0x940181a94A35A4569E4529A3CDfB74e38FD98631"}' --max-payment 0.01

# Same check on Ethereum
bankr x402 call https://true402.dev/api/v1/ethereum/token-report -X POST \
  -d '{"token":"0x…"}' --max-payment 0.01

# Deep due diligence on a Base token before a larger position
bankr x402 call https://true402.dev/api/v1/base/dossier -X POST \
  -d '{"token":"0x…"}' --max-payment 0.10
```

Then buy only if the verdict allows it, e.g. `bankr agent 'Buy $20 of 0x… on Base'`.

## Notes

- Read `verdict.rating` (`ok` / `caution` / `avoid`) and `verdict.reasons` first; the rest is evidence.
- A simulation reads the token as it is right now. It cannot see off-chain intent, and a token that
  passes can still be rugged later by whoever controls it — say so when it matters.
- Full schema of every endpoint: `https://true402.dev/api/openapi.json`. Free manual check for humans:
  https://true402.dev/check
