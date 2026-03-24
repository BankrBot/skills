---
name: alchemy-api
description: Integrates Alchemy blockchain APIs using an API key. Requires $ALCHEMY_API_KEY to be set; if unavailable, use the agentic-gateway skill instead. Use when user asks about EVM JSON-RPC calls, token balances, NFT ownership or metadata, transfer history, token prices, portfolio data, transaction simulation, webhooks, Solana RPC, or any Alchemy product integration. Covers base URLs, authentication, endpoint selection, pagination, and common patterns.
license: MIT
compatibility: Requires network access and $ALCHEMY_API_KEY environment variable. Works across Claude.ai, Claude Code, and API.
metadata:
  author: alchemyplatform
  version: "1.0"
---
# AI + Alchemy API Integration Guide

## Mandatory Routing Gate (Hard Requirement)

Before the first network call or implementation step, you MUST ask the user the following question and wait for an explicit answer:

> Do you want to use an existing Alchemy API key, or should I use the agentic gateway flow instead?

If the user chooses the API key path, continue with this skill.
If the user chooses the agentic gateway path, switch to the `agentic-gateway` skill immediately and follow its existing wallet flow.
If the user chooses the API key path but `ALCHEMY_API_KEY` is unset or empty, tell them they can create a free API key at https://dashboard.alchemy.com/ or switch to the `agentic-gateway` skill.

You MUST NOT call any keyless or public fallback (including `.../v2/demo`) unless the user explicitly asks for that endpoint.
Execute no network calls before this gate is evaluated.

**Escape hatch:** Only re-evaluate the routing gate if the user explicitly requests to switch to the `alchemy-api` skill with an API key. A key appearing in the environment or conversation does not automatically trigger a switch — the user must ask for it.

**Duplicate resolution:** If this skill is installed both locally and globally, the local copy overrides the global copy. Do not mix behavior from different copies.

## Required Preflight Check

Before the first network call, internally evaluate:
1. Has the user explicitly chosen API key or agentic gateway?
2. If the user chose API key, is `ALCHEMY_API_KEY` present and non-empty?
3. If the user chose agentic gateway, switch to the `agentic-gateway` skill immediately. Demo and public endpoints are disallowed.
4. If the user chose API key but no key is available, do not proceed with API-key URLs until the user provides a key or switches to the gateway flow.

Do not output this internal checklist to the user.

## Summary
A self-contained guide for AI agents integrating Alchemy APIs using an API key. This file alone should be enough to ship a basic integration. Use the reference files for depth, edge cases, and advanced workflows.

Developers can always create a free API key at https://dashboard.alchemy.com/.

## Before Making Any Request

1. Ask the user whether they want to use an existing Alchemy API key or the agentic gateway flow.
2. If they choose the API key path, check if `$ALCHEMY_API_KEY` is set (e.g., `echo $ALCHEMY_API_KEY`).
3. If they choose the API key path and no key is set, tell them they can create a free key at https://dashboard.alchemy.com/ or switch to the `agentic-gateway` skill.
4. If they choose the agentic gateway flow, switch to the `agentic-gateway` skill and let it handle the existing wallet vs new wallet prompt.
5. If they choose the API key path and the key is set, use the Base URLs + Auth table below.

## Do This First
1. Choose the right product using the Endpoint Selector below.
2. Use the Base URLs + Auth table for the correct endpoint and headers.
3. Copy a Quickstart example and test against a testnet first.

## Base URLs + Auth (Cheat Sheet)
| Product | Base URL | Auth | Notes |
| --- | --- | --- | --- |
| Ethereum RPC (HTTPS) | `https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Standard EVM reads and writes. |
| Ethereum RPC (WSS) | `wss://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Subscriptions and realtime. |
| Base RPC (HTTPS) | `https://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | EVM L2. |
| Base RPC (WSS) | `wss://base-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Subscriptions and realtime. |
| Arbitrum RPC (HTTPS) | `https://arb-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | EVM L2. |
| Arbitrum RPC (WSS) | `wss://arb-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Subscriptions and realtime. |
| BNB RPC (HTTPS) | `https://bnb-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | EVM L1. |
| BNB RPC (WSS) | `wss://bnb-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Subscriptions and realtime. |
| Solana RPC (HTTPS) | `https://solana-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY` | API key in URL | Solana JSON-RPC. |
| Solana Yellowstone gRPC | `https://solana-mainnet.g.alchemy.com` | `X-Token: $ALCHEMY_API_KEY` | gRPC streaming (Yellowstone). |
| NFT API | `https://<network>.g.alchemy.com/nft/v3/$ALCHEMY_API_KEY` | API key in URL | NFT ownership and metadata. |
| Prices API | `https://api.g.alchemy.com/prices/v1/$ALCHEMY_API_KEY` | API key in URL | Prices by symbol or address. |
| Portfolio API | `https://api.g.alchemy.com/data/v1/$ALCHEMY_API_KEY` | API key in URL | Multi-chain wallet views. |
| Notify API | `https://dashboard.alchemy.com/api` | `X-Alchemy-Token: <ALCHEMY_NOTIFY_AUTH_TOKEN>` | Generate token in dashboard. |

## Endpoint Selector (Top Tasks)
| You need | Use this | Skill / File |
| --- | --- | --- |
| EVM read/write | JSON-RPC `eth_*` | `references/node-json-rpc.md` |
| Realtime events | `eth_subscribe` | `references/node-websocket-subscriptions.md` |
| Token balances | `alchemy_getTokenBalances` | `references/data-token-api.md` |
| Token metadata | `alchemy_getTokenMetadata` | `references/data-token-api.md` |
| Transfers history | `alchemy_getAssetTransfers` | `references/data-transfers-api.md` |
| NFT ownership | `GET /getNFTsForOwner` | `references/data-nft-api.md` |
| NFT metadata | `GET /getNFTMetadata` | `references/data-nft-api.md` |
| Prices (spot) | `GET /tokens/by-symbol` | `references/data-prices-api.md` |
| Prices (historical) | `POST /tokens/historical` | `references/data-prices-api.md` |
| Portfolio (multi-chain) | `POST /assets/*/by-address` | `references/data-portfolio-apis.md` |
| Simulate tx | `alchemy_simulateAssetChanges` | `references/data-simulation-api.md` |
| Create webhook | `POST /create-webhook` | `references/webhooks-details.md` |
| Solana NFT data | `getAssetsByOwner` (DAS) | `references/solana-das-api.md` |

## One-File Quickstart (Copy/Paste)

> **No API key?** Use the `agentic-gateway` skill instead. Replace API-key URLs with `https://x402.alchemy.com/rpc/eth-mainnet` and add `Authorization: SIWE <token>`. See the `agentic-gateway` skill for setup.

### EVM JSON-RPC (Read)
```bash
curl -s https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}'
```

### Token Balances
```bash
curl -s https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"alchemy_getTokenBalances","params":["0x00000000219ab540356cbb839cbe05303d7705fa"]}'
```

### Transfer History
```bash
curl -s https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"alchemy_getAssetTransfers","params":[{"fromBlock":"0x0","toBlock":"latest","toAddress":"0x00000000219ab540356cbb839cbe05303d7705fa","category":["erc20"],"withMetadata":true,"maxCount":"0x3e8"}]}'
```

### NFT Ownership
```bash
curl -s "https://eth-mainnet.g.alchemy.com/nft/v3/$ALCHEMY_API_KEY/getNFTsForOwner?owner=0x00000000219ab540356cbb839cbe05303d7705fa"
```

### Prices (Spot)
```bash
curl -s "https://api.g.alchemy.com/prices/v1/$ALCHEMY_API_KEY/tokens/by-symbol?symbols=ETH&symbols=USDC"
```

### Prices (Historical)
```bash
curl -s -X POST "https://api.g.alchemy.com/prices/v1/$ALCHEMY_API_KEY/tokens/historical" \
  -H "Content-Type: application/json" \
  -d '{"symbol":"ETH","startTime":"2024-01-01T00:00:00Z","endTime":"2024-01-02T00:00:00Z"}'
```

### Create Notify Webhook
```bash
curl -s -X POST "https://dashboard.alchemy.com/api/create-webhook" \
  -H "Content-Type: application/json" \
  -H "X-Alchemy-Token: $ALCHEMY_NOTIFY_AUTH_TOKEN" \
  -d '{"network":"ETH_MAINNET","webhook_type":"ADDRESS_ACTIVITY","webhook_url":"https://example.com/webhook","addresses":["0x00000000219ab540356cbb839cbe05303d7705fa"]}'
```

### Verify Webhook Signature (Node)
```ts
import crypto from "crypto";

export function verify(rawBody: string, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}
```

## Network Naming Rules
- Data APIs and JSON-RPC use lowercase network enums like `eth-mainnet`.
- Notify API uses uppercase enums like `ETH_MAINNET`.

## Pagination + Limits (Cheat Sheet)
| Endpoint | Limit | Notes |
| --- | --- | --- |
| `alchemy_getTokenBalances` | `maxCount` <= 100 | Use `pageKey` for pagination. |
| `alchemy_getAssetTransfers` | `maxCount` default `0x3e8` | Use `pageKey` for pagination. |
| Portfolio token balances | 3 address/network pairs, 20 networks total | `pageKey` supported. |
| Portfolio NFTs | 2 address/network pairs, 15 networks each | `pageKey` supported. |
| Prices by address | 25 addresses, 3 networks | POST body `addresses[]`. |
| Transactions history (beta) | 1 address/network pair, 2 networks | ETH and BASE mainnets only. |

## Common Token Addresses
| Token | Chain | Address |
| --- | --- | --- |
| ETH | ethereum | `0x0000000000000000000000000000000000000000` |
| WETH | ethereum | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` |
| USDC | ethereum | `0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eB48` |
| USDC | base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

## Failure Modes + Retries
- HTTP `429` means rate limit. Use exponential backoff with jitter.
- JSON-RPC errors come in `error` fields even with HTTP 200.
- Use `pageKey` to resume pagination after failures.
- De-dupe websocket events on reconnect.

## Skill Map

For the complete index of all 82+ reference files organized by product area (Node, Data, Webhooks, Solana, Wallets, Rollups, Recipes, Operational, Ecosystem), see `references/skill-map.md`.

Quick category overview:
- **Node**: JSON-RPC, WebSocket, Debug, Trace, Enhanced APIs, Utility
- **Data**: NFT, Portfolio, Prices, Simulation, Token, Transfers
- **Webhooks**: Address Activity, Custom (GraphQL), NFT Activity, Payloads, Signatures
- **Solana**: JSON-RPC, DAS, Yellowstone gRPC (streaming), Wallets
- **Wallets**: Account Kit, Bundler, Gas Manager, Smart Wallets
- **Rollups**: L2/L3 deployment overview
- **Recipes**: 10 end-to-end integration workflows
- **Operational**: Auth, Rate Limits, Monitoring, Best Practices
- **Ecosystem**: viem, ethers, wagmi, Hardhat, Foundry, Anchor, and more

## Troubleshooting

### API key not working
- Verify `$ALCHEMY_API_KEY` is set: `echo $ALCHEMY_API_KEY`
- Confirm the key is valid at [dashboard.alchemy.com](https://dashboard.alchemy.com/)
- Check if allowlists restrict the key to specific IPs/domains (see `references/operational-allowlists.md`)

### HTTP 429 (Rate Limited)
- Use exponential backoff with jitter before retrying
- Check your compute unit budget in the Alchemy dashboard
- See `references/operational-rate-limits-and-compute-units.md` for limits per plan

### Wrong network slug
- Data APIs and JSON-RPC use lowercase: `eth-mainnet`, `base-mainnet`
- Notify API uses uppercase: `ETH_MAINNET`, `BASE_MAINNET`
- See `references/operational-supported-networks.md` for the full list

### JSON-RPC error with HTTP 200
- Alchemy returns JSON-RPC errors inside the `error` field even with a 200 status code
- Always check `response.error` in addition to HTTP status

## Official Links
- [Developer docs](https://www.alchemy.com/docs)
- [Get Started guide](https://www.alchemy.com/docs/get-started)
- [Create a free API key](https://www.dashboard.alchemy.com)
