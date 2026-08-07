# wallet-audit

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Classifies an on-chain address on Base and determines whether it is books-compatible for financial attribution. Returns the address type, books eligibility, and a stablecoin balance when the address is eligible.

Use this before submitting a wallet to an agent manifest — it tells you whether that address type qualifies for financial books.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/wallet-audit
```

## Auth

```
Authorization: Bearer zt_live_...
```
or
```
X-API-Key: zt_live_...
```

Get a key at [zettaai.co/developer](https://www.zettaai.co/developer).

## Input

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | string | Yes | 0x Ethereum address to audit (42 chars) |
| `chain` | string | No | Chain name. Default: `"base"`. Only Base is supported. |

## Output

```json
{
  "skill": "wallet-audit",
  "address": "0x...",
  "chain": "base",
  "address_type": "eoa",
  "books_compatible": true,
  "books_compatible_note": "This address type is eligible for books attribution when declared in the agent manifest",
  "stable_balance_usd": 4250.00,
  "notes": [
    "eoa wallets are books-compatible — declare this address in your agent manifest (evidenceSource: manifest) to enable financial attribution"
  ],
  "classified_at": "2026-06-23T00:00:00.000Z"
}
```

### `address_type` values

| Value | Books-compatible | Description |
|-------|-----------------|-------------|
| `eoa` | Yes | Externally owned account |
| `treasury_contract` | Yes | Gnosis Safe or equivalent multisig |
| `token_contract` | **No** | ERC-20 / ERC-721 / ERC-1155 |
| `smart_contract` | **No** | General smart contract |
| `proxy_contract` | **No** | Upgradeable proxy |
| `vault` | **No** | DeFi vault |
| `unknown` | **No** | Unclassifiable |

## Integrity rules

- Discovered wallets are not automatically books-eligible — they must be declared in `.agent/wallets.json`
- Token contracts are excluded regardless of manifest declaration
- Smart contracts and proxy contracts are not books-eligible even if declared
- Only `eoa` and `treasury_contract` types produce attributed financial books

## Example

```bash
curl -X POST https://www.zettaai.co/api/luca/skills/wallet-audit \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

## Usage notes

- `stable_balance_usd` is only populated when `books_compatible: true`
- Use this skill before running `agent-books` to confirm a wallet will produce attributed books
- A `true` result here means the address *type* qualifies — the wallet must also be manifest-declared for books to run

## Limitations

- Base chain only
- Does not verify whether the wallet is already in a manifest — use `registry-check` for that
- Balance is USDC + USDT on Base only; ETH and other assets are not included in the balance figure
