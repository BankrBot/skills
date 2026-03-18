---
name: inclawbator
description: >
  The Inclawbator — full-service AI agent for launching and managing Web3 projects.
  Launch tokens (Base/Solana), deploy staking pools, create marketing agents, airdrop tokens,
  run health checks, hire human freelancers, build apps and landing pages, check fees,
  book promos, and manage your entire project — all through one conversational API.
  Talk to it at inclawbate.com or via the REST API.
metadata:
  openclaw:
    emoji: "🦞"
    homepage: "https://inclawbate.com"
    requires:
      bins: ["curl"]
---

# The Inclawbator — AI Agent for Web3 Projects

The Inclawbator is an AI agent that launches and manages Web3 projects end-to-end. Launch tokens, deploy staking, create marketing agents, airdrop tokens, hire humans, build apps — all through one conversation.

Live at [inclawbate.com](https://inclawbate.com). Powered by Groq. Free to use.

## Talk to It

```bash
# Send a message to the Inclawbator
curl -X POST "https://inclawbate.com/api/inclawbate/agent-chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I want to launch a token called MoonCat on Base",
    "session_id": "optional-session-id"
  }'
# → { reply, function_called, session_id }
```

The agent handles tool selection automatically. Just describe what you need in plain language.

## What It Can Do (21 Tools)

### Launch & Deploy

| Tool | What it does |
|------|-------------|
| **Launch Token** | Deploy a new token on Base (via Clanker) or Solana (via Bags/Meteora). Walks you through name, symbol, description, image, socials. |
| **Deploy Staking** | Create a staking pool for any token via the Staking Factory. Holders stake → earn CLAWS rewards. |
| **Register Project** | Already have a token? Register it in the Inclawbate ecosystem to get staking, agents, and the CLAWS reward flywheel. |

### Manage & Monitor

| Tool | What it does |
|------|-------------|
| **Health Check** | Comprehensive project diagnostic — token price, volume, liquidity, staking stats, and actionable suggestions. |
| **Token Analytics** | Real-time price, volume, liquidity from DexScreener for any token address. |
| **Staking Stats** | Live TVL, APY, total stakers, distribution rates. Optionally check a specific wallet's position. |
| **Project Status** | See all projects launched by a wallet — tokens, staking, chain. |
| **User Workspace** | Everything a connected wallet has built — apps, marketing agents, vaults. |

### Marketing & Growth

| Tool | What it does |
|------|-------------|
| **Create Marketing Agent** | Set up an AI agent that auto-posts to X/Twitter on your project's behalf. Set a schedule and let it run forever. Free. |
| **Book Promo** | Promote your project through the @inclawbate X account. Shoutout, campaign, or featured tier — paid in CLAWS. |
| **Airdrop Tokens** | Distribute tokens to multiple wallets in one transaction via the Disperse contract. |

### Build

| Tool | What it does |
|------|-------------|
| **Build App** | Create a web app using the AI app builder at inclawbate.com/build. No code needed. |
| **Build Landing Page** | Create a branded project page with the AI builder. |
| **Browse Apps** | Discover 12+ community-built apps — games, tools, dashboards. |
| **Suggest App Ideas** | Get app ideas based on your interests (defi, gaming, social, tools, AI). |

### Hire the Council

| Tool | What it does |
|------|-------------|
| **Browse Inclawbators** | See the Inclawbate Council — vetted humans available for design, dev, marketing, content, strategy. |
| **Hire Inclawbator** | Post a request to the Inclawbate Council Telegram group. Council members pick it up. Paid in CLAWS. |

### Info

| Tool | What it does |
|------|-------------|
| **Ecosystem Info** | Overview of Inclawbate — what it is, key links, CLAWS token. |
| **Incubation Info** | Full-service incubation details — token + staking + branding + marketing as a package. |

## API

```
POST https://inclawbate.com/api/inclawbate/agent-chat
```

**Request:**
```json
{
  "message": "Your message here",
  "session_id": "optional — pass to continue a conversation",
  "wallet": "optional — 0x... for personalized responses"
}
```

**Response:**
```json
{
  "reply": "The agent's response text",
  "function_called": "tool_name_if_any",
  "session_id": "use this to continue the conversation"
}
```

The agent picks the right tool automatically based on your message. Multi-turn conversations are supported via `session_id`.

## Example Conversations

```bash
# Launch a token
curl -X POST ".../agent-chat" -d '{"message": "launch a token called DogPark, symbol DPARK, on Base"}'

# Health check
curl -X POST ".../agent-chat" -d '{"message": "how is my project doing?", "wallet": "0x..."}'

# Hire the council
curl -X POST ".../agent-chat" -d '{"message": "I need a logo designed for my project"}'

# Airdrop tokens
curl -X POST ".../agent-chat" -d '{"message": "airdrop 1000 CLAWS to 50 wallets"}'

# Deploy staking
curl -X POST ".../agent-chat" -d '{"message": "create a staking pool for my token 0xABC..."}'

# Book a promo
curl -X POST ".../agent-chat" -d '{"message": "I want to promote my project on the Inclawbate X account"}'
```

## Token

| Detail | Value |
|--------|-------|
| Token | CLAWS |
| Chain | Base |
| Contract | `0x7ca47B141639B893C6782823C0b219f872056379` |
| BaseScan | https://basescan.org/token/0x7ca47B141639B893C6782823C0b219f872056379 |

## Links

- **Talk to it:** https://inclawbate.com
- **Agent page:** https://inclawbate.com/inclawbator
- **App Store:** https://inclawbate.com/apps
- **Staking:** https://inclawbate.com/stake
- **Skills Directory:** https://inclawbate.com/skills
