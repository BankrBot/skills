# Contract Verification

Verify contracts on Basescan after deployment.

## Why Verify?

- Source code is publicly visible
- Users can read and trust the contract
- Enables Basescan's "Read/Write Contract" UI
- Required for most serious projects

## Get Basescan API Key

1. Go to [Basescan](https://basescan.org/) (or [sepolia.basescan.org](https://sepolia.basescan.org/) for testnet)
2. Create an account
3. Go to API Keys
4. Generate a new API key

Add to `.env`:
```bash
BASESCAN_API_KEY=your_api_key
```

## Verify with Forge

### Basic Verification

```bash
forge verify-contract \
  --chain-id 84532 \
  --watch \
  --etherscan-api-key $BASESCAN_API_KEY \
  <CONTRACT_ADDRESS> \
  src/Counter.sol:Counter
```

### With Constructor Arguments

```bash
forge verify-contract \
  --chain-id 84532 \
  --watch \
  --etherscan-api-key $BASESCAN_API_KEY \
  --constructor-args $(cast abi-encode "constructor(string,string,uint256)" "My Token" "MTK" 1000000) \
  <CONTRACT_ADDRESS> \
  src/MyToken.sol:MyToken
```

### With Optimizer Settings

```bash
forge verify-contract \
  --chain-id 84532 \
  --num-of-optimizations 200 \
  --watch \
  --etherscan-api-key $BASESCAN_API_KEY \
  <CONTRACT_ADDRESS> \
  src/Counter.sol:Counter
```

## Chain IDs

| Network | Chain ID |
|---------|----------|
| Base Mainnet | 8453 |
| Base Sepolia | 84532 |

## Configure in foundry.toml

```toml
[etherscan]
base_sepolia = { key = "${BASESCAN_API_KEY}", url = "https://api-sepolia.basescan.org/api" }
base = { key = "${BASESCAN_API_KEY}", url = "https://api.basescan.org/api" }
```

Then verify with:
```bash
forge verify-contract \
  --chain base-sepolia \
  --watch \
  <CONTRACT_ADDRESS> \
  src/Counter.sol:Counter
```

## Deploy and Verify in One Command

```bash
forge script script/Deploy.s.sol \
  --rpc-url $BASE_SEPOLIA_RPC \
  --broadcast \
  --verify \
  --etherscan-api-key $BASESCAN_API_KEY \
  -vvvv
```

## Verify Existing Contract

If you deployed earlier and need to verify:

```bash
# For Sepolia
forge verify-contract \
  --chain-id 84532 \
  --etherscan-api-key $BASESCAN_API_KEY \
  0xYourContractAddress \
  src/YourContract.sol:YourContract

# For Mainnet
forge verify-contract \
  --chain-id 8453 \
  --etherscan-api-key $BASESCAN_API_KEY \
  0xYourContractAddress \
  src/YourContract.sol:YourContract
```

## Check Verification Status

```bash
forge verify-check \
  --chain-id 84532 \
  <VERIFICATION_GUID>
```

## Common Issues

**"Unable to verify"**
- Ensure compiler version matches
- Check optimizer settings match deployment
- Verify constructor arguments are correct

**"Contract source code already verified"**
- Contract was already verified (this is fine)

**"Invalid API key"**
- Check BASESCAN_API_KEY is set correctly
- Ensure you're using the right key for the network (mainnet vs testnet share keys)

**"Compiler version mismatch"**
- Check solc version in foundry.toml
- Use `--compiler-version` flag if needed

## Verification Script

```typescript
// scripts/verify.ts
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface VerifyConfig {
  address: string;
  contract: string;
  constructorArgs?: string;
  network: "base-sepolia" | "base";
}

async function verify(config: VerifyConfig) {
  const chainId = config.network === "base-sepolia" ? 84532 : 8453;

  let cmd = `forge verify-contract \
    --chain-id ${chainId} \
    --watch \
    --etherscan-api-key ${process.env.BASESCAN_API_KEY}`;

  if (config.constructorArgs) {
    cmd += ` --constructor-args ${config.constructorArgs}`;
  }

  cmd += ` ${config.address} ${config.contract}`;

  console.log("Running:", cmd);

  try {
    const { stdout, stderr } = await execAsync(cmd);
    console.log(stdout);
    if (stderr) console.error(stderr);
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

// Verify Counter
verify({
  address: "0x...",
  contract: "src/Counter.sol:Counter",
  network: "base-sepolia",
}).catch(console.error);
```

## Resources

- [Basescan](https://basescan.org/)
- [Basescan Sepolia](https://sepolia.basescan.org/)
- [Forge Verify Docs](https://book.getfoundry.sh/reference/forge/forge-verify-contract)
