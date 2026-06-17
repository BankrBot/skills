# Noelclaw

A 103-tool MCP server that gives an agent persistent memory, a versioned vault, deep research with continuation, DeFi execution on Base, and workflow automation.

Works in Claude Code, Cursor, Windsurf, Codex, Aeon, Antigravity, Zed — anywhere MCP runs.

Install:
```
npx -y @noelclaw/mcp
```

---

## What it does

| Layer | What you get |
|---|---|
| **Memory** | Semantic recall across sessions (`memory_add`, `memory_search`, `memory_context`) |
| **Vault** | Typed, versioned artifact store with diff, history, and link relations (`related`, `continues`, `references`) |
| **Research** | Multi-stage `deep_research` with continuation (`continueFrom`), cross-time diff (`research_compare`), and timeline walking (`research_chain`) |
| **Agents** | Persistent named agents with goals and ledgers (`agent_spawn`, `agent_recall`, `agent_update`) |
| **DeFi** | Token swap and send on Base via 0x Permit2 (`swap_tokens`, `send_token`, `get_portfolio`, `get_defi_yields`) |
| **Automation** | DCA, alerts, scheduled monitors (`create_automation`, `schedule_research`) |
| **Code** | Contract generation, audit, review (`audit_contract`, `review_code`, `generate_contract`) |
| **GitHub** | Read repos, PRs, issues, commits, code search |
| **Reasoning** | `ask_noel` — Q&A with the user's memory and recent vault entries injected into context |

103 tools across 21 categories. Full list: [docs.noelclaw.fun](https://docs.noelclaw.fun).

---

## Honest limits

- **`deep_research` output quality depends on Firecrawl search results.** If the search returns only index pages, the report will be thin. The tool now returns "insufficient signal" instead of a fake summary in that case — see `deep_research` output for the skip reason.
- **Auto-linking past research is semantic-search based.** Hit rate depends on vault content density and topic specificity.
- **Scheduled monitors deduplicate on topic + schedule.** Creating the same monitor twice is rejected; cancel the old one first via `cancel_monitor`.
- **Swarm tools (`swarm_research`, `swarm_synthesize`) are experimental.** Use single-agent flows for production work.

---

## Bankr LLM integration

When `BANKR_API_KEY` is set, every reasoning step routes through `llm.bankr.bot`. Through Bankr, the skill accesses both Claude (`claude-sonnet-4-6`, `claude-haiku-4-5-20251001`) and Grok (`grok-4.3`, `grok-4.20`) under a single API and one billing relationship.

Verified live: production deployment reports `activeProvider: "bankr"`, default model `claude-sonnet-4-6`.

Tools that route through the LLM gateway: `ask_noel`, `deep_research` (every synthesis stage), agent reasoning, `humanize_text`, `write_content`, `audit_contract`, `review_code`, `memory_extract`, `memory_consolidate`, `market_thesis`, `trade_plan`.

Override the gateway with `NOELCLAW_PROVIDER=anthropic|grok` for direct fallback.

---

## Env vars

| Variable | Purpose |
|---|---|
| `BANKR_API_KEY` | Primary LLM gateway. Required for production reasoning. |
| `NOELCLAW_MODEL` | Override default model (e.g. `grok-4.3`). |
| `FIRECRAWL_API_KEY` | Optional. Bypasses the Noelclaw backend proxy for `deep_research` and `web_search` — useful if you want direct Firecrawl calls. When signed in to Noelclaw, these tools work without a key (backend pays). |
| `ANTHROPIC_API_KEY` | Direct fallback if Bankr unavailable. |
| `GROK_API_KEY` | Direct fallback if Bankr unavailable. |

---

## Architecture

```
Bankr Agent
    │ MCP stdio
    ▼
@noelclaw/mcp v3.26.2  (Node.js)
    │
    ├── reasoning ───► Bankr LLM (llm.bankr.bot)
    ├── deep_research ► Firecrawl + LLM + Vault
    ├── memory + vault ► Convex backend
    ├── market data ──► CoinGecko
    ├── DeFi ─────────► 0x Permit2 → Base mainnet
    └── monitors ─────► Trigger.dev cron
```

Keys never leave the local machine. Private keys never sent to any backend. Vault credentials encrypted at-rest with AES-GCM using `WALLET_ENCRYPTION_KEY`.

---

## Links

- npm: [@noelclaw/mcp](https://www.npmjs.com/package/@noelclaw/mcp)
- App: [app.noelclaw.com](https://app.noelclaw.com)
- Docs: [docs.noelclaw.fun](https://docs.noelclaw.fun)
- Source: [github.com/noelclaw/mcp](https://github.com/noelclaw/mcp)
