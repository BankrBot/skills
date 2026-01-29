# Moltbot Skills Library by Bankr & Community

Public repository of skills for [Moltbot](https://github.com/BankrBot/moltbot-skills) (formerly Clawdbot) — including first-party [Bankr](https://bankr.bot) skills and community-contributed skills from other providers.

## Structure

Each top-level directory is a provider. Each subdirectory within a provider is an installable skill containing a `SKILL.md` and other skill related files.

```
moltbot-skills/
├── bankr/                        # Bankr (first-party)
│   ├── SKILL.md
│   ├── references/
│   │   ├── token-trading.md
│   │   ├── leverage-trading.md
│   │   ├── polymarket.md
│   │   ├── automation.md
│   │   ├── token-deployment.md
│   │   └── ...
│   └── scripts/
│       └── bankr.sh
│
├── base/                         # Base (placeholder)
│   └── SKILL.md
├── lgi/                          # Lobster General Intelligence (community)
│   └── x-api/
│       ├── SKILL.md
│       └── scripts/
│           └── x-post.mjs
├── neynar/                       # Neynar (placeholder)
│   └── SKILL.md
└── zapper/                       # Zapper (placeholder)
    └── SKILL.md
```

## Available Skills

| Provider | Skill | Description |
|----------|-------|-------------|
| [bankr](https://bankr.bot) | [bankr](bankr/) | AI-powered crypto trading agent via natural language. Trade, manage portfolios, automate DeFi operations. |
| base | — | Placeholder |
| [lgi](https://github.com/lobstergeneralintelligence) | [x-api](lgi/x-api/) | Post to X (Twitter) using the official API. Reliable tweeting via OAuth 1.0a. |
| neynar | — | Placeholder |
| zapper | — | Placeholder |

## Install Instructions

Give Moltbot the URL to this repo and it will let you choose which skill to install.

```
https://github.com/BankrBot/moltbot-skills
```
