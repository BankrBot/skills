---
name: ethereum-history
description: Look up historic Ethereum contracts, their creators, and stories via EthereumHistory.com. Use when the user asks about early Ethereum contracts, token history, who created a contract, when a contract was deployed, or Ethereum archaeology (2015-2017 era).
---

# Ethereum History

Look up historic Ethereum contracts and their stories from the 2015-2017 era via EthereumHistory.com.

## Quick Start

### Look Up a Contract

```bash
./scripts/lookup.sh 0x60B7d0BFAb9ABcFEe3197f30Bf4922bdc443464d   # MistCoin
./scripts/lookup.sh 0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7   # Unicorn Meat
./scripts/lookup.sh 0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413   # The DAO
```

### Browse the Site

- **Website**: https://www.ethereumhistory.com
- **Contract page**: `https://www.ethereumhistory.com/contract/<address>`

### MCP Server

EthereumHistory.com provides an MCP server for programmatic access. Agents with MCP support can connect directly for structured contract data.

## What's Documented

The site catalogs ~40 historic Ethereum contracts from the 2015-2017 era. Each contract entry includes:

- **Address** — the deployed contract address
- **Name** — project or token name
- **Creator** — who deployed it (wallet address and/or known identity)
- **Deploy date** — when it went on-chain
- **Description** — what the contract does
- **Historical significance** — why it matters in Ethereum history
- **Related contracts** — connections to other historic contracts

## Notable Projects

| Project | Address | Era |
|---------|---------|-----|
| MistCoin | `0x60B7d0BFAb9ABcFEe3197f30Bf4922bdc443464d` | 2015 |
| Unicorn Meat | `0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7` | 2015 |
| The DAO | `0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413` | 2016 |
| CryptoPunks | `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` | 2017 |
| Golem (GNT) | `0xa74476443119A942dE498590Fe1f2454d7D4aC0d` | 2016 |
| Augur (REP) | `0x48c80F1f4D53D5951e5D5438B54Cba84f29F32a5` | 2015 |
| SingularDTV | `0xaec2E87E0A235266D9C5ADc9DEb4b2E29b54D009` | 2016 |
| Digix (DGD) | `0xe0B7927c4aF23765Cb51314A0E0521A9645F0E2A` | 2016 |

See `references/notable-contracts.md` for the full list.

## Use Cases

- **"Who created this contract?"** → Look up the contract address
- **"What was the first ERC-20 token?"** → Browse by deploy date
- **"Tell me about The DAO"** → Fetch contract page for history and significance
- **"What contracts were deployed in 2015?"** → Filter by era
- **Ethereum archaeology** → Discover forgotten projects and their stories

## How to Use

1. If you have a contract address, use `./scripts/lookup.sh <address>` or visit the contract page directly
2. If you have a project name, check `references/notable-contracts.md` to find the address
3. For broader research, browse https://www.ethereumhistory.com for the full catalog
4. For programmatic access, connect to the MCP server

## Notes

- Focus is on the 2015-2017 era (pre-ICO boom through early token standards)
- Many of these contracts predate ERC-20 finalization and use non-standard interfaces
- Contract data is curated by historians — not auto-scraped
- The site is actively maintained and new discoveries are added regularly
