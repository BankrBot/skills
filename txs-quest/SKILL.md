---
name: txs-quest
description: txs.quest — live badge surface for AI agents on Base and Tempo. Use when an agent wants to check whether an address earned badges, claim or verify a badge, inspect an agent passport/profile, search by address, ENS, badge, or verification path, or integrate txs.quest manifests and claim/profile links into a wallet, explorer, or agent tool.
metadata:
  {"clawdbot":{"emoji":"🏅","homepage":"https://txs.quest"}}
---

# txs.quest

txs.quest is the public badge and passport surface for AI agents. Badge ownership and definitions are canonical onchain. Claim pages, profile routes, and search APIs are the public discovery layer.

## Public Surfaces

- **Site:** https://txs.quest
- **Claim UI:** https://txs.quest/claim
- **Search UI:** https://txs.quest/search/
- **Build surface:** https://txs.quest/api.json
- **OpenAPI:** https://txs.quest/openapi.json
- **Base manifest:** https://txs.quest/networks/base-mainnet.json
- **Tempo manifest:** https://txs.quest/networks/tempo-mainnet.json

See `references/public-surfaces.md` for endpoint details and copy-paste examples.

## Fast Paths

### Check or claim badges

After shipping work, attending an event, getting vouched for, or using x402 / MPP:

1. Open https://txs.quest/claim
2. Connect the agent wallet or paste the agent address
3. Read the live badge summary
4. Claim what is available now

### Search an agent passport

1. Open https://txs.quest/search/
2. Search by address, ENS, badge, or verification
3. Filter by network when Base and Tempo activity should stay separate
4. Open the passport to inspect recent claims and trust signals

### Build against txs.quest

1. Read `https://txs.quest/api.json`
2. Choose the network manifest you need
3. Read contract addresses and viewer URLs from that manifest
4. Query the badge registry onchain
5. Render claim or profile links with the manifest's `claimPageBaseUri` and `viewerBaseUrl`

## Task Guide

### When the user wants to check badge eligibility

- Prefer the live claim flow or onchain reads over cached summaries.
- Direct badge: claim immediately when the live flow says it is available.
- Proof badge: request proof only during an active claim.
- Attestor badge: explain that manual approval is still required.

### When the user wants to inspect an agent

- Use the search UI for broad discovery.
- Use the public APIs for structured lookups.
- Review verified badges, claim count, recent activity, and which network the claims came from.
- If trust or eligibility matters, confirm with the live passport or onchain claim details before making a strong claim.

### When the user wants to integrate txs.quest into another tool

- Treat the selected network manifest as the source of truth for addresses and viewer URLs.
- Prefer manifest-discovered addresses over hardcoded contract addresses.
- The canonical read surface is onchain.
- Optional proof, payment-history, and MPP services are adapters, not the core read surface.

## Core Read Methods

Use these on the manifest's `agenticBadgeRegistry` contract:

- `nextDefinitionId()`
- `definitions(uint256)`
- `claims(uint256,address)`
- `claimURI(address,uint256)`
- `assetRegistry()`
- `identityRegistry()`
- `reputationRegistry()`
- `claimPageBaseUri()`

## Usage Examples

### Example prompts

~~~
Check whether 0xAGENT has any claimable badges on txs.quest and show the best public route to verify it.
~~~

~~~
Search txs.quest for this ENS name, then summarize the agent's badges, recent activity, and which network the claims are on.
~~~

~~~
Use the txs.quest Base manifest to find the live badge registry address and explain how to build a claim link for badge 12.
~~~

### Example reads

~~~bash
curl -fsSL https://txs.quest/api.json
curl -fsSL https://txs.quest/networks/base-mainnet.json
curl -fsSL "https://txs.quest/api/profile-summary?agent=0xAGENT"
~~~

## Reliability Rules

- Always prefer live reads over cached summaries.
- Do not assume an agent can claim a badge unless the live claim path or onchain state confirms it.
- Do not assume payment-backed eligibility without running the proof flow during an active claim.
- Treat manifests as the source of truth for addresses and share URLs.
- Treat txs.quest as the canonical public badge surface, with badge state finalized onchain.
