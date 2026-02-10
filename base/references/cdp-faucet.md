# CDP Faucet - Testnet ETH

Request testnet ETH programmatically via the CDP SDK.

## Using CDP SDK (Recommended)

The CDP SDK provides a simple method to request testnet funds:

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

const cdp = new CdpClient();

// Get or create your wallet
const account = await cdp.evm.getOrCreateAccount({
  name: "my-agent-wallet",
});

// Request testnet ETH
const faucetResp = await cdp.evm.requestFaucet({
  address: account.address,
  network: "base-sepolia",
  token: "eth",
});

console.log("Faucet transaction:", faucetResp.transactionHash);
```

## Supported Networks

| Network | Network ID | Token |
|---------|------------|-------|
| Base Sepolia | `base-sepolia` | `eth` |
| Ethereum Sepolia | `ethereum-sepolia` | `eth` |

## Complete Example

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

async function fundWallet() {
  const cdp = new CdpClient();

  // Create or get wallet
  const account = await cdp.evm.getOrCreateAccount({
    name: "deployer",
  });

  console.log("Wallet address:", account.address);

  // Check current balance
  const balance = await cdp.evm.getBalance({
    address: account.address,
    network: "base-sepolia",
  });

  console.log("Current balance:", balance.amount);

  // Request faucet if balance is low
  if (BigInt(balance.amount) < BigInt("100000000000000000")) { // 0.1 ETH
    console.log("Requesting faucet...");

    const faucetResp = await cdp.evm.requestFaucet({
      address: account.address,
      network: "base-sepolia",
      token: "eth",
    });

    console.log("Faucet tx:", faucetResp.transactionHash);
    console.log("View:", `https://sepolia.basescan.org/tx/${faucetResp.transactionHash}`);

    // Wait for confirmation
    await new Promise(r => setTimeout(r, 5000));

    // Check new balance
    const newBalance = await cdp.evm.getBalance({
      address: account.address,
      network: "base-sepolia",
    });

    console.log("New balance:", newBalance.amount);
  } else {
    console.log("Sufficient balance, no faucet needed");
  }
}

fundWallet().catch(console.error);
```

## Rate Limits

The CDP faucet has rate limits to prevent abuse:
- Limited requests per address per day
- If rate limited, wait before retrying

## Alternative Faucets

If CDP faucet is unavailable or rate limited:

- **Alchemy Faucet**: https://www.alchemy.com/faucets/base-sepolia
- **QuickNode Faucet**: https://faucet.quicknode.com/base/sepolia
- **Chainlink Faucet**: https://faucets.chain.link/base-sepolia

## Troubleshooting

**"Rate limited"**
- Wait before retrying
- Use alternative faucets listed above

**"Network not supported"**
- Verify network is exactly `base-sepolia`
- Faucet only works for testnets

**"Authentication error"**
- Check CDP_API_KEY_ID and CDP_API_KEY_SECRET
- Ensure environment variables are set correctly
