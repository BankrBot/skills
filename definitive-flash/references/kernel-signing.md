# Kernel v3.3 Signature Wrapping

## Why Normal Signatures Fail

Definitive Flash verifies every order and cancel signature by calling `isValidSignature(bytes32 hash, bytes sig)` on the funder's wallet address (EIP-1271). For a standard EOA this is a simple `ecrecover` check. For a **ZeroDev Kernel v3.3** smart wallet (EIP-7702 delegated), the check goes through Kernel's own validation logic.

Kernel v3.3 decodes the signature type from the first byte:

| First byte | Mode | Validator used |
|------------|------|----------------|
| `0x00` | **SUDO / root** | `rootValidator` (ECDSAValidator) |
| `0x01` | Named validator | Extracted from next 20 bytes of sig |
| `0x02` | Permission | Permission-based |

The critical constraint with `0x01`: the ValidationId it extracts includes bytes from the ECDSA signature itself, so it never matches the canonical stored validator ID → `InvalidValidator()` revert. **Always use `0x00` (SUDO mode).**

Even in SUDO mode, Kernel does not pass the original hash to ECDSAValidator directly. It wraps it:

```
wrapped_hash = keccak256(
  "\x19\x01"
  || kernel_domain_separator
  || keccak256(KERNEL_WRAPPER_TYPE_HASH || original_hash)
)
```

Where:
- `KERNEL_WRAPPER_TYPE_HASH = keccak256("Kernel(bytes32 hash)") = 0x1547321c374afde8a591d972a084b071c594c275e36724931ff96c25f2999c83`
- `kernel_domain_separator` uses: `name="Kernel"`, **`version="0.3.3"`** (NOT "0.3.0-beta" from GitHub main), `chainId=8453`, `verifyingContract=<wallet_address>`

ECDSAValidator then checks `ecrecover(wrapped_hash, sig[1:]) == owner`.

## The Signing Approach

Instead of signing the raw hash and prepending `0x00`, construct a **`Kernel(bytes32 hash)` typed data struct** and have bankr sign it via `eth_signTypedData_v4`. Bankr's `_hashTypedData` produces the identical `wrapped_hash` that ECDSAValidator checks, so the resulting signature verifies correctly.

### Step 1 — Compute the original EIP-712 hash

Use `eth_account` with a dummy key to hash Definitive's typed data without actually signing it:

```python
from eth_account import Account

dummy = Account.from_key(b'\x01' * 32)
signed = dummy.sign_typed_data(full_message=definitive_typed_data)
original_hash = signed.message_hash  # bytes
```

### Step 2 — Build the Kernel wrapper typed data

```python
kernel_td = {
    "types": {
        "EIP712Domain": [
            {"name": "name",             "type": "string"},
            {"name": "version",          "type": "string"},
            {"name": "chainId",          "type": "uint256"},
            {"name": "verifyingContract","type": "address"},
        ],
        "Kernel": [{"name": "hash", "type": "bytes32"}],
    },
    "domain": {
        "name":              "Kernel",
        "version":           "0.3.3",   # deployed version — NOT "0.3.0-beta"
        "chainId":           8453,
        "verifyingContract": WALLET_ADDRESS,
    },
    "primaryType": "Kernel",
    "message": {"hash": "0x" + original_hash.hex()},
}
```

### Step 3 — Sign with bankr and prepend type byte

```bash
bankr wallet sign --type eth_signTypedData_v4 --typed-data '<kernel_td_json>'
# returns: 0x<130 hex chars>
```

Return value to Definitive: `"0x00" + raw_sig[2:]` (66 bytes total).

## Cancel Signatures

The cancel endpoint uses the same `isValidSignature` check but with a **personal_sign** message rather than typed data. Apply the same wrapper:

1. Compute `personal_hash = keccak256("\x19Ethereum Signed Message:\n{len}{msg}")` — use `eth_account.messages.encode_defunct` + a dummy sign to get the hash.
2. Build the same `Kernel(bytes32 hash)` typed data substituting `personal_hash`.
3. Sign with bankr and return `"0x00" + sig[2:]`.

Without this, the cancel endpoint returns `404 NOT_FOUND` (Definitive hides the order when auth fails rather than returning 401/403).

## Verifying On-Chain

You can confirm a signature is valid before submitting:

```bash
# isValidSignature(bytes32,bytes) selector = 0x1626ba7e
cast call <WALLET> "isValidSignature(bytes32,bytes)(bytes4)" <HASH> <SIG> --rpc-url https://mainnet.base.org
# Expected: 0x1626ba7e
```

## Version Discovery

The deployed Kernel version can differ from the GitHub `main` branch. Always confirm with:

```bash
cast call <WALLET> "accountId()(string)" --rpc-url https://mainnet.base.org
# e.g. "kernel.advanced.v0.3.3"
```

Use the version string after `v` (e.g. `0.3.3`) in the domain.
