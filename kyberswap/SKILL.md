---
name: kyberswap
description: Swap tokens across 18 EVM chains via KyberSwap Aggregator API. Use when the user wants to get a swap quote, check exchange rates, build swap calldata, execute a token swap, or trade crypto. Supports quote-only, build-with-confirmation, and fast one-step execution flows.
metadata:
  tags:
    - defi
    - kyberswap
    - swap
    - quote
    - execute
    - aggregator
    - foundry
    - evm
  provider: KyberSwap
  homepage: https://kyberswap.com
  clawdbot:
    emoji: "🔄"
    requires:
      bins:
        - curl
        - jq
        - cast
---

# KyberSwap Skill

Swap tokens across 18 EVM chains via the KyberSwap Aggregator API. This skill supports four workflows:

1. **[Getting a Swap Quote](#getting-a-swap-quote)** — Fetch the best route and display expected output (informational, no transaction)
2. **[Building a Swap Transaction](#building-a-swap-transaction)** — Get route, confirm with user, build encoded calldata
3. **[Executing a Swap](#executing-a-swap)** — Submit a previously built swap transaction on-chain via Foundry's `cast send`
4. **[Fast Execute](#fast-execute)** — Build and execute in one step with NO confirmation (dangerous)

## Supported Chains

| Chain | Path Slug | Chain ID |
|---|---|---|
| Ethereum | `ethereum` | `1` |
| BNB Smart Chain | `bsc` | `56` |
| Arbitrum | `arbitrum` | `42161` |
| Polygon | `polygon` | `137` |
| Optimism | `optimism` | `10` |
| Base | `base` | `8453` |
| Avalanche | `avalanche` | `43114` |
| Linea | `linea` | `59144` |
| Mantle | `mantle` | `5000` |
| Sonic | `sonic` | `146` |
| Berachain | `berachain` | `80094` |
| Ronin | `ronin` | `2020` |
| Unichain | `unichain` | `130` |
| HyperEVM | `hyperevm` | `999` |
| Plasma | `plasma` | `9745` |
| Etherlink | `etherlink` | `42793` |
| Monad | `monad` | `143` |
| MegaETH | `megaeth` | `4326` |

If the user specifies a chain not listed above, query `https://common-service.kyberswap.com/api/v1/aggregator/supported-chains` via WebFetch to check if the chain is supported. Look for a matching `chainName` with `state: "active"` or `state: "new"`. Use the `chainName` value as the path slug.

## Shared Concepts

### Token Resolution

Read the token registry at `references/token-registry.md`. Look up `tokenIn` and `tokenOut` for the specified chain. Match case-insensitively. Note the **decimals** for each token.

**Aliases to handle:**
- "ETH" on Ethereum/Arbitrum/Optimism/Base/Linea/Unichain → native token address
- "MATIC" or "POL" on Polygon → native token address
- "BNB" on BSC → native token address
- "AVAX" on Avalanche → native token address
- "MNT" on Mantle → native token address
- "S" on Sonic → native token address
- "BERA" on Berachain → native token address
- "RON" on Ronin → native token address
- "XTZ" on Etherlink → native token address
- "MON" on Monad → native token address

**If a token is not found in the registry:**
Use the fallback sequence described at the bottom of `references/token-registry.md`:
1. **KyberSwap Token API** (preferred) — search whitelisted tokens first: `https://token-api.kyberswap.com/api/v1/public/tokens?chainIds={chainId}&name={symbol}&isWhitelisted=true` via WebFetch. Pick the result whose `symbol` matches exactly with the highest `marketCap`. If no whitelisted match, retry without `isWhitelisted` (only trust verified or market-cap tokens). If still nothing, browse `page=1&pageSize=100` (try up to 3 pages).
2. **CoinGecko API** (secondary fallback) — search CoinGecko for verified contract addresses if the Token API doesn't have it.
3. **Ask user manually** (final fallback) — if CoinGecko also fails, ask the user to provide the contract address. Never guess or fabricate addresses.

### Token Safety Check

For any token **not** in the built-in registry and **not** a native token, check the honeypot/FOT API. (Note: registry tokens are assumed safe, but a compromised proxy token could theoretically be updated. For high-value swaps involving proxy tokens, consider checking the safety API even for registry tokens.)

```
GET https://token-api.kyberswap.com/api/v1/public/tokens/honeypot-fot-info?chainId={chainId}&address={tokenAddress}
```

Via **WebFetch**, check both `tokenIn` and `tokenOut`:
- If `isHoneypot: true` — **warn the user** that this token is flagged as a honeypot (cannot be sold after buying). Display the warning prominently. For the Quote workflow, still show the quote but with the warning. For Build/Execute workflows, **refuse the swap**.
- If `isFOT: true` — warn the user that this token has a fee-on-transfer (tax: `{tax}%`). The actual received amount will be less than the quoted output. Display the adjusted estimate: `adjustedAmount = quotedAmount * (1 - tax/100)`. Example: if the quote shows 100 USDC and tax is 5%, display "~95 USDC after tax". Proceed only if the user acknowledges the tax.

### Wei Conversion

```
amountInWei = amount * 10^(tokenIn decimals)
```

The result must be a plain integer string with no decimals, no scientific notation, and no separators.

**For wei conversion, use a deterministic method instead of relying on AI mental math:**
```bash
python3 -c "print(int(AMOUNT * 10**DECIMALS))"
# or
echo "AMOUNT * 10^DECIMALS" | bc
```
**Verify known reference values:** 1 ETH = 1000000000000000000 (18 decimals), 1 USDC = 1000000 (6 decimals)

Examples:
- 1 ETH (18 decimals) = `1000000000000000000`
- 100 USDC (6 decimals) = `100000000`
- 0.5 WBTC (8 decimals) = `50000000`

### Slippage Defaults

If the user does not specify slippage, choose based on the token pair:

| Pair type | Default | Rationale |
|---|---|---|
| Stablecoin ↔ Stablecoin (e.g. USDC→USDT) | **5 bps** (0.05%) | Minimal price deviation between pegged assets |
| Common tokens (e.g. ETH→USDC, WBTC→ETH) | **50 bps** (0.50%) | Standard volatility buffer |
| All other / unknown pairs | **100 bps** (1.00%) | Conservative default for long-tail or volatile tokens |

**Known stablecoins:** USDC, USDT, DAI, BUSD, FRAX, LUSD, USDC.e, USDT.e, TUSD
**Known common tokens:** ETH, WETH, WBTC, BTC, BNB, MATIC, POL, AVAX, MNT, S

> These are recommended defaults, not official KyberSwap values. The KyberSwap API defaults to slippageTolerance: 0 if omitted.

**Note:** The API defaults to `0` if `slippageTolerance` is omitted. Always pass an explicit value. The range is `[0, 2000]` (0% to 20%). Use `ignoreCappedSlippage: true` to exceed 20%.

### Common Route Errors

| Code | Message | Quick Fix |
|------|---------|-----------|
| 4008 | Route not found | No liquidity for this pair/amount. Remove source filters (`includedSources`/`excludedSources`), try a smaller amount, or retry after a few seconds. |
| 4011 | Token not found | Verify the token address is correct for this chain. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native tokens. Check spelling and `0x` prefix. |
| 4000 | Bad request | Read the `fieldViolations` array in the response. Common issues: `amountIn` must be a plain integer string in wei (no decimals, no scientific notation), addresses must be 42-char hex with lowercase `0x`. |
| 4010 / 40011 | No eligible pools / Filtered sources (observed behavior, not in public API docs) | Remove `includedSources`/`excludedSources` filters. The pair may have liquidity only on specific DEXs. |
| 404 | Chain not found | Check chain slug spelling. Supported: `ethereum`, `bsc`, `polygon`, `arbitrum`, `optimism`, `avalanche`, `base`, `linea`, `mantle`, `sonic`, `berachain`, `ronin`, `unichain`, `hyperevm`, `plasma`, `etherlink`, `monad`, `megaeth`. |
| 4990 | Request canceled | Retry the request. Likely a timeout or network issue. |
| 500 | Internal server error | Verify all addresses are valid hex. Retry — may be transient. |

For any error code not listed above, or for deeper troubleshooting, refer to **`references/error-handling.md`** for the comprehensive error reference.

---

## Getting a Swap Quote

Fetch swap quotes from the KyberSwap Aggregator. Given a token pair and amount, retrieve the best route and present a clear summary including expected output, exchange rate, and gas cost.

### Quote Input

The user will provide input like:
- `1 ETH to USDC on ethereum`
- `100 USDC to WBTC on arbitrum`
- `0.5 WBTC to DAI on polygon`
- `1000 USDT to ETH` (default chain: ethereum)

Extract these fields:
- **amount** — the human-readable amount to swap
- **tokenIn** — the input token symbol
- **tokenOut** — the output token symbol
- **chain** — the chain slug (default: `ethereum`)

### Quote Workflow

**Step 1: Resolve token addresses** — See [Token Resolution](#token-resolution) above.

**Step 2: Check token safety** — See [Token Safety Check](#token-safety-check) above.

**Step 3: Convert amount to wei** — See [Wei Conversion](#wei-conversion) above.

**Step 4: Call the Routes API (GET request)**

Read the API reference at `references/api-reference.md` for the full specification.

Make the request using **WebFetch**:

```
URL: https://aggregator-api.kyberswap.com/{chain}/api/v1/routes?tokenIn={tokenInAddress}&tokenOut={tokenOutAddress}&amountIn={amountInWei}&source=ai-agent-skills
Prompt: Return the full JSON response body
```

**Step 5: Handle errors** — See [Common Route Errors](#common-route-errors) above.

**Step 5b: Dust amount warning**

After getting a successful route, check the USD values from the response:

- If `amountInUsd` < **$0.10** — warn the user: *"This swap amount is extremely small (~$X). Gas fees (~$Y) will far exceed the swap value. Consider using a larger amount."*
- If `gasUsd` > `amountInUsd` — warn the user: *"Gas cost (~$Y) exceeds the swap value (~$X). This trade is uneconomical."*

Still show the quote, but include the warning prominently before the results table.

**Step 6: Format the output**

Present the results in this format:

```
## KyberSwap Quote

**{amount} {tokenIn} → {amountOut} {tokenOut}** on {Chain}

| Detail | Value |
|---|---|
| Input | {amount} {tokenIn} (~${amountInUsd}) |
| Output | {amountOut} {tokenOut} (~${amountOutUsd}) |
| Rate | 1 {tokenIn} = {rate} {tokenOut} |
| Gas estimate | {gas} units (~${gasUsd}) |
| L1 fee (L2 only) | ~${l1FeeUsd} *(omit this row on L1 chains or if `l1FeeUsd` is `"0"`)* |
| Router | `{routerAddress}` |

### Route
{For each split in the route, show: tokenIn → tokenOut via [exchange name]}
```

**Calculating the output amount:**
Convert `amountOut` from wei back to human-readable using tokenOut's decimals:
```
humanAmount = amountOut / 10^(tokenOut decimals)
```

**Calculating the rate:**
```
rate = humanAmountOut / humanAmountIn
```

Display rates with appropriate precision (up to 6 significant digits).

### Structured JSON Output (Quote)

After the markdown table, always include a JSON code block so other plugins or agents can consume the result programmatically:

````
```json
{
  "type": "kyberswap-quote",
  "chain": "{chain}",
  "tokenIn": {
    "symbol": "{tokenIn}",
    "address": "{tokenInAddress}",
    "decimals": {tokenInDecimals},
    "amount": "{amount}",
    "amountWei": "{amountInWei}",
    "amountUsd": "{amountInUsd}"
  },
  "tokenOut": {
    "symbol": "{tokenOut}",
    "address": "{tokenOutAddress}",
    "decimals": {tokenOutDecimals},
    "amount": "{amountOut}",
    "amountWei": "{amountOutWei}",
    "amountUsd": "{amountOutUsd}"
  },
  "rate": "{rate}",
  "gas": "{gas}",
  "gasUsd": "{gasUsd}",
  "routerAddress": "{routerAddress}"
}
```
````

This JSON block enables downstream agents or plugins to parse the quote result without scraping the markdown table.

### Quote Example Files

Working examples in `references/examples.md`:
- **Basic Quote** — Simple ETH to USDC quote on Ethereum
- **Multi-Chain Quote** — Quote on L2 chain with L1 fee

### Quote Notes

- The quote is informational only — no transaction is built or submitted.
- Always read both `references/token-registry.md` and `references/api-reference.md` before making API calls.
- Never guess token addresses. Always verify from the registry or via the Token API / search.
- If the user doesn't specify a chain, default to `ethereum`.

---

## Building a Swap Transaction

Build swap transactions using the KyberSwap Aggregator. Given a token pair, amount, and sender address, fetch the best route and generate encoded calldata ready for on-chain submission.

**This is a three-step process:**
1. GET the optimal route (same as the quote workflow)
2. **Show quote details and ask for user confirmation**
3. POST to build the encoded transaction calldata

### Build Input

The user will provide input like:
- `100 USDC to ETH on arbitrum from 0xAbc123...`
- `1 ETH to USDC on ethereum from 0xAbc123... slippage 100`
- `0.5 WBTC to DAI on polygon from 0xAbc123... to 0xDef456...`

Extract these fields:
- **amount** — the human-readable amount to swap
- **tokenIn** — the input token symbol
- **tokenOut** — the output token symbol
- **chain** — the chain slug (default: `ethereum`)
- **sender** — the address that will send the transaction (**required**)
- **recipient** — the address to receive output tokens (default: same as sender). **WARNING: When the recipient address differs from the sender, display a prominent warning: "Output tokens will be sent to a DIFFERENT address than the sender. Please verify the recipient address carefully."**
- **slippageTolerance** — slippage in basis points (see [Slippage Defaults](#slippage-defaults))

**If the sender address is not provided, ask the user for it before proceeding.** Do not guess or use a placeholder address.

**Sender address validation — reject or warn before proceeding:**
- **Must not be the zero address** (`0x0000000000000000000000000000000000000000`) — this is an invalid sender and the transaction will fail.
- **Must not be the native token sentinel** (`0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`) — this is a placeholder for native tokens, not a real account.
- **Warn if it matches a known contract address** (e.g., a token address or the router address) — sending from a contract address is unusual and likely a mistake. Ask the user to confirm.

### Build Workflow

**Steps 1-3:** Same as the Quote workflow — resolve tokens, check safety, convert to wei.

**Step 4: Get the Route (GET request)**

Read the API reference at `references/api-reference.md` for the full specification.

Make the request using **WebFetch**:

```
URL: https://aggregator-api.kyberswap.com/{chain}/api/v1/routes?tokenIn={tokenInAddress}&tokenOut={tokenOutAddress}&amountIn={amountInWei}&source=ai-agent-skills&origin={sender}
Prompt: Return the full JSON response body exactly as received. I need the complete routeSummary object.
```

Extract the `data.routeSummary` object from the response. You need the **complete** `routeSummary` object for the build step.

**Step 4a: Dust amount check**

After getting a successful route, check the USD values from the `routeSummary`:

- If `amountInUsd` < **$0.10** — warn the user and **ask for confirmation**: *"This swap amount is extremely small (~$X). Gas fees (~$Y) will far exceed the swap value. Do you still want to proceed?"*
- If `gasUsd` > `amountInUsd` — warn the user and **ask for confirmation**: *"Gas cost (~$Y) exceeds the swap value (~$X). This trade is uneconomical. Do you still want to proceed?"*

If the user declines, abort the swap. Do NOT proceed to the build step.

**Step 4b: Display quote and request confirmation**

**CRITICAL: Always show quote details and ask for confirmation before building the transaction.**

Calculate the output amount and rate from the `routeSummary`:
```
amountOut = routeSummary.amountOut / 10^(tokenOut decimals)
rate = amountOut / amount
minAmountOut = amountOut * (1 - slippageTolerance/10000)
```

Present the quote details:

```
## Swap Quote — Confirmation Required

**{amount} {tokenIn} → {amountOut} {tokenOut}** on {Chain}

| Detail | Value |
|---|---|
| You send | {amount} {tokenIn} (~${amountInUsd}) |
| You receive | {amountOut} {tokenOut} (~${amountOutUsd}) |
| Exchange rate | 1 {tokenIn} = {rate} {tokenOut} |
| Minimum received | {minAmountOut} {tokenOut} (after {slippage}% slippage) |
| Price impact | {priceImpact}% *(from routeSummary.extraFee.feeAmount if available)* |
| Gas estimate | {gas} units (~${gasUsd}) |
| Route | {routeSummary.route description — e.g., "Uniswap V3 → Curve"} |

### Addresses

| Field | Value |
|---|---|
| Router | `{routerAddress}` |
| Sender | `{sender}` |
| Recipient | `{recipient}` |

---

> **Review the quote carefully:**
> - Verify the exchange rate is acceptable
> - Check the minimum received amount
> - Ensure the router address is correct (`0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` on most chains)

**Do you want to proceed with building this swap transaction?** (yes/no)
```

**Wait for the user to explicitly confirm with "yes", "confirm", "proceed", or similar affirmative response before building the transaction.**

If the user says "no", "cancel", or similar, abort and inform them the swap was cancelled. Do NOT proceed to Step 5.

**Note:** Routes expire quickly (~30 seconds). If the user takes too long to confirm, warn them that the quote may be stale and offer to re-fetch.

**Step 5: Build the transaction (POST request)**

**Only proceed to this step after the user confirms in Step 4b.**

**WebFetch only supports GET requests**, so use `Bash(curl)` for this POST request.

Construct the curl command:

```bash
curl -s -X POST "https://aggregator-api.kyberswap.com/{chain}/api/v1/route/build" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: ai-agent-skills" \
  -d '{
    "routeSummary": {PASTE THE COMPLETE routeSummary OBJECT HERE},
    "sender": "{sender}",
    "recipient": "{recipient}",
    "origin": "{sender}",
    "slippageTolerance": {slippageTolerance},
    "deadline": {CURRENT_UNIX_TIMESTAMP + 1200},
    "source": "ai-agent-skills"
  }'
```

**To get the current unix timestamp + 20 minutes for the deadline:**
```bash
echo $(($(date +%s) + 1200))
```

**Important:** The `routeSummary` field must contain the **exact** JSON object returned from Step 4. Do not modify, truncate, or reformat it.

**Optional fields** (include if relevant):
- Add `"permit": "{encoded_permit}"` if the user provides an ERC-2612 permit signature (skips the separate approval tx).
- Add `"enableGasEstimation": true` for a more accurate gas figure.
- Add `"ignoreCappedSlippage": true` if the user requests slippage above 20%.

See `references/api-reference.md` for all available fields.

**Step 5b: Handle build errors**

| Code | Message | Quick Fix |
|------|---------|-----------|
| 4227 | `return amount is not enough` | Price moved since route fetch. **Fetch a fresh route and retry** (recommended). The response includes `suggestedSlippage` (in bps) as a fallback. |
| 4227 | `insufficient funds for gas * price + value` | Sender doesn't have enough native token (ETH/MATIC/etc.) to cover `amountIn` + gas. Reduce amount or top up wallet. |
| 4227 | `TRANSFER_FROM_FAILED` | Sender hasn't approved the router to spend the input token, or token balance is insufficient. Check approval and balance. |
| 4222 | Quoted amount smaller than estimated | RFQ/limit order quote came in lower than estimated. **Fetch a fresh route and retry**. Or use `excludeRFQSources: true` to avoid RFQ sources. |
| 4002 | Request body malformed | Ensure `deadline` and `slippageTolerance` are numbers, booleans are `true`/`false`. Do NOT modify the `routeSummary` object. |
| 40010 (observed behavior, not in public API docs) | Empty sender address | Provide a valid `sender` address, or set `enableGasEstimation: false`. |
| 4000 | Bad request | Read `fieldViolations`. Common: `slippageTolerance` > 2000 needs `ignoreCappedSlippage: true`, `deadline` must be in the future, `recipient` is required. |
| PMM/RFQ errors | Various maker errors | Fetch a fresh route and retry. Or use `excludedSources` to skip the failing maker. See the table below. |

**Common PMM/RFQ error patterns:**

| Pattern | Meaning | Quick Fix |
|---------|---------|-----------|
| Blacklist / Banned | Sender address is on maker's deny list | Use a different sender address |
| Insufficient Liquidity | Maker doesn't have enough balance | Retry or exclude the source |
| Amount Too Small/Large | Trade size outside maker's range | Adjust `amountIn` |
| Market Moved | Price changed between route and build | Fetch fresh route and retry |

For any error not listed here, refer to **`references/error-handling.md`**.

**Step 6: Format the output**

Present the results:

```
## KyberSwap Swap Transaction

**{amount} {tokenIn} → {amountOut} {tokenOut}** on {Chain}

| Detail | Value |
|---|---|
| Input | {amount} {tokenIn} (~${amountInUsd}) |
| Expected output | {amountOut} {tokenOut} (~${amountOutUsd}) |
| Minimum output (after slippage) | {minAmountOut} {tokenOut} |
| Slippage tolerance | {slippageTolerance/100}% |
| Gas estimate | {gas} units (~${gasUsd}) |
| L1 fee (L2 only) | ~${additionalCostUsd} — {additionalCostMessage} *(omit on L1 chains or if absent)* |

### Transaction Details

| Field | Value |
|---|---|
| To (Router) | `{routerAddress}` |
| Value | `{value}` (in wei — non-zero only for native token input) |
| Data | `{encodedCalldata}` |
| Sender | `{sender}` |
| Recipient | `{recipient}` |

> **WARNING:** Review the transaction details carefully before submitting on-chain. This skill does NOT submit transactions — it only builds the calldata. You are responsible for verifying the router address, amounts, and calldata before signing and broadcasting.
```

### Structured JSON Output (Build)

After the markdown table, always include a JSON code block so other plugins or agents can consume the result programmatically:

````
```json
{
  "type": "kyberswap-swap",
  "chain": "{chain}",
  "tokenIn": {
    "symbol": "{tokenIn}",
    "address": "{tokenInAddress}",
    "decimals": {tokenInDecimals},
    "amount": "{amount}",
    "amountWei": "{amountInWei}",
    "amountUsd": "{amountInUsd}"
  },
  "tokenOut": {
    "symbol": "{tokenOut}",
    "address": "{tokenOutAddress}",
    "decimals": {tokenOutDecimals},
    "amount": "{amountOut}",
    "amountWei": "{amountOutWei}",
    "amountUsd": "{amountOutUsd}"
  },
  "tx": {
    "to": "{routerAddress}",
    "data": "{encodedCalldata}",
    "value": "{transactionValue}",
    "gas": "{gas}",
    "gasUsd": "{gasUsd}"
  },
  "sender": "{sender}",
  "recipient": "{recipient}",
  "slippageBps": {slippageTolerance}
}
```
````

This JSON block enables downstream agents or plugins to parse the swap result without scraping the markdown table.

**Calculating minimum output:**
If `outputChange` is provided in the build response, use:
```
minAmountOut = amountOut from build response / 10^(tokenOut decimals)
```

**Value field:** Use the `transactionValue` field from the build response directly. This is the `value` for the on-chain transaction (in wei). It will be non-zero only for native token input. Do not compute this manually.

**Step 7: ERC-20 approval reminder**

If `tokenIn` is **not** the native token, add this note after the transaction details:

```
### Token Approval Required

Before submitting this swap, you must approve the KyberSwap router to spend your {tokenIn}:

- **Token contract:** `{tokenIn address}`
- **Spender (router):** `{routerAddress}`
- **Amount:** `{amountInWei}` (exact amount, recommended) or `type(uint256).max` (unlimited — see warning below)

> **Security warning:** Unlimited approvals (`type(uint256).max`) are convenient but risky. If the router contract is ever compromised, an attacker could drain all approved tokens from your wallet. For large holdings, prefer **exact-amount approvals** matching `amountInWei`. Only use unlimited approvals with wallets holding limited funds.

Use your wallet or a tool like `cast` to send the approval transaction first.
```

### Build Example Files

Working examples in `references/examples.md`:
- **Basic Swap** — Simple ETH to USDC swap with native token input
- **ERC-20 Swap** — ERC-20 swap requiring token approval

### Build Notes

- Routes should not be cached for more than 5-10 seconds. If the build step fails, re-fetch the route from the GET endpoint and retry.
- This workflow does NOT submit transactions on-chain. It only builds the calldata.
- If the user doesn't specify slippage, use the smart defaults from the [Slippage Defaults](#slippage-defaults) table.

---

## Executing a Swap

Execute a swap transaction on-chain using Foundry's `cast send`. This workflow takes the output from the Build workflow and broadcasts the transaction.

### Execute Prerequisites

- **Foundry installed**: `cast` must be available in PATH
- **Wallet configured**: See `references/wallet-setup.md`
- **ETH for gas**: Sender must have native token for gas fees

**Quick wallet setup:**
```bash
# Import private key to encrypted keystore
cast wallet import mykey --interactive
# Enter private key, then set encryption password

# Create password file securely (prompts without echoing to terminal)
read -s -p "Password: " pw && echo "$pw" > ~/.foundry/.password && chmod 600 ~/.foundry/.password

# Verify
cast wallet list
```

**Option B: Environment Variable**
Set the key in your current shell session only (do not persist to shell profiles):
```bash
read -s -p "Enter private key: " PRIVATE_KEY && export PRIVATE_KEY
```
See the security section in `references/wallet-setup.md` for details.

**NEVER echo, print, log, or display any private key value, even in error messages or debug output.**

**Option C: Ledger Hardware Wallet**
- Connect Ledger, open Ethereum app
- No setup needed, will prompt for physical confirmation

See `references/wallet-setup.md` for detailed instructions on all wallet methods (keystore, env var, Ledger, Trezor).

### Execute Input

This workflow requires the JSON output from the Build workflow:

```json
{
  "type": "kyberswap-swap",
  "chain": "ethereum",
  "tx": {
    "to": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
    "data": "0x...",
    "value": "1000000000000000000",
    "gas": "250000"
  },
  "sender": "0x...",
  "tokenIn": { "symbol": "ETH", "amount": "1" },
  "tokenOut": { "symbol": "USDC", "amount": "2345.67" }
}
```

### Execute Workflow

**Step 1: Validate input**

Ensure the user has provided or you have access to the swap output JSON containing:
- `tx.to` — Router address
- `tx.data` — Encoded calldata
- `tx.value` — Transaction value in wei (for native token swaps)
- `chain` — Chain to execute on
- `sender` — Sender address

If the JSON is not available, ask the user to run the Build workflow first.

**Step 2: Determine RPC URL**

Use the appropriate RPC endpoint for the chain:

| Chain | RPC URL |
|-------|---------|
| ethereum | `https://rpc.ankr.com/eth` |
| arbitrum | `https://arb1.arbitrum.io/rpc` |
| polygon | `https://polygon-rpc.com` |
| optimism | `https://mainnet.optimism.io` |
| base | `https://mainnet.base.org` |
| bsc | `https://bsc-dataseed.binance.org` |
| avalanche | `https://api.avax.network/ext/bc/C/rpc` |
| linea | `https://rpc.linea.build` |
| mantle | `https://rpc.mantle.xyz` |
| sonic | `https://rpc.soniclabs.com` |
| berachain | `https://rpc.berachain.com` |
| ronin | `https://api.roninchain.com/rpc` |
| unichain | `https://rpc.unichain.org` |
| hyperevm | `https://rpc.hyperliquid.xyz/evm` |
| plasma | `https://plasma.drpc.org` |
| etherlink | `https://node.mainnet.etherlink.com` |
| monad | `https://rpc.monad.xyz` |
| megaeth | `https://rpc.megaeth.com` | <!-- MegaETH: state=new in KyberSwap API, RPC not confirmed as of 2026-02-19 -->

Or the user can specify a custom RPC with `--rpc-url`.

**Step 3: Confirm execution**

**CRITICAL: Always confirm before executing. Transactions are irreversible.**

> **Time-sensitive:** Routes expire in ~30 seconds. If the user takes too long to confirm, re-build with a fresh quote from the Build workflow before executing. Stale routes cause on-chain reverts that waste gas.

Present the transaction details:

```
## Swap Execution — Final Confirmation

**{tokenIn.amount} {tokenIn.symbol} → {tokenOut.amount} {tokenOut.symbol}** on {chain}

| Field | Value |
|-------|-------|
| Router | `{tx.to}` |
| Value | {tx.value} wei ({value in ETH} ETH) |
| Gas Limit | {tx.gas} |
| Sender | `{sender}` |

**WARNING: This action is IRREVERSIBLE.**
- Funds will be sent from your wallet
- Gas fees will be charged even if the swap fails
- Verify the router address is correct: `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`

**Do you want to execute this swap?** (yes/no)
```

Wait for explicit "yes" confirmation before proceeding.

**Step 3b: Simulate transaction (recommended)**

Before sending, simulate the transaction with `cast call` to catch reverts without spending gas:

```bash
cast call \
  --rpc-url {RPC_URL} \
  --value {tx.value} \
  --from {sender} \
  {tx.to} \
  {tx.data}
```

If this reverts, the transaction would fail on-chain. Re-build with a fresh route before retrying.

**Step 4: Determine wallet method**

Ask the user how they want to sign (if not already specified):

```
How do you want to sign this transaction?

1. Keystore (encrypted key at ~/.foundry/keystores/)
2. Environment variable ($PRIVATE_KEY)
3. Ledger hardware wallet
4. Trezor hardware wallet
```

**Step 5: Execute with cast**

Build the `cast send` command based on wallet method:

**Option 1: Keystore + Password File (Recommended)**
```bash
cast send \
  --rpc-url {RPC_URL} \
  --account {keystore_name} \
  --password-file ~/.foundry/.password \
  --gas-limit {tx.gas} \
  --value {tx.value} \
  {tx.to} \
  {tx.data}
```

**Option 2: Environment Variable**
```bash
cast send \
  --rpc-url {RPC_URL} \
  --private-key $PRIVATE_KEY \
  --gas-limit {tx.gas} \
  --value {tx.value} \
  {tx.to} \
  {tx.data}
```

**Option 3: Ledger**
```bash
cast send \
  --rpc-url {RPC_URL} \
  --ledger \
  --gas-limit {tx.gas} \
  --value {tx.value} \
  {tx.to} \
  {tx.data}
```

**Option 4: Trezor**
```bash
cast send \
  --rpc-url {RPC_URL} \
  --trezor \
  --gas-limit {tx.gas} \
  --value {tx.value} \
  {tx.to} \
  {tx.data}
```

**Wallet flags summary:**

| Method | Flags |
|--------|-------|
| Keystore | `--account NAME --password-file ~/.foundry/.password` |
| Env var | `--private-key $PRIVATE_KEY` |
| Ledger | `--ledger` |
| Trezor | `--trezor` |

**Example commands:**

```bash
# Using private key from environment
cast send \
  --rpc-url https://rpc.ankr.com/eth \
  --private-key $PRIVATE_KEY \
  --gas-limit 250000 \
  --value 1000000000000000000 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...

# Using Ledger hardware wallet
cast send \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --ledger \
  --gas-limit 250000 \
  --value 0 \
  0x6131B5fae19EA4f9D964eAc0408E4408b66337b5 \
  0x...calldata...
```

**Step 6: Handle result**

**On success**, parse the output and display:

```
## Transaction Submitted

| Field | Value |
|-------|-------|
| Transaction Hash | `{txHash}` |
| Block Number | {blockNumber} |
| Gas Used | {gasUsed} |

**Explorer Link:** {explorerUrl}/tx/{txHash}

Your swap of {tokenIn.amount} {tokenIn.symbol} → {tokenOut.amount} {tokenOut.symbol} has been submitted.
```

**Explorer URLs by chain:**

| Chain | Explorer |
|-------|----------|
| ethereum | https://etherscan.io |
| arbitrum | https://arbiscan.io |
| polygon | https://polygonscan.com |
| optimism | https://optimistic.etherscan.io |
| base | https://basescan.org |
| bsc | https://bscscan.com |
| avalanche | https://snowtrace.io |
| linea | https://lineascan.build |
| mantle | https://mantlescan.xyz |
| sonic | https://sonicscan.io |
| berachain | https://berascan.com |
| ronin | https://app.roninchain.com |
| unichain | https://uniscan.xyz |
| hyperevm | https://explorer.hyperliquid.xyz |
| plasma | https://plasmascan.io |
| etherlink | https://explorer.etherlink.com |
| monad | https://explorer.monad.xyz |
| megaeth | https://explorer.megaeth.com |

**On failure**, display the error:

```
## Transaction Failed

**Error:** {error message}

Common issues:
- Insufficient gas: Increase gas limit
- Insufficient balance: Check native token balance for gas
- Slippage exceeded: Route expired, rebuild with fresh quote
- Approval needed: Run token approval first for ERC-20 inputs
```

## ERC-20 Approval (if needed)

If the swap input is an ERC-20 token (not native), the user may need to approve first:

```bash
cast send \
  --rpc-url {RPC_URL} \
  {WALLET_FLAG} \
  {tokenIn.address} \
  "approve(address,uint256)" \
  {router_address} \
  {amountInWei}
```

Check current allowance:

```bash
cast call \
  --rpc-url {RPC_URL} \
  {tokenIn.address} \
  "allowance(address,address)(uint256)" \
  {sender} \
  {router_address}
```

### Execute Notes

- **Never expose private keys** in command output or logs
- **Always confirm** before executing — transactions cannot be undone
- **Check balances before executing** — verify native token balance covers `tx.value` + gas cost, and ERC-20 balance covers `amountInWei`:
  ```bash
  # Check native balance (returns wei)
  cast balance --rpc-url {RPC_URL} {sender}
  # Check current gas price (returns wei)
  cast gas-price --rpc-url {RPC_URL}
  # Check ERC-20 balance
  cast call --rpc-url {RPC_URL} {tokenIn.address} "balanceOf(address)(uint256)" {sender}
  ```
- **Apply a 20% gas limit buffer** — use `gas_limit = tx.gas + tx.gas / 5` to reduce out-of-gas failures
- **Verify router address** matches expected: `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`
- **Routes expire quickly (~30 seconds)** — execute promptly after building. Stale routes are the most common cause of on-chain failures.
- **Verify chain ID when using custom RPCs** — before sending, run `cast chain-id --rpc-url {RPC_URL}` and confirm it matches the expected chain ID to avoid sending transactions to the wrong chain

### Execute Common Errors

**Pre-Transaction Errors (transaction not sent, no gas spent):**

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| Gas estimation failed | RPC node issue or stale route | Retry, or re-run Build for a fresh route. Try a different RPC if persistent. |
| Simulation revert | Insufficient balance, missing approval, or stale route | Check token balance >= `amountIn`, check approval for router, then re-build with fresh route. |
| Transaction submission failed | RPC rejected tx, nonce conflict, or insufficient gas balance | Check native token balance covers gas. Reset nonce if stuck transactions exist. Try a different RPC. |

**On-Chain Errors (transaction sent, gas spent):**

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `TRANSFER_FROM_FAILED` | Router can't pull input tokens | Approve the router (`routerAddress`) to spend at least `amountInWei` of the input token. Check token balance. |
| `ETH_TRANSFER_FAILED` | Insufficient ETH for swap + gas | Ensure wallet has enough ETH for both `tx.value` and gas fees. Send exactly the `transactionValue` from the build response. |
| `Return amount is not enough` | Price moved beyond slippage | Re-build with a fresh route. Or increase `slippageTolerance`. For MEV protection, use a private RPC (e.g., Flashbots). |
| Out of gas | Gas limit too low for the route | Use `gas_limit = tx.gas + tx.gas / 5` (20% buffer). Do not cap gas limit below the build response's estimate. |
| Call failed (internal) | Pool state changed or pool issue | Re-build with a fresh route. Use `excludedSources` to skip the failing DEX. |

---

## Fast Execute

Build and execute a swap transaction in one step using the shell script at `scripts/execute-swap.sh`. The script calls `fast-swap.sh` internally to build the swap, then immediately broadcasts it. No confirmation prompts.

### VIGILANT WARNING — EXTREME CAUTION REQUIRED

**This workflow builds AND executes blockchain transactions IMMEDIATELY without any confirmation.** Once executed, transactions are IRREVERSIBLE and cannot be cancelled.

**Critical Risks:**
1. **NO CONFIRMATION** — Transaction broadcasts the instant this workflow runs
2. **IRREVERSIBLE** — Blockchain transactions cannot be undone
3. **REAL MONEY AT STAKE** — Gas fees are charged even if the swap fails
4. **NO QUOTE VERIFICATION** — You cannot review the swap rate before execution
5. **NO SECOND CHANCE** — Wrong parameters or bad rates will still execute

### Before Using This Workflow, Ensure:

- [ ] You have double-checked all swap parameters (amount, tokens, chain)
- [ ] You understand this sends a real transaction immediately
- [ ] You have sufficient gas fees in your wallet
- [ ] You trust the current market conditions
- [ ] You have used Build + Execute before to understand typical swap outputs

**When NOT to use this workflow:**
- **High-value transactions (> $1,000 USD equivalent)** — Use Build + Execute instead
- First time using these skills
- When you want to review the quote before executing
- When you're unsure about any swap parameter
- Volatile market conditions

**If the estimated swap value exceeds $1,000 USD, refuse fast execution and recommend the user use Build + Execute with confirmation prompts instead.**

### Safer Alternatives:

- Use **Build** to build (with confirmation), review, then **Execute** to execute (with confirmation)
- Use **Build** for step-by-step quote verification before building

### Fast Execute Prerequisites

- **Foundry installed**: `cast` must be available in PATH
- **curl and jq installed**: Required for API calls
- **Wallet configured**: See `references/wallet-setup.md`

**Quick wallet setup:**
```bash
# Import key to keystore
cast wallet import mykey --interactive

# Create password file securely (prompts without echoing to terminal)
read -s -p "Password: " pw && echo "$pw" > ~/.foundry/.password && chmod 600 ~/.foundry/.password
```

### Fast Execute Input

The user will provide input like:
- `1 ETH to USDC on base from 0xAbc123...`
- `100 USDC to ETH on arbitrum from 0xAbc123... slippage 100`
- `0.5 WBTC to DAI on polygon from 0xAbc123... keystore mykey`

Extract these fields:
- **amount** — the human-readable amount to swap
- **tokenIn** — the input token symbol
- **tokenOut** — the output token symbol
- **chain** — the chain slug (default: `ethereum`)
- **sender** — the address that will send the transaction (**required**)
- **recipient** — the address to receive output tokens (default: same as sender)
- **slippageTolerance** — slippage in basis points (see [Slippage Defaults](#slippage-defaults))
- **walletMethod** — `keystore`, `env`, `ledger`, or `trezor` (default: `keystore`)
- **keystoreName** — keystore account name (default: `mykey`)

**If the sender address is not provided, ask the user for it before proceeding.** Do not guess or use a placeholder address.

**Sender address validation:** Same rules as the Build workflow — reject zero address, native token sentinel. Warn if contract address.

**Recipient address warning:** When the recipient address differs from the sender, display a prominent warning: **"WARNING: Output tokens will be sent to a DIFFERENT address than the sender. Please verify the recipient address carefully before proceeding."** Wait for the user to acknowledge before continuing.

### Fast Execute Workflow

**Pre-Step: Verbal confirmation required**

**CRITICAL: Before running any script or making any API call, you MUST confirm with the user:**

> You are about to execute a swap IMMEDIATELY with no confirmation step. The transaction will be broadcast as soon as the route is found. Proceed? (yes/no)

**Wait for the user to explicitly respond with "yes", "proceed", "confirm", or a clear affirmative.** If the user says "no", "cancel", "wait", or anything non-affirmative, abort and recommend they use Build + Execute instead for a safer flow with quote review.

Do NOT skip this confirmation. Do NOT assume consent. This is the only safety gate before an irreversible transaction.

**Step 0: Dust amount pre-check**

Before running the script, sanity-check the swap amount. If the amount is obviously a dust amount (e.g., `0.0000000001 ETH`), **warn the user and abort** — the script will reject dust amounts (< $0.10 USD or gas > swap value) anyway. Catching it early avoids unnecessary API calls.

> "This swap amount is extremely small. Gas fees will far exceed the swap value. Use a larger amount."

**Step 0.5: Resolve token addresses**

Before running the script, resolve both token addresses. The script has a built-in registry and Token API fallback, but **unregistered tokens** (memecoins, new launches, etc.) may not be found by the script. Pre-resolving ensures all tokens work.

**For each token (tokenIn and tokenOut):**
1. Check `references/token-registry.md` for the token on the specified chain
2. **If found in registry** → pass the **symbol** to the script (e.g. `ETH`, `USDC`). The script resolves it internally (fastest path).
3. **If NOT found in registry** → resolve the address using this fallback sequence:
   a. **KyberSwap Token API** (preferred) — search whitelisted tokens first: `https://token-api.kyberswap.com/api/v1/public/tokens?chainIds={chainId}&symbol={symbol}&isWhitelisted=true` via WebFetch. Pick the result whose `symbol` matches exactly (case-insensitive) with the highest `marketCap`. If no whitelisted match, retry without `isWhitelisted` (only trust verified or market-cap tokens). If still nothing, try by name: `?chainIds={chainId}&name={symbol}&isWhitelisted=true`.
   b. **CoinGecko API** (secondary fallback) — search CoinGecko for verified contract addresses if the Token API doesn't have it.
   c. **Ask user** (final fallback) — ask the user for the contract address and decimals. Never guess or fabricate addresses.
4. Pass resolved tokens as `address:decimals` format (e.g. `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48:6`)

**For any non-registry token**, check honeypot/FOT before calling the script:

```
GET https://token-api.kyberswap.com/api/v1/public/tokens/honeypot-fot-info?chainId={chainId}&address={tokenAddress}
```

Via **WebFetch**, check both `tokenIn` and `tokenOut`:
- If `isHoneypot: true` — **refuse the swap** and warn the user.
- If `isFOT: true` — warn the user about fee-on-transfer tax. Proceed only if acknowledged.

**Step 1: Run the script**

```bash
bash scripts/execute-swap.sh <amount> <tokenIn> <tokenOut> <chain> <sender> [recipient] [slippage_bps] [wallet_method] [keystore_name]
```

**Arguments (positional):**

| # | Name | Required | Description |
|---|---|---|---|
| 1 | `amount` | Yes | Human-readable amount (e.g. `1`, `0.5`, `100`) |
| 2 | `tokenIn` | Yes | Input token symbol (e.g. `ETH`, `USDC`) or pre-resolved `address:decimals` |
| 3 | `tokenOut` | Yes | Output token symbol (e.g. `USDC`, `ETH`) or pre-resolved `address:decimals` |
| 4 | `chain` | Yes | Chain slug (e.g. `ethereum`, `arbitrum`, `base`) |
| 5 | `sender` | Yes | Sender wallet address |
| 6 | `recipient` | No | Recipient address (default: same as sender) |
| 7 | `slippage_bps` | No | Slippage in basis points (default: `50`) |
| 8 | `wallet_method` | No | `keystore`, `env`, `ledger`, `trezor` (default: `keystore`) |
| 9 | `keystore_name` | No | Keystore account name (default: `mykey`) |

> **Note:** The underlying `execute-swap.sh` script defaults to 50 bps if no slippage argument is passed. **You must calculate and pass the correct slippage value** from the [Slippage Defaults](#slippage-defaults) table as argument 7 when calling the script.

> **Note:** Arguments 7-9 use snake_case (shell convention) for the script's positional parameters. When parsing user input, map from the camelCase names above (slippageTolerance → slippage_bps, walletMethod → wallet_method, keystoreName → keystore_name).

**Examples:**

```bash
# Known tokens (symbol) — script resolves internally
bash scripts/execute-swap.sh 1 ETH USDC ethereum 0xYourAddress

# Pre-resolved tokens (address:decimals) — skips script resolution
bash scripts/execute-swap.sh 100 0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202:18 ETH ethereum 0xYourAddress

# Mix: one symbol, one pre-resolved
bash scripts/execute-swap.sh 0.5 ETH 0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202:18 ethereum 0xYourAddress "" 100

# Specify all options
bash scripts/execute-swap.sh 100 USDC ETH arbitrum 0xYourAddress "" 50 keystore mykey

# Different recipient
bash scripts/execute-swap.sh 0.5 WBTC DAI polygon 0xSender 0xRecipient 100 env

# Using Ledger hardware wallet
bash scripts/execute-swap.sh 1 ETH USDC base 0xYourAddress "" 50 ledger
```

**Step 2: Parse the output**

**On success** (`ok: true`):

```json
{
  "ok": true,
  "chain": "base",
  "txHash": "0x1234567890abcdef...",
  "blockNumber": "12345678",
  "gasUsed": "285432",
  "status": "1",
  "explorerUrl": "https://basescan.org/tx/0x1234...",
  "swap": {
    "tokenIn": {"symbol": "ETH", "amount": "1"},
    "tokenOut": {"symbol": "USDC", "amount": "2345.67"},
    "slippageBps": "50"
  },
  "tx": {
    "sender": "0xYourAddress",
    "recipient": "0xYourAddress",
    "router": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
    "value": "1000000000000000000"
  },
  "walletMethod": "keystore"
}
```

**On error** (`ok: false`):

```json
{
  "ok": false,
  "error": "Swap failed (pre-flight): Build failed — Route not found. No route available for this pair/amount. No transaction was submitted."
}
```

**Step 3: Format the output**

**On success**, present:

```
## Transaction Executed

**{swap.tokenIn.amount} {swap.tokenIn.symbol} → {swap.tokenOut.amount} {swap.tokenOut.symbol}** on {chain}

| Field | Value |
|-------|-------|
| Transaction Hash | `{txHash}` |
| Block Number | {blockNumber} |
| Gas Used | {gasUsed} |
| Status | {status == "1" ? "Success" : "Failed"} |
| Slippage | {swap.slippageBps/100}% |

**Explorer:** [{explorerUrl}]({explorerUrl})

> This transaction was executed immediately without confirmation. If this was a mistake, you cannot undo it.
```

**On error**, check the error prefix to determine what happened:
- **`"Swap failed (pre-flight): ..."`** — No transaction was submitted on-chain. No gas was spent. Fix the issue and retry.
- **`"Transaction was broadcast but ..."`** — A real transaction was sent. Gas fees were consumed. Check the block explorer for details.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Private key (required if `wallet_method=env`) |
| `KEYSTORE_PASSWORD_FILE` | Override default `~/.foundry/.password` |
| `RPC_URL_OVERRIDE` | Override chain RPC URL |
| `FAST_SWAP_MAX_USD` | Override the $1,000 USD safety threshold (default: `1000`). Set to a higher value to allow fast execution of larger swaps. |
| `EXPECTED_ROUTER_OVERRIDE` | Override the expected router address (default: `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5`). Use if KyberSwap deploys a new router version. Must be a valid Ethereum address. |

### Fast Execute Important Notes

- **EXTREMELY DANGEROUS**: This workflow builds AND executes in one step with NO confirmation
- **Irreversible**: Once sent, transactions cannot be cancelled
- **Gas fees**: Charged even if the swap fails (e.g., slippage exceeded)
- **Ledger/Trezor**: Still requires physical button press on the device
- **ERC-20 tokens**: The script automatically checks allowance and token balance before executing. If insufficient, it aborts with an actionable error.
- **Balance pre-check**: Native token balance is verified against tx.value + estimated gas cost before sending. ERC-20 balance is checked against amountInWei.
- **Gas buffer**: A 20% buffer is applied to the API gas estimate to reduce out-of-gas failures.
- **Gas price**: Current gas price is logged so you can see what you're paying.
- For safer execution, use Build then Execute (both have confirmation steps)

### Fast Execute Common Errors

**Pre-Flight Errors (no transaction sent, no gas spent):**

These errors appear with the prefix `"Swap failed (pre-flight): ..."` in the script output.

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| Route not found (4008) | No liquidity for this pair/amount | Try a smaller amount, remove source filters, or try a different chain. |
| Token not found (4011) | Wrong token address or unsupported token | Verify the token symbol and chain are correct. |
| Gas estimation failed — return amount not enough (4227) | Price moved between route fetch and build | Retry — the script will fetch a fresh route. Increase slippage if it keeps failing. |
| Gas estimation failed — insufficient funds (4227) | Sender doesn't have enough native token for value + gas | Top up the wallet or reduce swap amount. |
| Gas estimation failed — TRANSFER_FROM_FAILED (4227) | Missing token approval or insufficient token balance | Approve the router to spend the input token first. Check balance. |
| Quoted amount smaller than estimated (4222) | RFQ quote came in lower than expected | Retry. The script will fetch a fresh route. |
| Insufficient allowance | ERC-20 approval too low | The script detects this and aborts. Approve the router address for at least `amountIn`. |
| Insufficient token balance | Sender doesn't hold enough of the input token | The script detects this and aborts. Check balance. |
| Dust amount detected | Swap value < $0.10 USD | Use a larger amount. Gas fees dwarf the swap value. |
| Uneconomical swap | Gas cost > swap value | Use a larger amount to make the trade worthwhile. |

**On-Chain Errors (transaction sent, gas spent):**

These errors appear with the prefix `"Transaction was broadcast but ..."` in the script output.

| Error | Cause | Quick Fix |
|-------|-------|-----------|
| `TRANSFER_FROM_FAILED` | Approval revoked or race condition | Re-approve and retry. |
| `Return amount is not enough` | Price slipped beyond tolerance during execution | Increase slippage or retry quickly. For MEV protection, use a private RPC. |
| Out of gas | Gas limit insufficient for the route | The script adds a 20% buffer, but complex routes may need more. Set `RPC_URL_OVERRIDE` to a faster RPC and retry. |

**Common script-level errors:**

| Error | Solution |
|-------|----------|
| `cast not found` | Install Foundry: `curl -L https://foundry.paradigm.xyz \| bash && foundryup` |
| `Password file not found` | Create `~/.foundry/.password` with your keystore password |
| `PRIVATE_KEY not set` | Export `PRIVATE_KEY=0x...` or use keystore method |
| `Unknown chain` | Set `RPC_URL_OVERRIDE` environment variable |

---

## Reference Files

- **`references/api-reference.md`** — Full KyberSwap Aggregator API specification, error codes, rate limiting
- **`references/token-registry.md`** — Token addresses and decimals for all 18 chains
- **`references/error-handling.md`** — Comprehensive error catalog for all API, pre-transaction, and on-chain errors
- **`references/wallet-setup.md`** — Foundry wallet configuration guide (keystore, env var, Ledger, Trezor)
- **`references/examples.md`** — Working examples for all workflows

## Troubleshooting

For errors not covered in this document, refer to **`references/error-handling.md`** for the comprehensive error reference covering all API error codes (4000-4227, 40010-40011, 500, 404), PMM/RFQ errors, pre-transaction errors, and on-chain reverts.
