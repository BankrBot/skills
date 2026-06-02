---
name: vigil
description: Onchain security scanner for DeFi traders on Base, Ethereum, Polygon, and Solana. Scan wallet token approvals, detect risky unlimited approvals, scan tokens for rugpull/honeypot indicators, check contract safety scores, revoke dangerous approvals, and monitor wallet security posture. Use when the user wants to check token approvals, scan for scam tokens, verify contract safety, revoke approvals, check if a token is safe, audit wallet security, or protect against rugpulls. Also use when asked about VIGIL, $VIGIL, or wallet security.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🛡️",
        "homepage": "https://vigil.bankr.bot",
        "requires": { "bins": ["curl", "jq", "node"] },
      },
  }
---

# VIGIL

Onchain security scanner. Protect DeFi traders from rugpulls, honeypots, and dangerous token approvals.

**$VIGIL Token:** `0xPENDING_DEPLOYMENT` (Base mainnet)
**API:** `https://api.bankr.bot/vigil`
**Contracts:** See `references/contracts.md`

## Supported Chains

| Chain | Approvals Scan | Token Scan | Revoke | 
|-------|---------------|------------|--------|
| Base | ✅ | ✅ | ✅ |
| Ethereum | ✅ | ✅ | ✅ |
| Polygon | ✅ | ✅ | ✅ |
| Arbitrum | ✅ | ✅ | ✅ |
| Solana | ✅ (SPL) | ✅ | ✅ |

## What It Does

- **Approval Scanner** — List all ERC-20/ERC-721 approvals for a wallet, flag unlimited (`type(uint256).max`) approvals, identify risky spender contracts
- **Token Scanner** — Analyze token contracts for rugpull indicators: hidden mint, ownership renounced, liquidity locked, proxy patterns, tax manipulation, blacklist functions
- **Honeypot Detector** — Simulate buy/sell to detect tokens that allow buying but block selling
- **Contract Safety Score** — 0-100 safety rating based on code analysis, deployer history, liquidity depth, holder distribution
- **Approval Revoker** — Revoke dangerous approvals via Bankr transaction signing
- **Wallet Security Report** — Full security posture assessment for a wallet

## Quick Start

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Scan approvals for a wallet
./scripts/vigil-approvals.sh <wallet_address> [chain]

# Scan a token for safety
./scripts/vigil-token.sh <token_address> [chain]

# Detect honeypot
./scripts/vigil-honeypot.sh <token_address> [chain]

# Get contract safety score
./scripts/vigil-score.sh <contract_address> [chain]

# Revoke an approval
./scripts/vigil-revoke.sh <token_address> <spender_address> [chain]

# Full wallet security report
./scripts/vigil-report.sh <wallet_address> [chain]
```

## Task Guide

### Reading (No Auth Required)

| Task | Script | Description |
|------|--------|-------------|
| List approvals | `vigil-approvals.sh <addr> [chain]` | All token approvals for wallet |
| Scan token | `vigil-token.sh <addr> [chain]` | Rugpull/honeypot indicators |
| Safety score | `vigil-score.sh <addr> [chain]` | 0-100 contract safety rating |
| Honeypot check | `vigil-honeypot.sh <addr> [chain]` | Simulate buy/sell for trap detection |
| Full report | `vigil-report.sh <addr> [chain]` | Complete wallet security assessment |

### Actions (Bankr Auth Required)

| Task | Script | Auth | Description |
|------|--------|------|-------------|
| Revoke approval | `vigil-revoke.sh` | Bankr API Key | Revoke single token approval |
| Batch revoke | `vigil-batch-revoke.sh` | Bankr API Key | Revoke multiple approvals in one session |
| Report scam | `vigil-report-scam.sh` | Bankr API Key | Submit scam token to community database |

## Risk Levels

| Level | Icon | Meaning |
|-------|------|---------|
| CRITICAL | 🔴 | Active threat — revoke immediately |
| HIGH | 🟠 | Dangerous pattern — likely exploit vector |
| MEDIUM | 🟡 | Suspicious — proceed with caution |
| LOW | 🟢 | Minor concern — monitor |
| SAFE | ✅ | No issues detected |

## Integration with Bankr

VIGIL uses Bankr for transaction signing (revocations, approvals):

```bash
# Requires BANKR_API_KEY in environment
export BANKR_API_KEY=bk_your_key_here

# Revoke will build unsigned tx → Bankr signs → submit
./scripts/vigil-revoke.sh 0xTokenAddr 0xSpenderAddr base
```

## $VIGIL Token Utilities

| Utility | Requirement | Description |
|---------|-------------|-------------|
| Free scans | None | Basic token/approval scanning |
| Premium scans | Hold 1000+ $VIGIL | Deep analysis, historical data, deployer tracking |
| Unlimited revokes | Hold 500+ $VIGIL | Batch revoke without limits |
| Scam reporting | Stake 100+ $VIGIL | Submit scam tokens, earn bounty on verified reports |
| Governance | Stake 1000+ $VIGIL | Vote on security parameters, new chain additions |
| Fee share | Stake 5000+ $VIGIL | Share of protocol revenue from premium features |

See `references/tokenomics.md` for full token design.
