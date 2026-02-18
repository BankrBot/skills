# Bankr CLI Tools

These are the Bankr CLI commands scoped to the token launch flow. Research
and evidence gathering use the platform's native tools (web search, browser),
not Bankr.

## Wallet

Set up before launching.

```
bankr login                           — authenticate with Bankr API
bankr whoami                          — show wallets, social accounts, connection status
bankr prompt "what are my balances?"  — check wallet has funds to deploy
```

## Launch

Deploy a token on Base. Two paths:

**Structured** (always pass `-y` to skip interactive prompts):
```
bankr launch --name "TESTCOIN" --fee "@creator" --fee-type x -y
```

**Natural language:**
```
bankr prompt "deploy a token called AgentCoin with symbol AGENT on base"
```

**Parameters and what they mean:**

- `--name` — The token name. This becomes the brand. It IS the narrative
  compressed to one word. Memeability and clarity both matter.
- `--image <url>` — Token image. First impression for every potential buyer.
  Drives social sharing. Skip it and the token looks abandoned.
- `--tweet <url>` — Anchors the launch to a social moment. Creates initial
  momentum. Without it, launch has no context for outsiders to discover.
- `--fee <recipient>` — Who earns the creator's share of trading fees (see
  Fee Splits below). This is how the builder makes money. Can be the
  builder's own handle, a community wallet, or an influencer to align
  incentives. If omitted, fees go to the deployer's Bankr wallet.
- `--fee-type` — How to resolve the fee recipient: `x` (X/Twitter handle),
  `farcaster`, `ens`, or `wallet` (raw address). Default: `x`.

## Fee splits

Every trade on a Bankr-launched token charges a pool fee. That fee is split
automatically on-chain. Fees accumulate until the creator claims them.

Pool fee: **1.2%** on every trade, split as:

| Recipient | Share | Description |
|-----------|-------|-------------|
| Creator | 57% | The `--fee` recipient (or deployer if omitted) |
| Bankr | 36.1% | Protocol fee — goes to the Bankr wallet |
| Alt | 1.9% | Secondary protocol recipient |
| Doppler | 5% | Underlying protocol (airlock owner) |

### Bankr wallet

Bankr's share of trading fees flows directly to a protocol-owned wallet.
These fees fund:

- **Agent operating costs** — LLM inference, RPC calls, gas sponsorship
- **Platform development** — ongoing feature work and infrastructure
- **Agent autonomy** — an agent that launches tokens with Bankr earns
  revenue it can use to pay for its own API costs and fund its own
  development, creating a self-sustaining loop

For builders launching via an agent, this means the agent's operational
costs are partially offset by every trade on every token it helps deploy.
The more successful the tokens, the more self-sufficient the agent becomes.

## Monitor and claim

Track fees, claim them, and move funds after launch.

```
bankr prompt "how much fees have I earned?"
bankr prompt "show my deployed tokens with fees"
bankr prompt "claim my fees for AgentCoin"
```

Claimed fees land in the builder's Bankr wallet. From there:

- **Transfer via Bankr** — `bankr prompt "send 0.1 ETH to 0x..."` to move
  funds to any wallet.
- **Sign into Terminal** — log in at terminal.bankr.fun with the same
  auth method used for `bankr login` to manage the wallet directly.
