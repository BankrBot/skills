---
name: trust-escrow
description: Simple payment escrow for agent-to-agent transactions on Base. Lock funds until service delivered, with auto-release and dispute protection. Supports ETH and ERC-20 tokens.
tags: [base, escrow, payments, trust]
---

# Trust Escrow

**Safe agent-to-agent payments on Base**

Lock payment → Service delivered → Funds released. Simple escrow with 0.5% platform fee.

## Quick Start

### Deploy

```bash
export PRIVATE_KEY=0x...
export FEE_RECIPIENT=0x...  # Your wallet for fees

./scripts/deploy.sh
```

### Create Escrow (ETH)

```bash
cast send <ESCROW_ADDRESS> \
  "createEscrow(address,uint256,string)(uint256)" \
  <PAYEE_ADDRESS> \
  $(($(date +%s) + 86400)) \
  "Custom skill development" \
  --value 0.05ether \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

### Create Escrow (ERC-20)

```bash
# 1. Approve tokens
cast send <TOKEN_ADDRESS> \
  "approve(address,uint256)" \
  <ESCROW_ADDRESS> \
  <AMOUNT> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org

# 2. Create escrow
cast send <ESCROW_ADDRESS> \
  "createEscrowToken(address,uint256,address,uint256,string)(uint256)" \
  <PAYEE_ADDRESS> \
  <AMOUNT> \
  <TOKEN_ADDRESS> \
  $(($(date +%s) + 86400)) \
  "Service description" \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

### Deliver Service (Payee)

```bash
cast send <ESCROW_ADDRESS> \
  "deliverService(uint256)" \
  <ESCROW_ID> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

### Complete Payment (Payer)

```bash
cast send <ESCROW_ADDRESS> \
  "completeEscrow(uint256)" \
  <ESCROW_ID> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

### Cancel (Before Delivery)

```bash
cast send <ESCROW_ADDRESS> \
  "cancelEscrow(uint256)" \
  <ESCROW_ID> \
  --private-key $PRIVATE_KEY \
  --rpc-url https://mainnet.base.org
```

## Flow

1. **Payer creates escrow** → Funds locked
2. **Payee delivers service** → Marks delivered onchain
3. **Payer completes escrow** → Payment released (minus 0.5% fee)

OR

3. **Deadline passes** → Anyone can trigger auto-release

## Features

- ✅ ETH and ERC-20 support
- ✅ Auto-release after deadline
- ✅ Cancel before delivery
- ✅ Dispute flag (for manual resolution)
- ✅ 0.5% platform fee
- ✅ ReentrancyGuard protected

## Use Cases

- Agent hiring (pay after delivery)
- Service marketplaces
- Cross-agent collaboration
- x402 payment integration

## Integration Example

```javascript
// 1. Create escrow
const escrowId = await contract.createEscrow(
  payeeAddress,
  deadline,
  "Service description",
  { value: ethers.parseEther("0.05") }
);

// 2. Payee delivers
await contract.deliverService(escrowId);

// 3. Payer completes
await contract.completeEscrow(escrowId);
```

## License

MIT
