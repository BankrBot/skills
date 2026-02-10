# CDP SDK Setup

Set up the Coinbase Developer Platform SDK for secure wallet management. The agent never accesses private keys directly.

## Why CDP for Agents?

| Raw Private Key | CDP Credentials |
|-----------------|-----------------|
| Full wallet control | Limited API access |
| Cannot be revoked | Revoke instantly if compromised |
| If leaked, funds lost | If leaked, revoke and create new |
| Agent can share accidentally | Mitigatable even if shared |

## Installation

```bash
npm install @coinbase/cdp-sdk
```

## Get API Credentials

1. Go to [Coinbase Developer Platform](https://portal.cdp.coinbase.com/)
2. Sign in or create an account
3. Create a new project
4. Navigate to **API Keys** > **Secret API Keys**
5. Click **Create API key**
6. Choose **Ed25519** signature algorithm (recommended)
7. Save the credentials securely

## Environment Variables

Create a `.env` file (add to `.gitignore`):

```bash
# CDP API credentials
CDP_API_KEY_ID=your_api_key_id
CDP_API_KEY_SECRET="-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIBkg...your_key_content_here...
-----END EC PRIVATE KEY-----"
CDP_WALLET_SECRET=your_wallet_secret

# Optional: for contract verification
BASESCAN_API_KEY=your_basescan_api_key
```

**Important**: Use actual newlines in the secret, not `\n` characters.

## Initialize the Client

### From Environment Variables (Recommended)

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

// Automatically reads from environment
const cdp = new CdpClient();
```

### Explicit Configuration

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";
import { readFileSync } from "fs";

const cdp = new CdpClient({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  walletSecret: process.env.CDP_WALLET_SECRET,
});
```

## Create a Managed Wallet

```typescript
// Create a new EVM account
const account = await cdp.evm.createAccount();
console.log("Address:", account.address);

// Or get/create by name (idempotent - same name returns same wallet)
const account = await cdp.evm.getOrCreateAccount({
  name: "my-agent-wallet",
});
```

## Check Balance

```typescript
const balance = await cdp.evm.getBalance({
  address: account.address,
  network: "base-sepolia",  // or "base" for mainnet
});

console.log("Balance:", balance.amount, balance.asset);
```

## Send a Transaction

```typescript
import { parseEther } from "viem";

const { transactionHash } = await cdp.evm.sendTransaction({
  address: account.address,
  network: "base-sepolia",
  transaction: {
    to: "0x...",
    value: parseEther("0.01"),
  },
});

console.log("Transaction:", transactionHash);
```

## Transfer Tokens

```typescript
import { parseUnits } from "viem";

const { transactionHash } = await account.transfer({
  to: "0x...",
  amount: parseUnits("10", 6),  // 10 USDC (6 decimals)
  token: "usdc",
  network: "base-sepolia",
});
```

## Import Existing Account

If you have an existing private key (use with caution):

```typescript
const account = await cdp.evm.importAccount({
  privateKey: "0x...",
  name: "imported-wallet",
});
```

## Smart Accounts (Account Abstraction)

For gasless transactions and advanced features:

```typescript
const owner = await cdp.evm.createAccount();
const smartAccount = await cdp.evm.getOrCreateSmartAccount({
  name: "my-smart-wallet",
  owner,
});

// Send user operation (can sponsor gas)
const userOp = await cdp.evm.sendUserOperation({
  smartAccount,
  network: "base-sepolia",
  calls: [
    {
      to: "0x...",
      value: parseEther("0.01"),
      data: "0x",
    },
  ],
});
```

## Verify Setup

```typescript
import { CdpClient } from "@coinbase/cdp-sdk";

async function testSetup() {
  try {
    const cdp = new CdpClient();
    const account = await cdp.evm.createAccount();
    console.log("Setup successful!");
    console.log("Wallet address:", account.address);
  } catch (error) {
    console.error("Setup failed:", error.message);
  }
}

testSetup();
```

## Security Best Practices

1. **Never commit credentials** - Use `.env` and add to `.gitignore`
2. **Rotate keys regularly** - Create new keys periodically
3. **Scope permissions** - Use minimal required permissions
4. **Monitor usage** - Check CDP dashboard for unexpected activity
5. **Use named accounts** - `getOrCreateAccount` is idempotent and safer

## Troubleshooting

**"Invalid API key"**
- Verify CDP_API_KEY_ID is correct
- Check key hasn't been revoked in CDP portal

**"Invalid signature"**
- Ensure API Key Secret is in correct PEM format
- Use actual newlines, not literal `\n` characters
- Verify the full key content is included

**"Wallet secret required"**
- Set CDP_WALLET_SECRET environment variable
- This is used for wallet encryption

## Resources

- [CDP Portal](https://portal.cdp.coinbase.com/)
- [CDP SDK TypeScript Docs](https://coinbase.github.io/cdp-sdk/typescript)
- [CDP SDK GitHub](https://github.com/coinbase/cdp-sdk)
