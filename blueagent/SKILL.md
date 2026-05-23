---
name: blueagent
description: >
  AI founder console and agent infrastructure for Base builders.
  22 MCP tools (blue_idea, blue_build, blue_audit, blue_ship, blue_raise + 17 Hub tools),
  40+ REST API endpoints, x402 pay-per-call, A2A signal protocol, and SOUL.md personality config.
  Available as remote MCP server (no install) or @blueagent/skill npm package (local stdio).
  Triggers: "blue idea", "blue build", "blue audit", "check builder score", "market fit",
  "token pick", "base grant", "investor memo", "risk gate", "honeypot check".
metadata:
  {
    "clawdbot":
      {
        "emoji": "🟦",
        "homepage": "https://blueagent.dev",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Blue Agent — AI Founder Console for Base

**MCP server · 40+ REST tools · x402 payments · A2A protocol**

Built by [Blocky Studio](https://blocky.studio) · [@blueagent_](https://x.com/blueagent_) · Base (chain ID 8453)

---

## MCP Server (22 tools — no install needed)

Add to Claude Desktop / Claude Code / Cursor in 30 seconds:

```json
{
  "mcpServers": {
    "blue-agent": {
      "url": "https://blueagent.dev/api/mcp"
    }
  }
}
```

```bash
# Claude Code CLI
claude mcp add blue-agent --transport http https://blueagent.dev/api/mcp

# Or local stdio
npx -y @blueagent/skill
```

---

## MCP Tools

### Console Commands (grounded in 34 Base skill files)

| Tool | Description | Price |
|------|-------------|-------|
| `blue_idea` | Concept → fundable brief — problem, why now, why Base, MVP, risks | $0.05 |
| `blue_build` | Architecture, stack, folder structure, integrations, test plan | $0.50 |
| `blue_audit` | Security review — 500+ checks, 13 categories, go/no-go | $1.00 |
| `blue_ship` | Deployment checklist, verification steps, monitoring plan | $0.10 |
| `blue_raise` | Pitch narrative — market framing, why this wins, ask, investors | $0.20 |

### Hub Tools (3-agent consensus: Blue × Aeon × MiroShark)

| Tool | Description | Price |
|------|-------------|-------|
| `hub_builder_score` | Builder Score for X handle — on-chain activity, shipping (0-100) | $0.001 |
| `hub_agent_score` | Agent Score for AI agents on Base — XP, interactions, uptime | $0.01 |
| `hub_market_fit` | Market fit analysis — problem clarity, timing, competition | $0.25 |
| `hub_token_pick` | AI token pick — falsifiable thesis, entry, kill criterion | $0.20 |
| `hub_narrative` | Narrative map — mindshare, velocity, FRONT-RUN/RIDE/FADE/WATCH | $0.15 |
| `hub_ecosystem` | Daily Base ecosystem digest — launches, protocols, builders | $0.20 |
| `hub_competitor_scan` | Competitor analysis + defensible edge | $0.20 |
| `hub_investor_memo` | Full investor memo — thesis, market, moat, risks, ask | $0.35 |
| `hub_repo_health` | GitHub repo health — velocity, coverage, dependency risk | $0.005 |
| `hub_base_grant` | Active grants and funding for Base projects | $0.01 |
| `hub_risk_gate` | Pre-transaction screen — rug check, AML, malicious patterns | $0.05 |
| `hub_honeypot` | Honeypot token detection | $0.01 |
| `hub_deep_analysis` | Token fundamentals — on-chain activity, holders, risk signals | $0.001 |
| `hub_whale_signal` | Whale copy-trade signals for a token | $0.005 |
| `hub_fundraise_timing` | Is now the right time to raise? Market + stage readiness | $0.20 |

### Utility

| Tool | Description |
|------|-------------|
| `blue_score` | Builder Score for GitHub/Farcaster handle or wallet |
| `blue_new` | Scaffold Base project: `base-agent` \| `base-x402` \| `base-token` |

---

## REST API (40+ endpoints)

**Base URL:** `https://blueagent.dev/api/v1/`  
**Auth:** x402 — USDC on Base per call, no subscription

```bash
# Example
curl -X POST https://blueagent.dev/api/v1/builder-score \
  -H "Content-Type: application/json" \
  -H "X-Payment: <x402-token>" \
  -d '{"handle":"madebyshun"}'

# Tool catalog
GET https://blueagent.dev/api/v1/_catalog
```

Full docs: https://blueagent.dev/api-docs

---

## A2A Signal Protocol

Other agents can send signals to Blue Agent:

```bash
POST https://blueagent.dev/api/signal
{
  "id": "sig_001",
  "source": "aeon",
  "type": "opportunity",
  "data": { "subject": "...", "context": "..." },
  "confidence": 0.85,
  "timestamp": "2026-05-23T00:00:00Z"
}
```

Blue Agent scores the signal (confidence + source trust + priority + chain boost), decides action, and stores in KV.

Discovery: `GET https://blueagent.dev/api/health`  
Agent identity: `https://blueagent.dev/.well-known/agent.json`

---

## SOUL.md — Forkable Agent Personality

Blue Agent's identity, values, tone, decision rules, and hard limits are version-controlled in `SOUL.md`.

```
Fork → edit → load into any Bankr-compatible agent session.
```

View + fork: https://blueagent.dev/skills  
Raw: https://raw.githubusercontent.com/madebyshun/blue-agent/main/SOUL.md

---

## x402 Security Tools (legacy endpoint)

**Base URL:** `https://x402.bankr.bot/0xf31f59e7b8b58555f7871f71973a394c8f1bffe5/`

| Service | Price | Description |
|---------|-------|-------------|
| `quantum-premium` | $1.50 | Wallet quantum vulnerability score |
| `quantum-batch` | up to $2.50 | Batch scan 1–10 wallets |
| `quantum-migrate` | $2.00 | Quantum-safe migration plan |
| `key-exposure` | $0.50 | Check if public key is exposed on-chain |
| `risk-gate` | $0.05 | Pre-transaction safety check |
| `honeypot-check` | $0.05 | Detect honeypot contracts |
| `allowance-audit` | $0.20 | Audit dangerous token approvals |
| `circuit-breaker` | $0.50 | CONTINUE/PAUSE/HALT for autonomous agents |
| `deep-analysis` | $0.35 | Deep due diligence for Base tokens |
| `wallet-pnl` | $1.00 | Wallet PnL report |
| `whale-tracker` | $0.10 | Smart money flow analysis |
| `yield-optimizer` | $0.15 | Best APY on Base DeFi |

---

## npm Packages

```bash
npm install -g @blueagent/cli      # TUI + blue CLI (40 versions)
npm install -g @blueagent/skill    # MCP server — 22 tools (local stdio)
npm install @blueagent/sdk         # Unified SDK
npm install @blueagent/core        # Runtime + skill registry
npm install @blueagent/agentkit    # Coinbase AgentKit plugin
npm install @blueagent/x402-guard  # x402 security middleware
```

---

## Resources

- **Web:** https://blueagent.dev
- **API Docs:** https://blueagent.dev/api-docs
- **Skills:** https://blueagent.dev/skills
- **GitHub:** https://github.com/madebyshun/blue-agent
- **Token:** $BLUEAGENT on Base (Uniswap v4)
- **Community:** https://t.me/blueagent_hub
- **X:** https://x.com/blueagent_
