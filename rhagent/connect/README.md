# @rhwallet/connect

One-time Robinhood Agentic OAuth for Bankr users.

## Recommended — one command

```bash
curl -fsSL https://rhagent.bot/scripts/rh-connect.sh | bash
```

Setup wizard: https://rhwallet-rhagent-production.up.railway.app/agentic/setup

## Manual

```bash
git clone https://github.com/rhagent69/Rhagent.git
cd Rhagent/skill/connect
node bin/cli.js
```

Run `bankr login` first so your token auto-saves to Bankr.

## Trust

Token is sent only to Bankr API (`api.bankr.bot/agent/env`). RH Wallet never stores it.
