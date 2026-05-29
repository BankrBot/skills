# Noelclaw — Autonomous Crypto Agent Platform

Noelclaw is a multi-agent crypto platform that turns plain-English instructions into on-chain actions. It combines a 35-tool MCP server, an NL-to-automation engine, a multi-agent swarm, and a persistent vault — all running on Base with USDC via x402.

## Core Capabilities

**Trading & DeFi (via 0x on Base)**
- Token swaps: `swap_tokens` — execute any ERC-20↔ERC-20 swap on Base through the user's custodial MCP wallet
- Token transfers: `send_token` — send ETH, USDC, USDT, DAI to any address
- Wallet resolution: `get_wallet_address` — look up or create a user's encrypted on-chain wallet

**Natural Language Automations**
- `create_automation` — parse plain English into a structured trigger + action pair, then run it on a cron
  - **Triggers**: `schedule` (interval), `price_drop_%`, `price_rise_%`, `price_below`, `price_above`, `dominance_below`, `dominance_above`
  - **Actions**: `swap`, `send`, `alert` (Telegram)
  - **Limits**: `maxRuns`, `maxSpendUsd`, expiry
  - Examples: *"Buy $50 of ETH every day, stop after $500"*, *"If ETH drops 10%, buy $100 USDC→ETH"*, *"Alert me when BTC dominance drops below 50%"*
- `list_automations` / `pause_automation` / `delete_automation`

**Agent Swarm**
Five specialized sub-agents run autonomously when the swarm is active:
- **Market Monitor** — tracks live prices, detects volume spikes and resistance breaks
- **Sentiment Tracker** — scans on-chain signals and social data
- **Workflow Executor** — fires scheduled automations and DCA strategies
- **Memory Manager** — compresses and organises shared swarm memory
- **Risk Verifier** — gates every action through a configurable risk score threshold

Tools: `start_swarm`, `stop_swarm`, `get_swarm_status`, `get_swarm_memory`, `write_swarm_memory`, `get_execution_scores`

**Agent Framework**
- `create_task_packet` — create a named, persistent task for agents to act on across sessions
- `list_task_packets` — list all active task packets
- `list_playbooks` — list available pre-built automation playbooks
- `run_playbook` — execute a named playbook by ID
- `get_noel_ledger` — fetch the Steward Ledger: history of agent decisions and outcomes
- `get_sentinel_rules` — fetch Sentinel risk-gate rules and configurable thresholds

**Market Intelligence**
- `get_market_data` — live prices, trending coins, top-20 market cap via Bankr LLM API
- `get_token_data` — deep token analysis (price, volume, sentiment, on-chain activity)
- `ask_noel` — general crypto Q&A and reasoning, powered by Bankr LLM

**MiroShark Simulation**
- `miroshark_simulate` — run a multi-agent market simulation; describe any scenario in plain English (crash, policy change, whale movement) and get a live simulation with AI agent participants
- `miroshark_status` — poll a running simulation for progress, round counts, and agent activity
- `miroshark_stop` — stop a running simulation by ID

**Vault (Persistent Agent Memory)**
- `vault_save` / `vault_read` / `vault_search` / `vault_list` — store and retrieve agent outputs, strategies, research notes
- `vault_history` / `vault_diff` / `vault_export` — version history and diff between entries

**Other**
- `post_tweet` — post to X/Twitter with optional humanization
- `humanize_text` — rewrite AI-generated text to sound natural
- `set_telegram` — link a Telegram chat for alert delivery

## Access

**MCP Server**
Install via npm and configure with your Noelclaw API key:

\`\`\`bash
npx -y @noelclaw/mcp
\`\`\`

Add to Claude Desktop / any MCP-compatible client:
\`\`\`json
{
  "mcpServers": {
    "noelclaw": {
      "command": "npx",
      "args": ["-y", "@noelclaw/mcp"],
      "env": { "NOELCLAW_API_KEY": "your_key_here" }
    }
  }
}
\`\`\`

Get your API key at **noelclaw.com/api-keys** (7 free keys per account).

**HTTP API**
Base URL: \`https://api.noelclaw.com\`

| Auth Method | Header |
|---|---|
| Session token | \`Authorization: Bearer <token>\` |
| x402 micropayment | Send USDC on Base → retry with \`X-Payment: {"txHash":"...","requestId":"..."}\` |
| Wallet signature | \`X-Wallet-Address\` + \`X-Wallet-Signature\` + \`X-Wallet-Timestamp\` |

Free tools (market data, \`ask_noel\`) pass through with no auth.

## Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| \`/mcp/market\` | GET | Live market data (prices, trending, top-20) |
| \`/mcp/chat\` | POST | Ask Noel any question |
| \`/automations/create\` | POST | Create automation from plain English |
| \`/automations/list\` | GET | List user's automations |
| \`/automations/pause\` | POST | Pause or resume an automation |
| \`/automations/delete\` | POST | Delete an automation |
| \`/swarm/start\` | POST | Start the agent swarm |
| \`/swarm/stop\` | POST | Stop the swarm |
| \`/swarm/status\` | GET | Get current swarm status |
| \`/swarm/memory/write\` | POST | Write a key to shared swarm memory |
| \`/swarm/scores\` | GET | Get agent execution scores |
| \`/mcp/defi/swap\` | POST | Get swap quote for signing |
| \`/mcp/defi/send\` | POST | Get send tx data for signing |

## Integration Pattern

Noelclaw acts as an **execution + intelligence layer**:
- Use \`get_market_data\` or \`ask_noel\` for research (free, no auth)
- Use \`create_automation\` to set up recurring strategies in plain English
- Use \`swap_tokens\` / \`send_token\` for immediate on-chain execution
- Use \`start_swarm\` to run autonomous multi-agent monitoring 24/7
- Use \`vault_save\` to persist agent outputs across sessions

All swap and send operations go through the user's personal encrypted MCP wallet on Base. The swarm's risk-verifier agent gates every autonomous action against a configurable threshold before execution.

## Tech Stack

- **Bankr LLM API** (\`llm.bankr.bot\`) — all agent reasoning and market intelligence
- **x402 protocol** — native USDC micropayment support on Base
- **Model Context Protocol (MCP)** — 35 tools, stdio transport, v2.1.0
- **Convex** — real-time backend, cron automation engine, swarm coordinator
- **0x Protocol v2** — on-chain swap execution on Base
- **Base mainnet** — all token operations and payments