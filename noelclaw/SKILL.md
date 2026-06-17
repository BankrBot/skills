---
name: noelclaw
description: |
  Persistent AI OS for agents — memory that survives across sessions, deep research that compounds
  into a knowledge graph, autonomous monitors, multi-agent swarm coordination, Base DeFi execution,
  and versioned vault storage. Use when the task requires memory across sessions, ongoing research
  that builds on itself, persistent named agents, autonomous monitoring of X/GitHub/websites,
  or DeFi execution on Base. 103 tools across 21 categories.
  Triggers: "remember this", "search my memory", "save to vault", "monitor X account",
  "run deep research on", "spawn an agent", "what did I research about", "swap on Base",
  "track this ecosystem", "launch a swarm", "what's in my vault", "recall what we discussed".
---

# Noelclaw

Persistent AI OS for agents. Not a wrapper — a runtime layer that gives agents memory, research that compounds, autonomous monitoring, and DeFi execution on Base. Everything connects: research flows into vault, vault feeds agents, agents update memory, memory informs the next research cycle.

Works in Claude Code, Cursor, Windsurf, Codex, Aeon, Antigravity, Zed — anywhere MCP runs.

```bash
npx -y @noelclaw/mcp
```

With `BANKR_API_KEY` set, all LLM reasoning routes through Bankr (`llm.bankr.bot`). Override model via `NOELCLAW_MODEL` (default: `claude-haiku-4-5-20251001`).

---

## When to use Noelclaw

| Situation | Tool to reach for |
|---|---|
| Need to recall something from a past session | `memory_context`, `memory_search` |
| Research a topic and store the result durably | `deep_research` → auto-saves to vault |
| Build on past research over multiple sessions | `vault_read`, `vault_diff`, `research_compare` |
| Monitor X, GitHub, websites, or ecosystems continuously | `create_monitor`, `schedule_research` |
| Coordinate parallel research across multiple agents | `swarm_research`, `swarm_synthesize` |
| Execute a swap or send tokens on Base | `swap_tokens`, `send_token` |
| Build a named agent that persists and accumulates context | `agent_spawn`, `agent_recall`, `agent_update` |
| Store and retrieve credentials, research, or code artifacts | `vault_save`, `vault_read`, `vault_search` |

---

## Core capabilities

### Memory — semantic recall across sessions

```
memory_add content="User prefers conservative DeFi on Base. Lido for ETH, Aerodrome for LP."
memory_search query="user DeFi preferences"
memory_context topic="Base chain investments"    # inject relevant memory into context
memory_extract                                   # pull facts from current conversation
memory_consolidate                               # merge and deduplicate accumulated memory
```

Memory persists across sessions. `memory_context` is the primary tool — call it at the start of a session to load relevant context automatically.

---

### Vault — versioned artifact store with knowledge graph

```
vault_save type="research" title="Base DeFi Q2 2026" content="..."
vault_read key="research/base-defi-q2-2026"
vault_search query="aerodrome yields"
vault_history key="research/base-defi-q2-2026"     # git-style version log
vault_diff key="..." fromVersion=1 toVersion=3      # what changed between versions
vault_link fromKey="research/btc" toKey="research/eth" relation="related"
vault_related key="research/btc"                    # navigate the knowledge graph
```

Relations: `references | derived_from | supersedes | related | continues`

Everything saved to vault is versioned. Research compounds — each new session diffs against the prior version rather than starting from scratch.

---

### Deep Research — multi-stage, vault-native

```
deep_research topic="AI agent infrastructure on Base" depth="deep"
```

Each run:
1. Pulls and synthesizes from multiple sources
2. Saves result to vault automatically
3. Diffs against prior research on the same topic
4. Links to related vault entries

Follow-up runs extend the prior version rather than overwriting it.

Comparison and timeline tools:
```
research_compare topic="Base TVL" fromDate="2026-01-01" toDate="2026-06-01"
research_chain topic="Aerodrome" steps=5    # walk the research history as a timeline
```

---

### Monitors — autonomous, scheduled

```
create_monitor topic="@noelclawfun on X" schedule="daily"
schedule_research topic="Base chain TVL" schedule="weekly" action="save_to_vault"
list_monitors
cancel_monitor id="..."
```

Monitors run on schedule, detect changes, summarize them, and store results to vault. No manual checking required.

---

### Swarm — parallel multi-agent research

```
swarm_research topic="AI agent infrastructure Q2 2026" synthesize=true
# → launches parallel agents + synthesizes existing vault knowledge immediately

# 60 seconds later:
swarm_synthesize    # collect full results from all agents
```

Use swarm for broad research where multiple angles are needed simultaneously. Results merge into vault automatically.

---

### Agents — persistent named agents

```
agent_spawn name="base-researcher" goal="track Base chain protocol developments weekly"
agent_recall name="base-researcher"      # load state + memory into context
agent_update name="base-researcher" progress="found 3 new protocols" status="active"
```

Agents survive across sessions. Each has an identity, goal, execution history, and accumulated vault entries.

---

### DeFi — Base chain execution

```
get_portfolio                                           # current holdings
get_defi_yields                                         # available yield opportunities
estimate_swap from="ETH" to="USDC" amount=0.1          # preview
swap_tokens from="ETH" to="USDC" amount=0.1            # execute via 0x Permit2
send_token token="USDC" to="0x..." amount=100
analyze_wallet address="0x..."
```

Execution wallet is the user's Noelclaw-managed Base wallet. Privy/OKX wallets are identity only.

---

### AI reasoning — `ask_noel`

```
ask_noel question="What are the top emerging protocols on Base?" messages=[{...}]
```

Routes through Bankr LLM with user's memory and recent vault entries injected into context. Supports multi-turn via `messages` array. Specialized variants: `market_thesis`, `trade_plan`.

---

## Honest limits

- **`deep_research` quality depends on source availability.** Returns "insufficient signal" rather than fabricating a report when sources are thin.
- **Scheduled monitors require Noelclaw backend connectivity.** The monitor runs server-side — local MCP process doesn't need to stay alive.
- **Swarm tools are experimental.** Use single-agent flows for production-critical work.
- **DeFi execution is Base mainnet only.** No testnet, no other chains.
- **Duplicate monitors are rejected.** `create_monitor` deduplicates on topic + schedule. Cancel the existing one first via `cancel_monitor`.

---

## Bankr LLM integration

When `BANKR_API_KEY` is set, every reasoning step routes through `llm.bankr.bot`. Through Bankr, the skill accesses Claude (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) and Grok (`grok-4.3`, `grok-4.20`) under a single API.

Verified live: production deployment reports `activeProvider: "bankr"`, default model `claude-haiku-4-5-20251001`.

Tools that route through the LLM gateway: `ask_noel`, `deep_research` (every synthesis stage), agent reasoning, `humanize_text`, `audit_contract`, `review_code`, `memory_extract`, `memory_consolidate`, `market_thesis`, `trade_plan`.

Override model: `NOELCLAW_MODEL=grok-4.3`
Override provider: `NOELCLAW_PROVIDER=anthropic|grok`

---

## Env vars

| Variable | Purpose |
|---|---|
| `BANKR_API_KEY` | Primary LLM gateway. Required for production reasoning. |
| `NOELCLAW_MODEL` | Override model (e.g. `grok-4.3`, `claude-sonnet-4-6`). |
| `ANTHROPIC_API_KEY` | Direct fallback if Bankr unavailable. |
| `GROK_API_KEY` | Direct fallback if Bankr unavailable. |
| `FIRECRAWL_API_KEY` | Optional. Bypasses backend proxy for `deep_research` + `web_search`. |

---

## Architecture

```
Bankr Agent
    │ MCP stdio
    ▼
@noelclaw/mcp v3.26.2  (Node.js, 103 tools)
    │
    ├── reasoning ───► Bankr LLM (llm.bankr.bot)
    ├── deep_research ► Firecrawl + LLM synthesis + Vault
    ├── memory + vault ► Convex (versioned, encrypted at rest)
    ├── monitors ─────► server-side scheduled jobs (Trigger.dev)
    ├── market data ──► CoinGecko
    └── DeFi ─────────► 0x Permit2 → Base mainnet
```

Private keys never leave the user's device. Vault credentials encrypted at-rest with AES-GCM.

---

## Links

- npm: [@noelclaw/mcp](https://www.npmjs.com/package/@noelclaw/mcp)
- App: [app.noelclaw.com](https://app.noelclaw.com)
- Docs: [docs.noelclaw.fun](https://docs.noelclaw.fun)
- X: [@noelclawfun](https://x.com/noelclawfun)
