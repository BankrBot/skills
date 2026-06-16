# x402 wire-level reference (buy-side)

Implementation detail for debugging or extending the scripts. SKILL.md has the user-facing flow; this is verified against the Obol Stack reference buyer (`obol-stack` `buy.py`). Logic lives in `scripts/x402.ts`.

## Addresses & facilitator

| | Value |
|---|---|
| Canonical Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| x402 exact-Permit2 proxy (witness spender) | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| OBOL (mainnet) | `0x0B010000b7624eb9B3DfBC279673C76E9D29D5F7` (18 dec, `permit2`) |
| Obol mainnet facilitator | `https://x402.gcp.obol.tech` |

## 402 challenge

The seller returns `402` with a JSON body. Networks are CAIP-2 (`eip155:<id>`); `amount` is in **base units** of the asset.

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:1",
    "asset": "0x0B010000b7624eb9B3DfBC279673C76E9D29D5F7",
    "amount": "1000000000000000000",
    "payTo": "0x09f4a31c591421062A8dba9FcE24F29C5e88419A",
    "maxTimeoutSeconds": 60,
    "extra": { "assetTransferMethod": "permit2", "name": "Obol Network", "version": "1" }
  }],
  "extensions": { "eip2612GasSponsoring": { "info": { "...": "..." } } }
}
```

| Field | Notes |
|-------|-------|
| `amount` | uint256 string, base units. Look up decimals before showing a human. |
| `asset` | ERC-20 contract; the EIP-712 `verifyingContract` for token signatures. |
| `payTo` | Transfer recipient. EIP-3009 `to`; Permit2 witness `to`. |
| `extra.assetTransferMethod` | `"eip3009"` → EIP-3009; `"permit2"` → Permit2 witness transfer. |
| `extra.name` / `extra.version` | EIP-712 domain for the **permit2/EIP-2612** path. For **USDC** they mirror `name()` and are NOT reliably the signing domain — see below. |
| `extra.eip712Domain` | Optional Obol convention: authoritative `{name, version}` for EIP-3009. |
| `extensions.eip2612GasSponsoring` | Seller's facilitator gas-sponsors an EIP-2612 permit. Triggers the extra permit signature on the permit2 path. |

## Path 1 — EIP-3009 `TransferWithAuthorization` (USDC)

```ts
domain: { name, version, chainId, verifyingContract: asset }
types.TransferWithAuthorization: [from, to, value, validAfter, validBefore, nonce]  // address,address,uint256,uint256,uint256,bytes32
message: { from: buyer, to: payTo, value: amount, validAfter: "0", validBefore: deadline, nonce: 0x+32 random bytes }
```

`nonce` is random per request (facilitator records `(from, nonce)` vs replay). **Domain resolution** (`x402.ts`): `extra.eip712Domain` if present, else the per-chain USDC table (`CHAINS[id].usdcDomain` — mainnet/base = `["USD Coin","2"]`, base-sepolia = `["USDC","2"]`), else `["USDC","2"]`. Do **not** trust `extra.name` for USDC: base-sepolia's `name()` is "USD Coin" but its EIP-712 domain is "USDC", and the wrong domain yields a valid-looking signature the facilitator silently rejects.

## Path 2 — Permit2 + EIP-2612 (OBOL)

Two signatures. First, a Permit2 `PermitWitnessTransferFrom` (the transfer authorization):

```ts
domain: { name: "Permit2", chainId, verifyingContract: PERMIT2 }   // no version field
types: {
  TokenPermissions: [token, amount],
  Witness: [to, validAfter],
  PermitWitnessTransferFrom: [permitted: TokenPermissions, spender: address, nonce: uint256, deadline: uint256, witness: Witness]
}
message: {
  permitted: { token: asset, amount },
  spender: X402_PROXY,                 // the exact-Permit2 proxy, NOT payTo
  nonce: <random uint256>,
  deadline,
  witness: { to: payTo, validAfter: "0" }
}
```

Then, when `extensions.eip2612GasSponsoring` is advertised, an EIP-2612 permit approving **canonical Permit2** to pull the tokens — the facilitator submits this on-chain gaslessly:

```ts
domain: { name: extra.name, version: extra.version, chainId, verifyingContract: asset }  // OBOL: "Obol Network","1"
types.Permit: [owner, spender, value, nonce, deadline]
message: { owner: buyer, spender: PERMIT2, value: amount, nonce: <on-chain nonces(owner)>, deadline }
```

`nonces(owner)` is read fresh via `eth_call` to `nonces(address)` (selector `0x7ecebe00`) — per-token, per-owner, increments on chain. Never cache. Without gas sponsoring, Permit2 needs a prior `approve(Permit2, …)` from the wallet, which this client does not perform (it warns instead).

## Payment envelopes (`X-PAYMENT`)

Base64-encode the JSON, send as the **`X-PAYMENT`** request header (not `PAYMENT-SIGNATURE`). The settlement receipt comes back base64 in **`X-PAYMENT-RESPONSE`** (`{success, transaction, network, payer}`).

### EIP-3009 (USDC)

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "exact", "network": "eip155:8453", "amount": "10000", "asset": "0x...", "payTo": "0x...", "maxTimeoutSeconds": 60, "extra": { "...": "..." } },
  "payload": {
    "signature": "0x...",
    "authorization": { "from": "0x...", "to": "0x...", "value": "10000", "validAfter": "0", "validBefore": "1735689600", "nonce": "0x..." }
  }
}
```

### Permit2 + EIP-2612 sponsoring (OBOL)

```json
{
  "x402Version": 2,
  "accepted": { "scheme": "exact", "network": "eip155:1", "amount": "1000000000000000000", "asset": "0x0B01...", "payTo": "0x...", "maxTimeoutSeconds": 60, "extra": { "assetTransferMethod": "permit2", "name": "Obol Network", "version": "1" } },
  "payload": {
    "signature": "0x...",
    "permit2Authorization": {
      "permitted": { "token": "0x0B01...", "amount": "1000000000000000000" },
      "spender": "0x402085c248EeA27D92E8b30b2C58ed07f9E20001",
      "nonce": "<random uint256>",
      "deadline": "1735689600",
      "witness": { "to": "0x...", "validAfter": "0" },
      "from": "0x..."
    }
  },
  "extensions": {
    "eip2612GasSponsoring": {
      "info": { "from": "0x...", "asset": "0x0B01...", "spender": "0x0000...A3", "amount": "1000000000000000000", "nonce": "42", "deadline": "1735689600", "signature": "0x...", "version": "1" }
    }
  }
}
```

x402 v2 requires the client to echo each server extension's `info`; the script copies them, then overlays the signed `eip2612GasSponsoring.info`.

## Signing via Bankr

```bash
curl -X POST https://api.bankr.bot/wallet/sign \
  -H "X-API-Key: $BANKR_KEY" -H "Content-Type: application/json" \
  -d '{ "signatureType": "eth_signTypedData_v4", "typedData": { "types": {...}, "primaryType": "...", "domain": {...}, "message": {...} } }'
```

Response: `{ "success": true, "signature": "0x...", "signer": "0x..." }`. `signer` must equal the `from`/`owner` in the typed data — pass `--from` to pin an address if they differ. Each `typedData` includes its `EIP712Domain` type (with or without `version`); `x402.ts` builds it.

## Adding a token or chain

Edit `scripts/x402.ts`:
- **Chain**: add to `CHAINS` (`{ name, rpc, usdc, usdcDomain }`) and, if it needs a short alias, `NET_ALIAS`.
- **Token decimals/symbol** (display): USDC is derived from `CHAINS[id].usdc`; for others add to the `tokenMeta` registry (only OBOL is special-cased today). Unknown tokens fall back to on-chain `decimals()` (selector `0x313ce567`).
