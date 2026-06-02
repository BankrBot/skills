# VIGIL — Bankr Integration Guide

## Overview

VIGIL integrates with Bankr for:
1. **Transaction signing** — Approval revocations go through Bankr's wallet API
2. **API key authentication** — VIGIL uses the same `BANKR_API_KEY`
3. **Chain routing** — Leverages Bankr's multi-chain RPC infrastructure

## Setup

### 1. Get Bankr API Key

```bash
# If you don't have a key yet
bankr login email your@email.com
# Follow the OTP flow, enable --read-write
```

### 2. Configure VIGIL

```bash
export BANKR_API_KEY=bk_your_key_here

# Optional: custom VIGIL API endpoint
export VIGIL_API=https://api.bankr.bot/vigil
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
# Step 1: Check if token is safe
./scripts/vigil-token.sh 0xTokenAddr base

# Step 2: If safe, check honeypot specifically
./scripts/vigil-honeypot.sh 0xTokenAddr base

# Step 3: If all clear, trade via Bankr
bankr agent "buy 0.01 ETH of 0xTokenAddr on base"
```

### Pattern 2: Regular Wallet Audit

Run weekly security check on your wallet:

```bash
# Full security report
./scripts/vigil-report.sh 0xYourWallet base

# Fix any critical issues found
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
