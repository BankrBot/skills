# Signing Unsigned Transactions

All Arcadia write tools return unsigned transactions as `{ to, data, value, chainId }`. You need a separate wallet to sign and broadcast. Never expose private keys to the agent.

## Wallet MCP Servers (recommended)

- MCP Wallet Signer (github.com/nikicat/mcp-wallet-signer): routes to browser wallet (MetaMask, Rabby), non-custodial
- Phantom MCP (@phantom/mcp-server): for Phantom wallet users
- Privy MCP (github.com/incentivai-io/privy-mcp-server): wallet infrastructure
- Coinbase AgentKit (github.com/coinbase/agentkit): wallet-agnostic signing
- Safe MCP (github.com/safer-sh/safer): multi-sig via Safe
