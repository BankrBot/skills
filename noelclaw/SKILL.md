---
name: noelclaw
description: |
  AI OS runtime for agents — memory that survives across sessions, research that compounds
  into a versioned knowledge graph, autonomous monitors that run without babysitting, and
  DeFi execution on Base. The core pattern: research saves to vault, vault feeds agents,
  agents update memory, monitors trigger the next research cycle. Nothing resets between sessions.
  Use when the task requires context from prior sessions, research that builds on itself over weeks,
  a named agent with persistent goals, automated tracking of X/GitHub/ecosystems, or Base swaps.
  102 tools across 21 categories.
  Triggers: "remember this", "what did we research about", "recall what we discussed",
  "search my memory", "save to vault", "what's in my vault", "run deep research on",
  "build on our last research", "compare research from last month", "spawn an agent",
  "monitor this X account", "track this ecosystem weekly", "launch a swarm",
  "swap on Base", "what are the DeFi yields",
  "list my GitHub repos", "search my code", "get that PR".
---

# Noelclaw

AI OS runtime for agents. Not a one-shot tool — a persistence layer. Memory survives sessions, research compounds into a knowledge graph, monitors run server-side without keeping a process alive, agents remember their own history.

```bash
npx -y @noelclaw/mcp
```

With `BANKR_API_KEY` set, all LLM reasoning routes through Bankr (`llm.bankr.bot`). Default model: `claude-haiku-4-5-20251001`. Override via `NOELCLAW_MODEL`.

---

## The Knowledge Flywheel

This is the core pattern. Every layer feeds the next:

```
Research ──► Vault (versioned) ──► Agent (persistent) ──► Monitor (autonomous)
   ▲                                      │
   └──────────── Memory ◄─────────────────┘
```

- `deep_research` auto-saves to vault and diffs against prior versions
- `vault_link` connects related entries into a knowledge graph
- `agent_recall` loads an agent's entire history — goals, past findings, vault entries — into context
- Monitors run on Trigger.dev server-side; no local process needed
- `memory_context` at session start restores everything relevant automatically

Use this flywheel when you need intelligence that accumulates rather than resets.

---

## When to use

| Situation | First tool |
|---|---|
| Start a session — restore prior context | `memory_context topic="..."` |
| Research a topic and keep it across sessions | `deep_research topic="..."` |
| What changed since last time I researched this | `research_compare` / `vault_diff` |
| Named agent that remembers its own history | `agent_spawn` → `agent_recall` |
| Watch X, GitHub, or a website automatically | `schedule_research` |
| Broad research across multiple angles at once | `deep_research depth="deep"` |
| Store a credential, artifact, or note durably | `vault_save` |
| Find something I saved weeks ago | `vault_search` / `memory_search` |
| Current Base wallet holdings | `base_mcp_balance` |
| Swap or send tokens on Base | `base_mcp_estimate` → `base_mcp_swap` |

---

## End-to-end flows

### 1. Compound research over weeks

Build knowledge that grows instead of resets. Each session extends the prior one.

**Session 1:**
```
deep_research topic="AI agent infrastructure on Base" depth="deep"
→ synthesizes from multiple sources, saves to vault as v1

memory_add content="Key finding: agent infra shifting from wallet wrappers to runtime layers. Watch Noelclaw, AEON, Bankr."
```

**Session 2, one week later:**
```
memory_context topic="AI agent infrastructure"
→ loads prior findings into context automatically

deep_research topic="AI agent infrastructure on Base" depth="deep"
→ diffs against v1, surfaces what changed, saves as v2

vault_list type="research"
→ find your saved report keys

research_compare keyA="research/ai-agent-infrastructure-on-base" keyB="research/ai-agent-infrastructure-on-base-2"
→ structured diff: new findings, updated positions, weakened claims
```

**Session N:**
```
research_chain startKey="research/ai-agent-infrastructure-on-base"
→ walks the full timeline as a compound narrative (follows vault `continues` links)
```

---

### 2. Persistent research agent

Deploy a named agent that accumulates context across every session it runs.

```
# One-time setup:
agent_spawn name="base-tracker" goal="monitor new Base DeFi protocol launches weekly"

# Every session — loads full history, goals, and vault entries:
agent_recall name="base-tracker"

# Do the work:
deep_research topic="new Base DeFi protocols this week"
vault_save type="note" title="Base week 24 — Morpho v2 launch" content="..."

# Update agent state:
agent_update name="base-tracker" progress="found Morpho v2, Aerodrome CLMM" status="active"
```

The agent's execution history, vault entries, and goal are restored automatically on the next `agent_recall`. Nothing is lost between sessions.

---

### 3. Set-and-forget ecosystem monitoring

Register once. Runs server-side on schedule. Check results anytime.

```
# Register monitors (server-side, survives MCP process restart):
schedule_research topic="@noelclawfun on X" schedule="daily"
schedule_research topic="Base chain TVL" schedule="weekly"
schedule_research topic="github.com/noelclaw/mcp new PRs" schedule="daily"

# Check what's in your vault after a week:
vault_search query="Base TVL weekly"
vault_search query="noelclawfun X digest"

# List or cancel:
list_monitors
cancel_monitor id="..."
```

---

### 4. DeFi: analyze then act

```
base_mcp_balance
→ current Base wallet holdings with USD values

get_defi_yields
→ ranked yield opportunities on Base (Aerodrome, Morpho, Lido)

base_mcp_estimate fromToken="ETH" toToken="USDC" amount="0.5"
→ preview route, fees, and expected output

base_mcp_swap fromToken="ETH" toToken="USDC" amount="0.5"
→ execute via 0x Permit2 on Base mainnet

base_mcp_send token="USDC" to="0x..." amount="100"
→ send from managed wallet
```

---

## Tool reference

### Memory (9 tools)
```
memory_context topic="..."         # primary — call at session start
memory_add content="..."           # store a fact
memory_search query="..."          # semantic recall
memory_extract                     # pull facts from current conversation
memory_consolidate                 # deduplicate and compress
```

### Vault (14 tools)
```
vault_save type="research|note|code|credential" title="..." content="..."
vault_read key="research/..."
vault_search query="..."
vault_history key="..."            # git-style version log
vault_diff key="..." fromVersion=1 toVersion=3
vault_link fromKey="..." toKey="..." relation="related|references|derived_from|supersedes|continues"
vault_related key="..."            # navigate the knowledge graph
vault_store_credential / vault_get_credential
```

### Deep Research (4 tools)
```
deep_research topic="..." depth="quick|standard|deep"   # deep = 5 angles + adversarial critic
research_compare keyA="research/..." keyB="research/..." # structured diff of two vault reports
research_chain startKey="research/..."                    # walk the evolution timeline
web_search query="..."                                    # raw results, no synthesis
```

### Agents (5 tools)
```
agent_spawn name="..." goal="..."
agent_recall name="..."
agent_update name="..." progress="..." status="active|paused|done"
list_agents
hire_agent                         # browse pre-built agents
```

### Monitors (3 tools)
```
schedule_research topic="..." schedule="daily|weekly|hourly"   # register recurring monitor
list_monitors
cancel_monitor id="..."
```

### DeFi — Base mainnet only
```
base_mcp_balance                                       # ETH, USDC, USDT, DAI, WETH holdings
get_defi_yields                                        # ranked yield opportunities
base_mcp_estimate fromToken="..." toToken="..." amount="..."
base_mcp_swap fromToken="..." toToken="..." amount="..."
base_mcp_send token="..." to="0x..." amount="..."
base_mcp_lend                                          # lending opportunities on Base
```

### GitHub (8 tools)
```
github_list_repos username="..."              # repos for a user or org
github_list_prs owner="..." repo="..."        # open PRs
github_get_pr owner="..." repo="..." number=N # PR details + diff
github_list_issues owner="..." repo="..."
github_get_issue owner="..." repo="..." number=N
github_get_file owner="..." repo="..." path="..."
github_get_commits owner="..." repo="..."
github_search_code query="..." repo="..."
```

### AI Reasoning
```
ask_noel question="..."            # memory + vault injected into context automatically
market_thesis token="..."
trade_plan
```

### Coder
```
audit_contract address="0x..."
review_code code="..."
generate_contract description="..."
generate_mcp_skill description="..."
```

---

## Honest limits

- **`deep_research` depends on source availability.** Returns "insufficient signal" rather than fabricating output when sources are thin.
- **Monitors run server-side.** The MCP process doesn't need to stay alive. Results appear in vault.
- **`deep_research depth="deep"` runs 5 angles + adversarial critic.** Slower (~180s) but thorough. Use `depth="standard"` for most cases.
- **DeFi is Base mainnet only.** No testnet, no other chains.
- **Duplicate monitors rejected.** `schedule_research` deduplicates on topic + schedule. Cancel the existing one first.

---

## Bankr LLM integration

With `BANKR_API_KEY` set, all reasoning routes through `llm.bankr.bot`. Gives access to Claude and Grok under one API.

**Verified live:** production deployment reports `activeProvider: "bankr"`, default model `claude-haiku-4-5-20251001`.

Tools that use the LLM gateway: `ask_noel`, `deep_research` (every synthesis stage), `market_thesis`, `trade_plan`, `memory_extract`, `memory_consolidate`, `audit_contract`, `review_code`, `humanize_text`, all agent reasoning.

```
NOELCLAW_MODEL=grok-4.3           # override model
NOELCLAW_PROVIDER=anthropic|grok  # override provider
```

---

## Env vars

| Variable | Purpose |
|---|---|
| `BANKR_API_KEY` | Primary LLM gateway — required for production reasoning |
| `NOELCLAW_MODEL` | Override model (`grok-4.3`, `claude-sonnet-4-6`, etc.) |
| `ANTHROPIC_API_KEY` | Direct fallback if Bankr unavailable |
| `GROK_API_KEY` | Direct fallback if Bankr unavailable |
| `FIRECRAWL_API_KEY` | Optional — bypasses backend proxy for `deep_research` and `web_search` |

---

## Architecture

```
Bankr Agent
    │ MCP stdio
    ▼
@noelclaw/mcp v3.28.0  (Node.js, 102 tools)
    │
    ├── reasoning ───► Bankr LLM (llm.bankr.bot)
    ├── deep_research ► Firecrawl + LLM synthesis + Vault
    ├── memory + vault ► Convex (versioned, encrypted at rest)
    ├── monitors ─────► Trigger.dev (server-side, always-on)
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
