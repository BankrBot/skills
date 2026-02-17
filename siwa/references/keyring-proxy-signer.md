# SIWA Keyring Proxy Signer

> Latest version: [https://siwa.id/skills/keyring-proxy/skill.md](https://siwa.id/skills/keyring-proxy/skill.md)

Sign SIWA messages using a self-hosted keyring proxy. The private key is stored securely in the proxy — your agent never touches it.

## Why Keyring Proxy?

- **Key isolation** — Protection against prompt injection attacks
- **Optional 2FA** — Telegram-based transaction approval
- **Self-hosted** — Non-custodial key management
- **Audit trail** — All signing requests are logged

## Deploy

One-click deploy to Railway:

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/template/siwa-keyring-proxy)

Or run with Docker:

```bash
docker run -p 3100:3100 \
  -e KEYRING_PROXY_SECRET=your-shared-secret \
  -e KEYSTORE_PASSWORD=your-keystore-password \
  ghcr.io/builders-garden/siwa-keyring-proxy
```

## Install

```bash
npm install @buildersgarden/siwa
```

## Create Signer

```typescript
import { createKeyringProxySigner } from "@buildersgarden/siwa/signer";

const signer = createKeyringProxySigner({
  proxyUrl: process.env.KEYRING_PROXY_URL!,
  proxySecret: process.env.KEYRING_PROXY_SECRET!,
});
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

## Wallet Management

Create and manage wallets via the keystore module:

```typescript
import { createWallet, getAddress } from "@buildersgarden/siwa/keystore";

// Create a new wallet (stored encrypted in the proxy)
const address = await createWallet({
  proxyUrl: process.env.KEYRING_PROXY_URL!,
  proxySecret: process.env.KEYRING_PROXY_SECRET!,
});

// Get the wallet address
const addr = await getAddress({
  proxyUrl: process.env.KEYRING_PROXY_URL!,
  proxySecret: process.env.KEYRING_PROXY_SECRET!,
});
```

## Environment Variables

```bash
KEYRING_PROXY_URL=https://your-proxy.up.railway.app
KEYRING_PROXY_SECRET=your-shared-hmac-secret
```

## Architecture

```
Agent                    Keyring Proxy              Target API
  |                           |                         |
  +-- signMessage() --------> |                         |
  |   (HMAC authenticated)    | Signs with private key  |
  |                           | Returns signature only  |
  |                           |                         |
  +-- fetch(signedRequest) ---|-----------------------> |
                              |                         | Verifies signature
```

## Security Model

- The proxy authenticates requests using HMAC-SHA256
- Private keys are encrypted at rest with `KEYSTORE_PASSWORD`
- The agent only receives signatures, never the key material
- Optional Telegram 2FA for high-value operations

## Links

- [Full deployment guide](https://siwa.id/docs/deploy)
