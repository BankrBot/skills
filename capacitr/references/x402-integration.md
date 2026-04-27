# x402 Integration Guide for Capacitr

## Overview

Capacitr uses the [x402 protocol](https://x402.org) to charge $0.01 USDC per API call on Base.
Agents that support x402 pay automatically — no API keys, no subscriptions.

## How x402 Works

1. Agent sends request to endpoint
2. If no payment proof: server responds `HTTP 402 Payment Required` with payment details in headers
3. Agent reads `X-Payment-Required` header, signs a payment on Base, retries with `X-Payment` header
4. Server validates payment, processes request, returns results

## Payment Details

```
Network:  Base (chain ID 8453)
Token:    USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
Amount:   $0.10 (100000 USDC units, 6 decimals) for URL scans
          $0.05 (50000 USDC units, 6 decimals) for text queries
Payee:    0x6503fB61705EB6B3C57EE1ab88a1a75A6eE01869
```

## JavaScript / TypeScript

```javascript
import { wrapFetchWithPayment } from '@x402/fetch';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http(),
});

const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);

async function scanMarkets(input) {
  const isUrl = input.startsWith('http');
  const body = isUrl ? { url: input } : { query: input };

  const response = await fetchWithPayment(
    'https://app.capacitr.xyz/api/analyze-link',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Usage
const markets = await scanMarkets('https://reuters.com/...');
const edgeMarkets = markets.predictions.filter(p => p.spread > 0.05);
```

## Python

```python
import httpx
from x402.client import X402Client  # pip install x402

client = X402Client(private_key=os.environ["AGENT_PRIVATE_KEY"], chain="base")

response = client.post(
    "https://app.capacitr.xyz/api/analyze-link",
    json={"query": "Federal Reserve rate decision"},
)
data = response.json()

# Edge opportunities
edges = [p for p in data["predictions"] if (p.get("spread") or 0) > 0.05]
for edge in edges:
    direction = "BUY YES" if edge["spreadDirection"] == "q_higher" else "BUY NO"
    print(f"{direction} +{round(edge['spread']*100)}% | {edge['question']}")
```

## Bankr Agent (natural language)

```
bankr agent prompt "Scan this article for tradeable markets and show me the best edge opportunities: https://..."
```

Bankr's agent automatically handles x402 payments from its embedded wallet.

## Cost Estimation

| Volume | Type | Monthly Cost |
|--------|------|-------------|
| 100 calls/day | URL scans | ~$300/month |
| 100 calls/day | Text queries | ~$150/month |
| 500 calls/day | URL scans | ~$1,500/month |
| 500 calls/day | Text queries | ~$750/month |

## What's Included Per Call

- URL scraping via Jina AI (handles JavaScript-rendered pages, paywalled content best-effort)
- LLM entity extraction (GPT-4o-mini) — tickers, entities, keywords
- Polymarket search across entities + keywords (up to 15 results)
- HyperLiquid perp + HIP-3 spot perp matching (stocks, commodities, indices)
- Deribit options chain for matched crypto assets
- Quotient AI mispricing scores and edge signals where available
