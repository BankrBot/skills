---
name: Verlo
description: Compliant tokenized assets settlement layer on Base. KYC-gated trading of real-world assets with atomic delivery-versus-payment in USDC. Agents can query asset listings, check KYC status, and execute compliant trades through a single skill.
version: 0.1.0
status: pre-mainnet
---

# Verlo Skill

Verlo is the compliance layer for tokenized real-world assets on Base. Built retail-first.

KYC is enforced at the token level (ERC-3643-style — verified on every transfer). Settlement is atomic delivery-versus-payment in USDC — buyer's USDC and seller's security token swap in a single transaction or both revert. No counterparty risk, no escrow contracts in between.

This skill lets a Bankr agent interact with Verlo's contracts via natural language.

## Status

Verlo is currently on Base Sepolia testnet. Mainnet deployment is planned. This SKILL.md is being published ahead of mainnet so the Bankr team and builders can review the integration approach. Once mainnet is live, the contract addresses below will be updated and the skill will be functional end-to-end.

## What this skill does

The Verlo skill enables Bankr agents to:

- **Query listed tokenized assets** — name, symbol, price, asset type
- **Check a wallet's KYC status** before any trade
- **Execute compliant trades** via Verlo's DvP settlement contract
- **Self-verify with $VERLO holdings** (post v1.1, gated by token threshold)

## Example prompts

```
list verlo assets
```
Returns all tokenized assets currently listed on Verlo with prices and types.

```
check my kyc status on verlo
```
Reads from Verlo's KYCRegistry contract. Returns verified | unverified.

```
buy 5 VTE on verlo
```
Executes a compliant atomic trade: agent's wallet pays USDC, receives VTE security token. KYC is checked at the token level — unverified wallets revert automatically.

```
self-verify on verlo with my $VERLO
```
(post v1.1) — if wallet holds ≥10,000 $VERLO, calls selfVerifyWithVerloHolding() on KYCRegistry. Wallet is verified on-chain instantly.

## Contracts

### Base Sepolia (testnet)

| Contract | Address |
| --- | --- |
| KYCRegistry | `0xab634e36Fa5adc9eB60021d0f2dcC9299cC5c572` |
| SecurityToken (VTE) | `0xFEA2A98bb8b387Fd1C9509ccDf42476ABf037761` |
| DvPSettlement | `0xBE857F0d91d1ff276EAc74e81E57f90D5F0511A2` |
| USDC (Circle testnet) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

### Base mainnet

Coming soon. Addresses will be added here once deployed.

## How a Bankr agent uses this skill

The skill talks to Verlo's three contracts directly via Bankr's Submit API. No off-chain backend required.

**For a trade:**
1. Agent gets quote from Verlo's asset list (read-only contract call)
2. Agent calls `approve()` on USDC for the trade amount
3. Agent calls `settleTradeAtomic()` on DvPSettlement
4. KYC is checked at the token transfer layer — unverified wallets revert
5. If KYC passes, USDC and security token swap atomically

**For KYC check:**
1. Agent calls `isVerified(address)` on KYCRegistry
2. Returns `true` or `false`

**For self-verification (post v1.1):**
1. Agent calls `selfVerifyWithVerloHolding()` on KYCRegistry
2. Contract checks $VERLO balance ≥ threshold
3. If pass, marks wallet verified on-chain

## Why this fits the Bankr ecosystem

Verlo's design is agent-native by accident, not retrofit:

- **Atomic settlement** means agents get deterministic outcomes. The trade succeeds completely or fails completely. No half-states for an agent to clean up.
- **On-chain KYC** means agents can verify compliance before routing a trade. Compliance is a contract call, not a regulatory filing.
- **Single-transaction trades** mean an agent submits one transaction and the trade is done. No multi-step orchestration.
- **Predictable fees** — flat 0.3% (0.2% for $VERLO holders). No oracle dependence, no MEV concerns.

These design choices were made to keep retail UX simple. They also happen to be exactly what AI agents need to operate reliably.

## Links

- **Live site:** verloprotocol.com
- **Contracts repo:** github.com/verlo-protocol/contracts
- **Frontend repo:** github.com/verlo-protocol/frontend
- **Twitter:** @verloonbase

## Roadmap

- **v1.0** — Mainnet launch with VTE demo asset, manual KYC approval
- **v1.1** — $VERLO holder auto-verification + issuer self-serve UI
- **v1.2** — Coinbase Verifications for non-$VERLO users
- **v1.3** — AI assistant in dashboard
- **v1.4** — Persona/Sumsub fallback KYC
- **v1.5** — Full Bankr skill activation post-mainnet
- **v1.6** — x402 payments for agent-paid trades
- **v1.7** — Wrapped XRP settlement
- **v2.0** — Real tokenized securities (Q4 2026 / 2027)
