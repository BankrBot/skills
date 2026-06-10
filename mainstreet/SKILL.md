---
name: mainstreet
description: MainStreet — EIP-712 reputation oracle for AI agents on Base. Use when an agent wants to look up a wallet's reputation score (0-100), fetch a cryptographically-signed attestation, verify an attestation on-chain via the deployed verifier contract, get a risk-only audit verdict (AVOID/CAUTION/OK), check whether a Virtuals agent token has a backing reputation, find which wallets fund another wallet (sybil detection), or query the canonical identity (Basename + ERC-8004 + agent.json) of any Base address. 847 Base agents indexed, 4,811 Virtuals agents in proof index, 153k x402 settlements tracked. Also use when asked about MainStreet, EIP-712 attestation, MainStreetVerifier, or onchain agent reputation.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🪪",
        "homepage": "https://avisradar.app/oracle.html",
      },
  }
---

# MainStreet

EIP-712 reputation oracle for AI agents on Base. Free attestation fetch, free off-chain verify, on-chain verifiable via the deployed `MainStreetVerifier` contract.

**Verifier contract:** `0x7397adb9713934c36d22aa54b4dbbcd70263592b` (Base mainnet)
**Operator (signer):** `0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9`
**EAS Schema:** `0xe572079c100f08f537660248df84c632a7c4e5ad3b1d644dc36abb7d993cfe6f`
**API:** `https://avisradar-production.up.railway.app/api/agent`
**Catalog:** `https://avisradar-production.up.railway.app/api/agent/catalog`
**Basename:** `mainstreetxyz.base.eth` · **ERC-8004 agentId:** `53953`

## Quick Start

1. No API key required for public endpoints
2. Use the shell scripts in `scripts/` for all operations
3. Paid endpoints (audit, risk-report, audit-batch, sponsor) settle via x402 USDC on Base
4. Verify any attestation on-chain via the deployed verifier contract

```bash
# Free score lookup
./scripts/mainstreet-score.sh 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9

# Fetch EIP-712 signed attestation (free)
./scripts/mainstreet-attestation.sh 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9

# Verify an attestation (zero-crypto, server-side)
./scripts/mainstreet-verify.sh

# Premium audit ($0.25 USDC via x402)
curl https://avisradar-production.up.railway.app/api/agent/audit/0xYourAgent

# Risk-only verdict ($0.50 USDC via x402)
curl https://avisradar-production.up.railway.app/api/agent/risk-report/0xYourAgent

# Bulk audit up to 10 addresses ($1 USDC via x402)
./scripts/mainstreet-audit-batch.sh

# Canonical identity (free)
./scripts/mainstreet-canonical.sh 0xYourAgent
```

## Free endpoints (no payment)

- `GET /score/{address}` — cached 0-100 score + metrics + trust tier
- `GET /attestation/{address}` — EIP-712 signed payload + signature
- `GET /auto-attest-status/{address}` — poll for autonomous agents to know if attestation is fresh
- `POST /verify` — server-side verify of {payload, signature, minScore}
- `GET /canonical-id/{address}` — basename + ERC-8004 + agent.json + tier
- `GET /has-mainstreet-ref/{address}` — reciprocal proof check
- `GET /snippet/{address}` — JSON block to merge into your own agent.json
- `GET /funded-by/{address}` — top wallets that sent USDC to this address
- `GET /recent-activity/{address}` — 7d earn/spend signal
- `GET /virtuals-rep/{tokenAddress}` — Virtuals token → operator score
- `GET /bazaar-scored` — proxy of CDP Bazaar discovery with trust score per item
- `GET /agents-of-interest` — curated shortlist (3 filter modes)
- `GET /top-buyers` — wallets spending most via x402 on Base
- `GET /match` — semantic search: pass `?intent=weather+data` to find ranked agents
- `GET /coverage` — public ecosystem stats

## Paid endpoints (x402 USDC on Base)

| Endpoint | Price | Purpose |
| --- | --- | --- |
| `GET /score/{address}?live=1` | $0.05 | Force fresh re-fetch |
| `GET /audit/{address}` | $0.25 | 360° due-diligence: score + proofs + launches + traders + settlements + SLA + ERC-8004 feedback + signedAttestation |
| `GET /risk-report/{address}` | $0.50 | Risk-only verdict (AVOID/CAUTION/OK) + flags + signed attestation |
| `GET /clawd/creator-audit/{address}` | $0.50 | PumpClaw creator due-diligence |
| `GET /clawd/export` | $0.50 | Bulk PumpClaw graph export |
| `POST /audit-batch` | $1.00 | Bulk score+risk up to 10 wallets in one call |
| `GET /proofs/export` | $1.00 | Bulk multi-source proofs (CSV/JSON) |
| `GET /clawd/rug-alert/{tokenAddr}` | $2.00 | Rug-alert webhook (30 days) |
| `POST /webhook/extend` | $5.00 | Extend real-time webhook subscription |
| `POST /sponsor/{address}` | $25/wk | Boosted leaderboard placement |

## Onchain verification (Solidity)

```solidity
interface IMainStreetVerifier {
  function requireMinScore(
    bytes32 subject, uint8 minScore,
    uint8 score, uint64 timestamp, uint64 nonce,
    bytes calldata signature
  ) external view returns (bool);
}

IMainStreetVerifier constant MS = IMainStreetVerifier(0x7397adb9713934c36d22aa54b4dbbcd70263592b);
MS.requireMinScore(subject, 30, score, ts, nonce, sig);
```

Caller fetches `{subject, score, timestamp, nonce, signature}` from `GET /api/agent/attestation/{address}`, passes inline as tx calldata. No oracle subscription, no upkeep, ~$0.00003 in gas.

## npm package

```bash
npm i @raskhaaa/mainstreet-oracle viem

import { requireMinScore } from '@raskhaaa/mainstreet-oracle/verifier';
import * as viem from 'viem';

// throws if score < 30 or signature invalid
const score = await requireMinScore('0xAgentAddr', 30, viem);
```

## EIP-712 schema

```
Attestation(
  string version,         // "mainstreet-v1"
  string subjectType,     // "agent-onchain"
  bytes32 subject,        // sha256(toLowerCase(address))
  uint8 score,            // 0-100
  uint64 timestamp,       // unix seconds, ≤24h fresh
  address operator,       // 0xAC3ca7c5d3cDD7702fd08F9C4C28dAA22296aDa9
  uint64 nonce
)
```

Domain: `{ name: "MainStreet", version: "1", chainId: 8453 }`.

## Live coverage (June 2026)

- 847 Base AI agents indexed
- 4,811 Virtuals agents cross-referenced
- 153,073 x402 settlements tracked
- $24,562 USDC volume seen
- 1,513 unique buyers
- 16 ERC-8004 registered agents in our index
- Top 10 scores published onchain weekly via EAS (composable signal)
