---
name: base
description: Build on Base blockchain. Use for smart contract development, deployment, wallet management, and agent-to-agent financial agreements. Routes to sub-skills for specific tasks.
---

# Base

Build on Base blockchain using Foundry and CDP SDK.

**Security**: Uses CDP managed wallets. Agent never accesses private keys.

## Sub-Skills

| Task | Reference | Use When |
|------|-----------|----------|
| Wallet Setup | [cdp-setup.md](references/cdp-setup.md) | Creating wallets, CDP authentication |
| Testnet Faucet | [cdp-faucet.md](references/cdp-faucet.md) | Getting Base Sepolia test ETH |
| Contract Dev | [contract-development.md](references/contract-development.md) | Writing Solidity contracts |
| Testing | [testing.md](references/testing.md) | Testing with Foundry |
| Deployment | [deployment.md](references/deployment.md) | Deploying to Base |
| Verification | [verification.md](references/verification.md) | Verifying on Basescan |
| Interaction | [contract-interaction.md](references/contract-interaction.md) | Reading/writing contracts |
| Agent Patterns | [agent-patterns.md](references/agent-patterns.md) | Escrow, payments, tokens |

## Networks

| Network | ID | Chain ID |
|---------|-----|----------|
| Base Mainnet | `base` | 8453 |
| Base Sepolia | `base-sepolia` | 84532 |

## Quick Reference

```bash
# Install
curl -L https://foundry.paradigm.xyz | bash && foundryup
npm install @coinbase/cdp-sdk

# Build & test
forge build && forge test

# Deploy (see deployment.md)
```
