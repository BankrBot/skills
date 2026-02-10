# Contract Interaction

Read from and write to deployed contracts.

## Read Contract State (No Transaction)

Reading is free and doesn't require signing.

### Using cast (CLI)

```bash
# Read a public variable
cast call 0xContractAddress "number()" --rpc-url https://sepolia.base.org

# Read with arguments
cast call 0xContractAddress "balanceOf(address)" 0xUserAddress --rpc-url https://sepolia.base.org

# Decode the result
cast call 0xContractAddress "number()" --rpc-url https://sepolia.base.org | cast --to-dec
```

### Using viem

```typescript
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Read contract
const result = await publicClient.readContract({
  address: "0x...",
  abi: counterAbi,
  functionName: "number",
});

console.log("Number:", result);
```

## Write to Contract (Transaction Required)

Writing requires a transaction signed by CDP.

### Using CDP SDK

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData } from "viem";

const cdp = new CdpClient();
const account = await cdp.evm.getOrCreateAccount({ name: "my-wallet" });

// Encode the function call
const calldata = encodeFunctionData({
  abi: counterAbi,
  functionName: "setNumber",
  args: [42n],
});

// Send transaction
const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  network: "base-sepolia",
  transaction: {
    to: "0xContractAddress",
    data: calldata,
  },
});

console.log("Transaction:", transactionHash);
```

### With ETH Value

For payable functions:

```typescript
import { parseEther } from "viem";

const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  network: "base-sepolia",
  transaction: {
    to: "0xContractAddress",
    data: calldata,
    value: parseEther("0.1"),
  },
});
```

## Example: Counter Contract

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http, encodeFunctionData } from "viem";
import { baseSepolia } from "viem/chains";

const CONTRACT_ADDRESS = "0x...";

const counterAbi = [
  {
    inputs: [],
    name: "number",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "newNumber", type: "uint256" }],
    name: "setNumber",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "increment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function main() {
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name: "my-wallet" });

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  // Read current value
  const before = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: counterAbi,
    functionName: "number",
  });
  console.log("Before:", before);

  // Increment
  const calldata = encodeFunctionData({
    abi: counterAbi,
    functionName: "increment",
  });

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",
    transaction: {
      to: CONTRACT_ADDRESS,
      data: calldata,
    },
  });

  console.log("Tx:", transactionHash);

  // Wait for confirmation
  await publicClient.waitForTransactionReceipt({
    hash: transactionHash as `0x${string}`,
  });

  // Read new value
  const after = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: counterAbi,
    functionName: "number",
  });
  console.log("After:", after);
}

main().catch(console.error);
```

## Example: Escrow Contract

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeFunctionData, parseEther } from "viem";

const escrowAbi = [
  {
    inputs: [],
    name: "release",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "refund",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

async function releaseEscrow(contractAddress: string) {
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name: "payer" });

  const calldata = encodeFunctionData({
    abi: escrowAbi,
    functionName: "release",
  });

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",
    transaction: {
      to: contractAddress,
      data: calldata,
    },
  });

  console.log("Released! Tx:", transactionHash);
}
```

## Using cast for Writes

For quick testing (requires private key):

```bash
# Set number
cast send 0xContractAddress "setNumber(uint256)" 42 \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY

# Increment
cast send 0xContractAddress "increment()" \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY
```

**Note**: For production, use CDP SDK instead of raw private keys.

## Watch for Events

```typescript
import { createPublicClient, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

// Watch for NumberChanged events
const unwatch = publicClient.watchEvent({
  address: CONTRACT_ADDRESS,
  event: parseAbiItem("event NumberChanged(uint256 newNumber)"),
  onLogs: (logs) => {
    for (const log of logs) {
      console.log("Number changed to:", log.args.newNumber);
    }
  },
});

// Stop watching
// unwatch();
```

## Get Past Events

```typescript
const logs = await publicClient.getLogs({
  address: CONTRACT_ADDRESS,
  event: parseAbiItem("event NumberChanged(uint256 newNumber)"),
  fromBlock: 0n,
  toBlock: "latest",
});

for (const log of logs) {
  console.log("Block:", log.blockNumber, "Value:", log.args.newNumber);
}
```

## Multicall (Batch Reads)

```typescript
const results = await publicClient.multicall({
  contracts: [
    {
      address: CONTRACT_ADDRESS,
      abi: counterAbi,
      functionName: "number",
    },
    {
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    },
  ],
});

console.log("Counter:", results[0].result);
console.log("Balance:", results[1].result);
```

## Resources

- [viem Documentation](https://viem.sh/)
- [cast Command Reference](https://book.getfoundry.sh/reference/cast/)
