# Noelclaw — Persistent AI. Any client, every session.

Noelclaw gives your AI persistent memory, autonomous automations, and on-chain execution on Base — all from plain-English instructions. Install once, your AI remembers everything across every session.

**74 MCP tools · v3.0.0 · Free during beta**

## Install

```bash
npx -y @noelclaw/mcp
```

```bash
# Claude Code
claude mcp add noelclaw -- npx -y @noelclaw/mcp
```

```json
{
  "mcpServers": {
    "noelclaw": {
      "command": "npx",
      "args": ["-y", "@noelclaw/mcp"],
      "env": {
        "NOELCLAW_API_KEY": "noel_sk_...",
        "ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Get your API key at **app.noelclaw.com**

---

## What It Does

Three pillars: **Remember · Act · Know**

```
remember my coding conventions for next time
→ ✓ saved to Vault · auto-loaded every session

send me a weekly research digest every Monday
→ ✓ automation created · runs weekly 09:00 UTC

swap 0.5 ETH to USDC on Base
→ ✓ swapped → 1,842 USDC · tx confirmed in 2s

what did I save about ETH yield last week?
→ searches semantic memory · returns relevant entries

swarm research: "best DeFi plays on Base this month"
→ multi-agent research · auto-saves findings to vault
```

---

## 🧠 REMEMBER — Persistent Memory

### Vault — Structured Notes (12 tools)

| Name | Description |
|------|-------------|
| **Vault Save** `vault_save` | Save a note, research, or decision |
| **Vault Read** `vault_read` | Read an entry by key |
| **Vault List** `vault_list` | List recent entries |
| **Vault Search** `vault_search` | Full-text search across your vault |
| **Vault History** `vault_history` | Version history for an entry |
| **Vault Diff** `vault_diff` | Compare two versions |
| **Vault Export** `vault_export` | Export as JSON or markdown |
| **Store Credential** `vault_store_credential` | Securely store an API key |
| **Get Credential** `vault_get_credential` | Retrieve a stored credential |
| **Vault Pin** `vault_pin` | Pin an important entry |
| **Vault Delete** `vault_delete` | Delete an entry |
| **Vault Tag** `vault_tag` | Add or update tags |

### Memory — Semantic Search (7 tools)

| Name | Description |
|------|-------------|
| **Memory Add** `memory_add` | Add text, notes, or auto-fetch a URL |
| **Memory Search** `memory_search` | Search by meaning — "what did I save about X?" |
| **Memory Context** `memory_context` | Load entries relevant to the current session |
| **Memory Profile** `memory_profile` | Your memory profile — preferences, history |
| **Memory List** `memory_list` | List recent memory entries |
| **Memory Delete** `memory_delete` | Remove a memory entry |
| **Memory Insight** `memory_insight` | AI insights from your memory patterns |

### OS — Session Lifecycle (3 tools)

| Name | Description |
|------|-------------|
| **Boot** `noel_boot` | Start a session — loads memory, market data, automations |
| **Status** `noel_status` | Full dashboard — memory, swarm, active automations |
| **Shutdown** `noel_shutdown` | End session — saves summary to vault |

---

## ⚡ ACT — Execute & Automate

### Automations (6 tools)

| Name | Description |
|------|-------------|
| **Create Automation** `create_automation` | Create a price alert, DCA, or scheduled task in plain English |
| **List Automations** `list_automations` | View all active automations |
| **Pause Automation** `pause_automation` | Pause or resume |
| **Delete Automation** `delete_automation` | Delete an automation |
| **Automation Runs** `get_automation_runs` | Execution history |
| **Run Now** `run_automation` | Trigger manually |

Triggers: `schedule`, `price_drop_%`, `price_rise_%`, `price_below`, `price_above`
Actions: `swap`, `send`, `alert` (Telegram)

### DeFi Execution (6 tools)

> Transactions signed client-side — private key never leaves your machine.

| Name | Description |
|------|-------------|
| **Portfolio** `get_portfolio` | View wallet holdings and balances |
| **Estimate Swap** `estimate_swap` | Quote via 0x before executing |
| **Swap Tokens** `swap_tokens` | Execute token swap on Base via 0x |
| **Send Token** `send_token` | Send ETH or ERC-20 to any address |
| **Analyze Wallet** `analyze_wallet` | Deep analysis of any public wallet |
| **DeFi Yields** `get_defi_yields` | Best yield opportunities on Base |

### Base Chain (4 tools)

| Name | Description |
|------|-------------|
| **Chain Stats** `base_chain_stats` | Live ETH price, gas, latest block |
| **Query Vaults** `base_query_vaults` | Top Morpho vaults ranked by APY |
| **List Markets** `base_list_markets` | Moonwell lending and borrowing rates |
| **Prepare Deposit** `base_prepare_deposit` | Prepare a Morpho vault deposit |

### Wallet & Notifications (2 tools)

| Name | Description |
|------|-------------|
| **Wallet Address** `get_wallet_address` | Get or generate your MCP wallet address |
| **Set Telegram** `set_telegram` | Connect Telegram for notifications |

### Playbooks (3 tools)

| Name | Description |
|------|-------------|
| **List Playbooks** `list_playbooks` | Browse available playbooks |
| **Run Playbook** `run_playbook` | Execute a playbook by ID |
| **Noel Ledger** `get_noel_ledger` | Credits and full audit trail |

---

## 🔍 KNOW — Research & Intelligence

### Market & Prices (5 tools)

| Name | Description |
|------|-------------|
| **Market Data** `get_market_data` | Live prices — BTC, ETH, SOL, top 20 |
| **Token Data** `get_token_data` | Price, volume, market cap for any token |
| **Compare Tokens** `compare_tokens` | Side-by-side token comparison |
| **Market Overview** `market_overview` | Top movers, Fear & Greed, dominance |
| **Token History** `token_history` | Historical OHLC data |

### Scanner (4 tools)

| Name | Description |
|------|-------------|
| **Score Token** `score_token` | Risk and quality score |
| **Check Token** `check_token` | Honeypot detection, contract audit flags |
| **Scan Dips** `scan_dips` | Tokens dipping with recovery signals |
| **Scan Momentum** `scan_momentum` | Tokens breaking out upward |

### Research & Insight (3 tools)

| Name | Description |
|------|-------------|
| **Ask Noel** `ask_noel` | AI crypto analyst — opinions, trade ideas |
| **Market Thesis** `market_thesis` | Bull/bear thesis for any token or sector |
| **Trade Plan** `trade_plan` | Entry, exit, and risk levels |

### Agent Network (8 tools)

> Multiple AI agents research and monitor in parallel with shared memory.

| Name | Description |
|------|-------------|
| **Start Swarm** `start_swarm` | Start the agent network |
| **Stop Swarm** `stop_swarm` | Stop the swarm |
| **Swarm Status** `get_swarm_status` | Status and memory snapshot |
| **Trigger Agent** `trigger_agent` | Run a specific agent now |
| **Swarm Research** `swarm_research` | Multi-agent research — auto-saves to vault |
| **Swarm Brief** `swarm_brief` | Summary of everything the swarm found |
| **List Agents** `list_agents` | Browse specialist agents |
| **Hire Agent** `hire_agent` | Hire an agent for a task |

---

## 🛠 BUILD — Developer & Content Tools

### Coder (5 tools)

| Name | Description |
|------|-------------|
| **Generate Contract** `generate_contract` | Solidity smart contract |
| **Audit Contract** `audit_contract` | Contract vulnerability audit |
| **Explain Code** `explain_code` | Plain-English code explanation |
| **Generate MCP Skill** `generate_mcp_skill` | Generate a new MCP tool from plain English |
| **Review Code** `review_code` | Code review with actionable feedback |

### Content & Humanizer (3 tools)

| Name | Description |
|------|-------------|
| **Humanize Text** `humanize_text` | Strip AI patterns — makes output sound human |
| **Write Thread** `write_thread` | Write a Twitter/X thread |
| **Write Post** `write_post` | Write a punchy social post |

### MiroShark — Market Simulation (3 tools)

| Name | Description |
|------|-------------|
| **Simulate** `miroshark_simulate` | Multi-agent market simulation from plain English |
| **Simulation Status** `miroshark_status` | Poll progress and get AI brief on completion |
| **Stop Simulation** `miroshark_stop` | Stop a running simulation |

---

## Tech Stack

- **Bankr LLM API** — agent reasoning and market intelligence
- **Model Context Protocol (MCP)** — 74 tools, stdio transport, v3.0.0
- **Convex** — real-time backend, automation engine, swarm coordinator
- **0x Protocol v2** — on-chain swap execution on Base
- **Supermemory** — semantic vector memory
- **Base mainnet** — all token operations

## Links

- App: [app.noelclaw.com](https://app.noelclaw.com)
- npm: [@noelclaw/mcp](https://www.npmjs.com/package/@noelclaw/mcp)
- GitHub: [github.com/noelclaw/mcp](https://github.com/noelclaw/mcp)
- Docs: [docs.noelclaw.fun](https://docs.noelclaw.fun)
