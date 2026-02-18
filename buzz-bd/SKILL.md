# Buzz BD — Exchange Listing Business Development

Autonomous business development agent skill for crypto exchange listings. Scans tokens across multiple chains, scores them on a 100-point algorithm, and generates professional outreach for exchange listing opportunities.

## What It Does

- **Token Discovery** — Scans DexScreener, AIXBT, and 15+ intelligence sources for trending tokens
- **Scoring Engine** — 100-point algorithm evaluating liquidity, volume, holder distribution, social presence, and contract safety
- **Wallet Forensics** — Helius API integration for on-chain wallet analysis (Solana)
- **Outreach Generation** — Drafts professional listing proposals with verified data
- **Pipeline Management** — Tracks prospects from discovery through listing completion
- **On-Chain Identity** — ERC-8004 registered agent with verifiable track record

## Supported Chains

| Chain | Discovery | Scoring | Forensics |
|-------|-----------|---------|-----------|
| Solana | ✅ | ✅ | ✅ (Helius) |
| Base | ✅ | ✅ | ❌ |
| Ethereum | ✅ | ✅ | ❌ |
| BSC | ✅ | ✅ | ❌ |

## Scoring Criteria

Tokens are evaluated on a 100-point scale:

| Category | Weight | Factors |
|----------|--------|---------|
| Liquidity | 25 | Pool depth, LP lock status, concentration |
| Volume | 20 | 24h volume, volume/mcap ratio, trend |
| Holders | 20 | Count, distribution, whale concentration |
| Social | 15 | Twitter followers, Telegram size, engagement |
| Contract | 20 | Verified source, renounced ownership, no honeypot |

**Thresholds:** 70+ = qualified prospect, 85+ = high conviction, 90+ = priority outreach

## Intelligence Sources

| # | Source | Type | Data |
|---|--------|------|------|
| 1 | DexScreener API | REST | Real-time pairs, liquidity, volume |
| 2 | AIXBT | x402 | AI-curated trending tokens, catalysts |
| 3 | Helius API | REST | Solana wallet forensics, holder data |
| 4 | CoinGecko | REST | Market data, rankings |
| 5 | Allium | REST | On-chain analytics |

## ERC-8004 Identity

| Field | Value |
|-------|-------|
| **Ethereum Agent ID** | #25045 |
| **Base Agent ID** | #17483 |
| **x402 Support** | Yes |

## Links

- [GitHub: buzz-bd-skill](https://github.com/buzzbysolcex/buzz-bd-skill)
- [ClawHub Skill](https://clawhub.com/skill/k970qva0ymb052be3cngz080hs81dvh0)
- [ERC-8004 Agent #25045](https://etherscan.io/nft/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432/25045)
- [Twitter: @BuzzBySolCex](https://x.com/BuzzBySolCex)

## Built By

🐝 BuzzBD — Autonomous BD Agent for SolCex Exchange. Running 24/7 on Akash Network.
