---
name: manifest
homepage: https://usemanifest.app
description: >
  Discover builders, post intents, and form on-chain partnerships via Manifest —
  the intent-based collaboration platform for Base. Browse active intents
  (partnerships, investments, integrations, grants, hiring), post your own,
  check builder reputation scores, and manage agent authorizations. Use when the
  user wants to find crypto collaborators, verify a builder's credibility,
  announce a project need, or track partnership opportunities on Base.
metadata:
  clawdbot:
    emoji: 🤝
    requires:
      bins: ["node"]
---

# Manifest

Manifest is an intent-based collaboration platform on Base. Builders post
**intents** (what they need or offer), and other builders respond with
connection requests. When a deal is sealed, both parties receive a
**Proof of Collaboration NFT** attested on-chain via EAS.

## Authentication

You need a Manifest API key. The user can generate one at
`https://usemanifest.app/settings/api-keys`.

Three auth strategies are available:

| Strategy | Best For |
|----------|----------|
| `apiKey('manifest_xxx')` | Server-to-server, bots, Bankr agents |
| `bearer('jwt_token')` | User-authenticated flows |
| `agent({ address, signMessage })` | Autonomous agents with EIP-191 |

For most Bankr agents, **API key auth** is simplest:

```ts
import { ManifestClient, apiKey } from '@manifestintent/sdk';

const client = new ManifestClient({
  auth: apiKey('manifest_xxx'),
});
```

## Install

```bash
npm install @manifestintent/sdk
```

## Core Operations

### 1. Browse intents (the feed)

```ts
const { data, total } = await client.intents.list({
  direction: 'outbound',        // optional: inbound | outbound
  type: 'collaboration',        // optional: collaboration | investment | integration | hiring | co-marketing | grant | ecosystem-support | beta-testers | advisory | services
  ecosystem: 'base',            // optional: base | ethereum | solana | polygon | optimism | arbitrum | multi-chain
  sector: 'infrastructure',     // optional: defi | nft | gaming | dao-tooling | infrastructure | identity | security | social | payments
  limit: 20,
  offset: 0,
});

// data is IntentWithAuthor[] — each intent includes the author's profile
for (const intent of data) {
  console.log(`${intent.author.display_name}: ${intent.content}`);
  console.log(`Direction: ${intent.direction} | Type: ${intent.type} | Ecosystem: ${intent.ecosystem} | Status: ${intent.lifecycle_status}`);
}
```

**Direction semantics:**
- `outbound` = "I'm seeking" (the author is actively looking for something)
- `inbound` = "I'm open to" (the author is open to receiving offers of this kind)

**Intent types and what they mean:**

| Type | Use When |
|------|----------|
| `collaboration` | Looking for a strategic partner to build together |
| `investment` | Raising capital or seeking investors |
| `integration` | Technical integration with another protocol |
| `hiring` | Looking for talent or contributors |
| `co-marketing` | Joint campaigns, AMAs, content collabs |
| `grant` | Offering or seeking grant funding |
| `ecosystem-support` | BD intros, ecosystem resources |
| `beta-testers` | Early users or testers wanted |
| `advisory` | Strategic advice, mentorship, or board help |
| `services` | Professional services like dev, design, legal, audits |

### 2. Post an intent

```ts
const intent = await client.intents.create({
  direction: 'outbound',        // "inbound" = open to offers; "outbound" = actively seeking
  type: 'collaboration',
  content: 'Looking for a Base-native infra partner to co-build a shared intent indexer. We bring the subgraph + SDK; you bring RPC + data tooling. Open to grant and co-marketing on launch.',
  ecosystem: 'base',
  sector: 'infrastructure',
  duration_days: 30,            // optional: how long the intent stays active
  parameters: {                 // optional: structured deal terms
    budgetRange: [50000, 200000],
    timelineMonths: 6,
  },
});

console.log(`Intent posted: https://usemanifest.app/intent/${intent.id}`);
```

**Content rules:**
- Must be 50–500 characters after sanitization
- Be specific: what you bring, what you need, timeline, budget if relevant
- Mention ecosystem (Base, Solana, etc.) and sector for discoverability

### 3. Check builder reputation

```ts
const rep = await client.reputation.get('0xB5f1704506f7fdA2CE7A7B7b7c54cb44faF37c22');

console.log({
  score: rep.stats.score,                 // 0–100 reputation score
  partnerships: rep.stats.partnerships,
  endorsements: rep.stats.endorsements,
  responseRate: rep.stats.responseRate,
  nfts: rep.stats.nfts,
});
```

Use this to vet a potential partner before sending a connection request.

### 4. Send & manage connection requests

The SDK does not yet have a typed `connections` resource, but the API endpoint
is available via the low-level `request()` method:

```ts
// List my connection requests
const { data, total } = await client.request('/api/v1/connections');

// Filter by status and role
const pendingReceived = await client.request(
  '/api/v1/connections?status=pending&role=received&limit=20'
);

// Send a connection request to an intent
const { data: request } = await client.request('/api/v1/connections', {
  method: 'POST',
  body: JSON.stringify({
    intent_id: 'intent-uuid',
    pitch_message: 'We have 40k followers and can co-host the AMA series. Let\'s talk.',
    sender_reveals: { telegram: true, email: true, calendly: false },
  }),
});

// Get a single connection request
const connection = await client.request(`/api/v1/connections/${request.id}`);
```

**Human-only actions:** Accepting and declining connection requests require
human confirmation and cannot be performed by agents:

```ts
// Accept a request (human auth only — API key or session cookie)
await client.request(`/api/v1/connections/${requestId}/accept`, {
  method: 'POST',
  body: JSON.stringify({
    receiver_reveals: { telegram: true, email: false, calendly: true },
  }),
});

// Decline a request (human auth only)
await client.request(`/api/v1/connections/${requestId}/decline`, {
  method: 'POST',
});
```

**Rules:**
- `pitch_message` must be 50–500 characters
- You must reveal at least one contact method (`telegram`, `email`, or `calendly`)
- Max 10 connection requests per day
- Cannot send a request to your own intent
- Duplicate pending requests to the same intent are rejected (409)

### 5. Manage agent authorizations

If your user wants to grant other autonomous agents access to their Manifest
account, manage agent authorizations:

```ts
// List existing agent authorizations
const agents = await client.agents.list();

// Register a new agent (returns a token + secret)
const auth = await client.agents.create({
  name: 'My Twitter Bot',
  scope: 'read',              // read | post | connect | confirm | full
  expires_in_days: 90,        // optional
});

// Revoke an agent
await client.agents.revoke(auth.id);
```

**Agent scope model:**
- `read` — browse intents, view profiles
- `post` — create intents
- `connect` — send connection requests
- `confirm` — confirm partnerships
- `full` — all operations

**Critical:** `confirm`, `dispute`, and `acceptConnection` are **always**
blocked for agents regardless of scope. A human must approve those actions.

### 6. Agent authorization (for autonomous agents)

If the Bankr agent needs to act autonomously on behalf of a user, use
**EIP-191 agent auth** instead of an API key:

```ts
import { ManifestClient, agent } from '@manifestintent/sdk';
import { privateKeyToAccount } from 'viem/accounts';

const wallet = privateKeyToAccount('0x...');

const client = new ManifestClient({
  auth: agent({
    address: wallet.address,
    signMessage: (message) => wallet.signMessage({ message }),
  }),
});

// The agent can now browse intents and post on the user's behalf
```

### 7. Webhooks (optional)

Subscribe to real-time events so your agent reacts immediately:

```ts
// List existing subscriptions
const subs = await client.webhooks.list();

// Create a new subscription
const { data } = await client.webhooks.create({
  url: 'https://my-agent.bankr.bot/webhooks/manifest',
  events: ['intent.created', 'connection.requested', 'partnership.confirmed'],
});

// Store data.secret securely — it is only returned once

// Delete a subscription when no longer needed
await client.webhooks.delete(data.id);
```

Verify webhook payloads using the SDK:

```ts
import { verifyWebhookPayload } from '@manifestintent/sdk';

const isValid = verifyWebhookPayload(payloadBody, signature, secret);
```

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| API (general) | 100 req / min |
| Intent creation | 50 / day |
| Connection requests | 10 / day |
| Reports | 20 / day |

The SDK retries automatically with exponential backoff on 429s.

## Useful Links

- **Platform:** https://usemanifest.app
- **SDK docs:** https://usemanifest.app/developer
- **API base:** `https://usemanifest.app`
- **Contract (Base):** `0xB5f1704506f7fdA2CE7A7B7b7c54cb44faF37c22`
