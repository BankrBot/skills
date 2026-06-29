# treasury-monitor

**Luca Skills by Zetta** — Callable financial intelligence for the agent economy.

## What it does

Returns live stablecoin balances and a treasury health signal for an agent's declared wallets, or for a single address. Works with or without an agent slug — pass a wallet address directly for a quick balance check on any address.

## Endpoint

```
POST https://www.zettaai.co/api/luca/skills/treasury-monitor
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

Pass either `slug` or `address`. At least one is required.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | Conditional | Agent slug. Returns all manifest-declared wallets. |
| `address` | string | Conditional | Single 0x address. Returns one wallet row. |

If both are provided, `slug` takes precedence.

## Output — by slug

```json
{
  "skill": "treasury-monitor",
  "source": "slug",
  "agent": { "name": "AEON", "slug": "aeon", "ecosystem": "AEON" },
  "wallets": [
    {
      "address": "0x...",
      "label": "Treasury",
      "role": "treasury",
      "address_type": "treasury_contract",
      "evidence_source": "manifest",
      "books_eligible": true,
      "books_ineligibility_reason": null,
      "stable_balance_usd": 42500.00,
      "health": "healthy",
      "chain": "base"
    }
  ],
  "total_stable_balance_usd": 42500.00,
  "health": "healthy",
  "note": null,
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

## Output — by address

```json
{
  "skill": "treasury-monitor",
  "source": "address",
  "agent": null,
  "wallets": [
    {
      "address": "0x...",
      "address_type": "eoa",
      "stable_balance_usd": 1200.00,
      "health": "low",
      "chain": "base"
    }
  ],
  "total_stable_balance_usd": 1200.00,
  "health": "low",
  "generated_at": "2026-06-23T00:00:00.000Z"
}
```

### Health signal

| Signal | Threshold |
|--------|-----------|
| `healthy` | ≥ $10,000 USDC+USDT |
| `low` | ≥ $1,000, < $10,000 |
| `critical` | < $1,000 |
| `unknown` | No manifest wallets |

## Integrity rules

- Balance is USDC + USDT on Base only
- When called by slug: only manifest-declared, books-eligible wallets are shown by default. If no eligible wallets exist, all wallets are shown with a note
- `books_eligible: false` wallets are shown in the response but their balance does not count toward the agent's attributed treasury in books

## Example

```bash
# By agent slug
curl -X POST https://www.zettaai.co/api/luca/skills/treasury-monitor \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"slug": "aeon"}'

# By single address
curl -X POST https://www.zettaai.co/api/luca/skills/treasury-monitor \
  -H "Authorization: Bearer zt_live_..." \
  -H "Content-Type: application/json" \
  -d '{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"}'
```

## Usage notes

- Balances are live — fetched from Alchemy at request time, not cached
- `health: "unknown"` means the agent has no manifest-declared wallets, not that the agent is insolvent
- Use this alongside `revenue-analysis` to calculate runway: `total_stable_balance_usd ÷ monthly_burn_rate`

## Limitations

- USDC and USDT on Base only — does not include ETH, WETH, or tokens
- No historical balance data — point-in-time only
- Base chain only
