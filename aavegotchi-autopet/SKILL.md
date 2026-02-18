---
name: aavegotchi-autopet
description: Pet your Aavegotchi NFTs to maintain kinship on Base chain. Automated petting with 12-hour cooldown tracking.
---

# Aavegotchi Autopet

Pet your Aavegotchi NFTs to maintain kinship on Base chain.

## Usage

Ask the agent to "pet my aavegotchi" or "pet gotchi 9638"

## Configuration

Create config file at `~/.openclaw/workspace/skills/aavegotchi/config.json`:

```json
{
  "contractAddress": "0xa99c4b08201f2913db8d28e71d020c4298f29dbf",
  "walletAddress": "0xb96b48a6b190a9d509ce9312654f34e9770f2110",
  "gotchiId": "9638",
  "rpcUrl": "https://mainnet.base.org",
  "privateKey": "YOUR_PRIVATE_KEY_HERE"
}
```

## Requirements

- `cast` (from Foundry): https://book.getfoundry.sh/getting-started/installation
- Private key for the wallet that owns the Aavegotchi
- ETH on Base for gas fees

## Functions

### Pet Aavegotchi

Calls the `interact(uint256[] tokenIds)` function on the Aavegotchi contract to pet your gotchi.

```bash
./scripts/pet.sh [gotchiId]
```

## Security

⚠️ **NEVER commit your private key to git!**

Store your private key securely in the config file or use environment variables.
