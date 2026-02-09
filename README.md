# MetaMask OpenClaw Skills

A curated library of [OpenClaw](https://github.com/BankrBot/openclaw-skills) skills approved and recommended by MetaMask developers. This repository serves as a trusted collection of AI agent skills for building, testing, and interacting with MetaMask and the broader Ethereum ecosystem.

## What are OpenClaw Skills?

OpenClaw skills are modular instruction sets that enable AI coding agents to perform specialized tasks. Each skill contains a `SKILL.md` file with structured guidance that AI agents can follow to accomplish specific goals—from deploying smart contracts to interacting with DeFi protocols.

## Repository Structure

```
metamask-openclaw-skills/
├── provider-name/
│   ├── skill-name/
│   │   ├── SKILL.md          # Main skill definition (required)
│   │   ├── references/       # Supporting documentation (optional)
│   │   └── scripts/          # Helper scripts (optional)
│   └── another-skill/
│       └── SKILL.md
├── CONTRIBUTING.md
└── README.md
```

## Available Skills

| Provider | Skill | Description |
|----------|-------|-------------|
| clawdtalk | clawdtalk | Phone calling and SMS for OpenClaw. Call your AI agent from any phone with deep tool integration for calendar, Jira, web search, and more. Powered by Telnyx. |

## Installation

Point your AI agent to this repository URL:

```
https://github.com/MetaMask/openclaw-skills
```

The agent will present available skills for installation.

## Adding a New Skill

We welcome contributions from the community! To add a new skill:

1. **Fork this repository** and create a new branch
2. **Create your provider directory** (if it doesn't exist):
   ```bash
   mkdir -p your-provider-name/your-skill-name/
   ```
3. **Add the required `SKILL.md`** following our [skill template](.github/SKILL_TEMPLATE.md)
4. **Add optional supporting files**:
   - `references/` — Additional documentation
   - `scripts/` — Helper scripts
5. **Submit a Pull Request** with a clear description

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Skill Guidelines

Skills included in this repository should:

- ✅ Be relevant to MetaMask users and Ethereum developers
- ✅ Follow security best practices
- ✅ Include clear documentation and examples
- ✅ Be tested before submission
- ✅ Not include malicious code or instructions

## Security

If you discover a security vulnerability in any skill, please report it responsibly. Do not open a public issue. Instead, follow MetaMask's [security policy](https://github.com/MetaMask/metamask-extension/security/policy).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- [MetaMask Extension](https://github.com/MetaMask/metamask-extension)
- [MetaMask Developer Docs](https://docs.metamask.io/)
- [OpenClaw Skills (Original)](https://github.com/BankrBot/openclaw-skills)
