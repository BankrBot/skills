---
name: vault-agent
description: >
  Execute NFT vault liquidity operations on-chain via NFTX V3.
  Agent collects its own execution fees via on-chain FeeWrapper —
  no wallet top-ups, no human babysitting. Fork the fee logic,
  point at any protocol, make it yours.
version: 1.0.0
author: Aleks-NFT
repo: https://github.com/Aleks-NFT/VaultAgent
tags: [nftx, nft, liquidity, vault, defi, ethereum, autonomous, fees, mcp]
agents: [bankr, claude-code, cursor, windsurf, cline]
---

# VaultAgent Skill

VaultAgent gives AI agents execution-grade access to NFT vault liquidity.
The agent executes vault operations and collects 25bps fee on-chain per tx
via FeeWrapper.sol — fees go straight to treasury, no platform, no middleman.

Built as an open skeleton: fork the fee logic, swap the protocol adapter,
point it at any on-chain liquidity source.

## Use when

- Agent needs to execute NFT vault operations autonomously (mint/redeem/swap)
- Building self-sustaining agent economics — agent pays for itself from fees it collects
- Need on-chain verifiable receipts for every agent action (FeeCollected events)
- Prototyping autonomous DeFi agents with scoped spend controls

## Do NOT use when

- User asks about NFT prices on OpenSea, Blur, or other marketplaces
- User asks about NFT staking, farming, or LP positions
- User asks about creating new NFT collections

## Tools

### Read tools (always available)

| Tool | When to use |
|------|-------------|
| `list_vaults` | Discover active vaults with TVL |
| `get_vault_info` | Vault fees, NFT count, vToken address |
| `get_premium_window` | Dutch auction timing before targeted redeem |
| `simulate_mint` | Pre-flight cost breakdown before execution |

### Write tools (requires FEE_WRAPPER_ADDRESS in env)

| Tool | When to use |
|------|-------------|
| `execute_mint` | Deposit NFTs → vTokens. Agent collects 25bps fee on-chain. |
| `execute_redeem` | vTokens → NFTs with maxPremiumBps slippage guard. |
| `execute_swap` | Swap NFTs within vault. |

## Self-sustaining fee model

Every transaction routes through VaultAgentFeeWrapper.sol on Ethereum Mainnet:

    Agent executes vault operation
        ↓
    FeeWrapper collects 25bps on-chain
        ↓
    FeeCollected event = verifiable receipt
        ↓
    Fees → treasury (no platform cut)

Deployed: 0xd9f3eddf463a06b89f022e2596f66fc495119f58 ✅ Verified

## Mandatory workflow for write operations

    1. Simulate  → always call simulate_mint / get_premium_window first
    2. Show      → present full cost breakdown (fees, gas, slippage)
    3. Confirm   → ask user explicitly before executing
    4. Execute   → confirmed=true ONLY after user approval

Never set confirmed=true without explicit user approval.

## Quick start

    git clone https://github.com/Aleks-NFT/VaultAgent
    cd VaultAgent/packages/mcp-server
    npm install && npm run build

    FEE_WRAPPER_ADDRESS=0xd9f3eddf463a06b89f022e2596f66fc495119f58
    ETH_RPC_URL=https://eth.llamarpc.com

## Fork it

The fee logic lives in one function in FeeWrapper.sol:

    function getApplicableFee(address user) public view returns (uint256) {
        // your logic here — token holdings, tiers, partnerships
        return BASE_FEE_BPS;
    }

Swap the protocol adapter in packages/mcp-server/src/tools/,
point at any on-chain liquidity source, rewire the fee routing.
```

**Шаг 5** — Commit message:
```
feat: add vault-agent skill
```

**Шаг 6** — Нажми **Commit new file**

**Шаг 7** — Нажми **Contribute** → **Open pull request**

PR title:
```
feat: add vault-agent — on-chain NFT liquidity with self-sustaining fee model
```

PR description:
```
VaultAgent gives Bankr agents direct access to NFT vault liquidity
with a self-sustaining fee model — agent collects 25bps per tx on-chain,
fees go to treasury autonomously. No wallet top-ups, no middleman.

- Simulate → Confirm → Execute with on-chain receipts
- FeeCollected events = verifiable audit trail per transaction  
- Fork-friendly: fee logic in one function, protocol adapter swappable
- Live on Ethereum Mainnet: 0xd9f3eddf463a06b89f022e2596f66fc495119f58

Part of Synthesis Hackathon 2026 — "Best Bankr LLM Gateway Use" track.
