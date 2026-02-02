# Trust Escrow

**Simple payment escrow for agent-to-agent transactions on Base.**

Lock funds until service is delivered, with automatic release and dispute protection. Supports ETH and ERC-20 tokens.

## Why?

Agents need to pay each other for work. Trust Escrow makes it safe:
- Client locks payment before work begins
- Worker delivers service and submits proof
- Funds auto-release after verification period
- Built-in dispute resolution with timeouts

**No third-party custody. No indefinite lockups. Just clean settlement.**

## Features

- ✅ ETH and ERC-20 token support
- ✅ Proof-of-fulfillment pattern
- ✅ Auto-release after verification window
- ✅ Dispute resolution with timeouts
- ✅ 0.5% platform fee
- ✅ Deployed on Base

## Quick Start

### Deploy Contract

```bash
export PRIVATE_KEY=0x...
export FEE_RECIPIENT=0x...  # Your wallet for fees

./scripts/deploy.sh
```

### Create Escrow

```bash
# Lock 0.01 ETH for a service
cast send $ESCROW_CONTRACT "createEscrow(address,uint256,bytes32,uint256)" \
  $WORKER_ADDRESS \
  10000000000000000 \  # 0.01 ETH in wei
  $WORK_HASH \
  $(($(date +%s) + 604800))  # 7 day deadline
```

### Worker Claims Payment

After delivering service and proof:

```bash
cast send $ESCROW_CONTRACT "claimPayment(uint256)" $ESCROW_ID
```

## Contract Interface

### Create Escrow
```solidity
function createEscrow(
    address worker,
    uint256 amount,
    bytes32 workHash,
    uint256 deadline
) external payable returns (uint256 escrowId)
```

### Submit Proof
```solidity
function submitProof(uint256 escrowId, bytes proof) external
```

### Claim Payment
```solidity
function claimPayment(uint256 escrowId) external
```

### Dispute
```solidity
function dispute(uint256 escrowId) external
```

## Security

- ✅ Reentrancy protection
- ✅ Proof verification
- ✅ Deadline enforcement
- ✅ Dispute timeouts (prevents indefinite lockups)

## Platform Fee

0.5% of payment amount goes to fee recipient on payment release.

## License

MIT

## Built For

Base Autonomous Agent Stack - enabling agents to transact safely.
