# 🦊 MetaMask Smart Accounts Kit Skill

An [OpenClaw](https://github.com/openclaw/openclaw) agent skill for building Web3 applications with the MetaMask Smart Accounts Kit.

## What's This?

This skill gives your AI agent deep knowledge of:

- **ERC-4337 Smart Accounts** — Programmable wallets with recovery, multisig, and batched transactions
- **Delegation Framework (ERC-7710)** — Grant scoped permissions with caveats and restrictions
- **Advanced Permissions (ERC-7715)** — Request permissions through MetaMask with human-readable confirmations
- **Gas Abstraction** — Paymasters, gasless transactions, pay fees in any token

## Installation

### Via Git (recommended)

```bash
cd ~/.openclaw/workspace/skills
git clone https://github.com/smartgator/smart-accounts-kit-skills.git
```

### Manual

Download and extract to your OpenClaw skills directory.

## Structure

```
smart-accounts-kit-skills/
├── SKILL.md                    # Main skill file (quick reference)
├── references/
│   ├── smart-accounts.md       # Account creation, implementations, signers
│   ├── delegations.md          # Delegation lifecycle, scopes, caveats
│   └── advanced-permissions.md # ERC-7715 permissions via MetaMask
├── LICENSE
└── README.md
```

## Usage

Once installed, your OpenClaw agent can help you:

- Create and deploy smart accounts (Hybrid, Multisig, EIP-7702)
- Build delegation chains with spending limits and time restrictions
- Implement gasless transactions with paymasters
- Request advanced permissions through MetaMask Flask
- Write secure Web3 code with proper caveat enforcement

Just ask your agent about smart accounts, delegations, or permissions — it'll know what to do.

## Compatibility

- **MetaMask Smart Accounts Kit:** v0.3.0
- **Delegation Framework:** v1.3.0
- **Standards:** ERC-4337, ERC-7710, ERC-7715, ERC-7579

## Examples

Ask your agent things like:

> "Create a smart account with passkey support"

> "Set up a delegation that allows spending 100 USDC over 7 days"

> "How do I implement gasless transactions with a paymaster?"

> "Build a subscription system using periodic delegations"

## Resources

- [MetaMask Smart Accounts Kit Docs](https://docs.metamask.io/smart-accounts-kit)
- [OpenClaw](https://github.com/openclaw/openclaw)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)

## License

MIT — see [LICENSE](./LICENSE)

---

Built with 🐊 by [Smart Gator](https://github.com/smartgator)
