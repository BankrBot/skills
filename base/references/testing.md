# Testing Contracts

Test smart contracts using Foundry's forge.

## Basic Test Structure

```solidity
// test/Counter.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;

    function setUp() public {
        counter = new Counter();
        counter.setNumber(0);
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.number(), 1);
    }

    function test_SetNumber() public {
        counter.setNumber(42);
        assertEq(counter.number(), 42);
    }
}
```

## Run Tests

```bash
# Run all tests
forge test

# With verbosity (show logs)
forge test -vvv

# With maximum verbosity (show all traces)
forge test -vvvvv

# Run specific test
forge test --match-test test_Increment

# Run tests in specific file
forge test --match-path test/Counter.t.sol

# Run with gas report
forge test --gas-report
```

## Assertions

```solidity
// Equality
assertEq(a, b);
assertEq(a, b, "custom error message");

// Inequality
assertNotEq(a, b);

// Greater/less than
assertGt(a, b);  // a > b
assertGe(a, b);  // a >= b
assertLt(a, b);  // a < b
assertLe(a, b);  // a <= b

// Boolean
assertTrue(condition);
assertFalse(condition);
```

## Testing Reverts

```solidity
function test_DecrementReverts() public {
    // Expect specific revert message
    vm.expectRevert("Cannot decrement below zero");
    counter.decrement();
}

function test_CustomErrorReverts() public {
    // Expect custom error
    vm.expectRevert(abi.encodeWithSelector(MyError.selector, arg1, arg2));
    myContract.doSomething();
}

function test_AnyRevert() public {
    // Expect any revert
    vm.expectRevert();
    myContract.willFail();
}
```

## Fuzz Testing

Foundry automatically generates random inputs:

```solidity
function testFuzz_SetNumber(uint256 x) public {
    counter.setNumber(x);
    assertEq(counter.number(), x);
}

// Bound fuzz input to range
function testFuzz_BoundedInput(uint256 x) public {
    x = bound(x, 1, 100);  // 1 <= x <= 100
    counter.setNumber(x);
    assertGe(counter.number(), 1);
    assertLe(counter.number(), 100);
}
```

## Cheatcodes (vm)

### Set msg.sender

```solidity
function test_OnlyOwner() public {
    address owner = address(0x1);
    address notOwner = address(0x2);

    // Deploy as owner
    vm.prank(owner);
    MyContract c = new MyContract();

    // Call as not owner - should fail
    vm.prank(notOwner);
    vm.expectRevert("Not owner");
    c.ownerOnly();

    // Call as owner - should succeed
    vm.prank(owner);
    c.ownerOnly();
}
```

### Persistent sender

```solidity
function test_MultipleCalls() public {
    vm.startPrank(address(0x1));
    contract.call1();
    contract.call2();
    contract.call3();
    vm.stopPrank();
}
```

### Set block.timestamp

```solidity
function test_TimeLock() public {
    // Warp to specific timestamp
    vm.warp(1000);
    assertEq(block.timestamp, 1000);

    // Skip forward
    skip(100);
    assertEq(block.timestamp, 1100);
}
```

### Set block.number

```solidity
function test_BlockNumber() public {
    vm.roll(100);
    assertEq(block.number, 100);
}
```

### Deal ETH

```solidity
function test_WithETH() public {
    address user = address(0x1);

    // Give user 10 ETH
    vm.deal(user, 10 ether);
    assertEq(user.balance, 10 ether);
}
```

### Mock contract calls

```solidity
function test_MockCall() public {
    address target = address(0x1);

    // Mock return value
    vm.mockCall(
        target,
        abi.encodeWithSelector(IERC20.balanceOf.selector, address(this)),
        abi.encode(1000)
    );

    uint256 balance = IERC20(target).balanceOf(address(this));
    assertEq(balance, 1000);
}
```

## Testing Events

```solidity
function test_EmitsEvent() public {
    // Expect event with specific parameters
    vm.expectEmit(true, true, false, true);
    emit NumberChanged(42);

    counter.setNumber(42);
}
```

## Test Escrow Contract

```solidity
// test/SimpleEscrow.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {SimpleEscrow} from "../src/SimpleEscrow.sol";

contract SimpleEscrowTest is Test {
    SimpleEscrow public escrow;
    address public payer = address(0x1);
    address public payee = address(0x2);

    function setUp() public {
        vm.deal(payer, 10 ether);

        vm.prank(payer);
        escrow = new SimpleEscrow{value: 1 ether}(payee);
    }

    function test_Deposit() public view {
        assertEq(escrow.payer(), payer);
        assertEq(escrow.payee(), payee);
        assertEq(escrow.amount(), 1 ether);
        assertEq(address(escrow).balance, 1 ether);
    }

    function test_Release() public {
        uint256 payeeBefore = payee.balance;

        vm.prank(payer);
        escrow.release();

        assertEq(payee.balance, payeeBefore + 1 ether);
        assertTrue(escrow.released());
    }

    function test_OnlyPayerCanRelease() public {
        vm.prank(payee);
        vm.expectRevert("Only payer can release");
        escrow.release();
    }

    function test_Refund() public {
        uint256 payerBefore = payer.balance;

        vm.prank(payee);
        escrow.refund();

        assertEq(payer.balance, payerBefore + 1 ether);
        assertTrue(escrow.released());
    }

    function test_CannotDoubleRelease() public {
        vm.prank(payer);
        escrow.release();

        vm.prank(payer);
        vm.expectRevert("Already released");
        escrow.release();
    }
}
```

## Gas Reports

```bash
forge test --gas-report
```

Output shows gas usage per function.

## Coverage

```bash
forge coverage
```

## Debugging

```solidity
import {console} from "forge-std/Test.sol";

function test_Debug() public {
    console.log("Value:", counter.number());
    console.log("Address:", address(this));
    console.logBytes(data);
}
```

Run with `-vvv` to see console output.

## Resources

- [Foundry Book - Testing](https://book.getfoundry.sh/forge/tests)
- [Forge Cheatcodes](https://book.getfoundry.sh/cheatcodes/)
