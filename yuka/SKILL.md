---
name: yuka
description: Launch ERC-20 tokens on Base via Flaunch and earn 80% of trading fees automatically. Use when an agent wants to create its own token, monitor claimable ETH fees, or claim fee earnings to its wallet. Handles wallet creation, token deployment, social metadata, fee checking, and fee claiming — all in one CLI.
---

# YUKA — Agent Token Launchpad

YUKA is a CLI for AI agents to launch ERC-20 tokens on [Flaunch](https://flaunch.gg) (Base) and automatically earn 80% of all trading fees.

## Install

```bash
npm install -g hi-yuka
```

Or run without installing:

```bash
npx hi-yuka <command>
```

## Quick Start

```bash
# 1. Create/show wallet
yuka wallet

# 2. Fund the wallet with Base ETH (shown in output)
yuka fund

# 3. Launch a token
yuka launch --name "Degen Cat" --symbol "DCAT" --description "the cat that degens"

# 4. Check fees earned
yuka fees

# 5. Claim fees to wallet
yuka claim
```

## Commands

### `wallet`

Show agent wallet address and ETH balance. Creates the wallet on first run.

```bash
yuka wallet [--json]
```

**Output**: `address`, `balance` (ETH), `network`

---

### `fund`

Show how to fund the wallet with ETH on Base.

```bash
yuka fund [--json]
```

**Output**: `address`, `balance`, funding methods (Bridge / Coinbase / direct transfer)

---

### `launch`

Deploy a new ERC-20 token on Flaunch (Base mainnet). Costs ~0.0001 ETH gas.

```bash
yuka launch \
  --name "My Token" \
  --symbol "MTKN" \
  [--description "short description"] \
  [--image /path/to/image.png] \
  [--website https://mytoken.xyz] \
  [--twitter https://x.com/mytoken] \
  [--telegram https://t.me/mytoken] \
  [--testnet] \
  [--json]
```

**Parameters**:

| Flag | Required | Description |
|------|----------|-------------|
| `--name` | ✅ | Full token name (e.g. "Degen Cat") |
| `--symbol` | ✅ | Ticker symbol, max 8 chars (e.g. "DCAT") |
| `--description` | — | Short token description |
| `--image` | — | Path to PNG/JPG image (max 5 MB). Auto-generated if omitted. |
| `--website` | — | Project website URL |
| `--twitter` | — | Twitter/X profile URL |
| `--telegram` | — | Telegram group URL |
| `--testnet` | — | Deploy to Base Sepolia instead of mainnet |
| `--json` | — | Machine-readable JSON output |

**Output**: `tokenAddress`, `transactionHash`, `flaunchUrl`, `name`, `symbol`, `network`

**Fee structure**: Creator earns **80%** of all trading fees. Flaunch keeps 20%.

---

### `status`

List all tokens launched by this wallet.

```bash
yuka status [--testnet] [--json]
```

**Output**: Array of tokens with `name`, `symbol`, `tokenAddress`, `marketCapETH`, `createdAt`, `flaunchUrl`

---

### `price`

Get live market data for any token launched on Flaunch.

```bash
yuka price <tokenAddress> [--amount <eth>] [--testnet] [--json]
```

**Parameters**:
- `<tokenAddress>`: Token contract address (`0x...`)
- `--amount`: ETH amount to show % of market cap

**Output**: `name`, `symbol`, `marketCapETH`, `priceChange24h`, `volume24hETH`, `holders`, `flaunchUrl`

---

### `fees`

Check how much ETH is claimable from trading fees.

```bash
yuka fees [--testnet] [--json]
```

**Output**: `claimable` (ETH), `afterProtocolFee` (ETH), `protocolFee` (%), `walletBalance`, `canClaim` (bool)

---

### `claim`

Claim all accumulated trading fees to the wallet.

```bash
yuka claim [--testnet] [--json]
```

**Output**: `transactionHash`, claimed amount (ETH), `wallet`, `network`

> **Note**: Requires ETH for gas. Run `yuka fees` first to check if claiming is worth it.

---

## JSON Mode

All commands support `--json` for structured output:

```bash
# Success
yuka wallet --json
# {"ok":true,"command":"wallet","data":{"address":"0x...","balance":"0.05","network":"Base"}}

# Error
yuka launch --name "..." --json
# {"ok":false,"command":"launch","error":{"code":"INSUFFICIENT_FUNDS","message":"wallet needs ETH for gas"}}
```

---

## Typical Agent Workflow

```bash
# Step 1: Get wallet address
ADDRESS=$(yuka wallet --json | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['address'])")

# Step 2: Fund wallet (agent sends ETH to $ADDRESS)

# Step 3: Launch token
RESULT=$(yuka launch --name "YUKA" --symbol "YUKA" --description "AI agent launchpad" --json)
TOKEN=$(echo $RESULT | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokenAddress'])")

# Step 4: Check fees periodically
yuka fees --json | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('ok') and d['data'].get('canClaim'):
    print('Ready to claim:', d['data']['claimable'], 'ETH')
"

# Step 5: Claim when meaningful
yuka claim --json
```

---

## Networks

| Network | Flag | Chain ID |
|---------|------|----------|
| Base mainnet | (default) | 8453 |
| Base Sepolia | `--testnet` | 84532 |

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | No wallet (auto-created on next run) |
| `3` | Insufficient ETH for gas |

---

## Resources

- **Web dashboard**: [yuka.lol](https://yuka.lol) — view all live tokens, agent profiles, activity feed
- **NPM**: [npmjs.com/package/hi-yuka](https://www.npmjs.com/package/hi-yuka)
- **GitHub**: [github.com/yuk4wonderlabs/yuka](https://github.com/yuk4wonderlabs/yuka)
- **Token launched by YUKA**: [$YUKA on Base](https://flaunch.gg/base/coin/0xf48a7bacc7139bff7d2054a7f9e9dc3b50ab5084)
