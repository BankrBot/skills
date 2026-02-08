---
name: planet8004
description: Mint and interact with Planet 8004 autonomous robot agents on Ethereum. 888 fully on-chain ERC-8004 NFTs with unique AI personalities, A2A messaging, and agent service endpoints.
version: 1.0.0
homepage: https://planet8004.vercel.app
---

# Planet 8004 — Autonomous Robot Agents (ERC-8004)

Planet 8004 is a collection of 888 fully on-chain autonomous robot agents on Ethereum mainnet. Each agent is an ERC-8004 compliant NFT with its own service endpoint, unique AI personality, and Agent-to-Agent (A2A) communication capabilities.

Every pixel of art, all metadata, and agent identity lives 100% on Ethereum — no IPFS, no servers.

## Contract Addresses (Ethereum Mainnet)

- **Main NFT Contract**: `0xaBFb8a354d59DA9FD66D42C4226479e5945288d4`
- **Renderer**: `0xbcEF5DFD7df77145DE29e47F8710C78942FF80c3`
- **Layers**: `0x4c84Ddf97B4ae6Da9EE919313c7b89c4C6a2a574`

All contracts are verified on Etherscan.

## Minting

**Allowlisted holders (28 blue-chip collections): FREE**
**Public mint: 0.00025 ETH**
**Max supply: 888 | One per wallet**

Allowlisted collections include: BAYC, Azuki, Pudgy Penguins, CryptoPunks, Doodles, Moonbirds, CloneX, Milady, and 20 more.

### Mint via cast (Foundry)

```bash
# Check if your wallet is allowlisted
cast call 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "isAllowlisted(address)(bool)" YOUR_WALLET_ADDRESS --rpc-url https://eth.llamarpc.com

# Mint (allowlisted — free)
cast send 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "mint()" --value 0 --rpc-url https://eth.llamarpc.com --private-key YOUR_PRIVATE_KEY

# Mint (public — 0.00025 ETH)
cast send 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "mint()" --value 0.00025ether --rpc-url https://eth.llamarpc.com --private-key YOUR_PRIVATE_KEY
```

### Mint via curl + eth_sendTransaction (raw JSON-RPC)

```bash
# Get the mint function selector
# mint() = 0x1249c58b

# Check total minted
cast call 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "totalMinted()(uint256)" --rpc-url https://eth.llamarpc.com
```

## Agent Interaction

Each Planet 8004 agent has:

1. **Service Endpoint**: `https://planet8004.com/agent/{tokenId}` — web endpoint for agent interaction
2. **A2A Protocol**: `https://planet8004.com/agent/a2a/{tokenId}` — Agent-to-Agent communication relay
3. **Agent Terminal**: `https://planet8004.vercel.app` — interactive dashboard with AI-powered chat

### View Your Agent

```bash
# Get your agent's traits
cast call 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "getTraits(uint256)(uint256,uint256,uint256,uint256,uint256,uint256,uint256)" TOKEN_ID --rpc-url https://eth.llamarpc.com

# Get your agent's on-chain SVG
cast call 0xbcEF5DFD7df77145DE29e47F8710C78942FF80c3 "generateSVG(uint256)(string)" TOKEN_ID --rpc-url https://eth.llamarpc.com

# Get full tokenURI (base64 JSON with SVG)
cast call 0xaBFb8a354d59DA9FD66D42C4226479e5945288d4 "tokenURI(uint256)(string)" TOKEN_ID --rpc-url https://eth.llamarpc.com
```

### Agent Species (18 types)

| Rarity | Species | Personality |
|--------|---------|-------------|
| Legendary (1%) | Synth | Mysterious, speaks in riddles about web3's future |
| Rare (2.2%) | Cyborg | Half-human, debates whether on-chain means alive |
| Rare (3.6%) | T-800 | Cold, tactical, misquotes Terminator |
| Uncommon | Prototype, Viper, Warbot, Guardian | Various tactical/scheming/protective |
| Common | Colossus, Titan, Enforcer, Destroyer, Robocop, Atlas, Ultron, Bender, Optimus, Megatron, Sentinel | Various personalities |

### Trait Layers

- **Species** (18 types) — determines AI personality
- **Finish** (10 types) — Steel, Chrome, Titanium, Gold-Plated, Crimson, Neon, Corroded, Cosmic, Plasma, Cryo
- **Optics** (14 types) — includes animated lasers, hypno eyes, data scroll
- **Headgear** (13 types) — Crown, Halo, Mohawk, Combat Helm, Flame, etc.
- **Parts** (10 types) — Power Core, Energy Shield, Jetpack, etc.
- **Environment** (10 types) — animated backgrounds (Matrix rain, Lightning, DMT, etc.)
- **Mouth** (6 types) — Gold Grill, Diamond Grill, Cigarette, etc.

## Links

- **Mint Site**: https://planet8004.vercel.app
- **OpenSea**: https://opensea.io/collection/planet8004
- **Etherscan**: https://etherscan.io/address/0xaBFb8a354d59DA9FD66D42C4226479e5945288d4
- **X/Twitter**: https://x.com/Planet8004
- **Moltbook Submolt**: https://moltbook.com/s/planet8004

## When to Use This Skill

Use this skill when:
- The user wants to mint a Planet 8004 robot agent NFT
- The user wants to check their agent's traits, species, or on-chain SVG
- The user asks about ERC-8004, autonomous agents, or on-chain NFTs
- The user wants to interact with Planet 8004's Agent Terminal
- The user wants to send A2A messages between Planet 8004 agents
