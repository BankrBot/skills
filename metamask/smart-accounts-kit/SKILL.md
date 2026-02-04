---
name: smart-accounts-kit
description: Web3 development using MetaMask Smart Accounts Kit. Use when the user wants to build dApps with ERC-4337 smart accounts, send user operations, batch transactions, configure signers (EOA, passkey, multisig), implement gas abstraction with paymasters, create delegations, or request advanced permissions (ERC-7715). Supports Viem integration, multiple signer types (Dynamic, Web3Auth, Wagmi), gasless transactions, and the Delegation Framework.
metadata: {"openclaw":{"emoji":"🦊","homepage":"https://docs.metamask.io/smart-accounts-kit"}}
---
## Quick Reference

This skill file provides quick access to the MetaMask Smart Accounts Kit v0.3.0. For detailed information, refer to the specific reference files.

**📚 Detailed References:**

- [Smart Accounts Reference](./references/smart-accounts.md) - Account creation, implementations, signers
- [Delegations Reference](./references/delegations.md) - Delegation lifecycle, scopes, caveats
- [Advanced Permissions Reference](./references/advanced-permissions.md) - ERC-7715 permissions via MetaMask

## Package Installation

```bash
npm install @metamask/smart-accounts-kit@0.3.0
```

For custom caveat enforcers:

```bash
forge install metamask/delegation-framework@v1.3.0
```

## Core Concepts Summary

### 1. Smart Accounts (ERC-4337)

Three implementation types:

- **Hybrid** (`Implementation.Hybrid`) - EOA + passkey signers
- **Multisig** (`Implementation.MultiSig`) - Multiple signers with threshold
- **Stateless7702** (`Implementation.Stateless7702`) - EIP-7702 upgraded EOA

### 2. Delegation Framework (ERC-7710)

Grant permissions from delegator to delegate:

- **Scopes** - Initial authority (spending limits, function calls)
- **Caveats** - Restrictions enforced by smart contracts
- **Types** - Root, open root, redelegation, open redelegation
- **Lifecycle** - Create → Sign → Store → Redeem

### 3. Advanced Permissions (ERC-7715)

Request permissions via MetaMask extension:

- Human-readable UI confirmations
- ERC-20 and native token permissions
- Requires MetaMask Flask 13.5.0+
- User must have smart account

## Quick Code Examples

### Create Smart Account

```typescript
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount('0x...')

const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Hybrid,
  deployParams: [account.address, [], [], []],
  deploySalt: '0x',
  signer: { account },
})
```

### Create Delegation

```typescript
import { createDelegation } from '@metamask/smart-accounts-kit'
import { parseUnits } from 'viem'

const delegation = createDelegation({
  to: delegateAddress,
  from: delegatorSmartAccount.address,
  environment: delegatorSmartAccount.environment,
  scope: {
    type: 'erc20TransferAmount',
    tokenAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    maxAmount: parseUnits('10', 6),
  },
  caveats: [
    { type: 'timestamp', afterThreshold: now, beforeThreshold: expiry },
    { type: 'limitedCalls', limit: 5 },
  ],
})
```

### Sign Delegation

```typescript
const signature = await smartAccount.signDelegation({ delegation })
const signedDelegation = { ...delegation, signature }
```

### Redeem Delegation

```typescript
import { createExecution, ExecutionMode } from '@metamask/smart-accounts-kit'
import { DelegationManager } from '@metamask/smart-accounts-kit/contracts'
import { encodeFunctionData, erc20Abi } from 'viem'

const callData = encodeFunctionData({
  abi: erc20Abi,
  args: [recipient, parseUnits('1', 6)],
  functionName: 'transfer',
})

const execution = createExecution({ target: tokenAddress, callData })

const redeemCalldata = DelegationManager.encode.redeemDelegations({
  delegations: [[signedDelegation]],
  modes: [ExecutionMode.SingleDefault],
  executions: [[execution]],
})

// Via smart account
const userOpHash = await bundlerClient.sendUserOperation({
  account: delegateSmartAccount,
  calls: [{ to: delegateSmartAccount.address, data: redeemCalldata }],
})

// Via EOA
const txHash = await delegateWalletClient.sendTransaction({
  to: environment.DelegationManager,
  data: redeemCalldata,
})
```

### Request Advanced Permissions

```typescript
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions'

const walletClient = createWalletClient({
  transport: custom(window.ethereum),
}).extend(erc7715ProviderActions())

const grantedPermissions = await walletClient.requestExecutionPermissions([
  {
    chainId: chain.id,
    expiry: now + 604800,
    signer: {
      type: 'account',
      data: { address: sessionAccount.address },
    },
    permission: {
      type: 'erc20-token-periodic',
      data: {
        tokenAddress,
        periodAmount: parseUnits('10', 6),
        periodDuration: 86400,
        justification: 'Transfer 10 USDC daily',
      },
    },
    isAdjustmentAllowed: true,
  },
])
```

### Redeem Advanced Permissions

```typescript
// Smart account
import { erc7710BundlerActions } from '@metamask/smart-accounts-kit/actions'

const bundlerClient = createBundlerClient({
  client: publicClient,
  transport: http(bundlerUrl),
}).extend(erc7710BundlerActions())

const permissionsContext = grantedPermissions[0].context
const delegationManager = grantedPermissions[0].signerMeta.delegationManager

const userOpHash = await bundlerClient.sendUserOperationWithDelegation({
  publicClient,
  account: sessionAccount,
  calls: [
    {
      to: tokenAddress,
      data: calldata,
      permissionsContext,
      delegationManager,
    },
  ],
})

// EOA
import { erc7710WalletActions } from '@metamask/smart-accounts-kit/actions'

const walletClient = createWalletClient({
  account: sessionAccount,
  chain,
  transport: http(),
}).extend(erc7710WalletActions())

const txHash = await walletClient.sendTransactionWithDelegation({
  to: tokenAddress,
  data: calldata,
  permissionsContext,
  delegationManager,
})
```

## Key API Methods

### Smart Accounts

- `toMetaMaskSmartAccount()` - Create smart account
- `aggregateSignature()` - Combine multisig signatures
- `signDelegation()` - Sign delegation
- `signUserOperation()` - Sign user operation
- `signMessage()` / `signTypedData()` - Standard signing

### Delegations

- `createDelegation()` - Create delegation with delegate
- `createOpenDelegation()` - Create open delegation
- `createCaveatBuilder()` - Build caveats array
- `createExecution()` - Create execution struct
- `redeemDelegations()` - Encode redemption calldata
- `signDelegation()` - Sign with private key
- `getSmartAccountsEnvironment()` - Resolve environment
- `deploySmartAccountsEnvironment()` - Deploy contracts
- `overrideDeployedEnvironment()` - Override environment

### Advanced Permissions

- `erc7715ProviderActions()` - Wallet client extension for requesting
- `requestExecutionPermissions()` - Request permissions
- `erc7710BundlerActions()` - Bundler client extension
- `sendUserOperationWithDelegation()` - Redeem with smart account
- `erc7710WalletActions()` - Wallet client extension
- `sendTransactionWithDelegation()` - Redeem with EOA

## Common Delegation Scopes

### Spending Limits

| Scope                       | Description                   |
| --------------------------- | ----------------------------- |
| `erc20TransferAmount`       | Fixed ERC-20 limit            |
| `erc20PeriodTransfer`       | Per-period ERC-20 limit       |
| `erc20Streaming`            | Linear streaming ERC-20       |
| `nativeTokenTransferAmount` | Fixed native token limit      |
| `nativeTokenPeriodTransfer` | Per-period native token limit |
| `nativeTokenStreaming`      | Linear streaming native       |
| `erc721Transfer`            | ERC-721 (NFT) transfer        |

### Function Calls

| Scope               | Description                        |
| ------------------- | ---------------------------------- |
| `functionCall`      | Specific methods/addresses allowed |
| `ownershipTransfer` | Ownership transfers only           |

## Common Caveat Enforcers

### Target & Method

- `allowedTargets` - Limit callable addresses
- `allowedMethods` - Limit callable methods
- `allowedCalldata` - Validate specific calldata
- `exactCalldata` / `exactCalldataBatch` - Exact calldata match
- `exactExecution` / `exactExecutionBatch` - Exact execution match

### Value & Token

- `valueLte` - Limit native token value
- `erc20TransferAmount` - Limit ERC-20 amount
- `erc20BalanceChange` - Validate ERC-20 balance change
- `erc721Transfer` / `erc721BalanceChange` - ERC-721 restrictions
- `erc1155BalanceChange` - ERC-1155 validation

### Time & Frequency

- `timestamp` - Valid time range (seconds)
- `blockNumber` - Valid block range
- `limitedCalls` - Limit redemption count
- `erc20PeriodTransfer` / `erc20Streaming` - Time-based ERC-20
- `nativeTokenPeriodTransfer` / `nativeTokenStreaming` - Time-based native

### Security & State

- `redeemer` - Limit redemption to specific addresses
- `id` - One-time delegation with ID
- `nonce` - Bulk revocation via nonce
- `deployed` - Auto-deploy contract
- `ownershipTransfer` - Ownership transfer only
- `nativeTokenPayment` - Require payment
- `nativeBalanceChange` - Validate native balance
- `multiTokenPeriod` - Multi-token period limits

## Execution Modes

| Mode            | Chains   | Processing  | On Failure |
| --------------- | -------- | ----------- | ---------- |
| `SingleDefault` | One      | Sequential  | Revert     |
| `SingleTry`     | One      | Sequential  | Continue   |
| `BatchDefault`  | Multiple | Interleaved | Revert     |
| `BatchTry`      | Multiple | Interleaved | Continue   |

## Contract Addresses (v1.3.0)

### Core

| Contract              | Address                                      |
| --------------------- | -------------------------------------------- |
| EntryPoint            | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` |
| SimpleFactory         | `0x69Aa2f9fe1572F1B640E1bbc512f5c3a734fc77c` |
| DelegationManager     | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| MultiSigDeleGatorImpl | `0x56a9EdB16a0105eb5a4C54f4C062e2868844f3A7` |
| HybridDeleGatorImpl   | `0x48dBe696A4D990079e039489bA2053B36E8FFEC4` |

## Critical Rules

### Always Required

1. **Always use caveats** - Never create unrestricted delegations
2. **Deploy delegator first** - Account must be deployed before redeeming
3. **Check smart account status** - ERC-7715 requires user has smart account

### Behavior

4. **Caveats are cumulative** - In delegation chains, restrictions stack
5. **Function call default** - v0.3.0 defaults to NO native token (use `valueLte`)
6. **Batch mode caveat** - No compatible caveat enforcers available

### Requirements

7. **ERC-7715 requirements** - MetaMask Flask 13.5.0+, smart account
8. **Multisig threshold** - Need at least threshold signers
9. **7702 upgrade** - Stateless7702 requires EIP-7702 upgrade first

## Common Patterns

### Pattern 1: ERC-20 with Time Limit

```typescript
const delegation = createDelegation({
  to: delegate,
  from: delegator,
  environment,
  scope: {
    type: 'erc20TransferAmount',
    tokenAddress,
    maxAmount: parseUnits('100', 6),
  },
  caveats: [
    { type: 'timestamp', afterThreshold: now, beforeThreshold: expiry },
    { type: 'limitedCalls', limit: 10 },
    { type: 'redeemer', redeemers: [delegate] },
  ],
})
```

### Pattern 2: Function Call with Value

```typescript
const delegation = createDelegation({
  to: delegate,
  from: delegator,
  environment,
  scope: {
    type: 'functionCall',
    targets: [contractAddress],
    selectors: ['transfer(address,uint256)'],
    valueLte: { maxValue: parseEther('0.1') },
  },
  caveats: [{ type: 'allowedMethods', selectors: ['transfer(address,uint256)'] }],
})
```

### Pattern 3: Periodic Native Token

```typescript
const delegation = createDelegation({
  to: delegate,
  from: delegator,
  environment,
  scope: {
    type: 'nativeTokenPeriodTransfer',
    periodAmount: parseEther('0.01'),
    periodDuration: 86400,
    startDate: now,
  },
})
```

### Pattern 4: Redelegation Chain

```typescript
// Alice → Bob (100 USDC)
const aliceToBob = createDelegation({
  to: bob,
  from: alice,
  environment,
  scope: { type: 'erc20TransferAmount', tokenAddress, maxAmount: parseUnits('100', 6) },
})

// Bob → Carol (50 USDC, subset of authority)
const bobToCarol = createDelegation({
  to: carol,
  from: bob,
  environment,
  scope: { type: 'erc20TransferAmount', tokenAddress, maxAmount: parseUnits('50', 6) },
  parentDelegation: aliceToBob,
  caveats: [{ type: 'timestamp', afterThreshold: now, beforeThreshold: expiry }],
})
```

## Troubleshooting Quick Fixes

| Issue                    | Solution                                                     |
| ------------------------ | ------------------------------------------------------------ |
| Account not deployed     | Use `bundlerClient.sendUserOperation()` to deploy            |
| Invalid signature        | Verify chain ID, delegation manager, signer permissions      |
| Caveat enforcer reverted | Check caveat parameters match execution, verify order        |
| Redemption failed        | Check delegator balance, calldata validity, target contracts |
| ERC-7715 not working     | Upgrade to Flask 13.5.0+, ensure user has smart account      |
| Permission denied        | Handle gracefully, provide manual fallback                   |
| Threshold not met        | Add more signers for multisig                                |
| 7702 not working         | Confirm EOA upgraded via EIP-7702 first                      |

## Resources

- **NPM:** `@metamask/smart-accounts-kit`
- **Contracts:** `metamask/delegation-framework@v1.3.0`
- **ERC Standards:** ERC-4337, ERC-7710, ERC-7715, ERC-7579
- **MetaMask Flask:** https://metamask.io/flask

## Version Info

- **Toolkit:** 0.3.0
- **Delegation Framework:** 1.3.0
- **Breaking Change:** Function call scope defaults to no native token transfer

---

**For detailed documentation, see the reference files in the `/references` directory.**
