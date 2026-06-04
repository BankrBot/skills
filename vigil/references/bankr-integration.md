# VIGIL — Bankr Integration Guide

## Overview

VIGIL integrates with Bankr for:
1. **Transaction signing** — Approval revocations go through Bankr's wallet API
2. **API key authentication** — VIGIL uses the same `BANKR_API_KEY`
3. **Chain routing** — Leverages Bankr's multi-chain RPC infrastructure

## Setup

### 1. Get Bankr API Key (only needed for revocations)

```bash
# If you don't have a key yet
bankr login email your@email.com
# Follow the OTP flow, enable --read-write
```

Read-only scans (token, honeypot, score, approvals, report, market,
deployer, scam check) need **no key** — they hit the public VIGIL endpoint
at `https://mcp.vigil.codes`.

### 2. Configure VIGIL

```bash
# Required only for revoke actions (signed via Bankr)
export BANKR_API_KEY=bk_your_key_here

# Optional: override the public read-only endpoint
export VIGIL_ENDPOINT=https://mcp.vigil.codes/tools/call
```

### 3. Make scripts executable

```bash
cd ~/.hermes/skills/bankr-vigil
chmod +x scripts/*.sh
```

## Usage Patterns

### Pattern 1: Scan Before Trading

Before buying a new token, always scan it first:

```bash
# Step 1: Safety score + rugpull indicators
./scripts/vigil-token.sh 0xTokenAddr base

# Step 2: Honeypot check (buy + sell simulation)
./scripts/vigil-honeypot.sh 0xTokenAddr base

# Step 3: Market context — thin liquidity / brand-new pool is a red flag
./scripts/vigil-market.sh 0xTokenAddr base

# Step 4: Deployer reputation + community scam reports
./scripts/vigil-deployer.sh 0xTokenAddr base
./scripts/vigil-check-scam.sh 0xTokenAddr base

# Step 5: If all clear, trade via Bankr
bankr agent "buy 0.01 ETH of 0xTokenAddr on base"
```

### Pattern 2: Regular Wallet Audit

Run a weekly security check on your wallet:

```bash
# Full security report
./scripts/vigil-report.sh 0xYourWallet base

# Revoke risky approvals (scan via VIGIL, sign via Bankr)
./scripts/vigil-batch-revoke.sh 0xYourWallet base --risk-level critical
```

### Pattern 3: Alert Setup

Configure monitoring for your wallet:

```bash
# (Requires PULSE skill — future integration)
# Set up alerts for new risky approvals
pulse add --trigger "new_approval(risk=critical)" --wallet 0xYourWallet --notify telegram
```

## Security Notes

- VIGIL scripts never store your private keys
- Revocations are signed by Bankr (your key stays in Bankr's secure enclave)
- API calls use HTTPS only
- No data is shared with third parties
