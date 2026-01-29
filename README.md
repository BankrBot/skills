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
├── ember/                        # Ember (community)
│   └── solidity-contract-verification/
│       ├── SKILL.md
│       └── README.md
│
├── base/                         # Base (placeholder)
│   └── SKILL.md
├── neynar/                       # Neynar (placeholder)
│   └── SKILL.md
└── zapper/                       # Zapper (placeholder)
    └── SKILL.md
```

## Available Skills

| Provider | Skill | Description |
|----------|-------|-------------|
| [bankr](https://bankr.bot) | [bankr](bankr/) | AI-powered crypto trading agent via natural language. Trade, manage portfolios, automate DeFi operations. |
| [ember](https://x.com/emberclawd) | [solidity-contract-verification](ember/solidity-contract-verification/) | Verify smart contracts on Etherscan V2 Multichain API (60+ chains). |
| base | — | Placeholder |
| neynar | — | Placeholder |
| zapper | — | Placeholder |

## Install Instructions

Give Moltbot the URL to this repo and it will let you choose which skill to install.

```
https://github.com/BankrBot/moltbot-skills
```
