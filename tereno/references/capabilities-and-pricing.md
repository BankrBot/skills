# Tereno Canonical Capabilities, Pricing & MCP Tools

Base URL: `https://www.tereno.xyz`
Settlement rail: **x402 v2 over HTTP**, **USDC on Base (`eip155:8453`)** (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)

---

## 1. The 6 Canonical Capabilities (x402 Payable Routes)

### 1.1 `token.launch.guard`
- **Method & URL:** `GET /api/v1/capabilities/token.launch.guard/invoke?address=<0xTokenAddress>`
- **MCP Tool:** `token_launch_guard`
- **Pricing:** Fresh Miss `$0.07` · Partial Hit (reusing bytecode slot layout) `$0.04` · Cache Hit `$0.02`
- **TTL:** `12s`
- **What it returns:**
  - Live `eth_call` buy/sell exit simulation against Base DEX pools ("Can I get out after I get in?").
  - LP reserve depth and liquidity lock/burn status.
  - Owner powers remaining in bytecode (mint, blacklist, pause, hidden tax/fee traps).
  - Validity window (`validUntilBlock`).

### 1.2 `token.holders.guard`
- **Method & URL:** `GET /api/v1/capabilities/token.holders.guard/invoke?address=<0xTokenAddress>`
- **MCP Tool:** `token_holders_guard`
- **Pricing:** Fresh Miss `$0.04` · Partial Hit `$0.02` · Cache Hit `$0.01`
- **TTL:** `900s` (15 min)
- **What it returns:**
  - Top 10 holder concentration percentage.
  - Funding-origin graph tracing ETH/funder transfers to detect deployer-funded Sybil/cabal clusters and insider dump risk.

### 1.3 `contract.guard`
- **Method & URL:** `GET /api/v1/capabilities/contract.guard/invoke?address=<0xContractAddress>`
- **MCP Tool:** `contract_guard`
- **Pricing:** Fresh Miss `$0.03` · Partial Hit (fingerprint hit) `$0.02` · Cache Hit `$0.01`
- **TTL:** `10s` (bytecode fingerprints persist longer)
- **What it returns:**
  - Executable bytecode presence and EIP-1967 proxy implementation checks.
  - Pause status and ownership control.
  - In-memory 0-extra-RPC scan for scam/honeypot function selectors (`isBot`, blacklist, mint, trading locks).

### 1.4 `token.metadata`
- **Method & URL:** `GET /api/v1/capabilities/token.metadata/invoke?address=<0xTokenAddress>`
- **MCP Tool:** `token_metadata`
- **Pricing:** Fresh Miss `$0.03` · Partial Hit (identity hit) `$0.02` · Cache Hit `$0.01`
- **TTL:** `10s` (5 Base blocks for volatile `totalSupply`; 7-day identity cache)
- **What it returns:** Verified ERC-20 `name`, `symbol`, `decimals`, and block-fresh `totalSupply`.

### 1.5 `chain.snapshot`
- **Method & URL:** `GET /api/v1/capabilities/chain.snapshot/invoke` (no parameters)
- **MCP Tool:** `chain_snapshot`
- **Pricing:** Fresh Miss `$0.02` · Cache Hit `$0.01`
- **TTL:** `4s` (~2 Base blocks)
- **What it returns:** Latest Base block number, timestamp, base fee, and suggested gas fees.

### 1.6 `prediction.evidence`
- **Method & URL:** `POST /api/v1/capabilities/prediction.evidence/invoke`
- **Body (JSON):**
  ```json
  {
    "question": "Will Ethereum Pectra upgrade activate on mainnet before Q4 2026?",
    "market": "polymarket",
    "marketUrl": "https://polymarket.com/event/..."
  }
  ```
- **MCP Tool:** `prediction_evidence`
- **Pricing:** Fresh Miss `$0.05` · Partial Hit `$0.02` · Cache Hit `$0.01`
- **TTL:** `1800s` (30 min)
- **What it returns:**
  - Sourced machine-readable evidence supporting or contradicting the proposition.
  - Oracle dispute risk audit (UMA Optimistic Oracle vs deterministic on-chain vs subjective media).
  - Detection of emergency 50-50 / cancellation clauses and `marketSnapshot` (implied odds, volume, countdown).

---

## 2. Free Discovery, Preview & Economy Endpoints

| Endpoint / MCP Tool | Method | Cost | Purpose |
|---|---|---|---|
| `GET /api/v1/capabilities` · `tereno_catalog` | `GET` | Free | Live catalog with current prices & schemas |
| `GET /api/v1/quotes` · `tereno_price` | `GET` | Free | Check exact cache hit/miss price before paying |
| `GET /api/v1/bounties` · `tereno_bounties` | `GET` | Free | List unmet demand (`misses >= 2`) eligible for seeder bonus |
| `POST /api/v1/artifacts/publish` · `tereno_publish` | `POST` | Free | Submit EIP-712 audited `contract.guard` fingerprint (+$0.005 bonus + 20% dividends) |
| `GET /api/v1/evidence/{artifactId}` · `tereno_evidence_reference` | `GET` | Free | Independently verify a shared `sha256:...` artifact |
| `GET /api/v1/receipts/{invocationId}` · `tereno_receipt` | `GET` | Free | Retrieve signed receipt metadata |
| `GET /api/v1/agent-rules` · `tereno_agent_rules` | `GET` | Free | Machine-readable Tereno Cooperation Protocol v1.0 |
| `GET /api/erc7579/module` · `tereno_erc7579_module` | `GET` | Free | Canonical `TerenoGuardHook` addresses and ABI |
| `GET /api/v1/erc8004/validations/{id}` · `tereno_erc8004_validation` | `GET` | Free | Inspect ERC-8004 validation attestation status |
| `POST /api/acp/evaluate` | `POST` | Public/x402 | ERC-8183 ACP escrow arbitration returning EIP-712 `VerdictProof` |

---

## 3. MCP Streamable HTTP Integration

- **Remote MCP Endpoint:** `https://www.tereno.xyz/api/mcp`
- **Local NPX Package:** `npx -y tereno-mcp`
- **Free Trial Policy:** 1 free daily invocation per IP on paid capabilities so agents can evaluate live responses before funding an x402 wallet.

---

## 4. Expected Latency & HTTP Client Timeouts

Paid responses only settle x402 payments after verification succeeds:

| Call Path | Server Compute | End-to-End (with x402 Settlement) | Recommended HTTP Timeout |
|---|---|---|---|
| Cache hit (`executionMs: 0`) | `< 200ms` | `~1–2s` | `5s+` |
| Cold miss (`prediction.evidence`, `contract.guard`, `token.metadata`, `chain.snapshot`) | `~0.2–0.6s` | `~1.5–3s` | `10s+` |
| Cold miss (`token.launch.guard`, `token.holders.guard`) | `~1.2–2.5s` | `~3–5s` | `10–15s` (`--max-time 15`) |

> Always configure a **10s–15s HTTP request timeout** when replaying `PAYMENT-SIGNATURE` for cold `token.launch.guard` or `token.holders.guard` requests so the agent does not abort while Base RPC simulation and x402 facilitator settlement finish.
