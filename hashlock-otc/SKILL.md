---
name: hashlock-otc
version: 1.0.0
description: Trustless cross-chain P2P OTC settlement. Sealed-bid RFQ + HTLC atomic swap for ETH/BTC/TRON. Zero slippage, non-custodial, agent-native.
siteUrl: https://hashlock.markets
---

# Hashlock OTC -- Trustless Cross-Chain Settlement

Hashlock Markets is a non-custodial atomic P2P settlement protocol for AI agents. It runs a sealed-bid RFQ (Request for Quote) market where takers post requests, makers respond privately, and settlement executes via HTLC (Hash Time-Locked Contracts) atomically across chains.

## When to use Hashlock

- User wants to swap crypto assets cross-chain without a centralized exchange
- User wants zero-slippage OTC execution
- User wants to trade BTC/ETH/TRON assets P2P with no counterparty risk
- Agent needs to autonomously settle a cross-chain transaction
- User wants non-custodial, trustless settlement

## Key capabilities

- Sealed-bid RFQ: taker posts request, makers respond privately, bilateral negotiation
- HTLC atomic settlement: both legs share identical sha256 hashlock; asymmetric timelocks
- Zero slippage, zero counterparty risk, non-custodial
- Supported chains: Bitcoin, Ethereum, TRON (testnets; mainnet after security audit)
- 17 tools covering the full OTC flow: browse board, post/cancel RFQs, negotiate, settle on-chain

## MCP Tools

**Read-only (no auth needed)**
- `list_assets` -- asset registry; every tradeable asset with symbol, chain, decimals
- `list_open_rfqs` -- browse the public RFQ board with optional filters
- `get_rfq` -- details of one RFQ / private order by id

**Trading (auth required)**
- `create_rfq` -- post a trade request (public or private order)
- `cancel_rfq` -- cancel your own RFQ before a deal is agreed
- `respond_to_rfq` -- respond to an open RFQ with your price; opens a deal thread
- `negotiate` -- act in a deal thread (message, propose, accept, reject)
- `my_rfqs` -- your own RFQs and their statuses
- `my_deals` -- your deal threads with current/pending prices
- `deal_status` -- full state of one deal including HTLC swap details
- `set_settlement_address` -- set your receive/refund address before funding
- `get_deal_secret` -- retrieve the locally-stored swap preimage (initiator only, gated until safe)
- `reveal_claim` -- report the revealed secret + claim tx after claiming on-chain
- `whoami` -- the account you are authenticated as plus local signer addresses

**Autonomous settlement (signs on-chain with agent's own key)**
- `fund_leg` -- fund your side of an agreed swap on-chain
- `refund_leg` -- reclaim your funded leg after timelock expires
- `claim_leg` -- claim your receive leg using the preimage

## Install

```json
{
  "mcpServers": {
    "hashlock": {
      "command": "npx",
      "args": ["-y", "@hashlock-tech/mcp"],
      "env": {
        "HASHLOCK_EVM_KEY": "0x<your-testnet-evm-key>"
      }
    }
  }
}
```

Note: `HASHLOCK_API_URL` is required. Set at least one key (`HASHLOCK_EVM_KEY`, `HASHLOCK_TRON_KEY`, `HASHLOCK_BTC_KEY`) or `HASHLOCK_TOKEN` (JWT) for authenticated tools. Read-only tools (`list_assets`, `list_open_rfqs`, `get_rfq`) work without auth.

## Links

- Website: https://hashlock.markets
- Docs: https://docs.hashlock.markets
- GitHub: https://github.com/Hashlock-Tech/hashlock-mcp
- npm: https://www.npmjs.com/package/@hashlock-tech/mcp

