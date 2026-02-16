# MemoClaw Skill

Semantic memory API for AI agents. Wallet = identity.

## Install

```bash
npx skills add anajuliabit/memoclaw-skill
```

Or manually copy `SKILL.md` to your agent's skills directory.

## Quick Start

```bash
# Set your private key
export MEMOCLAW_PRIVATE_KEY=0x...

# Store a memory
memoclaw store "Meeting notes: discussed Q1 roadmap" --importance 0.8 --tags work

# Recall memories
memoclaw recall "what did we discuss about roadmap"

# Session start - load context
memoclaw recall "user preferences" --limit 5

# Session end - store summary
memoclaw store "Session 2026-02-13: Discussed project priorities" --importance 0.6 --tags session-summary
```

## Key Features

- **Semantic Search** - Natural language recall across all memories
- **Auto-Deduplication** - Built-in consolidate to merge similar memories  
- **Importance Scoring** - Rank memories by significance (0-1)
- **Memory Types** - Automatic decay based on type (correction: 180d, preference: 180d, decision: 90d)
- **Namespaces** - Organize memories per project or context
- **Relations** - Link related memories (supersedes, contradicts, supports)

## When to Use MemoClaw

| Use MemoClaw | Use Local Files |
|--------------|-----------------|
| Cross-session recall | Secrets, API keys |
| Semantic search | Temporary scratch notes |
| User preferences | Large configs/code |
| Project context | Data that must stay local |

## Pricing

**Free Tier:** 100 calls per wallet — no payment required.

After free tier (USDC on Base):
- Store/Recall/Update: $0.005
- Store batch (up to 100): $0.04
- Extract/Ingest/Consolidate/Context/Migrate: $0.01
- List, Get, Delete, Search, Suggested, Relations, Export, Stats: **Free**

Your wallet address is your identity — no signup needed.

## Links

- **API**: https://api.memoclaw.com
- **Docs**: https://docs.memoclaw.com
- **Website**: https://memoclaw.com

## License

MIT
