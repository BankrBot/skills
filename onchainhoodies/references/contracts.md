# Robinhood Chain and OnChainHoodies contract reference

Chain ID: **4663**. RPC: `https://rpc.mainnet.chain.robinhood.com`. Explorer: `https://robinhoodchain.blockscout.com`.

| Contract | Address |
|---|---|
| OnChainHoodies ERC-721 | `0x9Ec6C5b9f572A9B02138E553BC5F5882Da735F45` |
| HoodOS | `0x1993c5515E81d2768f7F8D8a1e6e38Bbf4e4beB9` |
| OCH ERC-20 (expected payment token; verify via `paymentToken()`) | `0x8BDD5adFF8A9D08372323d5BAF5e8e52605AF983` |

## Relevant Solidity ABI fragments

```solidity
// Hoodie NFT
function ownerOf(uint256 tokenId) external view returns (address);

// HoodOS
function walletOf(uint256 tokenId) external view returns (address);
function isActive(uint256 tokenId) external view returns (bool);
function activationEnabled() external view returns (bool);
function activationCost() external view returns (uint256);
function paymentToken() external view returns (address);
function activate(uint256 tokenId) external;

// ERC-20
function decimals() external view returns (uint8);
function symbol() external view returns (string memory);
function balanceOf(address account) external view returns (uint256);
function allowance(address owner, address spender) external view returns (uint256);
function approve(address spender, uint256 amount) external returns (bool);
```

## Source-derived behavior

Based on the user-provided `HoodOS(20261010-164556).sol` and `HoodWallet(20261010-164556).sol`:

- `activate(uint256)` is guarded by `whenNotPaused` and `nonReentrant`, checks `activationEnabled` and economy configuration, and requires `msg.sender == hoodies.ownerOf(tokenId)`.
- `activate` reverts for an already active Hoodie, calls `createWallet(tokenId)`, and uses `paymentToken.safeTransferFrom(msg.sender, address(this), activationCost)` after recording activation; subsequent fee distribution occurs inside the transaction.
- `walletOf` deterministically derives the account through ERC-6551 Registry using configured implementation, salt, `block.chainid`, the Hoodie contract, and tokenId.
- `isActive` compares recorded activation owner with the **current** NFT owner. Transfer invalidates the prior owner's activation.
- The activation price is stored in the public `activationCost` variable in the token's smallest units; read it live. The public `paymentToken` can be configured, so verify it rather than assuming an address.
- `HoodWallet.owner()` resolves ownership via NFT ownership; wallet execution additionally obeys HoodOS policy.

This source inspection does not prove the current live contract deployment has the same bytecode/configuration. Check verified contract or live chain before executing funds-moving transactions.
