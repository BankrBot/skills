# Callput MCP Server Setup Guide

## 1. Overview

This guide covers the complete setup of the Callput MCP (Model Context Protocol) server, which enables AI agents to scan, validate, and execute options spreads on the Base network.

The Callput MCP server supports two target environments:

- **Local Development & OpenClaw** — Direct configuration with a private key for testing, development, and standalone agent deployments
- **Bankr Integration** — Delegated signing where Bankr agent handles signing and broadcasting (no private key needed in MCP)

This guide walks you through prerequisites, installation, configuration, and verification for both environments.

---

## 2. Prerequisites

### System Requirements

You must have the following tools installed on your system:

**Node.js 18 or higher**

Check your version:
```bash
node --version
```

Expected output: `v18.0.0` or higher (e.g., `v20.11.0`, `v22.3.0`)

**npm 8 or higher**

Check your version:
```bash
npm --version
```

Expected output: `8.0.0` or higher (e.g., `9.6.0`, `10.2.0`)

### Network Requirements

**Base Mainnet RPC Endpoint**

The MCP server requires a Base Mainnet RPC endpoint to query options chains and simulate spreads. You have two options:

1. **Free Public RPC** (suitable for development and dry-runs)
   ```
   https://mainnet.base.org
   ```

2. **Paid RPC Providers** (recommended for production)
   - **Alchemy**: https://base-mainnet.g.alchemy.com/v2/{YOUR_API_KEY}
   - **Infura**: https://base-mainnet.infura.io/v3/{YOUR_PROJECT_ID}

### API Keys & Credentials

**Private Key (Optional for Standalone, NOT needed for Bankr)**

If you plan to run the server in **standalone mode with live trading**, you need an Ethereum private key for the Base network.

- A private key for a Base Mainnet wallet (must have ETH for gas and collateral for spreads)
- The key must start with `0x` and be 66 characters (32 bytes in hex)
- **Never commit private keys to version control**
- If using **Bankr**, you do NOT need a private key—signing is delegated to Bankr's API

**Example private key format:**
```
0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
```

---

## 3. Step 1: Clone & Install

Clone the Callput MCP repository and install dependencies:

```bash
git clone https://github.com/ayggdrasil/callput-option-agent.git
cd callput-option-agent
npm install
```

**Expected output:**

```
npm notice created a lockfile as package-lock.json
added 87 packages from 26 contributors in 8.234s

up to date, audited 87 packages in 1.234s
0 vulnerabilities found
```

After installation completes, verify that `node_modules` was created:

```bash
ls -la node_modules/@modelcontextprotocol/sdk
```

---

## 4. Step 2: Build

Compile TypeScript into JavaScript:

```bash
npm run build
```

**Expected output:**

```
tsc
```

The build script runs the TypeScript compiler with no visible output (which is good—it means no errors). To verify the build succeeded, check for the compiled output:

```bash
ls build/index.js
```

**Expected output:**

```
build/index.js
```

If the file exists, the build was successful. You can also verify all MCP tools were compiled:

```bash
ls -la build/
```

This should show compiled `.js` files for the main entry point and any smoke test utilities.

---

## 5. Step 3: MCP Configuration — Two Paths

The Callput MCP server can be configured in two ways depending on your deployment environment.

### Path A: Standalone or OpenClaw (with Private Key)

Use this configuration if you are running the MCP server directly with a private key for signing transactions. The MCP server receives tool calls from the agent and returns unsigned transactions. The agent (or agent runtime) is responsible for signing and broadcasting.

#### Configuration Block

Add this to your MCP config file:

```json
{
  "mcpServers": {
    "callput": {
      "command": "node",
      "args": ["/absolute/path/to/callput-option-agent/build/index.js"],
      "env": {
        "CALLPUT_RPC_URL": "https://mainnet.base.org",
        "CALLPUT_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

#### Config File Locations

Choose the appropriate location for your environment:

**Claude Desktop (macOS):**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Claude Desktop (Windows):**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**OpenClaw:**
```
~/.openclaw/mcp_config.json
```

**Generic/Custom:**
Any JSON file that your MCP client reads at startup.

#### Configuration Notes

- Replace `/absolute/path/to/callput-option-agent/build/index.js` with the actual absolute path to your cloned repository
- Use absolute paths (not relative paths like `./build/index.js`) to ensure the MCP server can be found regardless of the current working directory
- `CALLPUT_PRIVATE_KEY` is **optional** for dry-run mode (scanning spreads without executing), but **required** for live trading (executing spreads)
- `CALLPUT_RPC_URL` defaults to `https://mainnet.base.org` if not specified, but you can override it with a paid RPC provider for better reliability

#### Example with Alchemy (Production)

```json
{
  "mcpServers": {
    "callput": {
      "command": "node",
      "args": ["/Users/alice/projects/callput-option-agent/build/index.js"],
      "env": {
        "CALLPUT_RPC_URL": "https://base-mainnet.g.alchemy.com/v2/your-alchemy-api-key",
        "CALLPUT_PRIVATE_KEY": "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      }
    }
  }
}
```

---

### Path B: Bankr Integration (NO Private Key)

Use this configuration if your agent is running under Bankr. The MCP server operates in read-only mode (scan, query, build unsigned transactions). Bankr's agent runtime receives unsigned transactions from the MCP server and handles signing via its secure internal API, then broadcasts.

#### Configuration Block

Add this to your MCP config file:

```json
{
  "mcpServers": {
    "callput": {
      "command": "node",
      "args": ["/absolute/path/to/callput-option-agent/build/index.js"],
      "env": {
        "CALLPUT_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

#### Key Differences

- **No `CALLPUT_PRIVATE_KEY`** — Bankr agent retains the private key securely; MCP server never sees it
- **Passive MCP server** — Returns unsigned transactions; Bankr agent calls its own `/agent/sign` API to sign and `/agent/submit` to broadcast
- MCP server role: scan spreads, validate strikes, build unsigned transactions, query portfolio state, poll execution status
- Full live trading supported without exposing a private key to the MCP process

#### Security Architecture

The correct flow is:
1. Bankr agent calls MCP tools (e.g., `callput_execute_spread`)
2. MCP returns `unsigned_tx` with fields `{to, data, value, chain_id}`
3. Bankr agent internally calls `/agent/sign` with the unsigned transaction
4. Bankr agent calls `/agent/submit` with the signed transaction
5. Bankr agent calls `callput_get_request_key_from_tx(tx_hash)` to retrieve the request key for P&L tracking

In this model, the MCP server never calls Bankr—it is purely a passive tool that responds to requests.

---

## 6. Step 4: Verify Installation

After configuration, test that the MCP server is working correctly by making two sample MCP tool calls.

### Test 1: Scan Spreads (Dry-Run)

Scan for profitable ETH bullish call spreads without executing:

```json
{
  "name": "callput_scan_spreads",
  "arguments": {
    "underlying": "ETH",
    "position_type": "bullish",
    "max_results": 5,
    "dry_run": true
  }
}
```

**Expected response:**

```json
{
  "status": "success",
  "spreads": [
    {
      "name": "ETH Bullish Call Spread",
      "short_strike": 3000,
      "long_strike": 3100,
      "expiry": 1712102400,
      "credit": 250,
      "max_profit": 750,
      "max_loss": 250
    }
  ],
  "chain_available": true,
  "rpc_status": "connected"
}
```

### Test 2: Portfolio Summary

Query the portfolio summary for a test address (does not require signing):

```json
{
  "name": "callput_portfolio_summary",
  "arguments": {
    "wallet_address": "0x1234567890123456789012345678901234567890"
  }
}
```

**Expected response:**

```json
{
  "status": "success",
  "total_spreads": 2,
  "total_collateral_locked": "2.5",
  "total_premium_collected": "0.8",
  "open_positions": [
    {
      "id": "spread_001",
      "underlying": "ETH",
      "position_type": "bullish",
      "status": "open"
    }
  ]
}
```

If both calls succeed, your installation is correct.

---

## 7. Environment Variables

The MCP server reads the following environment variables:

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CALLPUT_RPC_URL` | No | `https://mainnet.base.org` | Base Mainnet RPC endpoint for queries and simulations |
| `CALLPUT_PRIVATE_KEY` | For Path A (standalone) live mode only | (none) | 32-byte Ethereum private key (0x prefix); omit for Path B (Bankr) |

---

## 8. Verification Checklist

Before using the MCP server in production, verify all of the following:

- [ ] Node.js version is 18 or higher (`node --version`)
- [ ] npm version is 8 or higher (`npm --version`)
- [ ] Repository cloned to disk and `npm install` completed without errors
- [ ] `npm run build` succeeded and `build/index.js` exists
- [ ] MCP configuration file is in place with correct absolute path to `build/index.js`
- [ ] (Path A: Standalone/OpenClaw) `CALLPUT_PRIVATE_KEY` is set and valid, OR (Path B: Bankr) config omits `CALLPUT_PRIVATE_KEY` entirely
- [ ] `callput_scan_spreads` MCP call returns results (query mode works)
- [ ] `callput_portfolio_summary` MCP call returns results (RPC connectivity verified)

---

## 9. Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `command not found: node` | Node.js not installed or not in PATH | Install Node.js 18+ from https://nodejs.org; verify with `node --version` |
| `build/index.js` does not exist | Build failed or TypeScript compilation error | Run `npm run build` and check for error messages; verify TypeScript config exists |
| `ENOENT: no such file or directory` in MCP logs | Absolute path in config is incorrect | Verify the path to `build/index.js` exists; use `pwd` in repo root and copy full path into config |
| RPC call times out | RPC endpoint is unreachable or rate-limited | Try the free public RPC `https://mainnet.base.org`; or use a paid provider (Alchemy, Infura) with higher rate limits |
| `CALLPUT_PRIVATE_KEY invalid` (Path A only) | Private key format is incorrect or missing `0x` prefix | Ensure key is 66 characters and starts with `0x`; never use partial keys |
| `execute_spread` returns unsigned_tx, but Bankr agent cannot sign | MCP worked correctly; check Bankr `/agent/sign` endpoint | Verify Bankr agent runtime is operational and `/agent/sign` API is reachable; MCP is passive and cannot call Bankr |

---

## 10. Next Steps

### For OpenClaw Deployments

Refer to the OpenClaw integration guide for agent-specific setup and testing:

```
../OPENCLAW_GUIDE.md
```

### For Bankr Integrations

Refer to the Bankr integration guide for secure signing and execution:

```
../BANKR_GUIDE.md
```

### For Local Testing

Start with dry-run mode to test MCP connectivity without risking funds:

```bash
npm run verify:mcp
```

This runs a smoke test that verifies RPC connectivity and all MCP tools.

### For Live Trading

Once verified, you can execute spreads by:

1. Setting a valid `CALLPUT_PRIVATE_KEY` and removing `dry_run: true`
2. Or setting `BANKR_MODE=true` and letting Bankr handle signing
3. Calling `callput_execute_spread` with your selected spread parameters

---

## Support

For issues, questions, or feature requests, open an issue on GitHub:

https://github.com/ayggdrasil/callput-option-agent/issues

For security concerns or private key handling questions, see the [Security](#security) section of the main README.
