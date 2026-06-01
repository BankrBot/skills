# x402 wire-level reference (buy-side)

Detail for debugging or extending the script. SKILL.md has the user-facing flow; this doc is the implementation reference.

## v1 vs v2 — what changed

| | v1 | v2 |
|---|---|---|
| Version field | `x402Version: 1` | `x402Version: 2` |
| Network identifier | plain string (`"ethereum"`, `"base"`) | CAIP-2 (`"eip155:1"`, `"eip155:8453"`) |
| Amount field | `maxAmountRequired` | `amount` |
| Resource field | string URL | `{url, description, mimeType?}` object |
| Transfer method hint | `extra.permit: true` (informal) | `extra.assetTransferMethod: "permit2" \| "transferWithAuthorization"` |
| Extensions | absent | top-level `extensions: {...}` object |
| Client → server header | `X-PAYMENT` | `PAYMENT-SIGNATURE` |
| Server → client receipt | `X-PAYMENT-RESPONSE` | `PAYMENT-RESPONSE` |
| Envelope must echo `accepted`? | no | yes — plus `extensions` |

The script handles both. On v2 retries it sends `PAYMENT-SIGNATURE` AND `X-PAYMENT` to cover sellers in transition.

## Real 402 challenge (Obol Stack seller, v2)

```json
{
  "x402Version": 2,
  "error": "Payment required for this resource",
  "resource": {
    "url": "http://example.trycloudflare.com/services/demo-hello",
    "description": "Payment required for /services/demo-hello"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:1",
      "asset": "0x0B010000b7624eb9B3DfBC279673C76E9D29D5F7",
      "amount": "1000000000000000000",
      "payTo": "0x09f4a31c591421062A8dba9FcE24F29C5e88419A",
      "maxTimeoutSeconds": 60,
      "extra": {
        "assetTransferMethod": "permit2",
        "name": "Obol Network",
        "version": "1"
      }
    }
  ],
  "extensions": {
    "eip2612GasSponsoring": {}
  }
}
```

Field meanings:

| Field | Notes |
|-------|-------|
| `amount` | uint256 string, **base units of the asset**. Look up decimals before showing to a human. |
| `asset` | ERC-20 contract address. Domain `verifyingContract` for the signature. |
| `payTo` | Transfer recipient. EIP-3009 `to` field. For EIP-2612, the actual spender is `extra.spender ?? payTo`. |
| `extra.name`, `extra.version` | EIP-712 domain `name`/`version`. Wrong values silently break signature recovery. Verify against the token's on-chain `name()` if signatures keep failing. |
| `extra.assetTransferMethod` | `"permit2"` → permit-style; `"transferWithAuthorization"` → EIP-3009. |
| `extensions.eip2612GasSponsoring` | Seller's facilitator gas-sponsors EIP-2612 permits (Obol mainnet facilitator). Triggers the permit signing path when the token supports it. |

## EIP-3009 `TransferWithAuthorization` (USDC default)

```ts
{
  domain: {
    name:    extra.name,      // "USD Coin" / "USDC"
    version: extra.version,   // "2"
    chainId,
    verifyingContract: asset, // token, NOT the facilitator
  },
  types: {
    TransferWithAuthorization: [
      { name: "from",        type: "address" },
      { name: "to",          type: "address" },
      { name: "value",       type: "uint256" },
      { name: "validAfter",  type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce",       type: "bytes32" },
    ],
  },
  primaryType: "TransferWithAuthorization",
  message: {
    from:        <buyer wallet>,
    to:          payTo,
    value:       amount,
    validAfter:  "0",
    validBefore: String(now + maxTimeoutSeconds),
    nonce:       "0x" + 32 random bytes,
  },
}
```

`nonce` is random per request (32 bytes). Facilitator records `(from, nonce)` against replay.

## EIP-2612 `Permit` (Obol facilitator path)

Triggered when any of: `extensions.eip2612GasSponsoring` present + token supports EIP-2612, `extra.assetTransferMethod === "permit2"` + token supports EIP-2612, v1's `extra.permit: true`, or `--force-permit`.

```ts
{
  domain: {
    name:    extra.name,      // "Obol Network"
    version: extra.version,   // "1"
    chainId,
    verifyingContract: asset,
  },
  types: {
    Permit: [
      { name: "owner",    type: "address" },
      { name: "spender",  type: "address" },
      { name: "value",    type: "uint256" },
      { name: "nonce",    type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  },
  primaryType: "Permit",
  message: {
    owner:    <buyer wallet>,
    spender:  extra.spender ?? payTo,
    value:    amount,
    nonce:    <on-chain nonces(owner)>,
    deadline: String(now + maxTimeoutSeconds),
  },
}
```

The `nonce` is **per-token, per-owner, incremented on-chain on every successful permit**. Read fresh via `eth_call` to `nonces(address)` (selector `0x7ecebe00`). Never cache.

### Why not Uniswap Permit2 (the contract)

`extra.assetTransferMethod: "permit2"` is a generic label for "permit-style transfer." With `extensions.eip2612GasSponsoring`, the facilitator translates that into a native EIP-2612 call against the token if the token supports it. The script does NOT sign a Uniswap Permit2 message — that would require a one-time approval of the Permit2 contract, which the gasless EIP-2612 path bypasses.

## Signing via Bankr

```bash
curl -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "signatureType": "eth_signTypedData_v4", "typedData": { ... } }'
```

Response: `{ "success": true, "signature": "0x...", "signer": "0x...", "signatureType": "eth_signTypedData_v4" }`.

`signer` must match the `from`/`owner` in the typed data. If they differ, pass `--from` to the script to pin a specific address.

## Payment envelopes

Base64-encode the JSON and send as `PAYMENT-SIGNATURE` (v2) or `X-PAYMENT` (v1).

### v2 — EIP-2612 permit (OBOL on mainnet via Obol facilitator)

```json
{
  "x402Version": 2,
  "scheme": "exact",
  "network": "eip155:1",
  "accepted": { /* the chosen accepts[] entry, verbatim */ },
  "extensions": { "eip2612GasSponsoring": {} },
  "payload": {
    "signature": "0xabc...",
    "permit": {
      "owner":   "0x...",
      "spender": "0x...",
      "value":   "1000000000000000000",
      "nonce":   "42",
      "deadline":"1735689600"
    },
    "payTo": "0x..."
  }
}
```

### v1 — EIP-3009 (legacy)

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base",
  "payload": {
    "signature": "0xabc...",
    "authorization": {
      "from": "0x...", "to": "0x...", "value": "1000",
      "validAfter": "0", "validBefore": "1735689600",
      "nonce": "0xdead..."
    }
  }
}
```

## Adding a new token

Drop it in `KNOWN_TOKENS` in `scripts/obol-x402-call.ts`, keyed by `<chainId>:<address-lowercase>`:

```ts
"1:0x0b010000b7624eb9b3dfbc279673c76e9d29d5f7": { symbol: "OBOL", decimals: 18, supportsEip2612: true },
```

For unknown tokens the script falls back to an on-chain `decimals()` read (selector `0x313ce567`). It can't infer EIP-2612 support from chain reads — pass `--force-permit` if you know the token supports it.
