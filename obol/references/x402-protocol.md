# x402 wire-level reference (buy-side)

Notes the script implements. Read this if you need to debug a 402 that isn't working, or extend the script to handle a scheme/asset it doesn't recognise.

## The 402 challenge

A seller responds to an unpaid request with HTTP `402 Payment Required` and a JSON body:

```json
{
  "x402Version": 1,
  "accepts": [
    {
      "scheme": "exact",
      "network": "base",
      "maxAmountRequired": "1000",
      "resource": "https://example.trycloudflare.com/services/hello/",
      "description": "Hello service",
      "mimeType": "application/json",
      "payTo": "0xSellerWallet...",
      "maxTimeoutSeconds": 60,
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "extra": { "name": "USD Coin", "version": "2" }
    }
  ],
  "error": "X-PAYMENT header is required"
}
```

Fields the buyer cares about:

| Field | Meaning |
|-------|---------|
| `scheme` | Settlement scheme. `exact` means "transfer exactly `maxAmountRequired` of `asset` to `payTo`." |
| `network` | x402 network identifier (`base`, `ethereum`, `polygon`, `arbitrum-one`, ...). Maps to an EVM chainId. |
| `maxAmountRequired` | Price in base units of the asset (string-encoded uint256). For USDC: 6 decimals. For OBOL: 18 decimals. |
| `asset` | ERC-20 contract address. |
| `payTo` | Recipient of the transfer (usually the seller's hot wallet). |
| `maxTimeoutSeconds` | How long the signed authorisation stays valid after the buyer signs. Set `validBefore`/`deadline` to `now + maxTimeoutSeconds`. |
| `extra.name`, `extra.version` | EIP-712 domain `name` / `version` for the asset. Crucial — wrong values break the signature. |
| `extra.permit` | Optional. If `true`, the seller wants an EIP-2612 `Permit` instead of EIP-3009 `TransferWithAuthorization`. Used for $OBOL on mainnet via the Obol facilitator. |
| `extra.spender` | Optional. With EIP-2612, who can pull the tokens (typically a facilitator/settler contract). Defaults to `payTo` if omitted. |

If there are multiple `accepts`, the script picks `accepts[0]`. To prefer a different network, ask the user; this skill isn't smart about routing.

## EIP-3009 `TransferWithAuthorization` (default `exact` path)

Used by USDC across every chain the script supports. Construct EIP-712 typed data with:

```ts
{
  domain: {
    name:    extra.name,      // e.g. "USD Coin"
    version: extra.version,   // e.g. "2"
    chainId: <network → chainId>,
    verifyingContract: asset, // the token contract, NOT the facilitator
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
    value:       maxAmountRequired,
    validAfter:  "0",
    validBefore: String(Math.floor(Date.now()/1000) + maxTimeoutSeconds),
    nonce:       "0x" + 32 random bytes (hex),
  },
}
```

The nonce is a random `bytes32` chosen by the buyer per request. The facilitator records `(from, nonce)` to prevent replay.

## EIP-2612 `Permit` (when `extra.permit: true`)

Used by OBOL on mainnet via the Obol facilitator. The flow is:

1. Buyer signs a `Permit` allowing `spender` (the facilitator's settler contract) to move `value` of the token on the buyer's behalf, up to `deadline`.
2. At settlement, the Obol facilitator submits one transaction batching `permit()` then `transferFrom()`. Gas is paid by the facilitator.

Typed data:

```ts
{
  domain: {
    name:    extra.name,
    version: extra.version,
    chainId: <network → chainId>,
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
    value:    maxAmountRequired,
    nonce:    <on-chain nonces(owner) from the token contract>,
    deadline: String(Math.floor(Date.now()/1000) + maxTimeoutSeconds),
  },
}
```

The EIP-2612 nonce is **per-token, per-owner** and **incremented on-chain** for every successful permit. Read it via `eth_call` to `nonces(address)` (selector `0x7ecebe00`) on the token contract. The script uses `https://ethereum-rpc.publicnode.com` by default; override with `--rpc-url`.

## Signing via Bankr

```bash
curl -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "signatureType": "eth_signTypedData_v4",
    "typedData": { ... the structure above ... }
  }'
```

Response:

```json
{
  "success": true,
  "signature": "0xabc123...",
  "signer": "0x1234...5678",
  "signatureType": "eth_signTypedData_v4"
}
```

The `signer` field is the address that signed. It should match the `from`/`owner` you put into the typed data — if it doesn't, the buyer's Bankr account has multiple EVM addresses and the wrong one was selected. Pass `--from` to the script to pin a specific address.

## The X-PAYMENT header

After signing, wrap the signature + the same authorisation/permit fields into a JSON object, base64-encode it, and send it as the `X-PAYMENT` header on the retry.

### EIP-3009 form

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "base",
  "payload": {
    "signature": "0xabc...",
    "authorization": {
      "from": "0x...",
      "to":   "0x...",
      "value": "1000",
      "validAfter":  "0",
      "validBefore": "1735689600",
      "nonce": "0xdeadbeef..."
    }
  }
}
```

### EIP-2612 form

```json
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "ethereum",
  "payload": {
    "signature": "0xabc...",
    "permit": {
      "owner":   "0x...",
      "spender": "0x...",
      "value":   "1000000000000000000",
      "nonce":   "42",
      "deadline":"1735689600"
    },
    "payTo": "0xSellerWallet..."
  }
}
```

Then:

```ts
const xPayment = Buffer.from(JSON.stringify(json)).toString("base64");
fetch(url, { headers: { "X-PAYMENT": xPayment } });
```

## Failure modes worth knowing

- **Signature verifies but settlement reverts**: the buyer wallet doesn't actually hold enough of the asset. The facilitator can verify a signature without doing the transfer first — settlement happens at request time, and if the on-chain `transferFrom`/`transferWithAuthorization` reverts, the buyer gets a 402 (or 502 from the seller) with an error explaining.
- **`validBefore` already elapsed**: signature is rejected. Always set `validBefore` to `now + maxTimeoutSeconds`, not a fixed timestamp.
- **Wrong EIP-712 domain (`name`, `version`, `verifyingContract`, `chainId`)**: the facilitator's recovered signer won't match `from`/`owner`. Symptoms: "signature does not verify" or "signer mismatch". Cross-check `extra.name` / `extra.version` against the token's on-chain `name()` / `version()` if you can; some tokens use unusual values.
- **EIP-2612 nonce stale**: if a previous permit succeeded, the on-chain nonce moved. Always read it fresh, never cache.

## Why the Obol facilitator matters

- Default Coinbase x402 facilitator: settles on Base only.
- Obol facilitator (`x402.gcp.obol.tech`): settles on Ethereum mainnet for USDC and OBOL. For OBOL specifically, batches `permit + transferFrom` so the buyer doesn't need to pre-approve and doesn't spend ETH.

The buyer never sets the facilitator URL anywhere; the seller's Obol Stack picks it at deploy time and embeds it in their settlement logic. From the buyer's perspective, the only signal is `extra.permit: true` in the 402 challenge.
