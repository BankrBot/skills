# SIWA Private Key Signer

> Latest version: [https://siwa.id/skills/private-key/skill.md](https://siwa.id/skills/private-key/skill.md)

Sign SIWA messages using a raw private key via viem's LocalAccount.

## Install

```bash
npm install @buildersgarden/siwa viem
```

## Create Signer

```typescript
import { createLocalAccountSigner } from "@buildersgarden/siwa/signer";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);
const signer = createLocalAccountSigner(account);
```

## Register as ERC-8004 Agent

If your agent doesn't have an ERC-8004 identity yet, register onchain first:

```typescript
import { registerAgent } from "@buildersgarden/siwa/registry";

const result = await registerAgent({
  agentURI: "data:application/json;base64,...",  // or ipfs://...
  chainId: 84532,  // Base Sepolia
  signer,
});

console.log("Agent ID:", result.agentId);
console.log("Registry:", result.agentRegistry);
console.log("Tx Hash:", result.txHash);
```

The `agentURI` contains your agent's metadata (name, description, capabilities). You can use a base64 data URI or IPFS.

---

## SIWA Authentication Flow

The authentication flow consists of two steps:

> **Note:** The URLs below (`api.example.com`) are placeholders. Replace them with your own server that implements the SIWA verification endpoints. See the [Server-Side Verification](server-side.md) skill for implementation details.

1. **Get a nonce** from the server's `/siwa/nonce` endpoint
2. **Sign and verify** by sending the signature to `/siwa/verify`

### Step 1: Request Nonce

```typescript
const nonceRes = await fetch("https://api.example.com/siwa/nonce", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    address: await signer.getAddress(),
    agentId: 42,
    agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e",
  }),
});
const { nonce, nonceToken, issuedAt, expirationTime } = await nonceRes.json();
```

### Step 2: Sign and Verify

```typescript
import { signSIWAMessage } from "@buildersgarden/siwa";

const { message, signature, address } = await signSIWAMessage({
  domain: "api.example.com",
  uri: "https://api.example.com/siwa",
  agentId: 42,
  agentRegistry: "eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e", //According to the chain
  chainId: 84532,
  nonce,
  issuedAt,
  expirationTime,
}, signer);

// Send to server for verification
const verifyRes = await fetch("https://api.example.com/siwa/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message, signature, nonceToken }),
});

const { receipt, agentId } = await verifyRes.json();
// Store the receipt for authenticated API calls
```

## Sign Authenticated Request (ERC-8128)

```typescript
import { signAuthenticatedRequest } from "@buildersgarden/siwa/erc8128";

const request = new Request("https://api.example.com/action", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "execute" }),
});

const signedRequest = await signAuthenticatedRequest(
  request,
  receipt,  // from SIWA sign-in
  signer,
  84532,
);

const response = await fetch(signedRequest);
```

## Environment Variables

```bash
PRIVATE_KEY=0x...your-private-key
```

## Security

- Never commit private keys to source control
- Use environment variables or secure vaults
- Consider using the [Keyring Proxy](keyring-proxy-signer.md) for production deployments where key isolation is required
