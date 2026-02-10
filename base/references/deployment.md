# Contract Deployment

Deploy contracts to Base using CDP SDK. The agent never accesses private keys.

## Prerequisites

1. Foundry installed (`forge --version`)
2. CDP SDK installed (`npm install @coinbase/cdp-sdk`)
3. CDP credentials configured (see [cdp-setup.md](cdp-setup.md))
4. Contract compiled (`forge build`)

## Compile Contract

```bash
forge build
```

Output is in `out/<ContractName>.sol/<ContractName>.json`.

## Basic Deployment

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { readFileSync } from "fs";

async function deploy() {
  const cdp = new CdpClient();

  // Get or create wallet
  const account = await cdp.evm.getOrCreateAccount({
    name: "deployer",
  });
  console.log("Deployer:", account.address);

  // Read compiled bytecode
  const artifact = JSON.parse(
    readFileSync("out/Counter.sol/Counter.json", "utf8")
  );

  // Deploy (to: undefined = contract creation)
  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",  // or "base" for mainnet
    transaction: {
      to: undefined,
      data: artifact.bytecode.object,
    },
  });

  console.log("Tx:", transactionHash);
  console.log("Explorer:", `https://sepolia.basescan.org/tx/${transactionHash}`);
}

deploy().catch(console.error);
```

## Deploy with Constructor Arguments

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { readFileSync } from "fs";

async function deployWithArgs() {
  const cdp = new CdpClient();
  const account = await cdp.evm.getOrCreateAccount({ name: "deployer" });

  // Read bytecode
  const artifact = JSON.parse(
    readFileSync("out/MyToken.sol/MyToken.json", "utf8")
  );

  // Encode constructor arguments
  // constructor(string name, string symbol, uint256 initialSupply)
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters("string, string, uint256"),
    ["My Token", "MTK", 1000000n]
  );

  // Combine bytecode + constructor args
  const deployData = artifact.bytecode.object + constructorArgs.slice(2);

  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: "base-sepolia",
    transaction: {
      to: undefined,
      data: deployData,
    },
  });

  console.log("Deployed:", transactionHash);
}

deployWithArgs().catch(console.error);
```

## Deploy with ETH Value

For payable constructors (e.g., escrow):

```typescript
import { parseEther } from "viem";

const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  network: "base-sepolia",
  transaction: {
    to: undefined,
    data: deployData,
    value: parseEther("0.1"),  // Send 0.1 ETH to contract
  },
});
```

## Get Contract Address

The contract address is derived from the deployer address and nonce:

```typescript
import { getContractAddress } from "viem";

// After deployment, get contract address
const contractAddress = getContractAddress({
  from: account.address,
  nonce: BigInt(nonce),  // Get nonce before deployment
});
```

Or fetch from transaction receipt:

```typescript
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const receipt = await publicClient.waitForTransactionReceipt({
  hash: transactionHash,
});

console.log("Contract address:", receipt.contractAddress);
```

## Complete Deployment Script

```typescript
// scripts/deploy.ts
import { CdpClient } from "@coinbase/cdp-sdk";
import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";
import { readFileSync } from "fs";

interface DeployConfig {
  contractName: string;
  constructorArgs?: `0x${string}`;
  value?: bigint;
  network: "base-sepolia" | "base";
}

async function deploy(config: DeployConfig) {
  const cdp = new CdpClient();

  // 1. Get wallet
  const account = await cdp.evm.getOrCreateAccount({
    name: "contract-deployer",
  });
  console.log("Deployer:", account.address);

  // 2. Check balance
  const balance = await cdp.evm.getBalance({
    address: account.address,
    network: config.network,
  });
  console.log("Balance:", balance.amount);

  // 3. Request faucet if testnet and low balance
  if (config.network === "base-sepolia" && BigInt(balance.amount) < BigInt("50000000000000000")) {
    console.log("Requesting faucet...");
    await cdp.evm.requestFaucet({
      address: account.address,
      network: "base-sepolia",
      token: "eth",
    });
    await new Promise(r => setTimeout(r, 5000));
  }

  // 4. Read artifact
  const artifact = JSON.parse(
    readFileSync(`out/${config.contractName}.sol/${config.contractName}.json`, "utf8")
  );

  // 5. Prepare deploy data
  let deployData = artifact.bytecode.object;
  if (config.constructorArgs) {
    deployData += config.constructorArgs.slice(2);
  }

  // 6. Deploy
  console.log(`Deploying ${config.contractName}...`);
  const { transactionHash } = await cdp.evm.sendTransaction({
    address: account.address,
    network: config.network,
    transaction: {
      to: undefined,
      data: deployData,
      value: config.value,
    },
  });

  console.log("Transaction:", transactionHash);

  // 7. Wait for receipt
  const chain = config.network === "base-sepolia" ? baseSepolia : base;
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash as `0x${string}`,
  });

  console.log("Contract deployed at:", receipt.contractAddress);
  console.log("Gas used:", receipt.gasUsed.toString());

  const explorer = config.network === "base-sepolia"
    ? "https://sepolia.basescan.org"
    : "https://basescan.org";

  console.log("Explorer:", `${explorer}/address/${receipt.contractAddress}`);

  return receipt.contractAddress;
}

// Deploy Counter
deploy({
  contractName: "Counter",
  network: "base-sepolia",
}).catch(console.error);
```

Run:
```bash
npx ts-node scripts/deploy.ts
```

## Gas Estimation

Before deploying, estimate gas:

```bash
# Compile and check sizes
forge build --sizes

# Get current gas price
cast gas-price --rpc-url https://sepolia.base.org
```

Or programmatically:

```typescript
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

const gasPrice = await publicClient.getGasPrice();
console.log("Gas price:", gasPrice);
```

## Networks

| Network | Network ID | Chain ID | Explorer |
|---------|------------|----------|----------|
| Base Mainnet | `base` | 8453 | basescan.org |
| Base Sepolia | `base-sepolia` | 84532 | sepolia.basescan.org |

## Best Practices

1. **Always test on Sepolia first** - Never deploy untested code to mainnet
2. **Verify after deployment** - See [verification.md](verification.md)
3. **Save deployment info** - Record contract address and deployment tx
4. **Check gas costs** - Estimate before mainnet deployment
5. **Use named wallets** - `getOrCreateAccount` with consistent names

## Troubleshooting

**"Insufficient funds"**
- Check balance: `cdp.evm.getBalance()`
- Request faucet: `cdp.evm.requestFaucet()` (testnet only)

**"Contract too large"**
- Enable optimizer in foundry.toml
- Split into multiple contracts
- Max size is 24KB

**"Transaction reverted"**
- Check constructor arguments
- Ensure sufficient value for payable constructors

**"Invalid bytecode"**
- Verify artifact path is correct
- Re-run `forge build`
