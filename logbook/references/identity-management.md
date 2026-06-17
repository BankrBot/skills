# Logbook Identity Management

How to generate, store, and use the ed25519 keypair that gives your agent a logbook identity.

## What an identity is

A logbook agent identity is one ed25519 keypair plus the registration record on the server. The keypair is generated locally by the agent. The public key gets registered with logbook in a one-time signed call. The private key never leaves the agent.

From the public key, you derive a `did:logbook:<base58>` identifier. That's the agent's stable id across logbook, used in all event payloads, in API paths, and in verification URLs.

The private key is the agent's authority. Anyone holding it can write events under that did.

## Keypair generation

Generate the keypair once, when the agent first starts using logbook. Persist both keys, then use only the private key from then on.

### Node.js

```ts
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex } from '@noble/hashes/utils';

const privateKey = ed25519.utils.randomPrivateKey(); // 32 random bytes
const publicKey = ed25519.getPublicKey(privateKey); // 32 bytes derived from private key

const privateKeyHex = bytesToHex(privateKey); // 64 hex chars
const publicKeyHex = bytesToHex(publicKey);   // 64 hex chars
```

### Python

```python
from nacl.signing import SigningKey
from nacl.encoding import HexEncoder

signing_key = SigningKey.generate()
verify_key = signing_key.verify_key

private_key_hex = signing_key.encode(encoder=HexEncoder).decode()
public_key_hex = verify_key.encode(encoder=HexEncoder).decode()
```

### Shell (one-off, for testing only)

```bash
node -e "
const { ed25519 } = require('@noble/curves/ed25519');
const { bytesToHex } = require('@noble/hashes/utils');
const priv = ed25519.utils.randomPrivateKey();
const pub = ed25519.getPublicKey(priv);
console.log(JSON.stringify({
  privateKey: bytesToHex(priv),
  publicKey: bytesToHex(pub),
}, null, 2));
"
```

## Deriving the did

The did is `did:logbook:` followed by the base58 encoding of the public key bytes.

```ts
import bs58 from 'bs58';

function didFromPublicKey(publicKeyHex: string): string {
  const bytes = Buffer.from(publicKeyHex, 'hex');
  return 'did:logbook:' + bs58.encode(bytes);
}
```

Example: a public key of `f2b8...` produces a did like `did:logbook:HLMnau36uvQ2ZhAtYUTqMaef6sUkKs3EAyxqC8tLb8pA`.

## Storage

The private key controls the agent's authority on logbook. Anyone with the private key can write events as the agent. Store it like you store any other production secret.

**Recommended:**

- For Bankr agents: store in the agent's configured secret store. Reference it by name in agent config, never inline.
- For local development: `.env` file with the entry `LOGBOOK_PRIVATE_KEY=<64 hex>`. Make sure `.env` is in `.gitignore`. Run `git check-ignore -v .env` to confirm before any commit.
- For server deployments: load from the platform's secret manager (Vercel env vars, Render env vars, AWS Secrets Manager, etc.). Never write the key to the deploy log.

**Avoid:**

- Hardcoding the key in source code.
- Storing the key in a config file that's committed to git.
- Logging the key anywhere - even in debug output.
- Sending the key over a network for any reason. Logbook never asks for it.

## Canonical message signing

Both registration and event submission sign over canonicalized JSON. The canonicalization rules are strict because both sides must produce byte-identical output before hashing.

The algorithm:

1. Start from the object to be signed.
2. Recursively sort all object keys alphabetically.
3. JSON.stringify with no extra whitespace (no spaces after `:` or `,`, no newlines).
4. UTF-8 encode the resulting string.
5. Sign with ed25519.
6. Hex-encode the 64-byte signature to get a 128-char string.

### Reference implementation in TypeScript

```ts
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return (
      '{' +
      keys
        .map(k => JSON.stringify(k) + ':' + canonicalize((value as any)[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}
```

Note: this is recursive sort by key, not the simpler `JSON.stringify(obj, Object.keys(obj).sort())` (which only sorts top-level keys).

### Registration signature

For `POST /agents`, sign over:

```ts
const message = canonicalize({
  type: 'logbook.register.v1',
  public_key: '<64 hex>',
  display_name: '<display name>',
  metadata: <metadata object>,
});

const signatureBytes = ed25519.sign(Buffer.from(message, 'utf8'), privateKey);
const signatureHex = bytesToHex(signatureBytes);
```

Send the signature as the `signature` field in the request body.

### Event signature

For `POST /events`, sign over the event payload without the signature field:

```ts
const message = canonicalize({
  agent_did: '<did>',
  seq_num: 1,
  action: '<action>',
  resource: '<resource or null>',
  metadata: <metadata object>,
  prev_hash: '<prev hash>',
});

const signatureBytes = ed25519.sign(Buffer.from(message, 'utf8'), privateKey);
const signatureHex = bytesToHex(signatureBytes);
```

## Common signing mistakes

- **Inconsistent canonicalization.** If your canonicalize function only sorts top-level keys, nested objects in `metadata` will produce different bytes than the server expects. Use recursive sort.
- **Sending the signature inside the canonical payload.** The signature is over the payload `without` the signature field. Build the canonical bytes first, sign, then attach the signature.
- **Sending decimal numbers as strings.** `seq_num: 1` is correct. `seq_num: "1"` will fail with `invalid_body`.
- **Wrong hex length.** Public keys are 64 hex chars. Signatures are 128 hex chars. Strip any `0x` prefix.
- **Encoding the message before signing it.** Ed25519 signs the raw bytes of the message. Do not hash the message yourself; ed25519 internally hashes the input.

## Recovery

There is none. The did is bound to the public key via base58 encoding. If you lose the private key:

- All existing events you signed remain verifiable. Nothing breaks.
- You cannot write new events under that did. Any attempt will fail signature verification.
- Your only option is to register a new identity (new keypair) and start a new chain.

This is by design. The whole point of the system is that a private key controls a chain, period. If keys were recoverable, the chain would not be tamper-proof.

## Practical advice

- Generate the keypair on the agent host the first time the agent runs. Persist immediately. Do not re-generate on every restart.
- If the agent runs as a service, generate the key in a setup step (one-time CLI command) and inject it via env var. Don't generate on startup.
- For dev and prod, use different keypairs. Treat the prod private key as a high-value secret.
- Back up the private key somewhere offline. If your secret store dies, you want to recover the key, not start a new chain.
