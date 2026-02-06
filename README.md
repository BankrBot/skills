# OpenClaw Skills Library

Public repository of skills for [OpenClaw](https://github.com/BankrBot/openclaw-skills) (formerly Clawdbot) — including [Bankr](https://bankr.bot) skills and community-contributed skills from other providers.

## Structure

Each top-level directory is a provider. Each subdirectory within a provider is an installable skill containing a `SKILL.md` and other skill related files.

```
openclaw-skills/
├── bankr/              # Bankr AI trading agent
├── botchan/            # Onchain agent messaging
├── clanker/            # ERC20 token deployment
├── endaoment/          # Charity donations
├── ens-primary-name/   # ENS reverse resolution
├── erc-8004/           # Agent registration
├── onchainkit/         # Coinbase OnchainKit
├── veil/               # Privacy/shielded txns
├── qrcoin/             # QR code auctions
├── yoink/              # Capture-the-flag game
├── base/               # (placeholder)
├── neynar/             # (placeholder)
└── zapper/             # (placeholder)
```

## Install Instructions

Give OpenClaw the URL to this repo and it will let you choose which skill to install.

```
https://github.com/BankrBot/openclaw-skills
```

## Available Skills

| Provider | Skill | Description |
|----------|-------|-------------|
| [bankr](https://bankr.bot) | [bankr](bankr/) | AI-powered crypto trading agent via natural language. Trade, manage portfolios, automate DeFi operations. |
| [8004.org](https://8004.org) | [erc-8004](erc-8004/) | Register AI agents on Ethereum mainnet using ERC-8004 (Trustless Agents). |
| botchan | [botchan](botchan/) | Onchain agent messaging on Base. Explore agents, post to feeds, send DMs. |
| [Clanker](https://clanker.world) | [clanker](clanker/) | Deploy ERC20 tokens on Base and other EVM chains via Clanker SDK. |
| [Coinbase](https://onchainkit.xyz) | [onchainkit](onchainkit/) | Build onchain apps with React components from Coinbase's OnchainKit. |
| [Endaoment](https://endaoment.org) | [endaoment](endaoment/) | Donate to charities onchain via Endaoment. Supports Base, Ethereum, Optimism. |
| [ENS](https://ens.domains) | [ens-primary-name](ens-primary-name/) | Set your primary ENS name on Base and other L2s. |
| neynar | — | Placeholder |
| [qrcoin](https://qrcoin.fun) | [qrcoin](qrcoin/) | QR code auction platform on Base. Bid to display URLs on QR codes. |
| [Veil Cash](https://veil.cash) | [veil](veil/) | Privacy and shielded transactions on Base via ZK proofs. |
| yoink | [yoink](yoink/) | Onchain capture-the-flag game on Base. |
| base | — | Placeholder |
| zapper | — | Placeholder |

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
