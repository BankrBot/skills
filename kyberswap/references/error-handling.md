# KyberSwap Error Handling Reference

This reference helps diagnose and resolve errors that occur when swapping tokens through the KyberSwap Aggregator API.

---

## When to use

Use this reference when:
- A user encounters an error while using KyberSwap API to swap tokens
- A swap transaction fails on-chain
- The KyberSwap API returns an error code
- A user needs help understanding why their swap failed
- Troubleshooting integration issues with KyberSwap Aggregator

## Error Categories

Errors are categorized into three phases:
1. **API Errors** - Returned by KyberSwap API during route fetching/building
2. **Pre-Transaction Errors** - Route built successfully, but failed to push the transaction on-chain
3. **On-Chain Errors** - Transaction reverts on the blockchain

---

## Error Handling Workflow

Follow this systematic approach when debugging swap failures:

### Step 1: Identify Error Phase
1. **API Error?** Check the HTTP response code and `code` field in JSON
2. **Pre-tx Error?** Check gas estimation or simulation results
3. **On-chain Error?** Check transaction receipt and revert reason

### Step 2: Look Up Error in This Guide
1. Find the error code (e.g., `4008`, `4222`, `4227`) in the API response
2. Navigate to the corresponding error section below:
   - **API Errors Reference** - for errors during route fetching/building
   - **Pre-Transaction Errors** - for gas estimation failures
   - **On-Chain Errors** - for transaction reverts
3. Read the **Description**, **Common Causes**, and **Solutions** for your specific error
4. Follow the recommended solutions in order

### Common Quick Fixes

| Symptom | Quick Fix |
|---------|-----------|
| Route not found | Remove source filters, try smaller amount |
| Token not found | Verify address, check chain |
| Insufficient output | Increase slippage |
| Transfer failed | Check balance and approval |
| Request timeout | Retry, check network |
| Gas estimation failed (4227) | Refetch route and retry, or use `suggestedSlippage` (not recommended) |
| Quoted < estimated (4222) | Fetch fresh route, or exclude RFQ sources |
| Slippage invalid | Set `ignoreCappedSlippage: true` (not recommended) |

---

## Best Practices

### Route Freshness
- **Never cache routes** for more than 5-10 seconds
- Always re-fetch route immediately before building transaction
- Markets move fast - stale routes cause failures

### Slippage Configuration
- Stablecoin ↔ Stablecoin (e.g. USDC→USDT): **5 bps** (0.05%)
- Common tokens (e.g. ETH→USDC, WBTC→ETH): **50 bps** (0.50%)
- All other / unknown pairs: **100 bps** (1.00%)

### Rate Limiting
- Always include `X-Client-Id` header

---

## API Errors Reference

> Note: Error codes 4008, 4009, 4010, 4011 are documented in official KyberSwap API docs. Other codes listed here (including 5-digit variants like 40010, 40011) are based on observed API behavior and may change without notice.
>
> **Maintenance note:** Observed (non-official) error codes should be periodically re-verified against live API behavior to ensure they are still accurate and relevant.

### Error 4000: Bad Request
```json
{
  "code": 4000,
  "message": "bad request",
  "details": [
    {
      "fieldViolations": [
        {
          "field": $validField,
          "description": "invalid"
        }
      ]
    }
  ]
}
```

**Description:** Generic bad request error with field-specific validation failures.

**Common Field Violations:**

| Field | Description | Cause |
|-------|-------------|-------|
| `tokenIn` | `required` | Missing tokenIn parameter |
| `tokenIn` | `invalid` | Wrong length, uppercase `0X`, missing `0x` prefix, non-hex chars |
| `tokenIn` | `identical with tokenOut` | Same token for input and output |
| `tokenOut` | `required` | Missing tokenOut parameter |
| `amountIn` | `invalid` | Zero, negative, decimal, scientific notation (1e18), hex (0x...) |
| `feeAmount` | `invalid` | Float value instead of integer |
| `gasPrice` | `invalid` | Non-numeric value |
| `chargeFeeBy` | `invalid` | Value other than `currency_in` or `currency_out` |
| `deadline` | `in the past` | Unix timestamp before current time |
| `slippageTolerance` | `invalid` | Negative value, or > 2000 without `ignoreCappedSlippage` (build only) |
| `recipient` | `required` | Missing recipient in build request |
| `route.route` | `empty route` | Empty or null route array in routeSummary |
| `to` | `required` | Missing `to` parameter in route/build endpoint |

**Solutions:**
1. Read the `fieldViolation` and `description` in the API response to see which field failed and the root cause.
2. For address-related fields: use valid 42-character hex strings with lowercase `0x` prefix (not `0X`)
3. For amount-related fields: use valid integer strings in wei - no decimals, no scientific notation, no hex
4. For `deadline`: use a Unix timestamp in the future (past timestamps are invalid)
5. For `slippageTolerance` in build: keep under 2000, or set `ignoreCappedSlippage: true`
6. Check that all required parameters are included

---

### Error 4001: Query Parameters Malformed
```json
{
  "code": 4001,
  "message": "unable to bind query parameters",
  "details": null,
  "requestId": ""
}
```

**Description:** The API cannot parse the query parameters in the request.

**Common Causes:**
- Invalid value for a boolean query parameter (e.g. not accepted by the API)

**Solutions:**
1. For boolean query parameters: use exactly `true` or `false` as required by the API. Avoid other values (e.g. `1`/`0`, `"yes"`/`"no"`).

---

### Error 4002: Request Body Malformed
```json
{
  "code": 4002,
  "message": "unable to bind request body",
  "details": null,
  "requestId": ""
}
```

**Description:** The POST request body cannot be parsed (for `/route/build` endpoint).

**Common Causes:**
- Data types don't match schema (e.g., string instead of number)
- Invalid JSON syntax in request body

**Solutions:**
1. Ensure that `deadline` and `slippageTolerance` are Numbers. `enableGasEstimation` and `ignoreCappedSlippage` are booleans (`true` or `false`)
2. DO NOT modify the `routeSummary` object - pass it unchanged

---

### Error 4003: Invalid Swap
```json
{"code": 4003, "message": "invalid swap"}
```

**Description:** The get route request is invalid and cannot be processed.

**Common Causes:**
- Error in dex integration from KyberSwap

**Solutions:**
1. Try to re-fetch the route after a period of time (recommended)
2. Use `excludedSources` to skip the failing DEX
3. Report to KyberSwap

---

### Error 4004: Invalid config for fee receiver
```json
{
  "code": 4004,
  "message": "invalid value",
  "details": null,
  "requestId": ""
}
```

**Description:** The fee configuration is incomplete or invalid. When `feeAmount` is specified, a valid `feeReceiver` address must also be provided to receive the collected fees.

**Common Causes:**
- `feeAmount` is set but `feeReceiver` is missing or empty
- Mismatch between number of `feeAmount` values and `feeReceiver` addresses when using multiple fee receivers

**Solutions:**
1. **Add a valid `feeReceiver` address** - Provide the wallet address that should receive the fees
2. **Match fee arrays** - When using multiple receivers, ensure `feeAmount` and `feeReceiver` have the same number of comma-separated values
3. **Remove fee parameters entirely** - If you don't need to charge fees, omit both `feeAmount` and `feeReceiver`

---

### Error 4005: Fee Amount Greater Than Amount In
```json
{
  "code": 4005,
  "message": "feeAmount is greater than amountIn",
  "details": null,
  "requestId": ""
}
```

**Description:** The configured fee exceeds the input amount when charging by input token.

**Common Causes:**
- `feeAmount` set too high relative to `amountIn`
- Incorrect `isInBps` configuration (treating BPS as absolute value or vice versa)
- Multiple fee receivers with combined fees exceeding input

**Solutions:**
1. Reduce `feeAmount` to be less than `amountIn`
2. If using BPS (`isInBps: true`), verify calculation: `10` = 0.1%, `100` = 1%
3. When not using BPS, `feeAmount` is in token wei - ensure it's less than `amountIn`
4. For multiple fees, ensure sum of all `feeAmount` values < `amountIn`

---

### Error 4007: Fee Amount Greater Than Amount Out
```json
{
  "code": 4007,
  "message": "feeAmount is greater than amountOut",
  "details": null,
  "requestId": ""
}
```

**Description:** The configured fee exceeds the output amount when charging by output token.

**Common Causes:**
- `feeAmount` set too high relative to expected `amountOut`
- Incorrect `isInBps` configuration (treating BPS as absolute value or vice versa)
- Multiple fee receivers with combined fees exceeding input
- Using `chargeFeeBy: "currency_out"` with miscalculated fee

**Solutions:**
1. Reduce `feeAmount` to be less than expected `amountOut`
2. If using BPS (`isInBps: true`), verify calculation: `10` = 0.1%, `100` = 1%
3. When not using BPS, `feeAmount` is in token wei - ensure it's less than `amountOut`
4. Consider switching to `chargeFeeBy: "currency_in"` for predictable fee calculation
5. Calculate maximum allowable fee based on estimated output

---

### Error 4008: Route Not Found
```json
{"code": 4008, "message": "route not found"}
```

**Description:** No viable swap path exists between the specified tokens.

**Common Causes:**
- No liquidity pools exist for the token pair
- Token is not listed on any DEX on this chain
- Extremely low liquidity for the pair
- Token has transfer restrictions blocking swaps
- Too restrictive source filtering (`includedSources`/`excludedSources`)

**Solutions:**
1. Verify both tokens are valid and tradeable on this chain
2. Remove source filters to search all liquidity sources
3. Try a different chain if the token is multi-chain
4. Reduce trade size - some routes only work for smaller amounts
5. Refetch route and retry after a short period of time

---

### Error 4009: Amount In Exceeds Maximum
```json
{"code": 4009, "message": "amountIn is greater than max allowed"}
```

**Description:** The input amount exceeds the maximum supported by the available liquidity sources or by the current KyberSwap API configuration.

**Common Causes:**
- Trade size too large

**Solutions:**
1. **Reduce the trade size** - split into multiple smaller swaps

---

### Error 4010: No Eligible Pools
```json
{"code": 4010, "message": "route not found"}
```

**Description:** No pools are eligible for routing after applying filters.

**Common Causes:**
- All pools filtered out by `includedSources`/`excludedSources`
- Liquidity exists but doesn't meet minimum requirements
- Pools exist but have insufficient liquidity for the amount

**Solutions:**
1. Remove or adjust source filters
2. Reduce trade size to fit available liquidity
3. Try without `onlyDirectPools` or `onlySinglePath` restrictions
4. Check if pools exist on block explorer for the token pair

---

### Error 4011: Token Not Found

```json
{"code": 4011, "message": "token not found"}
```

**Description:** The specified token address cannot be found or is not supported.

**Common Causes:**
- Token address is incorrect or has typo
- Token doesn't exist on this chain
- Token is not indexed by KyberSwap
- Using wrong chain for the token
- Token was recently deployed and not yet indexed

**Solutions:**
1. Verify the token contract address on a block explorer
2. Ensure you're using the correct chain
3. Check token address checksums (case-sensitive for EIP-55)
4. For native tokens, use: `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE`
5. For newly deployed tokens, wait for indexing
6. Try swapping a different, well-known token to verify API connectivity

---

### Error 4222: Quoted Amount Smaller Than Estimated

*Last verified: 2026-02-19 (observed behavior, not officially documented)*

```json
{
  "code": 4222,
  "message": "quoted amount is smaller than estimated",
  "details": null,
  "requestId": ""
}
```

**Description:** The actual quote from an RFQ market maker or limit order source is lower than the initially estimated output amount, causing the route to be rejected.

**Common Causes:**
- Market price moved between estimation and quote request
- RFQ market maker cannot offer the estimated rate for your trade size
- Stale estimation due to AMM pool state changes
- Price impact compounding in multi-hop routes
- High volatility in the token pair

**Solutions:**
1. **Fetch new route and retry the request** - Stale routes can cause failures (recommended)
2. **Use `excludeRFQSources: true`** - Avoid RFQ sources and rely only on AMM pools for more consistent pricing
3. **Use `onlyScalableSources: true`** - Stick to pools with predictable, calculable pricing
4. **Reduce trade size** - Smaller amounts typically get better and more stable quotes
5. **Increase slippage tolerance** - If using a tight `slippageTolerance`, the quote may fall outside the acceptable range

### Error 4227: Gas Estimation Failed

*Last verified: 2026-02-19 (observed behavior, not officially documented)*

```json
{
  "code": 4227,
  "message": "estimate gas failed: return amount is not enough",
  "details": ["estimate gas failed: return amount is not enough"],
  "requestId": "",
  "suggestedSlippage": 230
}
```
```json
{
  "code": 4227,
  "message": "estimate gas failed: insufficient funds for gas * price + value: have 1031632630608236 want 2000000000000000",
  "details": [
    "estimate gas failed: insufficient funds for gas * price + value: have 1031632630608236 want 2000000000000000"
  ],
  "requestId": ""
}
```
```json
{
  "code": 4227,
  "message": "estimate gas failed: execution reverted: TransferHelper: TRANSFER_FROM_FAILED",
  "details": [
    "estimate gas failed: execution reverted: TransferHelper: TRANSFER_FROM_FAILED"
  ],
  "requestId": ""
}
```

**Description:** Gas estimation failed during the build step. The API simulates the transaction before returning it, and the simulation reverted. The `message` field contains the specific revert reason. This error has several variants depending on the root cause.

#### Variant 1: "return amount is not enough"
The simulated swap would return less than the minimum acceptable amount based on current slippage settings. The API provides a `suggestedSlippage` value (in bps) that would make the transaction succeed.

**Common Causes:**
- Price moved unfavorably between route fetch and build
- Slippage tolerance is too tight for current market conditions
- High volatility in the token pair
- Route includes RFQ sources with changing quotes

**Solutions:**
1. **Fetch a new route and retry** - The route is stale; get a fresh quote (recommended)
2. **Use the `suggestedSlippage` value** - The API returns a suggested slippage (e.g., `230` = 2.3%) that would work
3. **Increase slippage tolerance** - Use a higher `slippageTolerance` in the build request

**Note:** The `suggestedSlippage` field is helpful but refetching a fresh route is generally the better approach as it gives you an updated price quote.

#### Variant 2: "insufficient funds for gas * price + value"
The sender's native token balance (e.g., ETH, MATIC) is not enough to cover the transaction value plus gas fees.

**Common Causes:**
- Sender wallet does not have enough native token to cover `amountIn` (for native token swaps) plus gas fees
- Gas price spiked between route fetch and build, increasing the total cost
- The `sender` address provided in the build request holds less native token than expected

**Solutions:**
1. **Check sender's native token balance** - Ensure the `sender` address has enough native token to cover the full transaction value plus gas fees
2. **Reduce the swap amount** - Lower `amountIn` to leave room for gas fees
3. **Top up the wallet** - Transfer more native token to the sender address before retrying

#### Variant 3: "TransferHelper: TRANSFER_FROM_FAILED"
The router contract failed to pull the input token from the sender during simulation.

**Common Causes:**
- Sender has not approved the router contract to spend the input token
- Token approval amount is less than `amountIn`
- Sender's token balance is less than `amountIn`
- The token contract has transfer restrictions (e.g., blacklists, paused transfers, max transfer limits)

**Solutions:**
1. **Check token approval** - Ensure the `sender` has approved the `routerAddress` to spend at least `amountIn` of the input token
2. **Check token balance** - Ensure the `sender` holds at least `amountIn` of the input token
3. **Check token restrictions** - Some tokens have blacklists, transfer fees, or pause mechanisms that block transfers

---

### Error 40010: Empty sender address

*Last verified: 2026-02-19 (observed behavior, not officially documented)*

```json
{
  "code": 40010,
  "message": "sender address can not be empty when enable gas estimation",
  "details": null,
  "requestId": ""
}
```

**Description:** The API requires a sender address to estimate gas costs, but none was provided in the request.

**Common Causes:**
- Missing `sender` parameter in the API request
- Empty string passed as sender address
- Using `enableGasEstimation: true` without providing a sender

**Solutions:**
1. **Provide a valid sender address** - Include the `sender` parameter with the user's wallet address
2. **Disable gas estimation** - If you don't need gas costs, set `enableGasEstimation: false` (or omit it)
3. **Use a placeholder address** - For quote-only requests, you can use any valid address format (e.g., `0x0000000000000000000000000000000000000001`)

---

### Error 40011: Filtered Liquidity Sources

*Last verified: 2026-02-19 (observed behavior, not officially documented)*

```json
{"code": 40011, "message": "filtered liquidity sources"}
```

**Description:** A route exists but was filtered out by user-defined liquidity source restrictions, or the user attempted to include a non-existent liquidity source in the `includedSources` field.

**Common Causes:**
- Using `includedSources` that do not exist or have no liquidity for this pair
- Using `excludedSources` that filters out all viable routes

**Solutions:**
1. Remove `includedSources` and `excludedSources` parameters
2. Expand the list of included sources
3. Check which DEXs have liquidity for this pair and include them

---

### Error 4221: WETH Not Configured
```json
{"code": 4221, "message": "weth not found"}
```

**Description:** WETH (Wrapped ETH) is not configured for this network.

**Common Causes:**
- Chain doesn't support native token wrapping
- Network misconfiguration
- Using unsupported testnet

**Solutions:**
1. Use the wrapped native token address directly instead of native token address
2. Check if WETH is configured on this chain

---

### Error 4990: Request Canceled

*Last verified: 2026-02-19 (observed behavior, not officially documented)*

```json
{"code": 4990, "message": "request was canceled"}
```

**Description:** The request was canceled.

**Common Causes:**
- Client canceled the request
- Network latency causing timeout

**Solutions:**
1. Retry the request
2. Check network connectivity
3. Try during lower traffic periods
4. If persistent, contact KyberSwap support with `requestId`

---

### Error 500: Internal Server Error
```json
{
  "code": 500,
  "message": "internal server error",
  "details": null,
  "requestId": ""
}
```

**Description:** An unexpected error occurred on the KyberSwap server. This is typically a bug or edge case that the API didn't handle gracefully.

**Common Causes:**
- Invalid `feeReceiver` address format (e.g., non-hex string like "invalid")
- Server-side processing error
- Malformed data that bypassed initial validation

**Solutions:**
1. **Verify all addresses** - Ensure all address fields are valid 42-character hex strings starting with `0x`
2. **Don't modify routeSummary** - Pass the routeSummary exactly as returned from get route API
3. **Retry the request** - The error may be transient

---

### HTTP 404: Chain Not Found
```json
{
  "message": "",
  "path": "/invalidchain/api/v1/routes?...",
  "request_id": "",
  "request_ip": "",
  "status": 404
}
```

**Description:** The specified chain in the API path is not supported or doesn't exist.

**Common Causes:**
- Typo in chain name (e.g., "etherium" instead of "ethereum")
- Using a testnet that's not supported (e.g., "goerli", "sepolia")
- Chain name is case-sensitive or formatted incorrectly

**Solutions:**
1. **Use correct chain names** - Refer to the supported chains list: `ethereum`, `bsc`, `polygon`, `arbitrum`, `optimism`, `avalanche`, `base`, `linea`, `mantle`, `sonic`, `berachain`, `ronin`, `unichain`, `hyperevm`, `plasma`, `etherlink`, `monad`, `megaeth`
2. **Check spelling** - Chain names are lowercase and must match exactly
3. **Verify chain support** - New chains may not be immediately available

### PMM/RFQ Errors

These errors occur when the route includes PMM (Private Market Maker) or RFQ (Request for Quote) sources such as Hashflow, Bebop, Native, or limit orders. They are returned during the **build-route** step when the maker fails to provide a firm quote.

#### Error Categories

| Category | Errors | Cause |
|----------|--------|-------|
| **Blacklist / Banned** | `ErrFirmQuoteBlacklist`, `ErrAddressBanned`, `ErrRFQDenyListed`, `ErrRFQBlacklisted` | Sender address is on the maker's deny list |
| **Insufficient Liquidity** | `ErrFirmQuoteInsufficientLiquidity`, `ErrRFQInsufficientLiquidity`, `ErrEmptyOrderList` | Maker doesn't have enough balance or pulled liquidity |
| **Amount Too Small** | `ErrMinGreaterExpect`, `ErrOrderIsTooSmall`, `ErrRFQMinSize`, `ErrRFQBelowMinimumAmount` | Trade amount is below the maker's minimum |
| **Amount Too Large** | `ErrRFQExceedsSupportedAmounts` | Trade amount exceeds the maker's maximum |
| **Market Moved** | `ErrFirmQuoteMarketCondition`, `ErrQuotedAmountSmallerThanEstimated` | Price changed between get-route and build-route |
| **Slippage** | `ErrAmountOutLessThanMin(4227)` | Firm quote output is below minimum acceptable amount |
| **Rate Limited** | `ErrRFQRateLimit` | Too many requests to the maker |
| **Pair Not Supported** | `ErrRFQNoMakerSupports`, `ErrRFQTokenNotSupported` | Maker doesn't support this token pair |
| **Volatility** | `ErrRFQMarketsTooVolatile` | Maker refuses to quote due to high volatility |
| **Timeout** | `ErrRFQTimeout` | Maker didn't respond in time |
| **Same Sender/Maker** | `ErrSameSenderMaker` | Taker and limit order maker are the same address |
| **Generic Failure** | `ErrRFQFailed`, `ErrFirmQuoteFailed`, `ErrQuoteSignFailed`, etc. | Catch-all failures from various makers |

#### General Handling Methods

1. **Retry with a fresh route** - Most PMM/RFQ errors are transient. Call get-route again to get fresh indicative prices, then build-route. Stale routes are the most common cause of failures.
2. **Exclude the failing source** - Use `excludedSources` to skip the problematic maker (e.g., `excludedSources=hashflow,bebop`). The router will find routes through other liquidity sources.
3. **Adjust trade amount** - If you hit min/max size errors, increase or decrease `amountIn` accordingly. For "gas exceeds size" errors, increase the trade to make it economically viable.
4. **Increase slippage tolerance** - For market-movement and slippage errors, a higher slippage tolerance gives the maker more room. Alternatively, just retry quickly before the price moves further.
5. **Wait and retry for rate limits** - For rate limit errors, back off for a few seconds before retrying.
6. **Use a different wallet for blacklist errors** - Blacklist/banned errors mean the maker has blocked your address. There is no workaround other than using a different sender address.
7. **Don't self-fill limit orders** - For `ErrSameSenderMaker`, use a different wallet than the one that created the limit order.

---

## Pre-Transaction Errors

These errors occur **after** successfully calling the Get Route and Build Route APIs, but **before** the transaction lands on-chain. The user's wallet or RPC node fails to estimate gas or submit the transaction.

**Flow where these errors occur:**
```
Get Route API ✓ → Build Route API ✓ → Wallet/RPC Submission ✗ (fails here)
```

---

### Gas Estimation Failed / Cannot Estimate Gas

**Description:** The wallet or RPC node failed to estimate gas for the transaction. The transaction was never broadcast to the network.

**Common Causes:**
- RPC node is overloaded, rate-limited, or experiencing issues
- Route has become stale (pool states changed since route was fetched)
- Price moved beyond slippage tolerance since route was built
- Network congestion causing RPC timeouts
- Token contract has transfer restrictions or blacklists

**Solutions:**
1. **Retry the transaction** - Transient RPC issues often resolve on retry
2. **Fetch a fresh route** - The route may be stale; call Get Route and Build Route again
3. **Change RPC URL** - Switch to a different RPC provider (e.g., Alchemy, Infura, QuickNode, or chain's public RPC)
4. **Check RPC rate limits** - If using a free RPC, you may be rate-limited; use a paid tier or different provider

---

### Transaction Submission Failed

**Description:** Gas estimation succeeded, but the transaction failed to be broadcast to the network.

**Common Causes:**
- RPC node rejected the transaction
- Nonce issues (pending transactions blocking new ones)
- Insufficient ETH/native token for gas fees
- Network connectivity issues
- RPC provider downtime

**Solutions:**
1. **Check gas balance** - Ensure sufficient native token (ETH, MATIC, etc.) for gas fees
2. **Reset nonce** - If stuck transactions exist, cancel them or reset wallet nonce
3. **Try a different RPC** - Switch RPC provider to rule out provider-specific issues
4. **Wait and retry** - Network congestion may clear up
5. **Check wallet connection** - Ensure wallet is properly connected to the correct network

---

### Simulation Revert

**Description:** The transaction simulation indicates it would revert on-chain.

**Common Causes:**
- Insufficient token balance
- Insufficient token approval
- Route expired (stale route data)
- Price moved beyond slippage tolerance
- Token has transfer fees or restrictions

**Solutions:**
1. **Verify balance** - Ensure sender has at least `amountIn` of the input token
2. **Check approval** - Approve `routerAddress` to spend at least `amountIn`
3. **Fetch fresh route** - Re-call Get Route and Build Route immediately before executing
4. **Increase slippage** - Use higher `slippageTolerance` (e.g., from 50 to 100 for 1%)
5. **Check token restrictions** - Some tokens have transfer fees, blacklists, or max transaction limits

---

## On-Chain Errors (Transaction Reverts)

These errors occur when a submitted transaction reverts on the blockchain.

### TransferHelper: TRANSFER_FROM_FAILED

**Description:** The router contract failed to transfer tokens from the sender.

**Common Causes:**
- Insufficient token approval for router contract
- Insufficient token balance in sender wallet

**Solutions:**
1. **Check balance:** Ensure sender has at least `amountIn` of the input token
2. **Check approval:** Approve `routerAddress` to spend at least `amountIn`.
   ```solidity
   token.approve(routerAddress, amountIn)
   ```
---

### TransferHelper: ETH_TRANSFER_FAILED

**Description:** Native ETH transfer failed during the swap.

**Common Causes:**
- Insufficient ETH balance for swap + gas
- Contract recipient rejects ETH transfers
- Recipient is a contract without receive/fallback function

**Solutions:**
1. **Check ETH balance:** Ensure sufficient ETH for both `amountIn` and gas fees
2. **Verify recipient:** If recipient is a contract, ensure it can receive ETH
3. **Check `transactionValue`:** Send exactly the `transactionValue` from build response

---

### Return Amount Is Not Enough (InsufficientAmountOut)

**Description:** The actual output amount is less than the minimum required based on slippage settings.

**Common Causes:**
- Price moved unfavorably between quote and execution
- High price volatility
- Slippage tolerance too tight
- Large trade causing price impact
- MEV/sandwich attack

**Solutions:**
1. **Increase slippage tolerance:**
   ```json
   {"slippageTolerance": 100}  // 1%
   ```
2. **Re-fetch route:** Get fresh quote immediately before executing
3. **Reduce trade size:** Smaller trades have less price impact
4. **Use private RPC:** Submit through Flashbots or private mempool to avoid MEV
---

### Out of Gas

**Description:** The transaction reverted because it consumed all allocated gas before completing the swap. The EVM stops execution when the gas limit is reached, causing the entire transaction to fail and revert.

**Common Causes:**
- **Gas limit too low:** The gas limit set when submitting the transaction is lower than the actual gas needed for the swap path
- **Complex route:** Multi-hop routes or routes through many pools require more gas than simple single-hop swaps
- **Underestimation:** Gas estimation (e.g. from `eth_estimateGas` or the build response) was inaccurate due to state change or edge case
- **Wallet/SDK default:** The client overwrites the suggested gas limit with a conservative default that is too low for aggregator routes

**Solutions:**
1. **Use suggested gas and add buffer:** Take the `gas` or gas estimate from the build response and multiply by 1.2–1.3 (20–30% buffer) when submitting the transaction
2. **Do not cap gas limit:** If your app or wallet caps gas limit, allow a higher cap for KyberSwap routes
3. **Check integration:** Ensure your code passes through the gas limit from the build response instead of replacing it with a fixed or default value
4. **Re-fetch route:** A different route might use fewer hops and less gas; try building again

---

### Call Failed (Internal Liquidity Source Error)

**Description:** An internal call to a liquidity source (DEX pool) failed.

**Common Causes:**
- Pool state changed between quote and execution
- Pool has insufficient liquidity
- Pool contract is paused or malfunctioning
- Route included a deprecated pool

**Solutions:**
1. **Wait and retry:** Pool state may stabilize
2. **Re-fetch route:** Get a fresh route that may use different pools
3. **Exclude problematic source:** Use `excludedSources` to skip the failing DEX
4. **Reduce trade size:** May route through more stable pools

---

## Unlisted Error Codes

For any error code not documented above, show the raw `code` and `message` from the API response to the user and suggest:
1. Re-fetch the route and retry
2. Check the official KyberSwap API docs: https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps
