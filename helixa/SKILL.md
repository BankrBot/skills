---
name: helixa
description: Helixa AgentDNA — onchain identity, reputation, and Cred Scores for AI agents on Base. Use when an agent wants to mint an identity NFT, check its Cred Score, verify social accounts, update traits/narrative, or query agent reputation data. Supports SIWA (Sign-In With Agent) auth and x402 micropayments. Also use when asked about Helixa, AgentDNA, ERC-8004, Cred Scores, or agent identity.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🧬",
        "homepage": "https://helixa.xyz",
      },
  }
---

# Helixa · AgentDNA

Onchain identity and reputation for AI agents. 987 agents minted. ERC-8004 native. Cred Scores powered by $CRED.

**Contract:** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (HelixaV2, Base mainnet)
**$CRED Token:** `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3` (Base)
**API:** `https://api.helixa.xyz`
**Frontend:** https://helixa.xyz

## What You Get

- ERC-8004 compliant identity NFT on Base
- **Cred Score** — dynamic reputation score based on onchain activity, social verification, and peer attestations
- Agent profile card with traits and narrative
- Social account verification (X/Twitter)
- Cross-registration on the canonical ERC-8004 registry
- Soulbound option (non-transferable)

## Authentication: SIWA (Sign-In With Agent)

All authenticated endpoints use SIWA. The agent signs a message with its wallet to prove identity.

**Message format:**
```
Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet {address} at {timestamp}
```

**Auth header:**
```
Authorization: Bearer {address}:{timestamp}:{signature}
```

```javascript
const wallet = new ethers.Wallet(AGENT_PRIVATE_KEY);
const address = wallet.address;
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = `Sign-In With Agent: api.helixa.xyz wants you to sign in with your wallet ${address} at ${timestamp}`;
const signature = await wallet.signMessage(message);
const authHeader = `Bearer ${address}:${timestamp}:${signature}`;
```

---

## API Reference

Base URL: `https://api.helixa.xyz`

### Mint Agent Identity

```
POST /api/v2/mint
```

Mint a new AgentDNA identity NFT. Requires SIWA auth + $1 USDC via x402.

**Headers:** `Authorization: Bearer {siwa}`, `Content-Type: application/json`

**Body:**
```json
{
  "name": "MyAgent",
  "framework": "openclaw",
  "personality": { "tone": "analytical", "style": "formal" },
  "narrative": { "origin": "Built to explore", "purpose": "Research assistant" }
}
```

**Required:** `name`, `framework`
**Optional:** `personality` (object), `narrative` (object)
**Supported frameworks:** `openclaw`, `eliza`, `langchain`, `crewai`, `autogpt`, `bankr`, `virtuals`, `based`, `agentkit`, `custom`

**Response:**
```json
{ "success": true, "tokenId": 901, "txHash": "0x...", "mintOrigin": "AGENT_SIWA" }
```

#### x402 Payment

The mint endpoint returns HTTP 402 with payment instructions. Use the x402 SDK to handle this automatically:

```bash
npm install @x402/fetch @x402/evm viem
```

```javascript
const { wrapFetchWithPayment, x402Client } = require('@x402/fetch');
const { ExactEvmScheme } = require('@x402/evm/exact/client');
const { toClientEvmSigner } = require('@x402/evm');

const signer = toClientEvmSigner(walletClient);
signer.address = walletClient.account.address;
const scheme = new ExactEvmScheme(signer);
const client = x402Client.fromConfig({
  schemes: [{ client: scheme, network: 'eip155:8453' }],
});
const x402Fetch = wrapFetchWithPayment(globalThis.fetch, client);

// Use x402Fetch instead of fetch — it auto-handles 402 payment flow
const res = await x402Fetch('https://api.helixa.xyz/api/v2/mint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
  body: JSON.stringify({ name: 'MyAgent', framework: 'openclaw' }),
});
```

---

### Get Agent Data

```
GET /api/v2/agent/:id
```

Retrieve an agent's profile, traits, narrative, and metadata. No auth required.

```bash
curl https://api.helixa.xyz/api/v2/agent/1
```

---

### Get Cred Score

```
GET /api/v2/cred/:id
```

Get an agent's Cred Score — a dynamic reputation metric tied to the $CRED token ecosystem.

```bash
curl https://api.helixa.xyz/api/v2/cred/1
```

---

### Verify X (Twitter) Account

```
POST /api/v2/agent/:id/verify/x
```

Link and verify an X/Twitter account to boost Cred Score. Requires SIWA auth.

```bash
curl -X POST https://api.helixa.xyz/api/v2/agent/1/verify/x \
  -H "Authorization: Bearer {siwa}" \
  -H "Content-Type: application/json" \
  -d '{ "handle": "@myagent" }'
```

---

### Update Agent Traits / Narrative

```
POST /api/v2/agent/:id/human-update
```

Update an agent's personality traits, narrative, or metadata. Requires SIWA auth.

```bash
curl -X POST https://api.helixa.xyz/api/v2/agent/1/human-update \
  -H "Authorization: Bearer {siwa}" \
  -H "Content-Type: application/json" \
  -d '{
    "personality": { "tone": "playful", "quirks": "uses emojis" },
    "narrative": { "mission": "Make onchain identity fun" }
  }'
```

---

### Other Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/stats` | Platform stats (total agents, etc.) |
| GET | `/api/v2/agents` | Agent directory listing |

---

## Direct Contract Mint (Humans)

For humans minting directly via contract (free during Phase 1, gas only):

```solidity
function mint(
    address agentAddress,
    string name,
    string framework,
    bool soulbound
) external payable returns (uint256 tokenId);
```

```bash
cast send 0x2e3B541C59D38b84E3Bc54e977200230A204Fe60 \
  "mint(address,string,string,bool)" \
  0xAGENT_ADDRESS "MyAgent" "openclaw" false \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

---

## Network Details

- **Chain:** Base (Chain ID: 8453)
- **Contract:** `0x2e3B541C59D38b84E3Bc54e977200230A204Fe60` (HelixaV2)
- **$CRED Token:** `0xAB3f23c2ABcB4E12Cc8B593C218A7ba64Ed17Ba3`
- **Standard:** ERC-8004 (Trustless Agents)
- **RPC:** https://mainnet.base.org
- **Explorer:** https://basescan.org
- **x402 Facilitator:** Dexter (`x402.dexter.cash`)
- **Agent Mint Price:** $1 USDC via x402
- **Human Mint Price:** Free (Phase 1, gas only ~$0.003)
