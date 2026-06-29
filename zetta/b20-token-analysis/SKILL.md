# b20-token-analysis

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Analyses a B20 token on Base: identity, issuer wallet, linked agent, manifest attribution status, mint/burn activity, and a Luca narrative read. Enforces strict data integrity — token transfers are not revenue, token contracts are not operator wallets, and B20 activity is excluded from Agent GDP.

Use this to understand a token's on-chain provenance and its relationship to an agent's financial identity, without conflating token activity with operating revenue.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/b20-token-analysis
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
| `address` | string | Yes | Token contract address (0x...) |
| `agent_slug` | string | No | Optional agent slug to correlate with |
| `period` | string | No | Activity period label (informational only, does not filter data) |

## Output

```json
{
  "skill": "b20-token-analysis",
  "token": {
    "address": "0x...",
    "name": "AEON Token",
    "symbol": "AEON",
    "decimals": 18,
    "total_supply": "1000000000000000000000000",
    "chain": "base",
    "deployed_block": 12345678,
    "issuer_wallet": "0x...",
    "owner_wallet": "0x...",
    "books_eligible": false,
    "books_eligible_note": "Token contracts are never books-eligible"
  },
  "linked_agent": {
    "name": "AEON",
    "slug": "aeon",
    "link_method": "known_token",
    "link_confidence": "confirmed",
    "note": null
  },
  "manifest_status": "attributed",
  "manifest_note": "Issuer wallet is manifest-attributed",
  "activity": {
    "mint_count": 12,
    "burn_count": 3,
    "mint_volume_raw": "50000000000000000000000",
    "burn_volume_raw": "1000000000000000000000",
    "recent_mints": [...],
    "recent_burns": [...],
    "last_activity_at": "2026-06-20T14:22:00.000Z"
  },
  "luca_read": "AEON Token (AEON) is a confirmed B20 asset linked to AEON via registry. 12 mint events and 3 burn events detected. Issuer wallet is manifest-attributed. Financial books require separate wallet attribution.",
  "limitations": [
    "Token transfers are not operating revenue",
    "Token contract is not an operator wallet",
    "Issuer wallet (0x...) is not books-eligible unless declared in agent manifest",
    "B20 activity is not included in Agent GDP",
    "Holder concentration analysis requires a full transfer scan — not available in this endpoint"
  ],
  "data_integrity_warnings": [
    "gross_inflow_usd from token transfers ≠ operating revenue",
    "Do not count B20 mint events as agent revenue",
    "Token issuance is a financial event but not a revenue event"
  ],
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

### `manifest_status` values

| Value | Meaning |
|-------|---------|
| `attributed` | Issuer wallet is manifest-declared and confirmed |
| `candidate` | Issuer wallet matches a registry agent but manifest is not submitted |
| `none` | No agent link found |

### `link_method` values

| Value | Meaning |
|-------|---------|
| `known_token` | Token is declared in the agent's registry entry |
| `manifest` | Linked via `.agent/wallets.json` declaration |
| `erc8004` | Linked via ERC-8004 identity record |
| `admin` | Manually linked by Zetta admin |
| `none` | No confirmed link |

## Integrity rules

- `books_eligible: false` is hardcoded — token contracts are **never** books-eligible, regardless of manifest
- Token transfers (mint, burn, transfer events) are **not** operating revenue
- The issuer wallet is **not** automatically attributed — it must be declared in `.agent/wallets.json` to produce books
- B20 activity does not enter Agent GDP calculations
- `manifest_status: "attributed"` only applies to the token's agent link — not to the token contract itself

## Example

```bash
curl -X POST https://www.zettaai.co/api/luca/skills/b20-token-analysis \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"address": "0xb2b335f832fd3f43461ebd1cd9831d93d9ca4ba3"}'
```

## Usage notes

- If the token is already indexed in the Zetta B20 database, cached identity is used and only activity is fetched live — faster response
- If not indexed, a live Alchemy lookup is performed — slightly higher latency
- `luca_read` is a data-derived narrative — not a generative AI response
- `data_integrity_warnings` and `limitations` are always present — they are not error states

## Limitations

- Base chain only
- Activity scan covers recent mint/burn events; full historical activity requires a separate scan
- Holder distribution and concentration data are not available in this endpoint
- Token price data is not included
