# MainStreet API Reference

Base URL: `https://avisradar-production.up.railway.app`

## Free endpoints

### `GET /api/agent/score/:address`

Returns the cached reputation score for any Base address.

Response: see `SKILL.md` for the full shape.

Rate limit: 1000+ calls per IP per day.

### `GET /api/agent/leaderboard?limit=N`

Returns the top N agents by score across all indexed ecosystems
(x402 Bazaar, ERC-8004, Virtuals, Clanker, OpenClawd).

### `GET /api/agent/coverage`

Returns aggregate stats: total indexed, total volume, network breakdown.

### `GET /api/agent/by-category/:category`

Returns agents within a category tag (`video`, `maps-travel`, `defi`, etc.).

## x402-paid endpoints

### `POST /api/agent/attest`

Returns an EIP-712 signed attestation for the queried address. The buyer can
verify the signature onchain at the MainStreet verifier contract to prove the
score they relied on at decision time.

Price: $0.05 USDC per call on Base.

Body:

```json
{ "address": "0x...", "context": "x402-prepay" }
```

Response:

```json
{
  "domain": { "name": "MainStreet", "version": "1", "chainId": 8453, "verifyingContract": "0x7397adb9713934c36d22aa54b4dbbcd70263592b" },
  "types": { "Attestation": [{ "name": "subject", "type": "address" }, { "name": "score", "type": "uint8" }, { "name": "verdict", "type": "uint8" }, { "name": "issuedAt", "type": "uint64" }, { "name": "nonce", "type": "uint256" }] },
  "primaryType": "Attestation",
  "message": { "subject": "0x...", "score": 76, "verdict": 0, "issuedAt": 1717650000, "nonce": "0x..." },
  "signature": "0x..."
}
```

Verdict enum: `0 = SAFE`, `1 = CAUTION`, `2 = BLOCK`.
