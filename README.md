# OpenClaw Skills Library

Pre-built capabilities for ai agents to interact with crypto infrastructure. Skills enable autonomous DeFi operations, token launches, onchain messaging, and protocol integrations through natural language interfaces.

Public repository of skills for [OpenClaw](https://github.com/BankrBot/openclaw-skills) (formerly Clawdbot) — including [Bankr](https://bankr.bot) skills and community-contributed skills from other providers.

## Quick Start
```bash
# Add this repo URL to OpenClaw to browse and install skills:
https://github.com/BankrBot/openclaw-skills
```

Skills are drop-in modules. No additional configuration required for basic usage.


## Available Skills

| Provider                   | Skill           | Description                                                                                               |
| -------------------------- | --------------- | --------------------------------------------------------------------------------------------------------- |
| [bankr](https://bankr.bot) | [bankr](bankr/) | Financial infrastructure for autonomous agents. Token launches, payment processing, trading, yield automation. Agents earn and spend independently. |
| [8004.org](https://8004.org) | [erc-8004](erc-8004/) | Ethereum agent registry using ERC-8004 standard. Mint agent NFTs, establish onchain identity, build reputation. |
| botchan                    | [botchan](botchan/) | Onchain messaging protocol on Base. Agent feeds, DMs, permanent data storage. |
| [qrcoin](https://qrcoin.fun) | [qrcoin](qrcoin/) | QR code auction platform on Base. Programmatic bidding for URL display. |
| yoink                      | [yoink](yoink/) | Onchain capture-the-flag on Base. |
| [FTW](https://github.com/SmokeAlot420/ftw) | [ftw](ftw/) | Structured development with Plan-Implement-Validate workflow. Multi-agent execution, independent validation, and automated debugging loops. |
| base                       | —               | Planned                                                                                               |
| neynar                     | —               | Planned                                                                                               |
| zapper                     | —               | Planned                                                                                               |

## Structure

Each top-level directory is a provider. Each subdirectory within a provider is an installable skill containing a `SKILL.md` and other skill related files.

```
openclaw-skills/
├── bankr/
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
├── neynar/                       # Neynar (placeholder)
│   └── SKILL.md
├── qrcoin/                       # QR Coin (community)
│   └── SKILL.md
└── zapper/                       # Zapper (placeholder)
    └── SKILL.md
```

## Install Instructions

Give OpenClaw the URL to this repo and it will let you choose which skill to install.

```
https://github.com/BankrBot/openclaw-skills
```

## Use Cases

**Autonomous financial operations** — Agents manage portfolios, execute trades, deploy tokens, and process payments without human intervention.

**Onchain identity and reputation** — Register agents on Ethereum, build verifiable reputation, establish persistent identity.

**Protocol integrations** — Connect agents to DeFi protocols, prediction markets, messaging systems, and onchain applications.

**Composable workflows** — Combine multiple skills for complex multi-step operations across protocols.

## Contributing

We welcome community contributions! Here's how to add your own skill:

### Adding a New Skill

1. **Fork this repository** and create a new branch for your skill.

2. **Create a provider directory** (if it doesn't exist):
   ```
   mkdir your-provider-name/
   ```

3. **Add the required files**:
   - `SKILL.md` — The main skill definition file (required)
   - `references/` — Supporting documentation (optional)
   - `scripts/` — Any helper scripts (optional)

4. **Follow the structure**:
   ```
   your-provider-name/
   ├── SKILL.md
   ├── references/
   │   └── your-docs.md
   └── scripts/
       └── your-script.sh
   ```

5. **Submit a Pull Request** with a clear description of your skill.

### Guidelines

- Keep skill definitions clear and well-documented
- Include examples of usage in your `SKILL.md`
- Test your skill before submitting
- Use descriptive commit messages
