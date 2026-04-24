# Trade Router MCP

**Non-custodial Solana trading API for AI agents.** One integration for swaps, MEV-protected execution, wallet holdings, limit orders, trailing stops, DCA, and TWAP — and your private key never leaves the machine running this MCP server.

[![Security: non-custodial](https://img.shields.io/badge/Security-Non%20Custodial-green.svg)](./SECURITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Trades executed](https://img.shields.io/badge/Trades-1000%2B%20live-brightgreen.svg)](https://traderouter.ai/)

## Is this safe?

**Yes, and here's exactly why.** Your private key is read once from the `PRIVATE_KEY` environment variable, used for local signing, and never transmitted, logged, or persisted. Only signed transactions leave your machine. See [SECURITY.md](./SECURITY.md) for the full threat model, data flow diagram, and permissions manifest.

**Signing flow:**

1. Agent calls `swap` tool → MCP sends wallet *address* (public key) to api.traderouter.ai
2. API returns an unsigned transaction
3. **MCP signs the tx locally** using the private key
4. The *signed* transaction is submitted to `/protect` (Jito MEV-protected bundle)
5. Server confirms, returns balance changes. Private key never crosses the network.

## Install

```bash
# via npm (public)
npm install -g @traderouter/mcp

# via Claude/Cursor/Cline config (~/.cursor/mcp_servers.json or similar)
{
  "traderouter": {
    "command": "npx",
    "args": ["-y", "@traderouter/mcp"],
    "env": {
      "PRIVATE_KEY": "<your-solana-base58-private-key>"
    }
  }
}
```

## Quickstart

```bash
# 1. Export your key (dedicated trading wallet, funded with 1-5 SOL for testing)
export PRIVATE_KEY=<base58 string>

# 2. Try a dry-run swap (no actual submission)
TRADEROUTER_DRY_RUN=1 npx @traderouter/mcp

# 3. Or use the REST API directly (see traderouter.ai for full docs)
curl -X POST https://api.traderouter.ai/swap \
  -H "Content-Type: application/json" \
  -d '{"wallet":"YourPubkey","token":"MintAddress","action":"buy","amount":"0.1"}'
```

## Features

### REST endpoints

| Endpoint | Purpose |
|---|---|
| `POST /swap` | Build an unsigned swap transaction (multi-DEX: Raydium, PumpSwap, Orca, Meteora) |
| `POST /protect` | Submit signed tx via Jito bundle — MEV-protected, returns confirmed balance changes |
| `POST /holdings` | Most accurate wallet scan on Solana — catches tokens standard RPC misses |
| `GET /mcap` | Market cap + price for any token |
| `GET /flex` | Trade card PNG generation |
| `GET /security` | Server trust anchor public key |

### WebSocket (`wss://api.traderouter.ai/ws`)

Persistent connection for server-side order monitoring:
- Limit orders (by mcap or price)
- Trailing stops (percentage or absolute)
- DCA (dollar-cost averaging)
- TWAP (time-weighted average price)
- Combo orders (limit + trailing)

Server polls mcap ~every 5s. When an order triggers, you receive an unsigned tx → sign locally → submit.

## Agent integration

- **MCP-compatible** — drops into Claude Desktop, Cursor, Cline, any MCP client
- **SKILL.md** — OpenClaw agent skill description for discoverability
- **llms.txt** — LLM-readable product summary
- **OpenAPI 3.1 spec** — autogenerate clients in any language

Reference clients available in:
- Python: [`trader_mcp.py`](./trader_mcp.py)
- TypeScript/Node: [`traderouter-mcp.mjs`](./traderouter-mcp.mjs)

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `PRIVATE_KEY` | *(required)* | Solana base58-encoded private key. Local use only. |
| `SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Optional custom RPC for reads |
| `TRADEROUTER_DRY_RUN` | `0` | Set to `1` to simulate without submitting |
| `MAX_DAILY_LOSS_SOL` | *(unset)* | Optional daily loss cap. Agent refuses trades if same-day loss exceeds this. |
| `TRADEROUTER_LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |

## Fees

Flat **1% fee on swap volume**, embedded in the transaction routing at `/protect`. No subscription, no API key, no monthly minimums. Read-only endpoints (`/holdings`, `/mcap`) are free.

## Why Trade Router over alternatives

| Concern | Trade Router | Building it yourself |
|---|---|---|
| Swap routing | Multi-DEX automatic | Pick one (Jupiter/Raydium SDK) |
| Wallet holdings | Most accurate on Solana (validated in production vs. Helius) | Helius + custom parsing |
| MEV protection | `/protect` → Jito bundles | Raw Jito integration + bundle logic |
| Limit / trailing / DCA / TWAP | WebSocket, server monitors | Self-host + cron + price feed |
| API keys / auth | **None** (wallet = identity) | Signup flow, key rotation, rate limits |
| Setup time | 30 seconds | 3-6 months |

## Architecture

- **Stateless MCP server** — no local database, no persistent state beyond the env var
- **Non-custodial** — see [SECURITY.md](./SECURITY.md)
- **Ed25519 signature verification** — all `order_filled` events from the server are verified against a hard-coded trust anchor before acceptance
- **Multi-DEX routing** — Raydium, PumpSwap, Orca, Meteora selected per-token based on liquidity

## Links

- **Docs / API reference**: [traderouter.ai](https://traderouter.ai/)
- **OpenAPI spec**: [traderouter.ai/openapi.yaml](https://traderouter.ai/openapi.yaml)
- **llms.txt**: [traderouter.ai/llms.txt](https://traderouter.ai/llms.txt)
- **X/Twitter**: [@trade_router](https://x.com/trade_router)
- **Moltbook**: [moltbook.com/u/traderouter](https://moltbook.com/u/traderouter)

## Security disclosure

Found a vulnerability? Email **security@traderouter.ai** or use GitHub Security Advisories. See [SECURITY.md](./SECURITY.md) for full policy.

## License

MIT. See [LICENSE](./LICENSE).

## Changelog

### 1.4.0 (2026-04-23)
- Added comprehensive `SECURITY.md` documenting the non-custodial threat model and data flow
- Added `LICENSE` (MIT)
- README rewrite: security-first (was feature-first)
- No behavior changes — pure documentation update to address automated scanner "suspicious" verdicts that cannot infer the non-custodial flow from static behavior

### 1.3.0 (prior)
- Combo orders
- Multi-DEX routing across Raydium, PumpSwap, Orca, Meteora
- WebSocket TWAP / DCA improvements
