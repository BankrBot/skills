---
name: trollbridge
description: Pre-trade safety lanes for Base tokens via the TrollBridge x402 API — five pay-per-call screens (contract-check, honeypot, rug-score, approval-screen, tx-dryrun) that return machine-readable risk scores and flags so an agent can decide whether a token or transaction is safe to touch before it trades. Screens are heuristic checks, not audits; no price prediction and no trade execution.
license: Apache-2.0
metadata:
  author: "Bankr agent (@eric-tijerina)"
  category: "intel"
  audience: "agent"
  x402: true
  pricing: "pay-per-call"
  version: "1.0.0"
---

# trollbridge — pre-trade safety lanes for Base tokens

## What it does

TrollBridge is an x402 pay-per-call intel gateway with 64 lanes — no subscription, USDC on Base or Solana. This skill covers its five pre-trade safety lanes. Before an agent trades a Base token, it calls one or more lanes to get machine-readable safety signals.

Every lane is a read-only screen: it flags known-danger patterns in a token contract, a pending approval, or a pending transaction. Screens are heuristic checks, not audits — they cannot predict price and cannot guarantee safety. Nothing here executes a trade.

## Setup (x402 payment flow)

1. Agent calls a lane with normal HTTPS: `POST https://mini-tollbooth.onrender.com/<lane>`.
2. The service responds `HTTP 402` with payment instructions (asset, network, amount).
3. The agent pays the quoted USDC amount on Base or Solana via its x402 stack.
4. The agent retries with the payment header and receives the screening result.

## Lanes

| Lane | Price per call | Purpose |
| ---- | -------------- | ------- |
| `/contract-check` | $0.10 | Heuristic contract safety screen; returns a 0–100 risk score plus flags. Labeled NOT an audit. |
| `/honeypot` | $0.02 | Screens whether a token can be bought and sold freely or traps sellers |
| `/rug-score` | $0.02 | Scores common rug-pull risk factors (liquidity, ownership, mint controls) |
| `/approval-screen` | $0.10 | Screens a pending token approval for unlimited allowances and risky spenders |
| `/tx-dryrun` | $0.02 | Simulates a transaction before submission to catch reverts and unexpected effects |

## Usage

Chain lanes as needed: run `/contract-check`, `/honeypot`, and `/rug-score` before a first buy; run `/approval-screen` before signing an approval; run `/tx-dryrun` before submitting a transaction.

## Example

```bash
curl -X POST https://mini-tollbooth.onrender.com/honeypot \
  -H "Content-Type: application/json" \
  -d '{"chain":"base","token_address":"0x..."}'
# → 402 Payment Required with USDC payment instructions
```

## Response contract

Each lane returns machine-readable JSON describing the screen result. `/contract-check` returns a 0–100 `risk_score` (higher = riskier) and a `flags` array naming the patterns found. The other lanes return comparable JSON verdicts for their own checks. Fields may expand over time — parse defensively and treat unknown fields as informational.

## Error behavior

- `400` — malformed request or unsupported chain.
- `402` — payment required; pay the quoted USDC amount and retry.
- `404` — unknown lane.
- `422` — the address was understood but could not be screened (e.g., no contract at that address).
- `5xx` — upstream screening failure; safe to retry later. Never treat an error as "safe".

## Decision policy

High risk scores or red flags mean the agent should not buy, approve, or submit. A clean screen reduces risk but never proves a token is safe. These are heuristic screens — not audits, not price predictions, and not guarantees.

## Billing

Per-call USDC on Base or Solana via x402. No subscription, no API key — the paying wallet is the account.

## References

- `references/safety-lanes.md` — lane-by-lane notes on inputs, outputs, and flags.
