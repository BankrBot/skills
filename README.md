# Bankr Skills. Build your agent.

Bankr Skills equip builders with plug-and-play tools to build more powerful agents.

## Install

Use [OpenClaw](https://github.com/BankrBot/openclaw) and tell it which skill to install:

```
> install the bankr skill from https://github.com/BankrBot/skills/tree/main/bankr
```

## Available Skills

| Provider | Skill | Description |
| --- | --- | --- |
| [Bankr](https://bankr.bot) | [bankr](bankr/) | Financial infrastructure for autonomous agents. Token launches, payment processing, trading, yield automation. |
| [Axiom](https://clawbots.org) | [bankr-signals](bankr-signals/) | Onchain-verified trading signals. Publish trades with TX hash proof, build track records, copy other providers. |
| [8004.org](https://8004.org) | [erc-8004](erc-8004/) | Ethereum agent registry using ERC-8004. Mint agent NFTs, establish onchain identity, build reputation. |
| botchan | [botchan](botchan/) | Onchain messaging on Base. Agent feeds, DMs, permanent data storage. |
| [Clanker](https://clanker.world) | [clanker](clanker/) | Deploy ERC20 tokens on Base and other EVM chains via Clanker. |
| [Coinbase](https://onchainkit.xyz) | [onchainkit](onchainkit/) | Build onchain apps with React components from Coinbase's OnchainKit. |
| [Endaoment](https://endaoment.org) | [endaoment](endaoment/) | Donate to charities onchain via Endaoment. Supports Base, Ethereum, Optimism. |
| [ENS](https://ens.domains) | [ens-primary-name](ens-primary-name/) | Set your primary ENS name on Base and other L2s. |
| [Neynar](https://neynar.com) | [neynar](neynar/) | Interact with Farcaster via Neynar API. Read feeds, look up users, post casts, search content. |
| [qrcoin](https://qrcoin.fun) | [qrcoin](qrcoin/) | QR code auction platform on Base. Programmatic bidding for URL display. |
| [Veil Cash](https://veil.cash) | [veil](veil/) | Privacy and shielded transactions on Base via ZK proofs. |
| yoink | [yoink](yoink/) | Onchain capture-the-flag on Base. |

## Adding a Skill

1. Fork this repo and create a branch.
2. Create a directory for your skill:
   ```
   mkdir your-skill-name/
   ```
3. Add a `SKILL.md` — this is the only required file.
4. Optionally add `references/` for supporting docs and `scripts/` for helper scripts:
   ```
   your-skill-name/
   ├── SKILL.md
   ├── references/
   │   └── your-docs.md
   └── scripts/
       └── your-script.sh
   ```
5. Open a pull request with a description of what your skill does.

**Guidelines:** Keep `SKILL.md` clear and well-documented. Include usage examples. Test before submitting.
