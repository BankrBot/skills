# KyberSwap Aggregator API Reference

> Source: [docs.kyberswap.com — EVM Swaps](https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps)

## Base URL

```
https://aggregator-api.kyberswap.com
```

## Required Header

All requests must include:

```
X-Client-Id: ai-agent-skills
```

A stricter rate limit is applied if `X-Client-Id` is not provided.

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

To get the live list of supported chains and their status (active/inactive/new), query:
```
GET https://common-service.kyberswap.com/api/v1/aggregator/supported-chains
```
Each chain object includes `chainId`, `chainName` (slug), `displayName`, and `state` (`active`, `inactive`, or `new`).

> Verified 2026-02-19. Note: chainId is returned as a string type, not integer. Chains are nested under data.chains[].

---

## Endpoints

### GET `/{chain}/api/v1/routes`

Find the best route to swap from `tokenIn` to `tokenOut`, supporting all liquidity sources including RFQ.

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `tokenIn` | string | Yes | Address of input token. Use `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` for native token (ETH/MATIC/BNB/AVAX etc.) |
| `tokenOut` | string | Yes | Address of output token. Same native token format as above |
| `amountIn` | string | Yes | Amount of tokenIn in **wei** (smallest unit). Must be a decimal string, no scientific notation |
| `includedSources` | string | No | Comma-separated DEX IDs to include in routing |
| `excludedSources` | string | No | Comma-separated DEX IDs to exclude from routing |
| `excludeRFQSources` | boolean | No | If `true`, exclude RFQ liquidity sources |
| `onlyScalableSources` | boolean | No | If `true`, only use sources that accept scaling |
| `onlyDirectPools` | boolean | No | If `true`, only route directly from tokenIn to tokenOut (no intermediate hops) |
| `onlySinglePath` | boolean | No | If `true`, return single-path routes only (no splits) |
| `gasInclude` | boolean | No | If `true`, include gas costs in route optimization. Default: `true` |
| `gasPrice` | string | No | Custom gas price in wei for route optimization |
| `feeAmount` | string | No | Fee(s) to collect, comma-separated. See [Fee Collection](#fee-collection) |
| `chargeFeeBy` | string | No | `currency_in` or `currency_out` — which token to charge the fee in |
| `isInBps` | boolean | No | If `true`, `feeAmount` is in basis points; if `false`, `feeAmount` is absolute wei |
| `feeReceiver` | string | No | Fee recipient address(es), comma-separated (one per feeAmount) |
| `origin` | string | No | User wallet address. Enables access to exclusive pools/rates |

**Example Request**

```
GET https://aggregator-api.kyberswap.com/ethereum/api/v1/routes?tokenIn=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&tokenOut=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48&amountIn=1000000000000000000
```

**Response Schema**

```json
{
  "code": 0,
  "message": "",
  "data": {
    "routeSummary": {
      "tokenIn": "0x...",
      "amountIn": "1000000000000000000",
      "amountInUsd": "2345.67",
      "tokenOut": "0x...",
      "amountOut": "2345670000",
      "amountOutUsd": "2345.67",
      "gas": "250000",
      "gasPrice": "25000000000",
      "gasUsd": "3.45",
      "l1FeeUsd": "0.12",
      "extraFee": {
        "feeAmount": "0",
        "chargeFeeBy": "",
        "isInBps": false,
        "feeReceiver": ""
      },
      "route": [
        [
          {
            "pool": "0x...",
            "tokenIn": "0x...",
            "tokenOut": "0x...",
            "swapAmount": "1000000000000000000",
            "amountOut": "2345670000",
            "exchange": "uniswap-v3",
            "poolType": "uni-v3",
            "poolExtra": {},
            "extra": {}
          }
        ]
      ],
      "routeID": "abc123...",
      "checksum": "...",
      "timestamp": "..."
    },
    "routerAddress": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5"
  },
  "requestId": "..."
}
```

**Key response fields:**
- `data.routeSummary` — The entire route summary object. Pass this to the build endpoint unchanged.
- `data.routeSummary.amountOut` — Output amount in wei
- `data.routeSummary.amountInUsd` / `amountOutUsd` — USD equivalents
- `data.routeSummary.gas` — Estimated gas units
- `data.routeSummary.gasUsd` — Estimated gas cost in USD
- `data.routeSummary.l1FeeUsd` — L1 data posting fee in USD (relevant on L2 chains: Arbitrum, Optimism, Base, Linea, etc.). May be `"0"` on L1 chains.
- `data.routeSummary.route` — Array of route splits, each containing swap steps with `exchange` names and `poolType`
- `data.routeSummary.routeID` — Unique route identifier
- `data.routerAddress` — The KyberSwap router contract address
- `requestId` — Request tracking identifier

**Important:** Do not cache routes for more than 5-10 seconds. Prices change rapidly and stale routes cause slippage.

---

### POST `/{chain}/api/v1/route/build`

Build encoded transaction calldata from a route. Call this after getting a route from the GET endpoint.

**Request Headers**

```
Content-Type: application/json
X-Client-Id: ai-agent-skills
```

**Request Body**

```json
{
  "routeSummary": { },
  "sender": "0x...",
  "recipient": "0x...",
  "slippageTolerance": 50,
  "deadline": 1234567890,
  "source": "ai-agent-skills"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `routeSummary` | object | Yes | The **exact, unmodified** `routeSummary` object from the GET routes response |
| `sender` | string | Yes | Address that will send the transaction (the swapper) |
| `recipient` | string | Yes | Address that will receive the output tokens. Usually same as `sender` |
| `slippageTolerance` | number | No | Slippage in basis points, range `[0, 2000]` (10 = 0.1%). **API default: `0`** — always pass an explicit value. Recommended: 5 bps for stablecoin↔stablecoin, 50 bps for common pairs, 100 bps for volatile/unknown tokens |
| `deadline` | integer | No | Unix timestamp deadline. Default: current time + 1200 (20 minutes) |
| `source` | string | No | Client identifier. Use `ai-agent-skills` |
| `origin` | string | No | User wallet address. Helps prevent rate limiting |
| `permit` | string | No | Encoded ERC-2612 permit calldata. Allows gasless token approvals (skip separate approval tx) |
| `ignoreCappedSlippage` | boolean | No | If `true`, allow slippage values above the default cap of 2000 BPS (20%). Use for volatile or low-liquidity tokens |
| `enableGasEstimation` | boolean | No | If `true`, triggers `eth_gasEstimate` for a more accurate gas figure |
| `referral` | string | No | Referral data emitted in the router's `ClientData` event |

**Example Request**

```bash
curl -s -X POST "https://aggregator-api.kyberswap.com/ethereum/api/v1/route/build" \
  -H "Content-Type: application/json" \
  -H "X-Client-Id: ai-agent-skills" \
  -d '{
    "routeSummary": { ... },
    "sender": "0xYourAddress",
    "recipient": "0xYourAddress",
    "slippageTolerance": 50,
    "source": "ai-agent-skills"
  }'
```

**Response Schema**

```json
{
  "code": 0,
  "message": "",
  "data": {
    "amountIn": "1000000000000000000",
    "amountInUsd": "2345.67",
    "amountOut": "2345670000",
    "amountOutUsd": "2345.67",
    "gas": "250000",
    "gasUsd": "3.45",
    "additionalCostUsd": "0.08",
    "additionalCostMessage": "L1 data fee",
    "outputChange": {
      "amount": "-11728350",
      "percent": -0.5,
      "level": 0
    },
    "data": "0x...",
    "routerAddress": "0x6131B5fae19EA4f9D964eAc0408E4408b66337b5",
    "transactionValue": "1000000000000000000"
  },
  "requestId": "..."
}
```

**Key response fields:**
- `data.data` — The encoded calldata. This is the `data` field for the on-chain transaction.
- `data.routerAddress` — Send the transaction `to` this address.
- `data.amountOut` — Expected output amount in wei (after slippage protection).
- `data.outputChange` — Shows the difference from the quote, including slippage impact.
- `data.gas` — Estimated gas for the transaction.
- `data.gasUsd` — Estimated gas cost in USD.
- `data.additionalCostUsd` — Extra costs such as L1 data fees on L2 chains. May be absent on L1.
- `data.additionalCostMessage` — Human-readable explanation of additional costs.
- `data.transactionValue` — The `value` field for the on-chain transaction (in wei). Non-zero only for native token input.
- `data.routerAddress` — The router contract to send the transaction to.

---

### GET `https://token-api.kyberswap.com/api/v1/public/tokens`

Look up token information (address, decimals, symbol) across all supported chains. Use this when a token is not in the local token registry.

**Base URL:** `https://token-api.kyberswap.com` (different from the aggregator API)

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `chainIds` | string | Yes | Comma-separated chain IDs (e.g., `1` for Ethereum, `56` for BSC, `42161` for Arbitrum). See the Supported Chains table for all IDs. |
| `name` | string | No | Search by token name or symbol (case-insensitive, partial match). |
| `symbol` | string | No | Search by token symbol (exact match). The symbol parameter performs exact matching (e.g., symbol=USDC returns only USDC), while name performs substring matching on the token name field. |
| `isWhitelisted` | boolean | No | If `true`, only return KyberSwap-whitelisted tokens. **Recommended** to filter out unverified or spam tokens. |
| `page` | integer | No | Page number (1-indexed). Default: `1` |
| `pageSize` | integer | No | Results per page. Default: `10` |

**Example Requests**

```
# Search whitelisted tokens by name (safest)
GET https://token-api.kyberswap.com/api/v1/public/tokens?chainIds=1&name=WBTC&isWhitelisted=true

# Search all tokens by name
GET https://token-api.kyberswap.com/api/v1/public/tokens?chainIds=1&name=WBTC

# Browse by market cap
GET https://token-api.kyberswap.com/api/v1/public/tokens?chainIds=1&page=1&pageSize=10
```

**Response Schema**

```json
{
  "code": 0,
  "message": "Succeeded",
  "data": {
    "tokens": [
      {
        "chainId": "1",
        "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        "symbol": "USDC",
        "name": "USD Coin",
        "decimals": 6,
        "marketCap": 70630000000,
        "isVerified": true,
        "isWhitelisted": true,
        "isStable": true,
        "logoURL": "https://..."
      }
    ],
    "pagination": {
      "totalItems": 526588
    }
  }
}
```

**Key response fields:**
- `data.tokens[].address` — The token contract address
- `data.tokens[].symbol` — Token symbol (e.g., "USDC")
- `data.tokens[].decimals` — Decimal places (needed for wei conversion)
- `data.tokens[].isVerified` — Whether the token has been verified
- `data.tokens[].isStable` — Whether the token is a stablecoin
- `data.tokens[].marketCap` — Market cap in USD (results sorted by this)

**Usage pattern for token lookup:**
1. **Search whitelisted by name** (safest): Query with `name={symbol}&isWhitelisted=true` and the target chain ID. This returns only KyberSwap-vetted tokens, avoiding spam and unverified forks. Pick the result whose `symbol` matches exactly with the highest `marketCap`.
2. **Search all by name** (broader): If no whitelisted match, retry without `isWhitelisted`. Only consider tokens that are `isVerified: true` or have a non-null `marketCap`, then pick the highest `marketCap`.
3. **Browse by market cap** (fallback): If name search returns no results, query with `pageSize=100` and scan pages 1-3 for a symbol match.
4. If still not found, use the CoinGecko API (see `token-registry.md` for instructions).
5. If CoinGecko also fails, ask the user to provide the contract address manually.

---

### GET `https://token-api.kyberswap.com/api/v1/public/tokens/honeypot-fot-info`

> Undocumented KyberSwap endpoint, verified working 2026-02-19.

Check if a token is a honeypot (can buy but cannot sell) or has a fee-on-transfer (FOT) tax. **Always check unfamiliar tokens before swapping.**

**Base URL:** `https://token-api.kyberswap.com` (same as the token lookup endpoint)

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `chainId` | integer | Yes | Chain ID (e.g., `1` for Ethereum) |
| `address` | string | Yes | Token contract address |

**Example Request**

```
GET https://token-api.kyberswap.com/api/v1/public/tokens/honeypot-fot-info?chainId=1&address=0x090185f2135308bad17527004364ebcc2d37e5f6
```

**Response Schema**

```json
{
  "code": 0,
  "message": "Succeeded",
  "data": {
    "isHoneypot": false,
    "isFOT": false,
    "tax": 0,
    "tokenAddress": ""
  }
}
```

**Key response fields:**
- `data.isHoneypot` — If `true`, the token is a honeypot. **Do not swap into this token.** Users will not be able to sell it.
- `data.isFOT` — If `true`, the token charges a fee on every transfer. The actual received amount will be less than the swap output.
- `data.tax` — The fee-on-transfer tax rate (as a percentage, e.g., `10` = 10%).

**Usage:**
- Check **both** `tokenIn` and `tokenOut` before building a swap.
- If either token `isHoneypot: true`, **refuse the swap** and warn the user.
- If either token `isFOT: true`, warn the user about the transfer tax. The actual received amount will be reduced by the tax.
- Skip this check for native tokens (`0xEeee...`) and tokens in the built-in registry (known safe).

---

## Fee Collection

Integrators can collect fees on swaps by passing fee parameters to the GET `/routes` endpoint:

1. Set `feeAmount` to the fee value (comma-separated for multiple fee receivers)
2. Set `chargeFeeBy` to `currency_in` or `currency_out`
3. Set `isInBps` to `true` (basis points) or `false` (absolute wei)
4. Set `feeReceiver` to the recipient address(es) (comma-separated, matching `feeAmount`)

The fee is deducted from the swap amount and sent to the receiver(s).

**Example:** Collect a 0.1% fee in the output currency:
```
&feeAmount=10&chargeFeeBy=currency_out&isInBps=true&feeReceiver=0xYourFeeWallet
```

---

## Error Codes

If something goes wrong (unexpected errors, missing fields, changed behavior), refer to:

- **`references/error-handling.md`** — Comprehensive error handling guide for all KyberSwap API errors. Use this when encountering any error codes (4000-4227, 40010-40011, 500, 404).

---

## Wei Conversion Reference

Tokens use different decimal places. To convert a human-readable amount to wei:

```
wei = amount * 10^decimals
```

| Decimals | Multiply by | Common tokens |
|---|---|---|
| 18 | 1000000000000000000 | ETH, WETH, most ERC-20s |
| 8 | 100000000 | WBTC (Ethereum), renBTC |
| 6 | 1000000 | USDC, USDT |

**Examples:**
- 1 ETH (18 decimals) = `1000000000000000000`
- 1 USDC (6 decimals) = `1000000`
- 0.5 WBTC (8 decimals) = `50000000`
- 100 USDC (6 decimals) = `100000000`

**Important:** The `amountIn` parameter must be a plain decimal string. Never use scientific notation (e.g., `1e18`).

---

## Rate Limiting

A stricter rate limit is applied when `X-Client-Id` is not provided. The API returns rate limit info in response headers:

| Header | Description | Example |
|---|---|---|
| `x-ratelimit-limit` | Max requests per window | `30, 10` |
| `x-ratelimit-remaining` | Requests remaining in current window | `29` |
| `x-ratelimit-reset-after` | Seconds until the window resets | `10` |
| `x-aggregator-tier` | Rate limit tier applied | `basic` |

When `x-ratelimit-remaining` reaches `0`, wait `x-ratelimit-reset-after` seconds before retrying. The `origin` parameter (user wallet address) in both GET and POST requests can help prevent rate limiting when using a fixed sender address.

> Verified against live API 2026-02-19.

---

## Troubleshooting / Fallback

If this reference is outdated, endpoints return unexpected errors, or fields are missing from responses, consult the official KyberSwap API documentation directly:

**Official API reference:** https://docs.kyberswap.com/kyberswap-solutions/kyberswap-aggregator/aggregator-api-specification/evm-swaps

The official docs are the single source of truth for endpoint specs, error codes, supported chains, and parameter definitions.
