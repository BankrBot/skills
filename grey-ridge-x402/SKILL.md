---
name: grey-ridge-x402
description: Base-native pre-trade safety gate and onchain data for AI agents — pay-per-call in USDC on Base via x402, no account or API key. Use BEFORE an agent buys or sells a Base token (honeypot, rug, proxy, mint/fee authority, liquidity) and get a GO/HOLD/BLOCK or SAFE/CAUTION/AVOID verdict, or when it needs Base RPC reads (balances, gas, tx, wallet) with USD values, crypto prices, funding-rate spreads, DeFi yields, or live Polymarket markets. Triggers on token safety, honeypot check, rug pull, is this token safe, can I sell, safe to swap, proxy/upgradeable, Base balance, gas price, funding rate, DeFi yield, Polymarket.
---

# Grey Ridge Signals — Base pre-trade gate + onchain data (x402)

**Base URL:** `https://x402-data-api.sigrunner.workers.dev`
**Payment:** x402, USDC on Base (`eip155:8453`, scheme `exact`). No account, no API key. Every route has a free `/preview` variant (same response shape) so you can test with no wallet.
**Catalog:** `/.well-known/x402` · **Docs:** `/llms.txt` · **MCP server:** `/mcp`

## Endpoints

| Endpoint | Price | What it returns |
|---|---|---|
| `GET /gate/swap?token=0x..&side=buy&notional_usd=100` | $0.008 | go / hold / block decision for swapping a Base ERC-20: live honeypot sell simulation, liquidity vs. size, proxy and tax risk |
| `GET /chain/token-report?token=0x..` | $0.01 | Full SAFE / CAUTION / AVOID report: honeypot sim, proxy/upgrade risk, mutable tax, mint/pause/blacklist authorities, ownership, liquidity |
| `GET /chain/token-security?token=0x..` | $0.009 | Lighter `clear / review / block` check with risk score and flags |
| `GET /chain/wallet?address=0x..` | $0.003 | ETH + token balances in one call, USD-priced |
| `GET /chain/gas-price` | $0.01 | EIP-1559 fees plus USD cost |
| `GET /crypto/funding` | $0.004 | Cross-venue perp funding-rate spread |
| `GET /defi/yields` | $0.001 | DeFi yields, risk-adjusted |
| `GET /pm/markets?q=..` | $0.005 | Live Polymarket markets with bid/ask/spread |

Full list (60+ routes, all $0.001–$0.05): `GET /.well-known/x402`.

## Try it free (no wallet)

```bash
B=https://x402-data-api.sigrunner.workers.dev
curl -s "$B/gate/swap/preview?token=weth"
curl -s "$B/chain/token-report/preview?token=aero"   # also usdc, cbbtc, degen, or any 0x address
```

## Call it with a paying client

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
// signer: any viem account holding a little USDC on Base
const pay = wrapFetchWithPayment(fetch, client);
const r = await pay(`${B}/gate/swap?token=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&side=buy&notional_usd=100`);
console.log(await r.json()); // { decision: "go" | "hold" | "block", verdict, risk_score, flags, ... }
```

Without a client, the first request returns `HTTP 402` with a `payment-required` header (amount, payTo, asset); sign a USDC authorization and retry with `X-PAYMENT`. If the paid path errors you are not charged.

## Practical flow

1. Before any Base swap, call `/gate/swap`. On `block`, stop. On `hold`, size down or ask the user.
2. For a larger position, pull `/chain/token-report` and read the flags.
3. Execute the trade through Bankr.

## MCP

```json
{"mcpServers":{"grey-ridge-x402":{"type":"streamable-http","url":"https://x402-data-api.sigrunner.workers.dev/mcp"}}}
```

Contact: contact@greyridgesignals.ai
