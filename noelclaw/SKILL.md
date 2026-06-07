# Noelclaw

**Noelclaw** is an AI operating system for Bankr agents — persistent memory, multi-agent swarm research, DeFi execution, workflow automation, and a full knowledge vault. All from natural language.

Install via MCP:
```
npx -y @noelclaw/mcp
```

---

## What This Skill Does

Noelclaw is an 87-tool MCP skill. When added to a Bankr agent, it unlocks:

- **AI analysis** — ask Noel anything: research, market analysis, strategy, code, writing — powered by Bankr LLM (BYOK)
- **Persistent memory** — semantic memory and versioned vault that survive across sessions, with full-text and semantic search
- **Knowledge graph** — link vault entries with semantic relations, traverse your agent's accumulated knowledge
- **Persistent agents** — spawn named agents with goals that persist across sessions; recall and update them later
- **Multi-agent swarm** — coordinate parallel research agents with shared memory, execution scores, and synthesis
- **DeFi execution** — swap tokens and send ETH/ERC-20 on Base mainnet via 0x Permit2, signed locally
- **Workflow automation** — create triggers, price alerts, DCA schedules, and conditional orders in plain English
- **Scheduled research** — set monitors that run agent research on a schedule and save findings to vault
- **Web research** — scrape and search the web, extract structured data
- **MiroShark simulation** — multi-agent social simulation for any scenario
- **Telegram & X** — push alerts to Telegram, post to X via Ayrshare

---

## Tool Categories (87 total)

| Category | Tools | Highlights |
|----------|-------|-----------|
| **Market** | 5 | `get_market_data`, `get_token_data`, `compare_tokens`, `market_overview`, `token_history` |
| **AI Intel** | 3 | `ask_noel`, `market_thesis`, `trade_plan` |
| **Memory** | 9 | `memory_add`, `memory_search`, `memory_context`, `memory_insight`, `memory_extract`, `memory_consolidate` |
| **Vault** | 14 | `vault_save`, `vault_read`, `vault_search`, `vault_history`, `vault_diff`, `vault_link`, `vault_related`, `vault_store_credential` |
| **Agents** | 5 | `list_agents`, `hire_agent`, `agent_spawn`, `agent_recall`, `agent_update` |
| **Swarm** | 6 | `swarm_research`, `stop_swarm`, `get_swarm_status`, `swarm_synthesize`, `swarm_brief` |
| **Research** | 2 | `web_scrape`, `web_search` |
| **Monitors** | 4 | `schedule_research`, `list_monitors`, `cancel_monitor` |
| **DeFi** | 6 | `swap_tokens`, `send_token`, `get_portfolio`, `estimate_swap`, `get_defi_yields`, `analyze_wallet` |
| **Automation** | 6 | `create_automation`, `list_automations`, `pause_automation`, `delete_automation`, `get_runs`, `run_automation` |
| **Coder** | 5 | `generate_contract`, `audit_contract`, `explain_code`, `review_code`, `generate_mcp_skill` |
| **Scanner** | 4 | `score_token`, `check_token`, `scan_dips`, `scan_momentum` |
| **Framework** | 3 | `list_playbooks`, `run_playbook`, `get_noel_ledger` |
| **Simulation** | 3 | `miroshark_simulate`, `miroshark_status`, `miroshark_stop` |
| **Humanizer** | 3 | `humanize_text`, `write_thread`, `write_post` |
| **Base** | 4 | `query_vaults`, `list_markets`, `prepare_deposit`, `chain_stats` |
| **OS** | 3 | `noel_status`, `noel_boot`, `noel_shutdown` |
| **Wallet** | 2 | `get_wallet_address`, `set_telegram` |

---

## Install

### Add to Bankr Agent

In your Bankr agent config, add the MCP server:

```json
{
  "mcpServers": {
    "noelclaw": {
      "command": "npx",
      "args": ["-y", "@noelclaw/mcp"],
      "env": {
        "BANKR_API_KEY": "bk_your_key_here"
      }
    }
  }
}
```

With `BANKR_API_KEY` set, all LLM calls route through Bankr LLM directly.

### Optional env vars

| Variable | Purpose |
|----------|---------|
| `BANKR_API_KEY` | Primary LLM gateway — powers `ask_noel` and all agent reasoning |
| `NOELCLAW_MODEL` | Override LLM model across the full stack (default: `claude-haiku-4-5-20251001`) |
| `MINIMAX_API_KEY` | Required for `humanize_text` |
| `AYRSHARE_API_KEY` | Required for `post_tweet` |

---

## Example Agent Session

```
boot up noelclaw

→ Noel OS v3.3.0 — 87 tools ready
  Bankr LLM: connected · Vault: synced · Memory: active

ask noel for a full market analysis — BTC trend, ETH momentum, top narratives

→ [Bankr LLM response with live analysis]

save that to vault as "June 2026 Market Analysis"

→ Vault entry created: research/june-2026-market-analysis (v1)

spawn a research agent called "base-ecosystem" with goal "track emerging Base chain protocols weekly"

→ Agent "base-ecosystem" spawned. Recall anytime with agent_recall.

run swarm research on "AI agent infrastructure market"

→ Agents launched — synthesizing from vault...
  Current synthesis: [report from existing vault knowledge]
  New findings will be saved automatically.

link the market analysis to base-ecosystem agent as "related"

→ Linked: research/june-2026-market-analysis —[related]→ agent/base-ecosystem
```

---

## Bankr LLM Integration

All LLM calls use Bankr as the primary gateway when `BANKR_API_KEY` is set:

- Routes to `https://llm.bankr.bot/v1/chat/completions` directly
- Model controlled by `NOELCLAW_MODEL` env var (default: `claude-haiku-4-5-20251001`)
- Falls back to Convex backend proxy if no key is configured
- Used by: `ask_noel`, swarm synthesis, agent hiring, monitor reports, and more

---

## Architecture

```
Bankr Agent
    │  MCP protocol (stdio)
    ▼
@noelclaw/mcp (Node.js, 87 tools)
    │
    ├── ask_noel / agent reasoning → Bankr LLM (llm.bankr.bot) — with your key
    ├── market tools ──────────── → CoinGecko free API — no key needed
    ├── memory + vault ─────────  → Convex backend
    ├── swarm coordination ──────  → Convex backend
    ├── automations + monitors ── → Convex backend
    ├── DeFi (swap/send) ────────  → 0x Permit2 → Base mainnet (signed locally)
    └── MiroShark ───────────────  → Railway simulation engine
```

Keys never leave the local machine. Private keys are never sent to any backend.

---

## Links

- npm: [@noelclaw/mcp](https://www.npmjs.com/package/@noelclaw/mcp)
- Platform: [noelclaw.com](https://noelclaw.com)
- Source: [@noelclaw/mcp on npm](https://www.npmjs.com/package/@noelclaw/mcp)
