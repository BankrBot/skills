# Agent-to-Agent Patterns

Smart contract patterns for agent-to-agent transactions.

## When to Use

Deploy a contract when agents need:
- Trustless payment agreements
- Automatic revenue splits
- Escrow for deliverables
- Custom tokens for agent economy

## Escrow Contract

Hold funds until conditions met.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleEscrow {
    address public payer;
    address public payee;
    uint256 public amount;
    bool public released;

    constructor(address _payee) payable {
        payer = msg.sender;
        payee = _payee;
        amount = msg.value;
    }

    function release() external {
        require(msg.sender == payer, "Only payer");
        require(!released, "Already released");
        released = true;
        payable(payee).transfer(amount);
    }

    function refund() external {
        require(msg.sender == payee, "Only payee");
        require(!released, "Already released");
        released = true;
        payable(payer).transfer(amount);
    }
}
```

**Deploy with value:**
```typescript
const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  network: "base-sepolia",
  transaction: {
    to: undefined,
    data: bytecode + encodedPayeeAddress,
    value: parseEther("0.1"),
  },
});
```

## Payment Splitter

Automatic revenue distribution.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/finance/PaymentSplitter.sol";

contract RevenueSplit is PaymentSplitter {
    constructor(
        address[] memory payees,
        uint256[] memory shares_
    ) PaymentSplitter(payees, shares_) {}
}
```

**Deploy for 60/40 split:**
```typescript
const payees = ["0xAgent1...", "0xAgent2..."];
const shares = [60, 40];
// Encode and deploy...
```

## Simple Token

Custom ERC-20 for agent economy.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AgentToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("AgentToken", "AGT") {
        _mint(msg.sender, initialSupply);
    }
}
```

## Conditional Payment

Pay when condition is verified.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract ConditionalPayment {
    address public payer;
    address public payee;
    address public arbiter;
    uint256 public amount;
    bool public completed;

    constructor(address _payee, address _arbiter) payable {
        payer = msg.sender;
        payee = _payee;
        arbiter = _arbiter;
        amount = msg.value;
    }

    function approve() external {
        require(msg.sender == arbiter, "Only arbiter");
        require(!completed, "Already completed");
        completed = true;
        payable(payee).transfer(amount);
    }

    function reject() external {
        require(msg.sender == arbiter, "Only arbiter");
        require(!completed, "Already completed");
        completed = true;
        payable(payer).transfer(amount);
    }
}
```

## Workflow

1. Agents negotiate terms
2. One agent deploys contract with terms encoded
3. Other agent verifies contract source
4. Funds deposited
5. Conditions met → funds released

## Resources

- [OpenZeppelin PaymentSplitter](https://docs.openzeppelin.com/contracts/4.x/api/finance#PaymentSplitter)
- [OpenZeppelin ERC20](https://docs.openzeppelin.com/contracts/4.x/erc20)
