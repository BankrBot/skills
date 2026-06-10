# Onchain Verifier

The MainStreet verifier is a stateless contract that recovers the EIP-712
signature on an attestation and confirms it was signed by the canonical
MainStreet oracle key.

**Address:** `0x7397adb9713934c36d22aa54b4dbbcd70263592b`
**Network:** Base mainnet (chainId 8453)
**Source:** https://github.com/philpof102-svg/mainstreet/blob/main/contracts/MainStreetVerifier.sol

## Verification flow

1. Buyer calls `POST /api/agent/attest { address, context }`.
2. Buyer receives a signed EIP-712 attestation (see `api.md`).
3. Buyer (or anyone, later) calls `verify(message, signature)` on the
   verifier contract.
4. The contract returns `true` if the signature recovers to the MainStreet
   oracle address.

```solidity
function verify(
  address subject,
  uint8 score,
  uint8 verdict,
  uint64 issuedAt,
  uint256 nonce,
  bytes calldata signature
) external view returns (bool);
```

## Why this matters

The attestation is third-party-verifiable without trusting MainStreet's API.
If a buyer agent paid an x402 seller based on a SAFE attestation and that
seller later turned out to be malicious, the buyer has cryptographic proof of
the verdict it relied on at the moment of payment.

This is the same pattern used by traditional rating agencies — except the
"rating" is queryable in 5 ms and verifiable by a smart contract.

## Anti-staleness

Each attestation includes `issuedAt` (unix seconds) and a `nonce`. Consumers
should reject attestations older than their tolerance window (recommended:
60 seconds for live agent flows).
