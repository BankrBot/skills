---
name: bankr
description: AI-powered crypto trading agent via natural language. Use when the user wants to trade crypto (buy/sell/swap tokens), check portfolio balances, view token prices, transfer crypto, manage NFTs, use leverage, bet on Polymarket, deploy tokens, set up automated trading strategies, submit raw transactions, execute calldata, or send transaction JSON. Supports Base, Ethereum, Polygon, Solana, and Unichain. Comprehensive capabilities include trading, portfolio management, market research, NFT operations, prediction markets, leverage trading, DeFi operations, automation, and arbitrary transaction submission.
metadata:
  {
    "clawdbot":
      {
        "emoji": "📺",
        "homepage": "https://bankr.bot",
        "requires": { "bins": ["bankr"] },
      },
  }
---

# Bankr

Execute crypto trading and DeFi operations using natural language through the Bankr CLI.

## Requirements

Install the Bankr CLI:

```bash
bun install -g @bankr/cli
```

Or with npm:

```bash
npm install -g @bankr/cli
```

## Quick Start

### First-Time Setup

```bash
# Authenticate with Bankr (creates account if needed)
bankr login

# Verify your identity
bankr whoami
```

The `bankr login` command gives you two options:

#### Option A: Open the Bankr dashboard (recommended for new users)

The CLI opens [bankr.bot/api](https://bankr.bot/api) in your browser where you:

1. **Sign up / Sign in** — Enter your email and the one-time passcode (OTP) sent to it
2. **Generate an API key** — Create a key with **Agent API** access enabled
3. **Paste the key** — Copy the `bk_...` key back into the CLI prompt

Creating a new account automatically provisions **EVM wallets** (Base, Ethereum, Polygon, Unichain) and a **Solana wallet** — no manual wallet setup needed.

#### Option B: Paste an existing API key

If you already have an API key, select "Paste an existing Bankr API key" and enter it directly. You can also set it without the interactive flow:

```bash
bankr config set apiKey bk_YOUR_KEY_HERE
```

### Verify Setup

```bash
bankr whoami
bankr prompt "What is my balance?"
```

## CLI Command Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `bankr login` | Authenticate with the Bankr API |
| `bankr logout` | Clear stored credentials |
| `bankr whoami` | Show current authentication info |
| `bankr prompt <text>` | Send a prompt to the Bankr AI agent |
| `bankr status <jobId>` | Check the status of a running job |
| `bankr cancel <jobId>` | Cancel a running job |
| `bankr skills` | Show all Bankr AI agent skills with examples |

### Configuration Commands

| Command | Description |
|---------|-------------|
| `bankr config get [key]` | Get config value(s) |
| `bankr config set <key> <value>` | Set a config value |
| `bankr --config <path> <command>` | Use a custom config file path |

Valid config keys: `apiKey`, `apiUrl`, `llmUrl`

Default config location: `~/.bankr/config.json`. Override with `--config` or `BANKR_CONFIG` env var.

### LLM Gateway Commands

| Command | Description |
|---------|-------------|
| `bankr llm models` | List available LLM models |
| `bankr llm setup openclaw [--install]` | Generate or install OpenClaw config |
| `bankr llm setup opencode [--install]` | Generate or install OpenCode config |
| `bankr llm setup claude` | Show Claude Code environment setup |
| `bankr llm setup cursor` | Show Cursor IDE setup instructions |
| `bankr llm claude [args...]` | Launch Claude Code via the Bankr LLM Gateway |

## Core Usage

### Simple Query

For straightforward requests that complete quickly:

```bash
bankr prompt "What is my ETH balance?"
bankr prompt "What's the price of Bitcoin?"
```

The CLI handles the full submit-poll-complete workflow automatically. You can also use the shorthand — any unrecognized command is treated as a prompt:

```bash
bankr What is the price of ETH?
```

### Interactive Prompt

For prompts containing `$` or special characters that the shell would expand:

```bash
# Interactive mode — no shell expansion issues
bankr prompt
# Then type: Buy $50 of ETH on Base

# Or pipe input
echo 'Buy $50 of ETH on Base' | bankr prompt
```

### Manual Job Control

For advanced use or long-running operations:

```bash
# Submit and get job ID
bankr prompt "Buy $100 of ETH"
# → Job submitted: job_abc123

# Check status of a specific job
bankr status job_abc123

# Cancel if needed
bankr cancel job_abc123
```

## LLM Gateway

The [Bankr LLM Gateway](https://docs.bankr.bot/llm-gateway/overview) is a unified API for Claude, Gemini, GPT, and other models. It provides:

- **Multi-provider access** — Anthropic, Google, OpenAI, Moonshot AI, and Alibaba through one API
- **Cost tracking** — Full visibility into token usage and costs per request
- **High availability** — Automatic failover between Vertex AI and OpenRouter
- **SDK compatible** — Works with OpenAI and Anthropic SDKs, no code changes needed

**Base URL:** `https://llm.bankr.bot/v1`

### Available Models

| Model | Provider | Best For |
|-------|----------|----------|
| `claude-opus-4.6` | Anthropic | Most capable, advanced reasoning |
| `claude-sonnet-4.5` | Anthropic | Balanced speed and quality |
| `claude-haiku-4.5` | Anthropic | Fast, cost-effective |
| `gemini-3-pro` | Google | Long context (2M tokens) |
| `gemini-3-flash` | Google | High throughput |
| `gemini-2.5-pro` | Google | Long context, multimodal |
| `gemini-2.5-flash` | Google | Speed, high throughput |
| `gpt-5.2` | OpenAI | Advanced reasoning |
| `gpt-5.2-codex` | OpenAI | Code generation |
| `gpt-5-mini` | OpenAI | Fast, economical |
| `gpt-5-nano` | OpenAI | Ultra-fast, lowest cost |
| `kimi-k2.5` | Moonshot AI | Long-context reasoning |
| `qwen3-coder` | Alibaba | Code generation, debugging |

```bash
# Fetch live model list from the gateway
bankr llm models
```

### Credits

```bash
# Check your LLM gateway credit balance
bankr llm credits
```

### OpenClaw Setup

The fastest way to connect OpenClaw to the gateway:

```bash
# Auto-install Bankr provider into ~/.openclaw/openclaw.json
bankr llm setup openclaw --install
```

This writes the full provider config (base URL, API key, all models) into your OpenClaw config. To preview without writing:

```bash
bankr llm setup openclaw
```

To use a Bankr model as your default in OpenClaw, add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "model": {
        "primary": "bankr/claude-sonnet-4.5"
      }
    }
  }
}
```

The gateway also supports the Anthropic Messages API format. Change the `api` field in the provider config from `"openai-completions"` to `"anthropic-messages"` for Claude-native features like extended thinking.

### Claude Code

```bash
# Print env vars to add to your shell profile
bankr llm setup claude

# Or launch Claude Code directly through the gateway
bankr llm claude
```

### OpenCode

```bash
# Auto-install Bankr provider into ~/.config/opencode/opencode.json
bankr llm setup opencode --install
```

### Cursor

```bash
# Get step-by-step instructions with your API key
bankr llm setup cursor
```

## Capabilities Overview

### Trading Operations

- **Token Swaps**: Buy/sell/swap tokens across chains
- **Cross-Chain**: Bridge tokens between chains
- **Limit Orders**: Execute at target prices
- **Stop Loss**: Automatic sell protection
- **DCA**: Dollar-cost averaging strategies
- **TWAP**: Time-weighted average pricing

**Reference**: [references/token-trading.md](references/token-trading.md)

### Portfolio Management

- Check balances across all chains
- View USD valuations
- Track holdings by token or chain
- Real-time price updates
- Multi-chain aggregation

**Reference**: [references/portfolio.md](references/portfolio.md)

### Market Research

- Token prices and market data
- Technical analysis (RSI, MACD, etc.)
- Social sentiment analysis
- Price charts
- Trending tokens
- Token comparisons

**Reference**: [references/market-research.md](references/market-research.md)

### Transfers

- Send to addresses, ENS, or social handles
- Multi-chain support
- Flexible amount formats
- Social handle resolution (Twitter, Farcaster, Telegram)

**Reference**: [references/transfers.md](references/transfers.md)

### NFT Operations

- Browse and search collections
- View floor prices and listings
- Purchase NFTs via OpenSea
- View your NFT portfolio
- Transfer NFTs
- Mint from supported platforms

**Reference**: [references/nft-operations.md](references/nft-operations.md)

### Polymarket Betting

- Search prediction markets
- Check odds
- Place bets on outcomes
- View positions
- Redeem winnings

**Reference**: [references/polymarket.md](references/polymarket.md)

### Leverage Trading

- Long/short positions (up to 50x crypto, 100x forex/commodities)
- Crypto, forex, and commodities
- Stop loss and take profit
- Position management via Avantis on Base

**Reference**: [references/leverage-trading.md](references/leverage-trading.md)

### Token Deployment

- **EVM (Base)**: Deploy ERC20 tokens via Clanker with customizable metadata and social links
- **Solana**: Launch SPL tokens via Raydium LaunchLab with bonding curve and auto-migration to CPMM
- Creator fee claiming on both chains
- Fee Key NFTs for Solana (50% LP trading fees post-migration)
- Optional fee recipient designation with 99.9%/0.1% split (Solana)
- Both creator AND fee recipient can claim bonding curve fees (gas sponsored)
- Optional vesting parameters (Solana)
- Rate limits: 1/day standard, 10/day Bankr Club (gas sponsored within limits)

**Reference**: [references/token-deployment.md](references/token-deployment.md)

### Automation

- Limit orders
- Stop loss orders
- DCA (dollar-cost averaging)
- TWAP (time-weighted average price)
- Scheduled commands

**Reference**: [references/automation.md](references/automation.md)

### Arbitrary Transactions

- Submit raw EVM transactions with explicit calldata
- Custom contract calls to any address
- Execute pre-built calldata from other tools
- Value transfers with data

**Reference**: [references/arbitrary-transaction.md](references/arbitrary-transaction.md)

## Supported Chains

| Chain    | Native Token | Best For                      | Gas Cost |
| -------- | ------------ | ----------------------------- | -------- |
| Base     | ETH          | Memecoins, general trading    | Very Low |
| Polygon  | MATIC        | Gaming, NFTs, frequent trades | Very Low |
| Ethereum | ETH          | Blue chips, high liquidity    | High     |
| Solana   | SOL          | High-speed trading            | Minimal  |
| Unichain | ETH          | Newer L2 option               | Very Low |

## Common Patterns

### Check Before Trading

```bash
# Check balance
bankr prompt "What is my ETH balance on Base?"

# Check price
bankr prompt "What's the current price of PEPE?"

# Then trade
bankr prompt "Buy $20 of PEPE on Base"
```

### Portfolio Review

```bash
# Full portfolio
bankr prompt "Show my complete portfolio"

# Chain-specific
bankr prompt "What tokens do I have on Base?"

# Token-specific
bankr prompt "Show my ETH across all chains"
```

### Set Up Automation

```bash
# DCA strategy
bankr prompt "DCA $100 into ETH every week"

# Stop loss protection
bankr prompt "Set stop loss for my ETH at $2,500"

# Limit order
bankr prompt "Buy ETH if price drops to $3,000"
```

### Market Research

```bash
# Price and analysis
bankr prompt "Do technical analysis on ETH"

# Trending tokens
bankr prompt "What tokens are trending on Base?"

# Compare tokens
bankr prompt "Compare ETH vs SOL"
```

## API Workflow

Bankr uses an asynchronous job-based API:

1. **Submit** — Send prompt, get job ID
2. **Poll** — Check status every 2 seconds
3. **Complete** — Process results when done

The `bankr prompt` command handles this automatically. For manual job control, use `bankr status <jobId>` and `bankr cancel <jobId>`.

For details on the API structure, job states, polling strategy, and error handling, see:

**Reference**: [references/api-workflow.md](references/api-workflow.md)

### Synchronous Endpoints

For direct signing and transaction submission, Bankr also provides synchronous endpoints:

- **POST /agent/sign** - Sign messages, typed data, or transactions without broadcasting
- **POST /agent/submit** - Submit raw transactions directly to the blockchain

These endpoints return immediately (no polling required) and are ideal for:
- Authentication flows (sign messages)
- Gasless approvals (sign EIP-712 permits)
- Pre-built transactions (submit raw calldata)

**Reference**: [references/sign-submit-api.md](references/sign-submit-api.md)

## Error Handling

Common issues and fixes:

- **Authentication errors** → Run `bankr login` or check `bankr whoami`
- **Insufficient balance** → Add funds or reduce amount
- **Token not found** → Verify symbol and chain
- **Transaction reverted** → Check parameters and balances
- **Rate limiting** → Wait and retry

For comprehensive error troubleshooting, setup instructions, and debugging steps, see:

**Reference**: [references/error-handling.md](references/error-handling.md)

## Best Practices

### Security

1. Never share your API key
2. Start with small test amounts
3. Verify addresses before large transfers
4. Use stop losses for leverage trading
5. Double-check transaction details

### Trading

1. Check balance before trades
2. Specify chain for lesser-known tokens
3. Consider gas costs (use Base/Polygon for small amounts)
4. Start small, scale up after testing
5. Use limit orders for better prices

### Automation

1. Test automation with small amounts first
2. Review active orders regularly
3. Set realistic price targets
4. Always use stop loss for leverage
5. Monitor execution and adjust as needed

## Tips for Success

### For New Users

- Start with balance checks and price queries
- Test with $5-10 trades first
- Use Base for lower fees
- Enable trading confirmations initially
- Learn one feature at a time

### For Experienced Users

- Leverage automation for strategies
- Use multiple chains for diversification
- Combine DCA with stop losses
- Explore advanced features (leverage, Polymarket)
- Monitor gas costs across chains

## Prompt Examples by Category

### Trading

- "Buy $50 of ETH on Base"
- "Swap 0.1 ETH for USDC"
- "Sell 50% of my PEPE"
- "Bridge 100 USDC from Polygon to Base"

### Portfolio

- "Show my portfolio"
- "What's my ETH balance?"
- "Total portfolio value"
- "Holdings on Base"

### Market Research

- "What's the price of Bitcoin?"
- "Analyze ETH price"
- "Trending tokens on Base"
- "Compare UNI vs SUSHI"

### Transfers

- "Send 0.1 ETH to vitalik.eth"
- "Transfer $20 USDC to @friend"
- "Send 50 USDC to 0x123..."

### NFTs

- "Show Bored Ape floor price"
- "Buy cheapest Pudgy Penguin"
- "Show my NFTs"

### Polymarket

- "What are the odds Trump wins?"
- "Bet $10 on Yes for [market]"
- "Show my Polymarket positions"

### Leverage

- "Open 5x long on ETH with $100"
- "Short BTC 10x with stop loss at $45k"
- "Show my Avantis positions"

### Automation

- "DCA $100 into ETH weekly"
- "Set limit order to buy ETH at $3,000"
- "Stop loss for all holdings at -20%"

### Token Deployment

**Solana (LaunchLab):**

- "Launch a token called MOON on Solana"
- "Launch a token called FROG and give fees to @0xDeployer"
- "Deploy SpaceRocket with symbol ROCK"
- "Launch BRAIN and route fees to 7xKXtg..."
- "How much fees can I claim for MOON?"
- "Claim my fees for MOON" (works for creator or fee recipient)
- "Show my Fee Key NFTs"
- "Claim my fee NFT for ROCKET" (post-migration)
- "Transfer fees for MOON to 7xKXtg..."

**EVM (Clanker):**

- "Deploy a token called BankrFan with symbol BFAN on Base"
- "Claim fees for my token MTK"

### Arbitrary Transactions

- "Submit this transaction: {to: 0x..., data: 0x..., value: 0, chainId: 8453}"
- "Execute this calldata on Base: {...}"
- "Send raw transaction with this JSON: {...}"

### Sign API (Synchronous)

Direct message signing without AI processing:

```bash
# Sign a plain text message
curl -X POST "https://api.bankr.bot/agent/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "personal_sign", "message": "Hello, Bankr!"}'

# Sign EIP-712 typed data (permits, orders)
curl -X POST "https://api.bankr.bot/agent/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "eth_signTypedData_v4", "typedData": {...}}'

# Sign a transaction without broadcasting
curl -X POST "https://api.bankr.bot/agent/sign" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"signatureType": "eth_signTransaction", "transaction": {"to": "0x...", "chainId": 8453}}'
```

### Submit API (Synchronous)

Direct transaction submission without AI processing:

```bash
# Submit a raw transaction
curl -X POST "https://api.bankr.bot/agent/submit" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {"to": "0x...", "chainId": 8453, "value": "1000000000000000000"},
    "waitForConfirmation": true
  }'
```

**Reference**: [references/sign-submit-api.md](references/sign-submit-api.md)

## Resources

- **Documentation**: https://docs.bankr.bot
- **LLM Gateway Docs**: https://docs.bankr.bot/llm-gateway/overview
- **API Key Management**: https://bankr.bot/api
- **Terminal**: https://bankr.bot/terminal
- **CLI Package**: https://www.npmjs.com/package/@bankr/cli
- **Twitter**: @bankr_bot

## Troubleshooting

### CLI Not Found

```bash
# Verify installation
which bankr

# Reinstall if needed
bun install -g @bankr/cli
```

### Authentication Issues

```bash
# Check current auth
bankr whoami

# Re-authenticate
bankr login
```

### API Errors

See [references/error-handling.md](references/error-handling.md) for comprehensive troubleshooting.

### Getting Help

1. Check error message in CLI output
2. Run `bankr whoami` to verify auth
3. Consult relevant reference document
4. Test with simple queries first (`bankr prompt "What is my balance?"`)

---

**Pro Tip**: The most common issue is not specifying the chain for tokens. When in doubt, always include "on Base" or "on Ethereum" in your prompt.

**Security**: Keep your API key private. Never commit your config file to version control. Only trade amounts you can afford to lose.

**Quick Win**: Start by checking your portfolio (`bankr prompt "Show my portfolio"`) to see what's possible, then try a small $5-10 trade on Base to get familiar with the flow.
