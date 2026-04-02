---
name: blueagent-x402
description: Pay-per-use AI services on Base via x402 protocol. Use when agents need to analyze tokens/projects (deep due diligence), analyze wallet PnL, get a token launch playbook, evaluate grant applications, or run a safety check before executing transactions. All powered by Blue Agent × Bankr. Pay USDC per call, no subscription.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🟦",
        "homepage": "https://github.com/madebyshun/blueagent-x402-services",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# BlueAgent x402 Services

5 AI-powered services on Base — pay USDC per call via x402 protocol. No subscription, no API key needed.

**Base URL:** `https://x402.bankr.bot/0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/`

## Services

| Service | Price | Description |
|---------|-------|-------------|
| `deep-analysis` | $0.35/req | Due diligence for any Base token or project |
| `wallet-pnl` | $1.00/req | PnL report for any Base wallet |
| `launch-advisor` | $3.00/req | Full launch playbook for Base founders |
| `grant-evaluator` | $5.00/req | Grant application scoring (Base/Coinbase criteria) |
| `risk-gate` | $0.05/req | Safety check before agents execute transactions |

## Quick Start

### Using Bankr CLI

```bash
# Analyze a token or project
bankr x402 call 0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/deep-analysis \
  -X POST -d '{"projectName":"Uniswap"}' -y

# Analyze a wallet
bankr x402 call 0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/wallet-pnl \
  -X POST -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}' -y

# Safety check before transaction
bankr x402 call 0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/risk-gate \
  -X POST -d '{"action":"buy token","contractAddress":"0x...","amount":"$50"}' -y
```

### Using x402-fetch (JS/TS)

```bash
npm install x402-fetch viem
```

```typescript
import { wrapFetchWithPayment } from 'x402-fetch';
import { createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base } from 'viem/chains';

const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY');
const wallet = createWalletClient({ account, chain: base, transport: http() });
const paidFetch = wrapFetchWithPayment(fetch, wallet);

const res = await paidFetch(
  'https://x402.bankr.bot/0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/deep-analysis',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectName: 'Uniswap' })
  }
);
const data = await res.json();
```

## Service Details

### deep-analysis — $0.35/req

Deep due diligence for any Base token or project.

**Input:**
```json
{
  "contractAddress": "0x...",
  "projectName": "Uniswap",
  "ticker": "UNI"
}
```
> Provide `contractAddress` OR `projectName` (at least one required)

**Output:**
```json
{
  "projectName": "Uniswap",
  "overallScore": 88,
  "riskScore": 12,
  "rugProbability": 2,
  "categories": {
    "Tokenomics": 85,
    "Liquidity": 95,
    "CodeQuality": 90,
    "TeamActivity": 82,
    "Community": 88,
    "Transparency": 87
  },
  "keyRisks": ["..."],
  "keyStrengths": ["..."],
  "recommendation": "Strong Buy",
  "summary": "..."
}
```

---

### wallet-pnl — $1.00/req

Deep PnL analysis for any Base wallet.

**Input:**
```json
{ "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" }
```

**Output:**
```json
{
  "estimatedPnL": "+$3,240",
  "winRate": "68%",
  "tradingStyle": "Memecoin Aper",
  "riskProfile": "Aggressive",
  "smartMoneyScore": 72,
  "topTokens": ["DEGEN", "BRETT", "TOSHI"],
  "summary": "..."
}
```

---

### launch-advisor — $3.00/req

Full go-to-market playbook for Base token launches.

**Input:**
```json
{
  "projectName": "MyProject",
  "description": "A DeFi protocol for...",
  "targetAudience": "Base builders",
  "teamSize": "3",
  "budget": "$10,000"
}
```

**Output:** Launch score, tokenomics, 8-week timeline, marketing strategy, KPIs, recommendation.

---

### grant-evaluator — $5.00/req

Professional grant scoring using Base/Coinbase grant criteria.

**Input:**
```json
{
  "projectName": "MyProject",
  "description": "Building a...",
  "teamBackground": "2 ex-Coinbase engineers",
  "requestedAmount": "$25,000",
  "milestones": "Month 1: MVP..."
}
```

**Output:** Overall score, Fund/Decline recommendation, suggested grant size, strengths, concerns.

---

### risk-gate — $0.05/req

Safety check for AI agents before executing onchain transactions.

**Input:**
```json
{
  "action": "buy token on Uniswap",
  "contractAddress": "0x...",
  "amount": "$50",
  "agentId": "my-trading-agent"
}
```

**Output:**
```json
{
  "decision": "APPROVE",
  "riskScore": 18,
  "riskLevel": "Low",
  "reasons": ["Verified contract", "Reasonable amount"],
  "recommendation": "Safe to proceed",
  "maxSafeAmount": "$200"
}
```

**Decision values:** `APPROVE` | `WARN` | `BLOCK`

## Resources

- **GitHub:** https://github.com/madebyshun/blueagent-x402-services
- **Token:** $BLUEAGENT on Base — `0xf895783b2931c919955e18b5e3343e7c7c456ba3`
- **Community:** https://t.me/blueagent_hub
- **Bot:** @BlueAgent_bot
