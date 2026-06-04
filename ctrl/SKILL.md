---
name: ctrl
description: Build on-chain automation workflows on Base or Ethereum via the CTRL MCP. Use for recurring / triggered / scheduled actions — DCA, price-triggered swaps, launchpad sniping (Clanker / Flaunch / Zora / BANKR), whale watching, balance alerts. Triggers on mentions of "automate", "schedule", "trigger when", "snipe new launches", "DCA", "watch wallet", "vault", or any workflow that should run autonomously after the user signs once. The user signs ONCE via EIP-5792; the CTRL keeper executes every trigger after, bounded by per-swap and per-day caps the user signed.
license: MIT
compatibility: Requires network access. No API key needed for the REST path (anonymous-friendly; security boundary is the wallet signature at activate-time). Bearer sk_ctrl_... only required for the JSON-RPC MCP server path (Cursor / Claude Desktop config). Works across Claude.ai, Claude Code, and any MCP-capable agent (Bankr, Cursor, Codex, Hermes, Aeon).
metadata:
  author: CTRLabs
  version: "1.0"
---

# CTRL: Visual Workflow Automation for DeFi

## Overview

CTRL is a workflow automation platform for on-chain actions. Users compose **trigger → action → condition** graphs in a visual builder; an audited V3 vault enforces per-swap and per-day spending caps; a Render-hosted keeper polls every ~5 seconds and executes when conditions are met. The user signs **once** to deploy the vault + register rules, and everything else runs autonomously under on-chain limits they pre-authorized.

Two integration pathways:

1. **REST API** — direct HTTP, **no API key required**. Recommended for wallet-native clients where the agent has access to the user's wallet.
2. **Streamable MCP server** at `https://ctrl.build/api/mcp` — JSON-RPC, requires `Bearer sk_ctrl_...`. Used by Cursor / Claude Desktop.

The REST path is anonymous-friendly because the security boundary is the wallet signature at activate-time, not an API key at create-time. The first wallet to sign the EIP-5792 activation batch becomes the workflow's owner. Drafts that never get activated are auto-pruned.

## Trust boundary

- **The user's wallet signs.** Vault activation is an EIP-5792 `transactions[]` batch — one user signature deploys the V13 vault and registers the spending rules. The wallet's confirmation UI is the source of intent; agents never hold keys.
- **CTRL executes.** After the signature lands, the keeper takes over forever. Every execution is bounded by the `maxPerSwap` and `maxPerDay` caps the user signed.

The natural agent flow:

1. User says "DCA 0.01 ETH into USDC every Monday at 14:00 UTC."
2. Agent calls `ctrl_get_block_catalog` to discover the right block ids.
3. Agent calls `ctrl_create_workflow` with the trigger + action chain.
4. Agent calls `ctrl_activate` — gets back a `transactions[]` batch.
5. Agent hands the batch to the user's wallet (via `send_calls` / `send_prepared_calls` / Base Account / any EIP-5792-capable wallet). User confirms in the wallet popup.
6. Keeper picks up on the next 5-second tick.

## Getting Started

### For wallet-native agents — zero setup

Add `ctrl.build` to your client's web-request allowlist (if it has one) and you're done. No API keys, no env vars, no minting flow. The agent invokes CTRL REST endpoints directly; the user's wallet handles the signature at activate-time, which is what binds the workflow.

### For Cursor / Claude Desktop (optional, advanced)

If you want to call the JSON-RPC MCP server instead of REST:

```json
{
  "ctrl": {
    "command": "npx",
    "args": ["-y", "mcp-remote", "https://ctrl.build/api/mcp",
             "--header", "Authorization:Bearer ${CTRL_API_KEY}"],
    "env": { "CTRL_API_KEY": "sk_ctrl_..." }
  }
}
```

Mint a key at [ctrl.build/settings/api-keys](https://ctrl.build/settings/api-keys). The REST path described below remains anonymous and is the right choice for wallet-native clients.

## Core MCP Tools

| Tool | Purpose |
|------|---------|
| `ctrl_get_vault_status` | Read the user's vault address, ETH + WETH balance, active rules. Call **before** activate so you can tell the user how much to fund. |
| `ctrl_get_block_catalog` | Return the live catalog of every block (trigger / action / condition / utility) with config-field schemas. Pass `chain` to filter to chain-compatible blocks. |
| `ctrl_create_workflow` | Create a workflow draft. One trigger + up to 20 actions/conditions/utilities. Returns `{ workflowId, activateUrl }`. |
| `ctrl_activate` | Encode the EIP-5792 `transactions[]` batch the user signs once. Returns calls + chainId for the wallet's `send_calls`-style handoff. |
| `ctrl_fire_manual` | Manually fire a workflow once. Keeper picks up within ~5s. Use to test without waiting for the natural trigger. |
| `ctrl_get_execution_logs` | Read recent executions: trigger, status, BaseScan/Etherscan tx hash, gas, timing. |

## Available Blocks

CTRL exposes 23 blocks via `GET /api/mcp/block-catalog` across four categories. Always call this first — every key in `trigger.config` and `chain[].config` must match catalog `fields[].key` exactly.

**Triggers (9)** — `time.interval`, `trigger.manual`, `price.above`, `price.below`, `price.change`, `pool.created` (Base launchpads: Clanker / Flaunch / Zora / BANKR), `watch.whale`, `event.transfer`, `event.balance`

**Actions (5)** — `cypher.swap`, `read.balance`, `notify.telegram`, `notify.discord`, `util.webhook`

**Conditions (4)** — `cond.price`, `cond.balance`, `cond.allowed_weekdays`, `cond.time_window`

**Utilities (5)** — `util.delay`, `util.note`, `util.log`, `util.stop`, `util.snapshot`

## Chain Selection

`ctrl_create_workflow` accepts `targetChain: "base" | "ethereum"`. Default is `base`.

- **Base mainnet** — launchpads (`pool.created`), Aerodrome routing, UniV4 hooks. Lowest fees.
- **Ethereum mainnet** — UniV3 routing only. No launchpads (`pool.created` returns 400 if `targetChain="ethereum"`). Tighter mainnet fee caps.

Activation deeplinks resolve to the correct chain automatically — the workflow row carries `chain` and `network`, the encoder reads them.

## REST API (anonymous, no key)

```bash
# 1. Create a workflow — NO auth header. The row is anonymous until claimed
#    at activate-time by the signing wallet.
curl -X POST https://ctrl.build/api/mcp/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "DCA ETH→USDC weekly",
    "workflow_data": { "nodes": [...], "edges": [...] },
    "chain": "base",
    "network": "mainnet"
  }'
# → { "workflow": { "id": "<uuid>", "name": "...", "status": "draft", "created_at": "..." } }

# 2. Encode the activation batch — pass the user's wallet via headers
#    (X-Wallet-Address + a signature from the user's wallet).
curl -X POST https://ctrl.build/api/mcp/activate/<workflowId> \
  -H "Content-Type: application/json" \
  -H "X-Wallet-Address: 0x..." \
  -H "X-Wallet-Signature: 0x..." \
  -d '{ "maxPerSwapEth": "0.01", "maxPerDayEth": "0.1", "depositEth": "0.05" }'
# → { "calls": [...], "chainId": 8453, "vaultAddress": "0x..." }

# 3. Hand the calls + chainId directly to the user's wallet via its
#    EIP-5792 send_calls / send_prepared_calls flow.

# 4. Read public state — vault status by wallet, no auth needed:
curl "https://ctrl.build/api/mcp/vault-status?wallet=0x..."

# 5. Read execution logs by workflow id (public — anyone with the id can see):
curl "https://ctrl.build/api/mcp/execution-logs?workflow_id=<id>"
```

The wallet signature in step 2 is what binds the workflow to the user. First signer wins; subsequent activate calls from other wallets get `403`.

## Rate Limits

All limits are per source IP, enforced via a Supabase-backed counter so they're shared across every serverless instance.

- **`POST /api/mcp/workflows`** (create) — 10 per 10 minutes
- **`POST /api/mcp/activate/<id>`** (prepare activation batch) — 5 per 10 minutes
- **`GET /api/mcp/vault-status`** — 60 per minute
- **`GET /api/mcp/execution-logs`** — 60 per minute
- **`GET /api/mcp/block-catalog`** — unrestricted (cached, cheap)

`429` responses carry `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

## Security Architecture

CTRL implements a **vault-direct model** — no session keys, no agent-held credentials:

**On-chain caps** — Every rule the user signs carries an immutable `maxPerSwap` and `maxPerDay`. The vault enforces them; no off-chain check can be bypassed.

**Kill switches** — `pauseVault()` halts all execution; `revokeRule(ruleId)` kills a single workflow. Both are 1-tx, user-callable any time.

**Built-in safety primitives** — The `pool.created` trigger has a `safetyEnabled` flag that runs GoPlus honeypot + tax + score checks before any swap fires. Honeypots and high-tax tokens are auto-rejected without an execution log entry.

**Keeper bounded** — The 8-wallet keeper fleet can only call methods the vault permits. Compromising a keeper wallet costs at most one tick's per-swap cap, not the vault.

## Example Flows

### DCA ETH → USDC every Monday 14:00 UTC

```
trigger: time.interval (everyMinutes=10080, alignedTo="monday-14:00-utc")
action:  cypher.swap (tokenIn="ETH", tokenOut="USDC", amount="0.01", slippage=5)
```

### Snipe Flaunch launches with "milady" in the name, max 0.005 ETH, sell at 2x

```
trigger: pool.created (launchpad=["flaunch"], keywordIncludes="milady",
                       safetyEnabled=true, safetyMinScore=50)
action:  cypher.swap (tokenIn="ETH", tokenOut="{{trigger.tokenAddress}}",
                      tokenOutMode="dynamic", amount="0.005", slippage=15,
                      autoSellEnabled=true, autoSellMode="multiple",
                      autoSellMultiplier=2, autoSellPercent=100,
                      autoSellReceiveToken="USDC")
action:  notify.telegram (message="bought {{token}}, sell-at-2x armed")
```

### Sell 50% of $PEPE if price drops 20%

```
trigger: price.change (token="PEPE", changePercent=-20, window="1h")
action:  cypher.swap (tokenIn="PEPE", tokenOut="USDC",
                      amountMode="percent", amountPercent=50, slippage=10)
```

## What the Agent Will NOT Do

- Hold private keys. Activation always returns an unsigned batch the user signs in their own wallet.
- Widen caps without re-prompting. `maxPerSwap` and `maxPerDay` changes require a new signature.
- Execute on a chain the user didn't pick. `targetChain` is mandatory at create-time.
- Override safety flags. `safetyEnabled: false` requires an explicit user confirmation in the create flow.

## Resources

- **App** — https://ctrl.build
- **Docs** — https://ctrl.build/docs
- **API key dashboard** — https://ctrl.build/settings/api-keys
- **MCP hub** — https://ctrl.build/mcp
- **Verified contracts on BaseScan:**
  - V13 Vault Factory — https://basescan.org/address/0x5Df25e79efd7f9dc86841b404b3EA6F4b7951DBB
  - Vault Implementation — https://basescan.org/address/0x48d16fe4d11499E6714840e101943F0f2FDacB5a
  - TimelockBeacon — https://basescan.org/address/0x5760A6D62743860F27843fA314E22166dBEF7d73
