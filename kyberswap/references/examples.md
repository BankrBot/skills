# KyberSwap Examples

Working examples for all KyberSwap workflows.

---

## Quote Examples

### Basic Quote: ETH to USDC on Ethereum

**User Input:**
```
1 ETH to USDC on ethereum
```

**Expected Output:**
```
## KyberSwap Quote

**1 ETH → 2345.67 USDC** on Ethereum

| Detail | Value |
|---|---|
| Input | 1 ETH (~$2345.67) |
| Output | 2345.67 USDC (~$2345.67) |
| Rate | 1 ETH = 2345.67 USDC |
| Gas estimate | 250000 units (~$3.45) |
| Router | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |

### Route
ETH → USDC via [uniswap-v3]
```

**JSON Output:**
```json
{
  "type": "kyberswap-quote",
  "chain": "ethereum",
  "tokenIn": {
    "symbol": "ETH",
    "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "decimals": 18,
    "amount": "1",
    "amountWei": "1000000000000000000",
    "amountUsd": "2345.67"
  },
  "tokenOut": {
    "symbol": "USDC",
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "decimals": 6,
    "amount": "2345.67",
    "amountWei": "2345670000",
    "amountUsd": "2345.67"
  },
  "rate": "2345.67",
  "gas": "250000",
  "gasUsd": "3.45",
  "routerAddress": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"
}
```

### Multi-Chain Quote: USDC to ETH on Arbitrum

**User Input:**
```
100 USDC to ETH on arbitrum
```

**Expected Output:**
```
## KyberSwap Quote

**100 USDC → 0.0426 ETH** on Arbitrum

| Detail | Value |
|---|---|
| Input | 100 USDC (~$100.00) |
| Output | 0.0426 ETH (~$99.85) |
| Rate | 1 USDC = 0.000426 ETH |
| Gas estimate | 450000 units (~$0.12) |
| L1 fee | ~$0.08 |
| Router | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |

### Route
USDC → ETH via [uniswap-v3]
```

**Notes:**
- L2 chains (Arbitrum, Optimism, Base, Linea) include an L1 fee row
- Gas costs are typically lower on L2s
- Router address may vary by chain

---

## Swap Build Examples

### Basic Swap: ETH to USDC (Native Token Input)

**User Input:**
```
1 ETH to USDC on ethereum from 0xYourWalletAddress
```

**Expected Output:**
```
## KyberSwap Swap Transaction

**1 ETH → 2345.67 USDC** on Ethereum

| Detail | Value |
|---|---|
| Input | 1 ETH (~$2345.67) |
| Expected output | 2345.67 USDC (~$2345.67) |
| Minimum output (after slippage) | 2333.94 USDC |
| Slippage tolerance | 0.5% |
| Gas estimate | 250000 units (~$3.45) |

### Transaction Details

| Field | Value |
|---|---|
| To (Router) | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |
| Value | `1000000000000000000` (in wei) |
| Data | `0x...` |
| Sender | `0xYourWalletAddress` |
| Recipient | `0xYourWalletAddress` |

> **WARNING:** Review the transaction details carefully before submitting on-chain.
```

**JSON Output:**
```json
{
  "type": "kyberswap-swap",
  "chain": "ethereum",
  "tokenIn": {
    "symbol": "ETH",
    "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "decimals": 18,
    "amount": "1",
    "amountWei": "1000000000000000000",
    "amountUsd": "2345.67"
  },
  "tokenOut": {
    "symbol": "USDC",
    "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "decimals": 6,
    "amount": "2345.67",
    "amountWei": "2345670000",
    "amountUsd": "2345.67"
  },
  "tx": {
    "to": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
    "data": "0x...",
    "value": "1000000000000000000",
    "gas": "250000",
    "gasUsd": "3.45"
  },
  "sender": "0xYourWalletAddress",
  "recipient": "0xYourWalletAddress",
  "slippageBps": 50
}
```

### ERC-20 Swap: USDC to ETH (Requires Approval)

**User Input:**
```
100 USDC to ETH on ethereum from 0xYourWalletAddress
```

**Expected Output:**
```
## KyberSwap Swap Transaction

**100 USDC → 0.0426 ETH** on Ethereum

| Detail | Value |
|---|---|
| Input | 100 USDC (~$100.00) |
| Expected output | 0.0426 ETH (~$99.85) |
| Minimum output (after slippage) | 0.0424 ETH |
| Slippage tolerance | 0.5% |
| Gas estimate | 280000 units (~$3.89) |

### Transaction Details

| Field | Value |
|---|---|
| To (Router) | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |
| Value | `0` (in wei — ERC-20 input, not native token) |
| Data | `0x...` |
| Sender | `0xYourWalletAddress` |
| Recipient | `0xYourWalletAddress` |

> **WARNING:** Review the transaction details carefully before submitting on-chain.

### Token Approval Required

Before submitting this swap, approve the KyberSwap router to spend USDC:

- **Token contract:** `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`
- **Spender (router):** `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`
- **Amount:** `100000000` (exact amount, recommended) or `type(uint256).max` (unlimited — risky if the router is compromised)

> **Security note:** Prefer exact-amount approvals for large holdings. Unlimited approvals allow the spender to transfer your entire token balance.

Use a wallet or a tool like `cast` to send the approval transaction first.
```

**Notes:**
- ERC-20 token inputs require a separate approval transaction
- The `value` field is `0` for ERC-20 swaps (non-zero only for native token input)
- Consider using `permit` for gasless approvals if the token supports ERC-2612

---

## Swap Execute Example

### Full End-to-End Flow

**Step 1: Build the Swap**

User runs the Build workflow:
```
0.01 ETH to USDC on arbitrum from 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
```

Output JSON:
```json
{
  "type": "kyberswap-swap",
  "chain": "arbitrum",
  "tokenIn": {
    "symbol": "ETH",
    "address": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    "decimals": 18,
    "amount": "0.01",
    "amountWei": "10000000000000000",
    "amountUsd": "23.45"
  },
  "tokenOut": {
    "symbol": "USDC",
    "address": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "decimals": 6,
    "amount": "23.42",
    "amountWei": "23420000",
    "amountUsd": "23.42"
  },
  "tx": {
    "to": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
    "data": "0xe21fd0e9000000000000000000000000...",
    "value": "10000000000000000",
    "gas": "350000",
    "gasUsd": "0.12"
  },
  "sender": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "recipient": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  "slippageBps": 50
}
```

**Step 2: Execute the Swap**

Agent confirms:
```
## Swap Execution — Final Confirmation

**0.01 ETH → 23.42 USDC** on arbitrum

| Field | Value |
|-------|-------|
| Router | `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |
| Value | 10000000000000000 wei (0.01 ETH) |
| Gas Limit | 350000 |
| Sender | `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045` |

> **WARNING: This action is IRREVERSIBLE.**

**Do you want to execute this swap?** (yes/no)
```

User confirms: `yes`

Agent asks for wallet method:
```
How do you want to sign this transaction?

1. Environment variable ($PRIVATE_KEY)
2. Ledger hardware wallet
3. Keystore file
4. Interactive (enter key when prompted)
```

User selects: `1` (Environment variable)

**Step 3: Cast Command Executed**

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  --gas-limit 350000 \
  --value 10000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0xe21fd0e9000000000000000000000000...
```

**Step 4: Success Output**

```
## Transaction Submitted

| Field | Value |
|-------|-------|
| Transaction Hash | `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef` |
| Block Number | 178234567 |
| Gas Used | 285432 |

**Explorer Link:** https://arbiscan.io/tx/0x1234567890abcdef...

Your swap of 0.01 ETH → 23.42 USDC has been submitted.
```

---

### ERC-20 Swap Execution (Requires Approval)

For swapping USDC → ETH, an approval step is needed:

**Check Allowance First:**

```bash
cast call \
  --rpc-url https://arb1.arbitrum.io/rpc \
  0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
  "allowance(address,address)(uint256)" \
  0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5
```

If allowance is less than `amountInWei`, approve first:

**Approve Router:**

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  0xaf88d065e77c8cC2239327C5EDb3A432268e5831 \
  "approve(address,uint256)" \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  115792089237316195423570985008687907853269984665640564039457584007913129639935
```

The large number is `type(uint256).max` for unlimited approval. **Security tradeoff:** unlimited approvals are convenient but allow the spender to transfer your entire token balance if the contract is compromised. For large holdings, prefer approving the exact `amountIn` instead.

**Then Execute Swap:**

```bash
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY \
  --gas-limit 350000 \
  --value 0 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

Note: `--value 0` because input is ERC-20, not native token.
