# GoPlus Security API Reference

Base URL: `https://api.gopluslabs.io/api/v1`
Auth: None required (free, rate-limited by IP)
Docs: https://docs.gopluslabs.io

## Token Security Endpoint

```
GET /token_security/{chain_id}?contract_addresses={address}
```

### Supported Chain IDs

| Chain | ID |
|-------|-----|
| Ethereum | 1 |
| BSC | 56 |
| Polygon | 137 |
| Arbitrum | 42161 |
| Base | 8453 |
| Solana | use `/solana_security` |

### Key Response Fields

| Field | Type | Meaning |
|-------|------|---------|
| `is_honeypot` | "0"/"1" | "1" = cannot sell token |
| `buy_tax` | "0.05" | 5% tax on buy |
| `sell_tax` | "0.10" | 10% tax on sell |
| `cannot_sell_all` | "0"/"1" | "1" = cannot sell entire balance |
| `transfer_pausable` | "0"/"1" | "1" = owner can freeze all transfers |
| `slippage_modifiable` | "0"/"1" | "1" = owner can change tax anytime |
| `is_mintable` | "0"/"1" | "1" = unlimited mint possible |
| `owner_address` | string | Current owner (empty = renounced) |
| `can_take_back_ownership` | "0"/"1" | "1" = ownership can be reclaimed |
| `hidden_owner` | "0"/"1" | "1" = obscured privileged address exists |
| `is_proxy` | "0"/"1" | "1" = upgradeable proxy contract |
| `is_open_source` | "0"/"1" | "0" = unverified bytecode |
| `external_call` | "0"/"1" | "1" = contract calls external addresses |
| `lp_locked_percent` | "80.5" | % of LP tokens locked |
| `lp_holder_analysis` | array | LP holder details |
| `holders` | array | Top token holders with percent |

### Example Request

```bash
curl -s "https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0x4200000000000000000000000000000000000006" | jq .
```

### Example Response (abbreviated)

```json
{
  "code": 1,
  "result": {
    "0x4200000000000000000000000000000000000006": {
      "is_honeypot": "0",
      "buy_tax": "0",
      "sell_tax": "0",
      "is_mintable": "0",
      "owner_address": "",
      "is_open_source": "1",
      "is_proxy": "0",
      "lp_locked_percent": "100",
      "holders": [
        { "address": "0x...", "percent": "0.15", "is_locked": 0 }
      ]
    }
  }
}
```

### Rate Limits

- ~30 req/min per IP (unauthenticated)
- Register at https://platform.gopluslabs.io for higher limits

## Solana Token Security

```
GET /solana_security?contract_addresses={mint_address}
```

Same field structure as EVM endpoint.
