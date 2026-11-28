---
name: tereno
description: |
  Pre-action onchain security cache, exit simulation, cabal detection, oracle dispute auditing, and cooperative dividend economy on Base (x402 / USDC). Use before interacting with unfamiliar Base contracts or newly launched tokens, before placing prediction market bets, when seeking open verification bounties (+$0.005 bonus + 20% reuse dividends), or when enforcing ERC-8183 escrow and ERC-7579 smart account guard proofs. Compatible with Binance Agentic Wallet (baw x402-payment), OpenClaw, and MCP.
license: MIT
metadata:
  version: "1.0.0"
  author: tereno-xyz
  homepage: "https://www.tereno.xyz"
  openclaw:
    tags:
      - base
      - x402
      - security
      - defi
      - prediction-markets
      - erc-8183
      - erc-7579
      - binance-agentic-wallet
---

# Tereno — Pre-Action Security Cache & Cooperative Verification Economy

Hosted endpoint: `https://www.tereno.xyz` · Settlement rail: **x402 v2 over HTTP (USDC on Base `eip155:8453`)** · MCP: `https://www.tereno.xyz/api/mcp`

Tereno is **not** a static blocklist API. It is a **shared machine verification and cache-dividend memory layer** designed for resource-constrained autonomous agents (serverless workers, OpenClaw agents, Binance Agentic Wallet flows):
- Replaces 8–12 sequential RPC roundtrips with a single **bounded verdict** (`allow` | `review` | `block`).
- Content-addresses every verdict (`sha256:artifactId`) so subsequent agents reuse fresh verdicts for **$0.01** (up to **80% cheaper**) while the seeder earns **20% lifetime reuse dividends**.
- Issues cryptographic **EIP-712 `VerdictProof`** signatures verifiable onchain by **ERC-8183 ACP** escrows and **ERC-7579** Modular Smart Accounts (`TerenoGuardHook`).

---

## When to Trigger This Skill

1. **Before a Base DEX Swap or Token Interaction (Escalation beyond basic static audits):**
   - Even if you already ran a free static scan (such as Binance's `query-token-audit`), escalate to Tereno whenever you need **live `eth_call` sell/exit simulation** (`token.launch.guard`), **deployer funding-origin Sybil/cabal cluster analysis** (`token.holders.guard`), or **0-RPC bytecode trap & EIP-1967 proxy inspection** (`contract.guard`).
2. **Before Placing a Prediction Market Bet (e.g., before `baw prediction trade place-order`):**
   - Run `prediction.evidence` to audit UMA Optimistic Oracle resolution rules, ambiguity/dispute risk, and 50-50 emergency cancellation clauses.
3. **To Self-Fund Your Agent's Security Budget (Cooperative Economy):**
   - Check `GET /api/v1/bounties` for unmet agent demand and submit free audited `contract.guard` bytecode fingerprints via `POST /api/v1/artifacts/publish` to earn an **instant $0.005 credit** (on `misses >= 2` bounties) plus **20% lifetime reuse dividends** in discount credits (down to the `$0.001` floor).
4. **In Multi-Agent Swarms & Smart Accounts:**
   - Pass `sha256:artifactId` references between agents for **free** verification (`GET /api/v1/evidence/:artifactId`), call `POST /api/acp/evaluate` for neutral ERC-8183 escrow arbitration, or install `TerenoGuardHook` (`GET /api/erc7579/module`).

---

## Quick Capability & Endpoint Map

| Need | Capability / Endpoint | Method | Fresh (Miss) | Cache Hit | TTL |
|---|---|---:|---:|---:|---|
| Exit simulation, LP lock & owner powers | `token.launch.guard` → `/api/v1/capabilities/token.launch.guard/invoke?address=0x...` | `GET` | `$0.07` (`$0.04` partial) | `$0.02` | `12s` |
| Top holders & deployer cabal clusters | `token.holders.guard` → `/api/v1/capabilities/token.holders.guard/invoke?address=0x...` | `GET` | `$0.04` (`$0.02` partial) | `$0.01` | `900s` |
| Contract bytecode, proxy & honeypot traps | `contract.guard` → `/api/v1/capabilities/contract.guard/invoke?address=0x...` | `GET` | `$0.03` (`$0.02` partial) | `$0.01` | `10s` |
| Verified ERC-20 identity & block-fresh supply | `token.metadata` → `/api/v1/capabilities/token.metadata/invoke?address=0x...` | `GET` | `$0.03` (`$0.02` partial) | `$0.01` | `10s` |
| Latest Base block, base fee & gas | `chain.snapshot` → `/api/v1/capabilities/chain.snapshot/invoke` | `GET` | `$0.02` | `$0.01` | `4s` |
| Prediction oracle rules & dispute risk | `prediction.evidence` → `/api/v1/capabilities/prediction.evidence/invoke` | `POST` | `$0.05` (`$0.02` partial) | `$0.01` | `1800s` |
| Open bounties (real unseeded demand) | `/api/v1/bounties` | `GET` | Free | Free | Live |
| Free audited fingerprint seeding (+$0.005) | `/api/v1/artifacts/publish` | `POST` | Free (EIP-712) | — | — |
| Free cross-agent artifact verification | `/api/v1/evidence/{artifactId}` | `GET` | Free | Free | — |
| ERC-8183 ACP escrow arbitration | `/api/acp/evaluate` | `POST` | Public/x402 | — | — |
| ERC-7579 Modular Smart Account hook info | `/api/erc7579/module` | `GET` | Free | Free | — |

Full schemas and MCP tool mappings: see [references/capabilities-and-pricing.md](references/capabilities-and-pricing.md).

---

## How to Pay & Authenticate (Choose Your Path)

### Path A — Native Binance Agentic Wallet (`baw`) x402 Flow (Recommended)

`binance-agentic-wallet` natively supports x402 v2 on **Base (`eip155:8453`)** with **USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)** via EIP-3009 — exactly matching Tereno's `402` challenge header (`PAYMENT-REQUIRED`):

1. Send the capability request with `X-Tereno-Skill: 1.0` and a descriptive `User-Agent` (e.g. `tereno-skill/1.0 (openclaw-baw)`), then inspect response headers on `402 Payment Required`.
2. Extract the base64 `PAYMENT-REQUIRED` header value.
3. Preview the payment option using Binance Agentic Wallet CLI:
   ```bash
   baw x402-payment preview --paymentRequirements "<PAYMENT-REQUIRED-VALUE>" --json
   ```
4. Confirm with the user (per `baw` guardrails unless pre-authorized) and sign:
   ```bash
   baw x402-payment sign --paymentId "<paymentId>" --selectedIndex <index> --json
   ```
5. Replay the exact original HTTP request adding `PAYMENT-SIGNATURE: <paymentHeaderValue>`.
6. Verify settlement metadata in the returned `PAYMENT-RESPONSE` header and store `artifactId` + `receipt` for peer reuse.

Detailed step-by-step script & pre-trade recipes: [references/baw-x402-workflow.md](references/baw-x402-workflow.md).

### Path B — Free MCP Evaluation Bridge (Cold-Start Trial)

If your agent does not yet have a funded Base USDC wallet, connect to Tereno's MCP server at **`https://www.tereno.xyz/api/mcp`** (or `npx -y tereno-mcp`).
- Every MCP client receives **1 free daily evaluation per IP** across `token_launch_guard`, `token_holders_guard`, `contract_guard`, `token_metadata`, `chain_snapshot`, and `prediction_evidence`.
- Free utility tools (`tereno_bounties`, `tereno_agent_rules`, `tereno_catalog`, `tereno_price`, `tereno_evidence_reference`, `tereno_publish`, `tereno_erc7579_module`, `tereno_erc8004_validation`) never charge USDC.

### Path C — Cooperative Seeder Loop (Self-Funding Budget)

Instead of only spending USDC:
1. Query `GET /api/v1/bounties` (or MCP `tereno_bounties`) to find contracts requested multiple times (`misses >= 2`) with no fresh artifact.
2. Read the contract bytecode locally and publish an EIP-712 signed fingerprint to `POST /api/v1/artifacts/publish` (or MCP `tereno_publish`) for **free**.
3. Tereno deterministically recomputes against Base chain state (fraudulent submissions are rejected). On pass, you earn an **instant $0.005 credit** plus **20% of every future cross-wallet reuse** (`$0.002`–`$0.004`/reuse up to cap), automatically discounting your future calls down to `$0.001`.

Full rules & dividend mechanics: [references/cooperation-economy.md](references/cooperation-economy.md).

---

## Bounded Output & Strict Agent Guardrails

Every Tereno capability returns a deterministic policy-ready contract:

```json
{
  "verdict": "allow | review | block",
  "reasonCodes": ["..."],
  "evidence": { "...": "..." },
  "limitations": ["..."],
  "validUntilBlock": 12345678,
  "artifactId": "sha256:...",
  "receipt": { "invocationId": "...", "receiptUrl": "..." }
}
```

**Mandatory Agent Behavior:**
1. **Respect `verdict: "block"`:** Halt transaction construction, swap execution, or escrow release immediately when `verdict` is `"block"`, and report `reasonCodes` + `limitations` verbatim to the user.
2. **Treat `"review"` as requires explicit human/policy escalation:** Never silently convert `"review"` into approval; surface the specific risk flags (e.g., upgradable EIP-1967 proxy, elevated top-10 concentration, UMA subjective resolution clause).
3. **Pass `artifactId`, never raw claims:** When collaborating with peer agents, share `artifactId` (`sha256:...`) and `receiptUrl` so peers can verify provenance for free via `GET /api/v1/evidence/{artifactId}`.
4. **Check `validUntilBlock` before acting:** On-chain state moves fast (`token.launch.guard` = `12s`, `contract.guard` = `10s`). Never rely on an expired artifact for execution.
5. **Follow x402 payment safety:** Always verify `network` is `eip155:8453` (Base Mainnet) and confirm quoted USD amounts before signing with `baw x402-payment sign`.
6. **Use a 10–15s HTTP timeout on paid replays:** Cached verdicts resolve in `<200ms` (`executionMs: 0`), while cold cache misses (`token.launch.guard`, `token.holders.guard`) run live Base RPC simulations (~1.2–2.5s) plus x402 settlement (~3–5s total). Pass `--max-time 15` (in `curl`) or set `timeoutMs >= 10000` so agents never abort mid-settlement.

---

## Reference Library

- **[Capabilities, Endpoints & MCP Tools](references/capabilities-and-pricing.md)** — Exact routes, query/body schemas, cache tiers, and MCP names.
- **[Binance Agentic Wallet (`baw`) x402 Integration](references/baw-x402-workflow.md)** — End-to-end shell recipes for Base swaps and Prediction Markets.
- **[Cooperative Cache, Bounties & Dividends](references/cooperation-economy.md)** — Seeder slots, `$0.005` instant bonus, 20% reuse dividends, and `POST /api/v1/artifacts/publish`.
- **[ERC-8183 Escrow & ERC-7579 Smart Account Hook](references/escrow-and-erc7579.md)** — Swarm arbitration (`POST /api/acp/evaluate`) and onchain preCheck enforcement (`TerenoGuardHook`).
