# Noelclaw

**Noelclaw** is an AI operating system for Bankr agents — persistent memory, multi-stage deep research that compounds across sessions, vault knowledge graphs, multi-agent swarm coordination, DeFi execution, and workflow automation. All from natural language.

Install via MCP:
```
npx -y @noelclaw/mcp
```

---

## What This Skill Does

Noelclaw is a 102-tool MCP skill. When added to a Bankr agent, it unlocks:

- **Research that compounds** — `deep_research` runs a multi-stage pipeline (plan → search → scrape → reflect → synthesize). Reports auto-link to past research and can continue from previous reports (`continueFrom`). Knowledge gets queryable across time, not disposable per-session.
- **Real-time research** — `freshMode` auto-detects time-sensitive queries and forces news-domain boosting + recency filters. Surfaces breaking news, recent X posts, and current data.
- **Cross-time analysis** — `research_compare` diffs any two reports to surface what changed. `research_chain` walks the full timeline of how your understanding of a topic evolved.
- **AI analysis** — `ask_noel` answers anything with live market context — research, strategy, code, writing — powered by Bankr LLM (BYOK)
- **Persistent memory** — semantic memory and versioned vault that survive across sessions, with full-text and semantic search
- **Knowledge graph** — link vault entries with typed relations (`related`, `continues`, `references`), traverse your agent's accumulated knowledge
- **Persistent agents** — spawn named agents with goals that persist across sessions; recall and update them later
- **Multi-agent swarm** — coordinate parallel research agents with shared memory, execution scores, and synthesis
- **DeFi execution** — swap tokens and send ETH/ERC-20 on Base mainnet via 0x Permit2, signed locally
- **Workflow automation** — create triggers, price alerts, DCA schedules, conditional orders in plain English
- **Scheduled research** — set monitors that run agent research on a schedule and save findings to vault
- **Web research primitives** — scrape and search the web with Firecrawl, extract structured data
- **GitHub** — read repos, PRs, issues, files, and commits directly from your agent
- **MiroShark simulation** — multi-agent social simulation for any scenario
- **Telegram & X** — push alerts to Telegram, post to X via Ayrshare
- **Credential vault** — store API keys + secrets with AES-GCM at-rest encryption

---

## Tool Categories (102 total)

| Category | Tools | Highlights |
|----------|-------|-----------|
| **Research** | 5 | `deep_research`, `research_compare`, `research_chain`, `web_search`, `web_scrape` |
| **Market** | 5 | `get_market_data`, `get_token_data`, `compare_tokens`, `market_overview`, `token_history` |
| **AI Intel** | 3 | `ask_noel`, `market_thesis`, `trade_plan` |
| **Memory** | 10 | `memory_add`, `memory_search`, `memory_context`, `memory_insight`, `memory_extract`, `memory_consolidate`, `memory_publish` |
| **Vault** | 14 | `vault_save`, `vault_read`, `vault_search`, `vault_history`, `vault_diff`, `vault_link`, `vault_related`, `vault_store_credential` (AES-GCM) |
| **Agents** | 7 | `list_agents`, `hire_agent`, `agent_spawn`, `agent_recall`, `agent_update`, `agent_identity`, `agent_ledger` |
| **Swarm** | 5 | `swarm_research`, `stop_swarm`, `get_swarm_status`, `swarm_synthesize`, `trigger_agent` |
| **Monitors** | 4 | `schedule_research`, `create_monitor`, `list_monitors`, `cancel_monitor` |
| **DeFi** | 6 | `swap_tokens`, `send_token`, `get_portfolio`, `estimate_swap`, `get_defi_yields`, `analyze_wallet` |
| **Automation** | 6 | `create_automation`, `list_automations`, `pause_automation`, `delete_automation`, `get_runs`, `run_automation` |
| **Coder** | 5 | `generate_contract`, `audit_contract`, `explain_code`, `review_code`, `generate_mcp_skill` |
| **Scanner** | 3 | `score_token`, `check_token`, `scan_market` |
| **Framework** | 3 | `list_playbooks`, `run_playbook`, `get_noel_ledger` |
| **GitHub** | 8 | `github_list_repos`, `github_list_prs`, `github_get_pr`, `github_list_issues`, `github_get_file`, `github_search_code` |
| **Chronicle** | 2 | `chronicle_add`, `chronicle_list` |
| **Packets** | 4 | `packet_create`, `packet_run`, `packet_list`, `packet_share` |
| **Simulation** | 3 | `miroshark_simulate`, `miroshark_status`, `miroshark_stop` |
| **Humanizer** | 2 | `humanize_text`, `write_content` |
| **Base** | 4 | `query_vaults`, `list_markets`, `prepare_deposit`, `chain_stats` |
| **Wallet & OS** | 3 | `get_wallet_address`, `set_telegram`, `noel_status` |

---

## What Makes Noelclaw Different from Other Research Tools

Most AI research tools (Perplexity, ChatGPT Deep Research, Gemini Deep Research) generate a report per query. Noelclaw treats research as a **compounding asset** instead:

| Capability | Noelclaw | Others |
|---|---|---|
| Multi-stage pipeline with reflection loop | ✅ | ✅ |
| Output structural validation + retry | ✅ | ❌ |
| Auto-link new reports to related past research | ✅ | ❌ |
| Build on prior research (`continueFrom`) | ✅ | ❌ |
| Walk the temporal evolution of a topic | ✅ | ❌ |
| Diff two reports across time | ✅ | ❌ |
| Self-host LLM provider (Bankr / Anthropic / Grok) | ✅ | ❌ |
| MCP-native — works in any client | ✅ | ❌ |

Reports stored in vault build a knowledge graph: every new report attaches via semantic auto-linking, and continuations form temporal chains queryable via `research_chain`.

---

## Optional Env Vars

| Variable | Purpose |
|----------|---------|
| `BANKR_API_KEY` | Primary LLM gateway — powers `ask_noel` and all agent reasoning |
| `NOELCLAW_MODEL` | Override LLM model across the full stack (default: `claude-haiku-4-5-20251001`) |
| `NOELCLAW_PROVIDER` | Force a provider: `"bankr"`, `"anthropic"`, or `"grok"`. Default: auto |
| `FIRECRAWL_API_KEY` | Required for `deep_research`, `web_search`, `web_scrape` — [firecrawl.dev](https://firecrawl.dev) |
| `MINIMAX_API_KEY` | Required for `humanize_text` |
| `AYRSHARE_API_KEY` | Required for `post_tweet` |
| `GROK_API_KEY` | Optional alternative LLM provider |
| `ANTHROPIC_API_KEY` | Optional alternative LLM provider |

---

## Example Agent Session

```
boot up noelclaw

→ Noelclaw v3.16.0 — 102 tools ready
  Bankr LLM: connected · Vault: synced · Memory: active

run deep_research on "state of Base chain DeFi in 2026"

→ 🔬 Deep Research v3 — depth: standard · 5 sub-questions · 14 sources
  📁 Saved to vault: research/state-of-base-chain-defi-in-2026
  🔗 Auto-linked to 2 related vault entries:
     • research/base-chain-q1-2026
     • research/defi-yields-analysis-may

  [structured report with citations, At a Glance table, counterevidence,
   confidence-tagged Key Findings, Follow-up Questions]

continueFrom that report next week with the same query

→ 🔬 Deep Research v3 (continuation) — focuses on UPDATES, GAPS, NEW
  📁 Saved to vault: research/state-of-base-chain-defi-in-2026-2
  🧬 Linked as continues → research/state-of-base-chain-defi-in-2026

run research_chain on the most recent Base chain report

→ 🧬 Research Chain — 3 reports across the timeline
  Walks all linked continuations + synthesizes net evolution.

spawn a research agent called "base-ecosystem" with goal "track Base DeFi
weekly, building on existing research"

→ Agent "base-ecosystem" spawned. Recall anytime with agent_recall.
```

---

## Bankr LLM Integration

All LLM calls use Bankr as the primary gateway when `BANKR_API_KEY` is set:

- Routes to `https://llm.bankr.bot/v1/chat/completions` directly
- Model controlled by `NOELCLAW_MODEL` env var (default: `claude-haiku-4-5-20251001`)
- Provider override via `NOELCLAW_PROVIDER=bankr|anthropic|grok`
- Falls back to Convex backend proxy if no key is configured
- Used by: `ask_noel`, `deep_research` (every synthesis stage), swarm synthesis, agent hiring, monitor reports

---

## Architecture

```
Bankr Agent
    │  MCP protocol (stdio)
    ▼
@noelclaw/mcp v3.16.0  (Node.js, 102 tools)
    │
    ├── ask_noel + reasoning ────► Bankr LLM (llm.bankr.bot) — your key
    ├── deep_research ───────────► Firecrawl + LLM router + Vault
    │   plan → search → scrape → reflect → synthesize → validate
    │       → save → auto-link → continueFrom chain
    │
    ├── research_compare ────────► diff two vault reports
    ├── research_chain ──────────► walk continueFrom timeline
    │
    ├── market tools ────────────► CoinGecko free API
    ├── memory + vault ──────────► Convex backend (84+ tests)
    ├── swarm coordination ──────► Convex backend
    ├── automations + monitors ──► Convex backend + Trigger.dev
    ├── DeFi (swap/send) ────────► 0x Permit2 → Base mainnet (signed locally)
    └── MiroShark ───────────────► Railway simulation engine
```

Keys never leave the local machine. Private keys never sent to any backend. Vault credentials encrypted at-rest with AES-GCM using `WALLET_ENCRYPTION_KEY`.

---

## What's New (recent versions)

| Version | Feature |
|---|---|
| **v3.16.0** | `research_chain` — walk the timeline of how your understanding evolved |
| **v3.15.0** | `research_compare` — diff two reports across time |
| **v3.14.0** | `freshMode` — auto-detected time-sensitive research with news-domain boost |
| **v3.13.0** | `continueFrom` — multi-session research that builds on prior reports |
| **v3.12.0** | Output structural validation + vault auto-linking (semantic graph) |
| v3.11.x | Grok provider routing with graceful Live Search fallback |
| v3.10.x | `deep_research` v3 — multi-stage pipeline with reflection loop |

---

## Links

- npm: [@noelclaw/mcp](https://www.npmjs.com/package/@noelclaw/mcp)
- Platform: [noelclaw.com](https://noelclaw.com)
- Docs: [docs.noelclaw.fun](https://docs.noelclaw.fun)
- Source: [github.com/noelclaw/mcp](https://github.com/noelclaw/mcp)
