# registry-check

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Looks up an agent in the Zetta registry by slug, name fragment, or wallet address. Returns the agent's attribution tier, books-eligible wallet count, ERC-8004 identity if available, and the full wallet list with per-wallet eligibility status.

Use this to check whether an agent is registered before running financial skills, or to find the correct slug when you only know a name or address.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/registry-check
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
| `query` | string | Yes | Agent slug, name fragment, or 0x wallet address |

Match priority: exact slug → exact wallet address → name substring.

## Output — found

```json
{
  "skill": "registry-check",
  "found": true,
  "query": "aeon",
  "match_type": "slug",
  "agent": {
    "name": "AEON",
    "slug": "aeon",
    "ecosystem": "AEON",
    "verification_status": "verified",
    "evidence_sources": ["manifest", "x_handle"],
    "erc8004_agent_id": "0x...",
    "erc8004_did": "did:ethr:base:0x...",
    "attribution_tier": "manifest_attributed",
    "books_eligible_wallets": 2,
    "total_wallets": 5,
    "wallets": [
      {
        "address": "0x...",
        "label": "Treasury",
        "role": "treasury",
        "address_type": "treasury_contract",
        "evidence_source": "manifest",
        "books_eligible": true,
        "books_ineligibility_reason": null,
        "chain": "base"
      },
      {
        "address": "0x...",
        "label": "Token",
        "role": "token_contract",
        "address_type": "token_contract",
        "evidence_source": "manifest",
        "books_eligible": false,
        "books_ineligibility_reason": "address_type=token_contract is not books-eligible",
        "chain": "base"
      }
    ]
  },
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Output — not found

```json
{
  "skill": "registry-check",
  "found": false,
  "query": "unknownagent",
  "agent": null,
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

### `attribution_tier` values

| Value | Meaning |
|-------|---------|
| `manifest_attributed` | Has manifest-declared books-eligible wallets — books are running |
| `discovered` | Wallets in registry but none manifest-declared — books require manifest submission |
| `unattributed` | No wallets at all |

### ERC-8004 fields

`erc8004_agent_id` and `erc8004_did` are **identity fields only** — they are never used for financial attribution. An agent with an ERC-8004 identity still requires a manifest-declared `eoa` or `treasury_contract` wallet to produce financial books.

## Example

```bash
# By slug
curl -X POST https://www.zettaai.co/api/luca/skills/registry-check \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"query": "aeon"}'

# By wallet address
curl -X POST https://www.zettaai.co/api/luca/skills/registry-check \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"query": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

## Usage notes

- This is the recommended first call before `agent-books`, `treasury-monitor`, or `revenue-analysis`
- `found: false` means the agent is not in the Zetta registry — not that they have no wallets on-chain
- `match_type: "name"` uses substring match and may return the closest match, not an exact one

## Limitations

- Name matching is case-insensitive substring — not fuzzy. Typos will not resolve.
- Returns only the first match for name queries — if multiple agents share a name fragment, the result is the first alphabetically
