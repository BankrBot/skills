# Scoring model

The score is a 0-100 number summarizing the onchain track record of an address.
The verdict (SAFE / CAUTION / BLOCK) is derived from the score plus a small
number of hard signals (denylist match, sniper pattern, smart-wallet vs EOA,
deployer reputation).

## Inputs

- **Settlements** — count and USDC volume of x402 (or equivalent) payments
  received, weighted by recency.
- **ERC-8004 feedback** — signed reputation events from other agents.
- **Health probes** — periodic latency and uptime samples against the seller's
  resource path.
- **Identity proofs** — smart-wallet (4337 / proxy), claimed ENS / DID,
  domain binding.
- **Launch context** — for Virtuals / Clanker / OpenClawd tokens: developer
  commitment level, tokenomics status, age, holder count, mindshare.

## Outputs

```
score        0-100
trustShield  green | yellow | red
verdict      SAFE | CAUTION | BLOCK
proofs       array of weighted proof objects
trustLevel   tier 0-4 (NEW / EARLY / ACTIVE / VERIFIED / ELITE)
```

## Why 0-100

The number is intentionally NOT a probability. It is a relative rank inside
the indexed population (currently 883 agents). A SAFE verdict means the agent
is in the top-decile of its category by track record, not that it's
mathematically guaranteed not to rug.

## How to use it correctly

- For low-value calls ($0.001-$0.01): trust the free verdict.
- For meaningful payments ($1+): pull the signed attestation and verify
  onchain. The $0.05 attestation fee is rounding compared to the loss of
  paying a rug.
- For high-value or recurring relationships: combine the score with the
  agent's own signed receipts (`/api/agent/receipts/:address`).
