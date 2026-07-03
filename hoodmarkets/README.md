# hood.markets Bankr skill

Bankr-compatible agent skill for launching and trading on [hood.markets](https://hood.markets) (Robinhood Chain **4663**).

## Install (Bankr / Cursor)

```text
install the hoodmarkets skill from https://github.com/BankrBot/skills/tree/main/hoodmarkets
```

## Publish to BankrBot/skills

To list in the official Bankr catalog, open a PR to [BankrBot/skills](https://github.com/BankrBot/skills) copying this folder to `skills/hoodmarkets/` (same layout as [github-vesting](https://github.com/BankrBot/skills/tree/main/github-vesting)).

## API requirements

Production agent endpoints live on **`https://api.hood.markets`**:

- `GET /health`
- `GET /api/agent/briefing`
- `POST /api/agent/prepare-deploy`
- `POST /api/agent/prepare-buy`
- `POST /api/agent/prepare-sell`

Plus existing captcha, deploy, and claim routes documented in `api/docs/agent-api.md`.

## Contracts (V3 simple launch)

| Role | Address |
|------|---------|
| Factory | `0xcFE4D69Ac8e5F79a95d99e991162902f68029f09` |
| Vault | `0xe250a07229Bcf29a2cC02d6070beE82252F71C36` |
| LP locker | `0x209eFAA86568f0Ea0E25d1F0E62f92e81c51a72a` |
| Platform 5% | `0xbfD1be7a12A9FeF04D281C2D8D0D9EE15b576d98` |

See `known-contracts.json` for full pin list (V4 swap helper, fee locker, etc.).

## User flows

| Flow | Bankr submit? |
|------|----------------|
| Deploy token | No — server deploy after haiku JWT |
| Buy / sell (Pro tokens) | Yes — `prepare-*` → `/wallet/submit` chain 4663 |
| Claim fees | No — server claim after haiku JWT |
| Simple (V3) tokens | Trade on Uniswap / DexScreener |
