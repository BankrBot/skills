---
name: opensea-tool-sdk
description: Build, register, and gate AI-callable tool endpoints using the OpenSea Tool Registry (ERC-8257) on Base. Scaffold HTTPS tools with JSON Schema interfaces, register them onchain, gate access via NFT ownership, subscriptions, trait gating, or x402 pay-per-call (USDC), and call gated tools. For querying OpenSea marketplace data use opensea-api instead.
homepage: https://github.com/ProjectOpenSea/tool-sdk
repository: https://github.com/ProjectOpenSea/tool-sdk
license: MIT
env:
  OPENSEA_API_KEY:
    description: API key for OpenSea REST API (tool discovery endpoints)
    required: false
    obtain: https://docs.opensea.io/reference/api-keys#instant-api-key-for-agents
  PRIVATE_KEY:
    description: Wallet private key for onchain registration and tool calls
    required: false
  RPC_URL:
    description: RPC URL for Base mainnet (default https://mainnet.base.org)
    required: false
dependencies:
  - node >= 18.0.0
---

# OpenSea Tool SDK

Build, register, and gate AI-callable tool endpoints using the OpenSea Tool Registry (ERC-8257) on Base.

## When to use this skill (`scope_in`)

Use `opensea-tool-sdk` when you need to:

- Scaffold an AI-callable tool endpoint (HTTPS, JSON Schema, `.well-known` manifest) for Vercel, Cloudflare, or Express
- Register a tool onchain on the Base ToolRegistry so other agents can discover it
- Gate access via x402 pay-per-call (USDC) or predicates (ERC-721/ERC-1155 ownership, subscriptions, trait gating, ERC-20 balance, composites)
- Call a gated tool: EIP-3009 auth (`eip3009AuthenticatedFetch`), 402 payments (`paidFetch`), or both (`paidAuthenticatedFetch`)
- Search and discover registered tools via the OpenSea REST API

## When NOT to use this skill (`scope_out`, handoff)

| Need | Use instead |
|---|---|
| Query NFT/token data, search, collection stats | `opensea-api` |
| Buy/sell NFTs | `opensea-marketplace` |
| Swap ERC20 tokens | `opensea-swaps` |
| Set up wallet signing providers | `opensea-wallet` |

This SDK is for tool *providers and consumers*. To query OpenSea marketplace data (floor prices, listings, trades), use the [`opensea-api`](../opensea-api/SKILL.md) skill instead.

## Concepts

| Term | Meaning |
|------|---------|
| **Tool** | An HTTPS endpoint with a JSON Schema interface, discoverable via `/.well-known/ai-tool/<slug>.json` |
| **Manifest** | JCS-canonicalized JSON describing the tool's name, endpoint, inputs, outputs, pricing, and access policy |
| **ToolRegistry** | Onchain contract (Base) where tools are registered with a manifest hash and optional access predicate |
| **Access Predicate** | An `IAccessPredicate` contract that gates who can invoke a tool (NFT ownership, subscriptions, trait gating, ERC-20 balance, composites) |
| **x402** | HTTP 402-based pay-per-call protocol (caller signs a USDC `TransferWithAuthorization`; server settles after execution) |
| **EIP-3009 auth** | Zero-value USDC `TransferWithAuthorization` signature used to authenticate callers for predicate-gated tools |
| **Facilitator** | Third-party service that verifies and settles x402 payments (PayAI or Coinbase CDP) |

## Deployed Contracts (Ethereum mainnet, Base, Shape, Abstract)

Canonical v0.2 deployments — identical CREATE2 address on every supported chain.

| Contract | Address |
|----------|---------|
| ToolRegistry (v0.2) | `0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1` |
| ERC721OwnerPredicate (v0.2) | `0xc8721c9A776958FfFfEb602DA1b708bf1D318379` |
| ERC1155OwnerPredicate (v0.2) | `0x77373Dc3c1AE9A1e937eF3e5E08F4807D47c7c11` |
| SubscriptionPredicate (v0.2) | `0xCBe0cd9B1d99d95Baa9c58f2767246C52e461f25` |
| TraitGatedPredicate (v0.2) | `0x10abF07CfA34Bf22372C57f27e8bd9C2DCF93fA1` |
| ERC20BalancePredicate (v0.2) | `0x1a834FC48B5f6e119c62C12a98b32137bCFA77cD` |

## Tool Discovery [Beta]

Search or look up registered tools via the OpenSea REST API. Requires `OPENSEA_API_KEY`.

```bash
# Get an instant free-tier API key (no signup needed — 60/min read, 5/min write, 30-day expiry)
export OPENSEA_API_KEY=$(curl -s -X POST https://api.opensea.io/api/v2/auth/keys | jq -r '.api_key')
```

For higher rate limits, create a full key at [Settings → Developer](https://docs.opensea.io/reference/api-keys).

**Search tools:** `GET /api/v2/tools/search` ([docs](https://docs.opensea.io/reference/search_tools))

| Parameter | Required | Description |
|-----------|----------|-------------|
| `query` | No | Search query text |
| `registry_chain` | No | Filter by registry chain ID |
| `tags` | No | Filter by tags |
| `access_type` | No | Filter by access type: `open`, `nft_gated`, `subscription` |
| `creator` | No | Filter by creator address |
| `sort_by` | No | Sort by: `relevance` (default), `newest`, `most_used` |
| `limit` | No | Results per page (1–200) |
| `cursor.value` | No | Pagination cursor |

**Get a tool:** `GET /api/v2/tools/{registry_chain}/{registry_addr}/{tool_id}` ([docs](https://docs.opensea.io/reference/get_tool))

| Parameter | Required | Description |
|-----------|----------|-------------|
| `registry_chain` | Yes | Registry chain ID (e.g. `1`, `8453`) |
| `registry_addr` | Yes | Registry contract address |
| `tool_id` | Yes | Numeric tool ID |

```bash
# Search tools by keyword
curl -s "https://api.opensea.io/api/v2/tools/search?query=nft" \
  -H "x-api-key: $OPENSEA_API_KEY" | jq

# Get a specific tool on Base
curl -s "https://api.opensea.io/api/v2/tools/8453/0x265BB2DBFC0A8165C9A1941Eb1372F349baD2cf1/1" \
  -H "x-api-key: $OPENSEA_API_KEY" | jq

# Filter by access type
curl -s "https://api.opensea.io/api/v2/tools/search?access_type=open&limit=10" \
  -H "x-api-key: $OPENSEA_API_KEY" | jq
```

## 1. Create a Tool

### 1a. Scaffold a project

```bash
npx @opensea/tool-sdk init --runtime vercel   # or: cloudflare, express
```

This generates:
- `src/manifest.ts` — tool manifest definition
- `src/handler.ts` — request handler with input/output schemas
- `api/index.ts` — framework adapter entry point
- `public/llms.txt` — agent-readable discovery page
- `api/well-known/[slug].ts` — serves the manifest at `/.well-known/ai-tool/<slug>.json`

### 1b. Define the manifest

```typescript
import { defineManifest } from "@opensea/tool-sdk"

export const manifest = defineManifest({
  name: "My Tool",
  description: "What this tool does",
  endpoint: "https://my-tool.example.com/api",
  creatorAddress: "0xYOUR_WALLET_ADDRESS",
  inputs: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
    },
    required: ["query"],
  },
  outputs: {
    type: "object",
    properties: {
      result: { type: "string" },
    },
  },
  // Optional: add pricing for x402 paywall (see references/x402.md)
  // pricing: paywall.pricing,
  // Optional: add access requirements (see references/predicate-gating.md)
  // access: { logic: "OR", requirements: [...] },
})
```

### 1c. Write the handler

```typescript
import { createToolHandler } from "@opensea/tool-sdk"
import { z } from "zod/v4"
import { manifest } from "./manifest.js"

const InputSchema = z.object({ query: z.string() })
const OutputSchema = z.object({ result: z.string() })

export const toolHandler = createToolHandler({
  manifest,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  // gates: [],  // Add gates here (see references/x402.md and references/predicate-gating.md)
  handler: async (input) => {
    return { result: `Processed: ${input.query}` }
  },
})
```

### 1d. Wire up the adapter

**Vercel:**
```typescript
import { toVercelHandler } from "@opensea/tool-sdk"
import { toolHandler } from "../src/handler.js"
export default toVercelHandler(toolHandler)
```

**Express:**
```typescript
import { toExpressHandler } from "@opensea/tool-sdk"
import { toolHandler } from "./handler.js"
app.post("/api", toExpressHandler(toolHandler))
```

**Cloudflare Workers:**
```typescript
import { toolHandler } from "./handler.js"
export default { fetch: toolHandler }
```

## 2. Register a Tool Onchain

### 2a. Via CLI

```bash
# Set up wallet
export PRIVATE_KEY=0x...
export RPC_URL=https://mainnet.base.org

# Register (open access — no predicate)
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base

# Register with an access predicate
npx @opensea/tool-sdk register \
  --metadata https://my-tool.example.com/.well-known/ai-tool/my-tool.json \
  --network base \
  --access-predicate 0xPREDICATE_ADDRESS

# Dry run (no transaction)
npx @opensea/tool-sdk register --metadata ... --network base --dry-run
```

The CLI:
1. Fetches the manifest from `--metadata` URL
2. Validates the manifest schema
3. Verifies `manifest.creatorAddress` matches your wallet
4. Computes the JCS keccak256 manifest hash
5. Calls `ToolRegistry.registerTool(metadataURI, manifestHash, accessPredicate)`
6. Returns the `toolId` from the `ToolRegistered` event

### 2b. Via SDK (programmatic)

```typescript
import { ToolRegistryClient, computeManifestHash } from "@opensea/tool-sdk"
import { createWalletFromEnv, walletAdapterToClient } from "@opensea/tool-sdk"
import { base } from "viem/chains"

const adapter = createWalletFromEnv()
const walletClient = await walletAdapterToClient(adapter, base)

const registry = new ToolRegistryClient({
  chain: base,
  rpcUrl: "https://mainnet.base.org",
  walletClient,
})

const { toolId, txHash } = await registry.registerTool({
  metadataURI: "https://my-tool.example.com/.well-known/ai-tool/my-tool.json",
  manifest,                                      // your ToolManifest object
  accessPredicate: "0x0000...0000",              // address(0) = open access
})

console.log(`Registered tool ${toolId} in tx ${txHash}`)
```

## 3. Gating tool access

Tools can be gated three ways:

| Gate | Mechanism | Reference |
|------|-----------|-----------|
| **x402 paywall** | Pay-per-call (USDC, EIP-3009) | [`references/x402.md`](references/x402.md) |
| **Predicate gate** | Onchain check (NFT, subscription, trait gating, ERC-20 balance, composite) | [`references/predicate-gating.md`](references/predicate-gating.md) |
| **Combined** | EIP-3009 auth and payment (predicate first, then x402) | [`references/predicate-gating.md`](references/predicate-gating.md) |

For deployed predicate addresses, requirement encodings, and SDK helpers like `describeToolAccess` / `decodeRequirement`, see [`references/known-predicates.md`](references/known-predicates.md).

## 4. Wallet Setup

The SDK supports multiple wallet providers via `@opensea/wallet-adapters`. Set environment variables and the SDK auto-detects the provider. See the [`opensea-wallet`](../opensea-wallet/SKILL.md) skill for the full provider table, env vars, setup walkthroughs, and signing-policy configuration.

| Provider | Env vars | Best for |
|----------|----------|----------|
| Private Key | `PRIVATE_KEY`, `RPC_URL` | Local dev, scripts |
| Privy | `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_WALLET_ID` | Server wallets |
| Turnkey | `TURNKEY_API_PUBLIC_KEY`, `TURNKEY_API_PRIVATE_KEY`, `TURNKEY_ORGANIZATION_ID` | Enterprise signing |
| Fireblocks | `FIREBLOCKS_API_KEY`, `FIREBLOCKS_API_SECRET`, `FIREBLOCKS_VAULT_ACCOUNT_ID` | Institutional custody |
| Bankr | `BANKR_API_KEY` | Agent wallets (via HTTP API) |

```typescript
import { createWalletFromEnv } from "@opensea/tool-sdk"

// Auto-detects: Privy > Fireblocks > Turnkey > Bankr > PrivateKey
const adapter = createWalletFromEnv()
const address = await adapter.getAddress()
```

For Bankr (external signer):

```typescript
import { createBankrAccount } from "@opensea/tool-sdk"

const account = await createBankrAccount("your-bankr-api-key")
// Use with eip3009AuthenticatedFetch or paidAuthenticatedFetch
```

## 5. Response Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse the JSON body per the manifest's `outputs` schema |
| 400 | Invalid input | Fix request body to match the manifest's `inputs` schema |
| 401 | Missing/invalid auth | Sign an EIP-3009 zero-value authorization and include `Authorization: EIP-3009 <token>` |
| 402 | Payment required | Read `body.accepts[0]` for payment requirements, sign and retry with `X-Payment` |
| 403 | Access denied | Inspect `body.predicate` to discover what's needed; acquire the required token/subscription |
| 405 | Method not allowed | Use POST |
| 500 | Internal tool error | Retry or contact the tool creator |
| 502 | Predicate/facilitator error | The upstream predicate or payment facilitator misbehaved; retry later |

## 6. Quick Reference: CLI Commands

| Command | Purpose |
|---------|---------|
| `init` | Scaffold a new tool project |
| `validate` | Validate a manifest file |
| `hash` | Compute the JCS keccak256 hash of a manifest |
| `export` | Export the manifest as JSON |
| `register` | Register a tool onchain. Supports `--nft-gate`, `--erc20-gate` + `--erc20-min-balance`, or `--predicate-config` to bundle predicate setup with registration |
| `update-metadata` | Update a tool's metadata URI and manifest hash onchain |
| `inspect` | Look up a tool's onchain config by ID |
| `verify` | Verify a manifest against its onchain hash |
| `deploy` | Deploy a tool to Vercel |
| `auth` | Call a predicate-gated tool (EIP-3009) |
| `pay` | Call an x402-paid tool (USDC), with optional `--auth` for predicate-gated endpoints |
| `smoke` | Auto-detect gate type and call |
| `dry-run-gate` | Simulate an x402 gate check locally |
| `dry-run-predicate-gate` | Simulate a predicate gate check locally |
| `set-collections` | Set ERC-721 collection gate list for a tool |
| `get-collections` | Read ERC-721 collection gate list for a tool |
| `set-collection-tokens` | Set ERC-1155 collection + token ID gate for a tool |
| `configure-subscription` | Configure SubscriptionPredicate gate (collection + minTier) for a tool |
| `configure-trait-gating` | Configure TraitGatedPredicate gate (collection, traits contract, trait key, allowed values) for a tool |
| `get-trait-config` | Read trait gating configuration for a tool |
| `configure-erc20-gate` | Configure ERC20BalancePredicate gate (token, minBalance) for a tool |
| `get-erc20-config` | Read ERC-20 balance gating configuration for a tool |

All CLI commands accept `--wallet-provider privy|turnkey|fireblocks|private-key` or auto-detect from env vars.

## 7. Usage Tracking

Tool-sdk supports usage tracking via the `onInvocation` callback on `createToolHandler`. This fires after every successful invocation (post-settle, pre-response) with an `InvocationEvent` containing caller identity, payment status, and timing.

### createEip3009UsageReporter (recommended)

`createEip3009UsageReporter` is the recommended `onInvocation` implementation. It reports tool usage via EIP-3009 zero-value `TransferWithAuthorization` signatures:

- **Free / gated calls**: signs a zero-value authorization proving the operator controls the wallet, and POSTs with `verification_type: "eip3009_authorization"`.
- **Paid x402 calls**: POSTs with `verification_type: "x402_settlement"` and the settlement tx hash — no additional signature needed.

```typescript
import { createToolHandler, createEip3009UsageReporter } from "@opensea/tool-sdk"
import { createWalletClient, http } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

const walletClient = createWalletClient({
  account: privateKeyToAccount("0x..."),
  chain: base,
  transport: http(),
})

export const toolHandler = createToolHandler({
  manifest,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  onInvocation: createEip3009UsageReporter({
    walletClient,
    chainId: 8453,
    // optional: aggregatorUrl, tokenAddress, toolSlug, timeoutMs
  }),
  handler: async (input) => {
    return { result: `Processed: ${input.query}` }
  },
})
```

### onInvocation callback

You can also provide a custom `onInvocation` callback for bespoke analytics:

```typescript
import { createToolHandler } from "@opensea/tool-sdk"
import type { InvocationEvent } from "@opensea/tool-sdk"

export const toolHandler = createToolHandler({
  manifest,
  inputSchema: InputSchema,
  outputSchema: OutputSchema,
  onInvocation: (event: InvocationEvent) => {
    // event.callerAddress — verified caller wallet
    // event.paid          — whether x402 payment settled
    // event.toolName      — resolved tool name from manifest
    // event.latencyMs     — handler execution time
    // event.timestamp     — invocation timestamp
  },
  handler: async (input) => {
    return { result: `Processed: ${input.query}` }
  },
})
```

## 8. End-to-End Examples

### Example A: Free open-access tool

```bash
# 1. Scaffold
npx @opensea/tool-sdk init --runtime vercel
# 2. Edit src/manifest.ts and src/handler.ts with your logic
# 3. Deploy
npx @opensea/tool-sdk deploy
# 4. Register (open access)
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --network base
# 5. Call
curl -X POST https://my-tool.vercel.app/api \
  -H "Content-Type: application/json" \
  -d '{"query": "hello"}'
```

### Example B: x402 paid tool (pay-per-call only, no identity check)

```bash
# Server: add paywall gate (see references/x402.md)
# Call via CLI:
PRIVATE_KEY=0x... npx @opensea/tool-sdk pay \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example C: NFT-gated tool (identity check, no payment)

```bash
# Register with ERC721OwnerPredicate
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --network base \
  --nft-gate 0xYOUR_COLLECTION_ADDRESS

# Configure which collection(s) gate the tool (if not using --nft-gate):
npx @opensea/tool-sdk set-collections <TOOL_ID> 0xYOUR_COLLECTION_ADDRESS \
  --network base

# Server: add predicateGate (see references/predicate-gating.md)

# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk auth \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example D: Subscription-gated tool

```bash
# Register with SubscriptionPredicate and configure in one shot:
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --access-predicate 0xCBe0cd9B1d99d95Baa9c58f2767246C52e461f25 \
  --predicate-config '{"collection":"0xYOUR_SUBSCRIPTION_NFT","minTier":0}' \
  --network base

# Or configure after registration:
npx @opensea/tool-sdk configure-subscription <TOOL_ID> 0xYOUR_SUBSCRIPTION_NFT \
  --min-tier 0 --network base

# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk auth \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example E: ERC-20 balance-gated tool

```bash
# Register with ERC20BalancePredicate and configure in one shot:
PRIVATE_KEY=0x... npx @opensea/tool-sdk register \
  --metadata https://my-tool.vercel.app/.well-known/ai-tool/my-tool.json \
  --network base \
  --erc20-gate 0xTOKEN_ADDRESS --erc20-min-balance 1000000000000000000

# Or configure after registration:
npx @opensea/tool-sdk configure-erc20-gate <TOOL_ID> 0xTOKEN_ADDRESS 1000000000000000000 \
  --network base

# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk auth \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

### Example F: NFT-gated + paid tool (both gates)

```bash
# Server: add both predicateGate and paywall.gate (see references/predicate-gating.md)
# Call via CLI:
PRIVATE_KEY=0x... RPC_URL=https://mainnet.base.org \
  npx @opensea/tool-sdk pay --auth \
  https://my-tool.vercel.app/api \
  --body '{"query": "hello"}'
```

## References

- [`references/x402.md`](references/x402.md): pay-per-call protocol, server-side paywall, `paidFetch`
- [`references/predicate-gating.md`](references/predicate-gating.md): EIP-3009-based access control, combined gates
- [`references/known-predicates.md`](references/known-predicates.md): deployed predicate contracts and SDK helpers
- [Tool SDK GitHub](https://github.com/ProjectOpenSea/tool-sdk)
