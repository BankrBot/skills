---
name: ens-primary-name
description: Set your primary ENS name on Base and other L2s. Use when user wants to set their ENS name, configure reverse resolution, set primary name, or make their address resolve to an ENS name. Supports Base, Arbitrum, Optimism, and Ethereum mainnet.
---

# ENS Primary Name

Set your primary ENS name on Base and other L2 chains via the ENS Reverse Registrar.

A primary name creates a bi-directional link:
- **Forward:** `name.eth` → `0x1234...` (set in ENS resolver)
- **Reverse:** `0x1234...` → `name.eth` (set via this skill)

## Quick Start

```bash
# Set primary name on Base
./scripts/set-primary.sh myname.eth

# Set on specific chain
./scripts/set-primary.sh myname.eth arbitrum
```

## Supported Chains

| Chain | Reverse Registrar |
|-------|-------------------|
| Base | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Arbitrum | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Optimism | `0x0000000000D8e504002cC26E3Ec46D81971C1664` |
| Ethereum | `0x283F227c4Bd38ecE252C4Ae7ECE650B0e913f1f9` |

## Prerequisites

1. **Own or control an ENS name** - The name must be registered
2. **Forward resolution configured** - The name must resolve to your address on the target chain
3. **Bankr wallet** - Used to sign and submit the transaction

## How It Works

1. Encodes `setName(string)` calldata with your ENS name
2. Submits transaction to the Reverse Registrar via Bankr
3. After confirmation, apps will show your ENS name instead of address

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Transaction reverted" | Ensure the ENS name resolves to your address on that chain |
| "Name not showing" | Forward resolution may not be set for that chain's cointype |
| "Not authorized" | You must call from the address the name resolves to |

## Manual Process

If the script fails, call `setName(string)` on the Reverse Registrar:

```solidity
// Function selector: 0xc47f0027
setName("yourname.eth")
```

## Links

- ENS Docs: https://docs.ens.domains/web/reverse
- ENS App: https://app.ens.domains
