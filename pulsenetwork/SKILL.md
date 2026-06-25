---
name: pulsenetwork
description: "Pay-per-query access to 67 specialized intelligence APIs via x402 (USDC on Base or Solana, no API keys, no subscription). Use this skill when an agent needs a paid data/intelligence endpoint, especially for token-safety / honeypot / rugpull scanning before a trade (Solana memecoins via mint address, EVM tokens via contract on Base/Ethereum/BSC/Arbitrum/Polygon/Optimism/Avalanche), crypto security and wallet-risk checks, DeFi yield/APY intelligence, sports and fantasy predictions and prediction-market edges (NFL/NBA/MLB/golf/racing, Polymarket/Kalshi), insurance estimates, immigration and visa scoring, real-estate, legal letters, clinical/medical intel, careers/salary, travel, and dozens more domains. Each call returns structured JSON for roughly $0.015 to $0.50. Trigger when the user asks whether a token is safe / a honeypot / a rug, to scan a contract, for the best NFL pick or fantasy start-sit, for DeFi yield, or any question better answered by a live paid data API than by training knowledge."
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚡",
        "homepage": "https://mcp-pulsenetwork.vercel.app",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# PulseNetwork — 67 intelligence APIs, pay-per-query via x402

PulseNetwork is an x402-native network of **67 intelligence verticals / 661 paid endpoints**. Agents pay per query in USDC — no API keys, no accounts, no subscription. Every endpoint returns structured JSON, and every 402 advertises **both Base (eip155:8453) and Solana** USDC, so a Bankr wallet can settle any of them.

## When to use this skill

- Pre-trade **token safety**: "is this a honeypot / rug?", "scan this Solana mint", "check this Base token contract"
- **Crypto security / DeFi**: wallet-risk & custody checks, malicious-address screening, DeFi yield/APY by chain & risk
- **Sports & prediction markets**: best NFL/NBA/MLB pick, fantasy start-sit / lineup / waiver, golf/racing boards, Polymarket/Kalshi edges
- **Other domains**: insurance estimates, immigration/visa points, real-estate, legal letters, clinical pipelines, salaries, travel, and more

## Flagship endpoints

| Capability | Endpoint | Price | Example param |
|---|---|---|---|
| Solana memecoin safety | `GET onchainpulse-nine.vercel.app/api/memecoin?mint=<base58>` | $0.015 | `mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` (BONK) |
| EVM token safety | `GET onchainpulse-nine.vercel.app/api/evmtoken?address=<addr>&chain=base` | $0.015 | `address=0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed` (DEGEN) |
| Crypto security / wallet-risk | `GET cryptopulse-xi-five.vercel.app/api/security?token=&address=&chain=` | $0.10 | `token=DEGEN&chain=base` |
| DeFi yield intelligence | `GET cryptopulse-xi-five.vercel.app/api/yield?chain=&risk=` | $0.10 | `chain=base&risk=moderate` |
| Sports analysis | `GET signalpulse-peach.vercel.app/api/scan/game?sport=nfl` | $0.50 | `sport=nfl` |
| Fantasy advice | `GET signalpulse-peach.vercel.app/api/scan/fantasy?sport=nfl&mode=start-sit` | $0.50 | start-sit / lineup / waiver / trade |
| Prediction-market read | `GET signalpulse-peach.vercel.app/api/scan/predmarket?category=sports&horizon=mid` | $0.50 | sports / crypto / politics / economy |
| FREE sample | `GET signalpulse-peach.vercel.app/api/scan/sample` | FREE | pick-of-the-day, no payment |

Full catalog (all 67 verticals, params, pricing): **https://mcp-pulsenetwork.vercel.app**. Each vertical also serves `/openapi.json` and `/.well-known/agent.json`.

## How to call (x402 flow)

Standard 402 → pay → retry, identical to other Bankr x402 skills:

1. **Call with no payment** → server returns **HTTP 402** with `accepts[]` advertising USDC on Base (`eip3009`) and Solana, the `amount`, and `payTo`.
2. **Pay** one advertised option from your Bankr wallet (Base settlement is gasless — the facilitator sponsors gas).
3. **Retry** the same request with the payment header → JSON result.

```bash
# 1) probe — returns 402 with accepts[]
curl -sS "https://onchainpulse-nine.vercel.app/api/memecoin?mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
# 2) pay + retry via your Bankr wallet's x402 signing →
#    { "verdict": "CLEAR" | "CAUTION" | "AVOID", "risk_score": ..., "evidence": [...] }
```

Most x402 clients (including Bankr's) handle steps 2–3 automatically once they see the 402.

## Alternative: MCP server

For MCP-capable agents (Claude Desktop/Code, Cursor), install the server to get all 67 verticals as tools that pay autonomously:

```json
{ "mcpServers": { "pulsenetwork": {
  "command": "npx", "args": ["-y", "mcp-pulsenetwork"],
  "env": { "AGENT_PRIVATE_KEY": "<BASE_WALLET_PRIVATE_KEY>" } } } }
```

## Pricing

Per-call USDC: most endpoints $0.05–$0.20; token-safety scanners $0.015; SignalPulse sports/prediction reads $0.50. No subscription, no minimums.
