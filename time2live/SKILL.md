---
name: time2live
description: Autonomous agent scheduling, webhook cron triggers, liveness heartbeats, and on-chain dead man's switch via time2live.xyz. Allows wallet-free agents to be scheduled and monitored externally with x402-funded execution.
recommended-models: [claude-3-7-sonnet, gpt-4o, gemini-2.5-pro]
---

# time2live Bankr Skill

Agent scheduling, liveness monitoring, and on-chain dead man's switch via [time2live.xyz](https://time2live.xyz).

Enables autonomous scheduling where a funder wallet (e.g. Bankr) pays for time2live credits via x402 (USDC on Base), while target worker agents receive scheduled HTTP webhook triggers without needing their own wallets, private keys, or API tokens.

## Architecture

```
Funder Wallet (Bankr)
  │
  │  Purchases credits via x402 (USDC on Base)
  ▼
time2live.xyz Engine
  │
  │  Executes Cron & One-off jobs: POST https://worker-agent.example.com/webhook
  │  Delivers signed payload (HMAC-SHA256, t2l-signature header)
  ▼
Worker Agent (Cloudflare Worker, VPS, Lambda, GitHub Actions)
  │
  │  Receives HTTP webhook → executes task
  │  Zero crypto wallet, zero keys, zero cost to the worker
  ▼
Task Completed
```

## Quick Reference

| Resource | URL / Address |
|---|---|
| Web Platform | https://time2live.xyz |
| API Base | https://time2live.xyz |
| Remote MCP Server | https://time2live.xyz/mcp |
| MCP Server Card | https://time2live.xyz/.well-known/mcp/server-card.json |
| OpenAPI 3.1 Spec | https://time2live.xyz/openapi.json |
| Agent Guide | https://time2live.xyz/llms.txt |
| GitHub Source | https://github.com/MeMikko/TTL (AGPLv3) |
| Base Switch Factory | `0x3d7ce7c30b712bc070ba1ea2918bd2211ad4349a` (Base) |
| T2L Ecosystem Token | `0xf5d3a3806240bf58234b5e973c991a5428ef5ba3` (Base) |
| Receipt Verification Key | https://time2live.xyz/.well-known/time2live-receipts.json |

---

## Authentication & Setup

time2live uses EIP-4361 Sign-In with Ethereum. The user signs an EIP-191 challenge with their EVM wallet.

### 1. Challenge & Registration Flow

Step 1 — Request challenge:
```http
POST https://time2live.xyz/v1/auth/challenge
Content-Type: application/json

{"address":"0x...","chainId":8453}
```
Returns: `{"nonce":"...","message":"...","expiresAt":"..."}`

Step 2 — Sign the challenge `message` with the wallet (`personal_sign`).

Step 3 — Submit signature:
```http
POST https://time2live.xyz/v1/auth/verify
Content-Type: application/json

{"message":"<the signed challenge message>","signature":"0x..."}
```
Returns: `{"accountId":"...","address":"...","created":true|false,"apiKey":{"key":"t2l_...","id":"key_...","prefix":"t2l_..."}}`

Step 4 — Store `apiKey.key` as `T2L_API_KEY` in Bankr:
Terminal sidebar → "Advanced" → "Env Vars" → add `T2L_API_KEY`.

---

## MCP Server Configuration

time2live exposes a remote streamable HTTP MCP server at `https://time2live.xyz/mcp`.

Configure in Bankr or MCP client:
```json
{
  "mcpServers": {
    "time2live": {
      "type": "http",
      "url": "https://time2live.xyz/mcp",
      "headers": {
        "Authorization": "Bearer {{env.T2L_API_KEY}}"
      }
    }
  }
}
```

Available MCP tools:
- `register_challenge` / `register`: EIP-4361 sign-in
- `create_job` / `list_jobs` / `trigger_job` / `delete_job`: Cron & one-off webhooks
- `create_heartbeat` / `list_monitors` / `ping`: Liveness tracking
- `get_status` / `activate` / `buy_credits`: Billing and account monitoring

---

## Core Workflows

All REST endpoints require `Authorization: Bearer {{env.T2L_API_KEY}}`.

### 1. Scheduled Webhook Jobs (Wake Agents Without Wallets)

Trigger any HTTP endpoint on a cron schedule. The receiving agent does not need an account or wallet.

```http
POST https://time2live.xyz/v1/jobs
Authorization: Bearer {{env.T2L_API_KEY}}
Content-Type: application/json

{
  "name": "market-analyzer-cron",
  "schedule": {
    "type": "cron",
    "expression": "0 */4 * * *",
    "timezone": "UTC"
  },
  "target": {
    "url": "https://my-agent.example.com/webhook",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": "{\"task\":\"analyze-markets\",\"mode\":\"full\"}"
  },
  "timeoutMs": 10000,
  "maxAttempts": 3
}
```

#### Verifying Incoming Deliveries
Each HTTP POST from time2live contains:
- `t2l-job-id`: Job identifier
- `t2l-delivery-id`: Execution run ID
- `t2l-event`: `job.run`
- `t2l-attempt`: Delivery attempt number
- `t2l-signature`: `t=<unix_timestamp>,v1=<hex_hmac_sha256>`
Verify `t2l-signature` with the account webhook secret (`GET /v1/account/webhook-secret`).

### 2. Heartbeat Monitor (Dead Man's Switch / Alerting)

Monitors whether an agent or process stays alive. If pings stop, time2live fires alerts (Telegram / Webhook).

```http
POST https://time2live.xyz/v1/monitors
Authorization: Bearer {{env.T2L_API_KEY}}
Content-Type: application/json

{
  "name": "agent-vital-signs",
  "ttlSeconds": 300,
  "graceSeconds": 60,
  "alerts": {
    "telegram": true
  }
}
```
Returns a `pingUrl`. Pinging requires **no authorization header**:
```http
POST https://time2live.xyz/v1/heartbeat/{monitorId}
```

### 3. Active Mode Monitor (External Health Probe)

Instead of the agent pinging out, time2live probes the agent's public health endpoint:
```http
POST https://time2live.xyz/v1/monitors
Authorization: Bearer {{env.T2L_API_KEY}}
Content-Type: application/json

{
  "name": "external-health-check",
  "ttlSeconds": 300,
  "mode": "active",
  "check": {
    "url": "https://my-agent.example.com/health",
    "intervalSeconds": 60,
    "expect": {
      "status": 200
    }
  }
}
```

### 4. Account Overview & Balances
```http
GET https://time2live.xyz/v1/account/overview
Authorization: Bearer {{env.T2L_API_KEY}}
```

### 5. Emergency Controls
- **Pause all jobs and monitors**: `POST https://time2live.xyz/v1/account/pause-all`
- **Revoke all API keys**: `POST https://time2live.xyz/v1/account/keys/revoke-all`

---

## On-Chain Dead Man's Switch (Base)

- **Factory Address**: `0x3d7ce7c30b712bc070ba1ea2918bd2211ad4349a` on Base (Chain ID 8453)
- **Function**: `createSwitch(agent, beneficiary, ttl, tokens[], salt)` (payable)
- Deploys EIP-1167 minimal proxy holding ETH and ERC-20s.
- Agent calls `ping()`. If TTL expires, keeper or anyone can call `trigger()`, transferring assets to the beneficiary.
- Note: Source code open in GitHub (`MeMikko/TTL`), contract is unaudited.

---

## Pricing & x402 Payments

| Item | Cost |
|---|---|
| Free Tier | 1 monitor, 50 runs/mo |
| Permanent Tier Activation | $0.10 (raises to 3 monitors, 100 runs/mo) |
| Additional Run | $0.0005 |
| Additional Monitor | $0.25 / 30 days |
| Credit Packs | $1, $5, $20 via x402 USDC on Base |
