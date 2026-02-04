# Aegis402 Use Cases for AI Agents

## The Problem

Meme coin lifecycle: 15 minutes. Agent decision time: 100ms. Human reaction time: too slow.

Without security verification:
1. Agent sees hype around $SCAM69
2. Agent analyzes sentiment, sees liquidity, buys
3. Agent doesn't see: honeypot code, hidden `renounceOwnership`, team allocation
4. Result: -$50,000 in one transaction

## Solution: Pre-Execution Security Layer

Aegis402 adds a security check between "decide to trade" and "sign transaction".

```
Agent Decision → Aegis402 Check → Safe? → Execute
                                    ↓
                              Risky? → Abort
```

---

## Use Case 1: Trading Bots

### Before Buying Any Token

```typescript
async function buyToken(address: string, chain_id: number) {
  // Security gate: check before buying
  const { isHoneypot, trustScore, risks } = await fetch402(
    `https://aegis402.xyz/v1/check-token/${address}?chain_id=${chain_id}`
  ).then(r => r.json());

  if (isHoneypot) {
    log('BLOCKED: Honeypot detected');
    return null;
  }

  if (trustScore < 60) {
    log(`BLOCKED: Low trust score (${trustScore})`);
    return null;
  }

  // Safe to proceed
  return executeBuy(address);
}
```

### Spending Tier Integration

Combine with spending limits for layered security:

```typescript
const TIERS = {
  auto: 50,      // < $50 — auto-execute after Aegis check
  notify: 500,   // $50-500 — notify human after Aegis check
  approval: Infinity // > $500 — require human approval
};

async function tieredTrade(amount: number, tx: Transaction) {
  // Always run Aegis check first
  const { isSafe, riskLevel } = await fetch402('https://aegis402.xyz/v1/simulate-tx', {
    method: 'POST',
    body: JSON.stringify(tx)
  }).then(r => r.json());

  if (!isSafe) {
    return { status: 'blocked', reason: 'Aegis security check failed' };
  }

  // Apply spending tier rules
  if (amount > TIERS.approval) {
    return { status: 'pending_approval', tx };
  }

  if (amount > TIERS.auto) {
    notifyHuman(`Trade $${amount}: ${tx.to}`);
  }

  return executeTrade(tx);
}
```

---

## Use Case 2: DeFi Automation

### Safe Approval Flow

```typescript
async function safeApprove(token: string, spender: string, amount: bigint) {
  // 1. Check the spender contract
  const { isPoisoned, reputation } = await fetch402(
    `https://aegis402.xyz/v1/check-address/${spender}`
  ).then(r => r.json());

  if (isPoisoned || reputation === 'MALICIOUS') {
    throw new Error('Refusing to approve malicious spender');
  }

  // 2. Simulate the approval
  const { isSafe, warnings } = await fetch402('https://aegis402.xyz/v1/simulate-tx', {
    method: 'POST',
    body: JSON.stringify({
      from: wallet,
      to: token,
      data: encodeApproval(spender, amount),
      chain_id: 8453
    })
  }).then(r => r.json());

  if (!isSafe) {
    throw new Error(`Unsafe approval: ${warnings.join(', ')}`);
  }

  // 3. Execute with exact amount (never unlimited)
  return approve(token, spender, amount);
}
```

---

## Use Case 3: Wallet Agents

### Transfer Verification

```typescript
async function sendTokens(to: string, amount: bigint, token: string) {
  // Check recipient for address poisoning
  const { isPoisoned } = await fetch402(
    `https://aegis402.xyz/v1/check-address/${to}`
  ).then(r => r.json());

  if (isPoisoned) {
    // Could be address poisoning attack
    throw new Error('Recipient flagged as poisoned address');
  }

  return transfer(to, amount, token);
}
```

---

## Use Case 4: AI Hedge Funds

### Portfolio Protection

```typescript
class SecurePortfolioManager {
  async rebalance(trades: Trade[]) {
    const safeResults = await Promise.all(
      trades.map(async (trade) => {
        // Run security check on each trade
        const simulation = await fetch402('https://aegis402.xyz/v1/simulate-tx', {
          method: 'POST',
          body: JSON.stringify(trade.tx)
        }).then(r => r.json());

        return {
          trade,
          safe: simulation.isSafe,
          risk: simulation.riskLevel,
          warnings: simulation.warnings
        };
      })
    );

    // Only execute safe trades
    const safeTrades = safeResults.filter(r => r.safe);
    const blockedTrades = safeResults.filter(r => !r.safe);

    if (blockedTrades.length > 0) {
      alertRiskTeam(blockedTrades);
    }

    return executeTrades(safeTrades.map(r => r.trade));
  }
}
```

---

## Integration with Agent Frameworks

### ElizaOS Plugin

```typescript
// plugins/aegis402.ts
import { Plugin } from '@elizaos/core';

export const aegis402Plugin: Plugin = {
  name: 'aegis402',
  actions: [
    {
      name: 'CHECK_TOKEN_SAFETY',
      handler: async (runtime, message) => {
        const { address, chain_id } = message.content;
        const result = await runtime.fetch402(
          `https://aegis402.xyz/v1/check-token/${address}?chain_id=${chain_id}`
        );
        return result.json();
      }
    }
  ]
};
```

---

## Cost Analysis

For a trading bot making 100 trades/day:

| Check Type | Per Trade | Daily Cost |
|------------|-----------|------------|
| Token check only | $0.01 | $1.00 |
| Token + Simulation | $0.06 | $6.00 |
| Full (token + sim + address) | $0.065 | $6.50 |

**ROI**: One prevented rug pull ($5,000+) = 770+ days of protection costs.

---

## Health Check (Free)

```bash
curl https://aegis402.xyz/health
```

```json
{
  "status": "healthy",
  "circuitBreaker": { "state": "CLOSED" }
}
```
