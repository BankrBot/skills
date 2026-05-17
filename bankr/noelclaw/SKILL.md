---
name: noelclaw
description: Crypto AI agent skill — live market signals, whale tracking, autonomous research, and Base DeFi tools. Use when the user wants to get live crypto prices, trending tokens, or top-20 market data, fetch trading signals for BTC/ETH with entry/TP/SL targets, check signal history and winrates, track whale wallet movements and smart money flows, get daily performance recaps, run on-demand research on any token or trend, start an autonomous 8-hour research shift with Telegram reports, check a research report for a specific token, swap tokens on Base mainnet, send ETH or ERC-20 tokens to any address, view wallet portfolio with USD values, chat with the Noel DeFi AI for market analysis and trade ideas, or configure a personal Telegram bot for signal and alert delivery. Powered by Base mainnet with server-side encrypted wallets.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚡",
        "homepage": "https://noelclaw.fun",
        "requires": { "bins": ["npx"] },
      },
  }
---

# Noelclaw

Live crypto signals, whale tracking, autonomous research, and Base DeFi — all via natural language. Noelclaw runs as an MCP server and gives Claude, Cursor, Hermes, and any MCP-compatible client access to real-time on-chain intelligence and a server-side Base wallet.

## Install

### Hermes

```bash
hermes mcp add noelclaw --command npx --args @noelclaw/research --env NOELCLAW_CONVEX_URL=https://valuable-fish-533.convex.site
```

### Claude Code

```bash
claude mcp add noelclaw -- npx @noelclaw/research
```

### Claude Desktop / Cursor / Windsurf

Add to your MCP config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "noelclaw": {
      "command": "npx",
      "args": ["@noelclaw/research"],
      "env": {
        "NOELCLAW_CONVEX_URL": "https://valuable-fish-533.convex.site"
      }
    }
  }
}
```

Restart your client after adding the config. Tools appear automatically.

### npm (global install)

```bash
npm install -g @noelclaw/research
```

Then use `noelclaw-research` as the command instead of `npx @noelclaw/research`.

## Tools

### Market Data & Research (11)

| Tool | Description |
|------|-------------|
| `get_market_data` | Live top-20 coins by market cap, trending tokens, and key prices for BTC/ETH/SOL. Results sent to Telegram if configured. |
| `get_token_data` | Price, 24h change, market cap, and volume for any token or set of tokens. |
| `get_latest_signal` | Latest BTC and/or ETH 1H trading signals — entry price, take profit targets, stop loss, confidence score, and reasoning. Generated daily at 08:00 UTC. |
| `get_signal_history` | Signal history with win/loss record, winrate stats, best/worst PnL, and avg return over a configurable lookback period. |
| `get_whale_alerts` | Recent large wallet movements, smart money flows, and CEX inflow/outflow alerts for BTC and ETH. |
| `get_daily_recap` | Today's trading performance recap with BTC/ETH win counts, winrates, avg PnL, and an AI-written review. |
| `run_research` | On-demand research snapshot on any crypto topic — like Perplexity but for crypto. Returns overview, key findings, market impact, affected tokens, sentiment, and what to watch. |
| `start_research` | Start an 8-hour autonomous research shift. Noel monitors markets, on-chain signals, and news — delivering reports to your Telegram at 2.5h, 5h, and 8h intervals. |
| `stop_research` | Stop an active autonomous research shift early. |
| `get_research_status` | Check the status of a running research shift and view recent reports. |
| `get_research_report` | Get the latest autonomous research report for a specific token or topic. |

### Wallet & DeFi (4)

| Tool | Description |
|------|-------------|
| `get_portfolio` | Base wallet address and full token portfolio — all balances with USD values. Auto-creates a secure encrypted wallet on first use. |
| `swap_tokens` | Swap ETH, USDC, USDT, DAI, or WETH on Base mainnet via 0x Permit2. Amount in smallest unit (wei for ETH/WETH, 6 decimals for USDC/USDT). |
| `send_token` | Send ETH or ERC-20 tokens (USDC, USDT, DAI, WETH) to any address on Base mainnet. |
| `ask_noel` | Chat with Noel DeFi AI — market outlook, trade ideas, on-chain analysis, and crypto research with live market context. Results sent to Telegram if configured. |

### Configuration (1)

| Tool | Description |
|------|-------------|
| `set_telegram` | Configure a personal Telegram bot token and chat ID. Noel delivers signals, whale alerts, and research reports directly to your Telegram. |

## Usage Examples

```
# Get live market data
get_market_data

# Get specific token data
get_token_data(question: "show me price and volume for SOL, ARB, and OP")

# Latest BTC signal
get_latest_signal(token: "BTC")

# Signal history for the past 14 days
get_signal_history(token: "ETH", days: 14)

# Recent whale activity
get_whale_alerts(hours: 6)

# Today's recap
get_daily_recap

# On-demand research
run_research(query: "What is the impact of Ethereum ETF approval on Base ecosystem?")

# Start an 8-hour autonomous research shift
start_research(userId: "your-id")

# Check research shift status
get_research_status(userId: "your-id")

# Get latest report for a token
get_research_report(userId: "your-id", token: "SOL")

# Stop an active shift
stop_research(userId: "your-id")

# View your Base wallet portfolio
get_portfolio(userId: "your-id")

# Swap 0.1 ETH for USDC
swap_tokens(userId: "your-id", fromToken: "ETH", toToken: "USDC", amount: "100000000000000000")

# Send 50 USDC to an address
send_token(userId: "your-id", token: "USDC", toAddress: "0x...", amount: "50000000")

# Ask Noel a question
ask_noel(question: "Is ETH forming a breakout on the 1H chart?")

# Configure Telegram
set_telegram(userId: "your-id", telegramBotToken: "1234567890:ABC...", telegramChatId: "987654321")
```

## Wallet Setup

Noelclaw wallets are server-side encrypted wallets on Base mainnet — no external wallet popup, no browser extension required. Your wallet is created automatically the first time you call `get_portfolio`. Fund it with ETH or USDC on Base to use swaps and sends.

```
# First use — creates your wallet
get_portfolio(userId: "your-id")

# → Returns your Base address and current balances
# Fund the address with ETH or USDC on Base, then:

swap_tokens(userId: "your-id", fromToken: "ETH", toToken: "USDC", amount: "10000000000000000")
```

## Telegram Delivery

Most tools accept an optional `userId` parameter. When a `userId` is provided and Telegram is configured for that user, results are delivered directly to your bot — signals, whale alerts, research reports, and market data.

**Setup:**

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram — get a bot token
2. Get your chat ID from [@userinfobot](https://t.me/userinfobot)
3. Run `set_telegram` with your userId, bot token, and chat ID

**Autonomous research reports** are delivered at **2.5h, 5h, and 8h** into each shift.

## Token Amounts

Noelclaw uses smallest-unit amounts for on-chain accuracy:

| Token | Decimals | Example: 1 token |
|-------|----------|------------------|
| ETH / WETH | 18 | `1000000000000000000` |
| USDC / USDT | 6 | `1000000` |
| DAI | 18 | `1000000000000000000` |

## Custom Deployment

By default, Noelclaw uses the hosted backend. To point to your own Convex deployment:

```bash
NOELCLAW_CONVEX_URL="https://your-deployment.convex.site" npx @noelclaw/research
```

Or in your MCP config's `env` block:

```json
{
  "mcpServers": {
    "noelclaw": {
      "command": "npx",
      "args": ["@noelclaw/research"],
      "env": {
        "NOELCLAW_CONVEX_URL": "https://your-deployment.convex.site"
      }
    }
  }
}
```

## Troubleshooting

| Error | Fix |
|-------|-----|
| Tools not appearing | Restart your MCP client after adding the config |
| `Noelclaw API error: 404` | Wrong `NOELCLAW_CONVEX_URL` or deployment not live |
| Server starts but no response | Normal — it waits for MCP stdin, not HTTP |
| `userId` required error | Pass your user ID (any stable string that identifies you) |
| Swap fails | Check that your wallet has sufficient balance on Base; fund via `get_portfolio` first |
| No Telegram messages | Run `set_telegram` with your bot token and chat ID |

## Resources

- **npm**: https://npmjs.com/package/@noelclaw/research
- **Docs**: https://docs.noelclaw.fun
- **GitHub**: https://github.com/noelclaw/noelmcp
- **Web app**: https://noelclaw.fun
