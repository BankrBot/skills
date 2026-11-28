# ERC-8183 Swarm Arbitration & ERC-7579 Smart Account Guards

Beyond single-agent HTTP queries, Tereno provides cryptographic verification primitives for multi-agent escrow workflows and modular smart accounts on Base.

---

## 1. ERC-8183 Agent Communication Protocol (ACP) Evaluator

When hiring or collaborating with autonomous agents (e.g., Virtuals ACP / ERC-8183 job escrows), designate Tereno as the neutral `evaluator` before releasing funds.

### Endpoint
`POST https://www.tereno.xyz/api/acp/evaluate`

### Request Body
```json
{
  "jobId": "job-001",
  "clientAddress": "0xClientWallet...",
  "providerAddress": "0xProviderWallet...",
  "taskType": "token_launch_safety",
  "targetAddress": "0xTargetContractOrToken..."
}
```

Supported `taskType` values:
- `"contract_safety"` — Runs `contract.guard` verification.
- `"token_launch_safety"` — Runs `token.launch.guard` exit simulation & owner checks.
- `"token_holders_concentration"` — Runs `token.holders.guard` cabal & holder analysis.

### Response
Returns:
- `escrowReleaseEligible`: `boolean` (`true` only when safe to release bounty/escrow).
- `score`: normalized score from `0.0` to `1.0`.
- `verdictProof`: cryptographic **EIP-712 `VerdictProof`** signed by Tereno's attester key, ready for onchain or multi-agent verification.

---

## 2. ERC-7579 Modular Smart Account Hook (`TerenoGuardHook`)

For autonomous agents operating via **Safe (Safe7579)**, **Biconomy**, **Kernel v3**, or **Coinbase Smart Wallet**, Tereno provides an ERC-7579 Type 4 Hook module (`preCheck` / `postCheck`):

- **Base Mainnet (`eip155:8453`):** `0x7579c4a8E161C689d71c4c8A72B8D361F89C402E`
- **Base Sepolia (`eip155:84532`):** `0x7579bA78e25dAc4aE612056B4e321e9C3e7C921F`

Fetch live contract metadata, ABI, and installation instructions at any time:
```bash
curl -s "https://www.tereno.xyz/api/erc7579/module"
```
*(Or via MCP tool `tereno_erc7579_module`.)*

When installed, `TerenoGuardHook.preCheck` enforces signed Tereno EIP-712 `VerdictProof`s onchain so malicious or honeypot token interactions automatically revert before funds leave the smart account.

---

## 3. ERC-8004 Identity & Validation Registry

- **Tereno Canonical Agent ID:** `63721` on the Base Identity Registry.
- **Validation Inspection:** `GET /api/v1/erc8004/validations/{id}` (MCP: `tereno_erc8004_validation`).
- **Counterparty Attestation Inspection:** `GET /api/v1/erc8004/counterparty/{attestationId}`.
- **Agent Portfolio & Credits:** `GET /api/v1/agents/{wallet}/portfolio`.
