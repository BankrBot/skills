# Contract Development

Write Solidity smart contracts using Foundry.

## Install Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Verify:
```bash
forge --version
```

## Initialize Project

```bash
forge init my-contract
cd my-contract
```

## Project Structure

```
my-contract/
├── src/              # Contract source files
├── test/             # Test files
├── script/           # Deployment scripts
├── lib/              # Dependencies
├── foundry.toml      # Configuration
└── .env              # Environment variables (gitignored)
```

## Simple Counter Contract

```solidity
// src/Counter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Counter {
    uint256 public number;

    event NumberChanged(uint256 newNumber);

    function setNumber(uint256 newNumber) public {
        number = newNumber;
        emit NumberChanged(newNumber);
    }

    function increment() public {
        number++;
        emit NumberChanged(number);
    }

    function decrement() public {
        require(number > 0, "Cannot decrement below zero");
        number--;
        emit NumberChanged(number);
    }
}
```

## Simple Escrow Contract

For agent-to-agent payment agreements:

```solidity
// src/SimpleEscrow.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SimpleEscrow {
    address public payer;
    address public payee;
    uint256 public amount;
    bool public released;

    event Deposited(address indexed payer, uint256 amount);
    event Released(address indexed payee, uint256 amount);
    event Refunded(address indexed payer, uint256 amount);

    constructor(address _payee) payable {
        require(msg.value > 0, "Must deposit ETH");
        payer = msg.sender;
        payee = _payee;
        amount = msg.value;
        emit Deposited(payer, amount);
    }

    function release() external {
        require(msg.sender == payer, "Only payer can release");
        require(!released, "Already released");
        released = true;
        payable(payee).transfer(amount);
        emit Released(payee, amount);
    }

    function refund() external {
        require(msg.sender == payee, "Only payee can refund");
        require(!released, "Already released");
        released = true;
        payable(payer).transfer(amount);
        emit Refunded(payer, amount);
    }
}
```

## Using OpenZeppelin

Install OpenZeppelin contracts:

```bash
forge install OpenZeppelin/openzeppelin-contracts
```

Update `foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/"
]
```

### ERC-20 Token

```solidity
// src/MyToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
```

### ERC-721 NFT

```solidity
// src/MyNFT.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function safeMint(address to, string memory uri) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
```

### Payment Splitter

For automatic revenue distribution:

```solidity
// src/RevenueSplit.sol
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

Usage:
```typescript
// Deploy with 60/40 split
const payees = ["0xAgent1...", "0xAgent2..."];
const shares = [60, 40];
```

## Compile Contracts

```bash
forge build
```

Output is in `out/` directory.

## Check Contract Sizes

```bash
forge build --sizes
```

Contracts must be under 24KB for deployment.

## foundry.toml Configuration

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
optimizer = true
optimizer_runs = 200
solc_version = "0.8.19"

remappings = [
    "@openzeppelin/=lib/openzeppelin-contracts/"
]

[rpc_endpoints]
base_sepolia = "${BASE_SEPOLIA_RPC}"
base = "${BASE_MAINNET_RPC}"

[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
```

## Common Patterns

### Ownable (Access Control)

```solidity
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Ownable {
    constructor() Ownable(msg.sender) {}

    function adminOnly() public onlyOwner {
        // Only owner can call
    }
}
```

### Pausable (Emergency Stop)

```solidity
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyContract is Pausable, Ownable {
    function transfer() public whenNotPaused {
        // Cannot call when paused
    }

    function pause() public onlyOwner {
        _pause();
    }
}
```

### ReentrancyGuard

```solidity
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MyContract is ReentrancyGuard {
    function withdraw() public nonReentrant {
        // Protected from reentrancy attacks
    }
}
```

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Solidity Docs](https://docs.soliditylang.org/)
