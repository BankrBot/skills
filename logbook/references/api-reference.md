# Logbook API Reference

Full endpoint specifications. The agent fetches this when it needs exact request and response shapes.

Base URL: `https://api.signedlogbook.com`

All endpoints return JSON. Errors have the shape `{ "error": "<code>", "message": "<human-readable>" }`.

## Authentication overview

- Read endpoints (`GET`) are open: no auth, no payment.
- `POST /agents` requires an ed25519 signature over the registration message.
- `POST /events` requires an ed25519 signature over the event payload AND a $0.001 USDC payment via x402.

There is no API key system. The agent's authority comes from its ed25519 private key.

## Canonicalization

Every signed message is JSON.stringify'd with sorted keys, no extra whitespace, UTF-8 encoded. Both the agent and the server compute the same bytes. The signature is ed25519 over those bytes, output as 128 hex characters (64 bytes).

The exact algorithm:
1. Build the object that needs signing.
2. Recursively sort all object keys alphabetically.
3. JSON.stringify with no spaces.
4. Encode as UTF-8.
5. Sign with ed25519 private key.
6. Hex-encode the 64-byte signature.

## POST /agents

Register a new agent. One-time per identity.

**Request body**

```json
{
  "public_key": "string, 64 hex chars (ed25519 public key)",
  "display_name": "string, 1-64 chars",
  "metadata": "object, free-form (default {})",
  "signature": "string, 128 hex chars"
}
```

**Signature payload**

The signature must be over the canonicalized JSON of:

```json
{
  "type": "logbook.register.v1",
  "public_key": "<the public key>",
  "display_name": "<the display name>",
  "metadata": "<the metadata object>"
}
```

**Response 200**

```json
{
  "did": "did:logbook:<base58 of public key>",
  "public_key": "<64 hex chars>",
  "display_name": "<string>",
  "metadata": "<object>",
  "created_at": "ISO 8601 timestamp"
}
```

**Error codes**

- `400 invalid_body` — malformed body or wrong field shapes
- `401 bad_signature` — signature does not match public key
- `409 already_registered` — an agent with this public key already exists

## GET /agents/:did

Get an agent's public information.

**Path param:** `did` — full did string, e.g. `did:logbook:AKytnP51PC75AgbE7gNVyeMcxNuJUNcCtRW1FVPXKdmy`

**Response 200**

```json
{
  "did": "did:logbook:...",
  "public_key": "<64 hex>",
  "display_name": "<string>",
  "metadata": "<object>",
  "event_count": 42,
  "created_at": "ISO 8601 timestamp"
}
```

**Error codes**

- `404 not_found` — no agent with that did

## GET /agents/:did/events

List events for an agent, newest first. Useful for finding the chain head before posting a new event.

**Query params**

- `limit` — number, default 50, max 100
- `before_seq` — number, optional cursor. Returns events with `seq_num < before_seq`.

**Response 200**

```json
{
  "events": [
    {
      "id": "uuid",
      "agent_did": "did:logbook:...",
      "seq_num": 3,
      "action": "swap",
      "resource": "<string or null>",
      "metadata": "<object>",
      "signature": "<128 hex>",
      "prev_hash": "<64 hex>",
      "event_hash": "<64 hex>",
      "x402_tx_hash": "<64 hex or null>",
      "created_at": "ISO 8601"
    }
  ],
  "count": 3
}
```

For chain management, fetch with `limit=1` to get just the latest event. Its `event_hash` is the next event's `prev_hash`; its `seq_num + 1` is the next `seq_num`.

## POST /events

Log a new event. Requires x402 payment of $0.001 USDC on Base.

**Request body**

```json
{
  "agent_did": "did:logbook:...",
  "seq_num": 1,
  "action": "string, 1-128 chars",
  "resource": "string or null, max 512 chars",
  "metadata": "object, free-form (default {})",
  "prev_hash": "64 hex chars (genesis hash for first event)",
  "signature": "128 hex chars"
}
```

**Signature payload**

The signature must be over the canonicalized JSON of the event payload WITHOUT the `signature` field. That is:

```json
{
  "agent_did": "<did>",
  "seq_num": <number>,
  "action": "<string>",
  "resource": "<string or null>",
  "metadata": "<object>",
  "prev_hash": "<64 hex>"
}
```

**Genesis hash**

The first event in any chain uses this constant as `prev_hash`:

```
b0f51bc78db4f1ccd09a31a31872c6f5a6e9d83bc06e63c4bce8b09c8d6ba78b
```

(This is `sha256("logbook:genesis:v1")`.)

**x402 payment flow**

If no payment header is provided, the server returns:

```
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: <base64-encoded JSON with payment requirements>
content-type: application/json

{}
```

The decoded `PAYMENT-REQUIRED` header looks like:

```json
{
  "x402Version": 2,
  "error": "Payment required",
  "resource": {
    "url": "https://api.signedlogbook.com/events",
    "description": "submit a signed event to logbook",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "1000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "<logbook receiver address>",
      "maxTimeoutSeconds": 300,
      "extra": {"name": "USD Coin", "version": "2"}
    }
  ]
}
```

The client signs an EIP-3009 transferWithAuthorization for 1000 atomic USDC (= $0.001) to the `payTo` address, encodes the payload, and retries the request with a `PAYMENT-SIGNATURE` header containing the encoded payload.

Bankr agents handle this automatically when calling x402-protected endpoints. For non-Bankr clients, use `@x402/fetch` from npm:

```ts
import { wrapFetchWithPayment } from '@x402/fetch';
import { x402Client } from '@x402/core/client';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY);
const x402 = new x402Client();
registerExactEvmScheme(x402, { signer: account });

const fetchWithPay = wrapFetchWithPayment(globalThis.fetch, x402);
// then use fetchWithPay everywhere instead of fetch
```

**Response 200**

```json
{
  "id": "uuid",
  "agent_did": "did:logbook:...",
  "seq_num": 1,
  "action": "<string>",
  "resource": "<string or null>",
  "metadata": "<object>",
  "signature": "<128 hex>",
  "prev_hash": "<64 hex>",
  "event_hash": "<64 hex>",
  "x402_tx_hash": "<64 hex>",
  "created_at": "ISO 8601"
}
```

**Error codes**

- `400 invalid_body` — malformed body
- `401 bad_signature` — event signature does not match the agent's registered public key
- `402 Payment Required` — no x402 payment included (expected on first call, the client should retry with payment)
- `404 unknown_agent` — `agent_did` does not match a registered agent
- `409 bad_prev_hash` — `prev_hash` does not match the latest event for this agent. Fetch the chain head and retry.
- `409 bad_seq_num` — `seq_num` is not exactly 1 greater than the latest event for this agent.

The 402 is part of the normal flow, not an error. A correctly-wired x402 client retries and gets 200.

## GET /events/:id

Fetch a single event by id.

**Path param:** `id` — event uuid

**Response 200:** same shape as event objects returned by `GET /agents/:did/events`.

**Error codes**

- `404 not_found` — no event with that id

## GET /verify/:id

Walk the chain from genesis to this event and confirm every event signs to the next.

**Response 200, valid chain**

```json
{
  "valid": true,
  "event_id": "uuid",
  "agent_did": "did:logbook:...",
  "chain_length": 3
}
```

**Response 200, invalid chain**

```json
{
  "valid": false,
  "reason": "hash_mismatch" | "bad_signature" | "broken_chain" | "seq_gap" | "agent_missing",
  "at_seq": 2,
  "expected_seq": 3
}
```

The `reason` field tells you what went wrong:

- `hash_mismatch` — an event's stored content does not hash to its stored event_hash. Someone tampered with the content.
- `bad_signature` — the event's signature does not match the agent's public key over the event payload.
- `broken_chain` — an event's `prev_hash` does not match the previous event's `event_hash`. Someone tried to insert or remove events.
- `seq_gap` — a sequence number is missing or duplicated.
- `agent_missing` — the agent referenced by this event no longer exists in the registry (should not happen in normal operation).

Verify is the core trust primitive. It runs in milliseconds (no x402, no payment, no signature from the caller) and returns a clear true or false with the reason on failure.
