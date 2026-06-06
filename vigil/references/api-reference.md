# VIGIL API Reference

Base URL: `https://api.bankr.bot/vigil`

Authentication: `Authorization: Bearer <BANKR_API_KEY>` (for write operations)

## Endpoints

### GET /approvals
List all token approvals for a wallet.

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| wallet | address | Yes | Wallet address |
| chain | string | No | base, ethereum, polygon, arbitrum (default: base) |
| risk | string | No | Filter: critical, high, medium, low |

**Response:**
```json
{
  "approvals": [
    {
      "token_address": "0x...",
      "token_symbol": "USDC",
      "token_name": "USD Coin",
      "spender_address": "0x...",
      "spender_name": "Uniswap V3 Router",
      "amount": "unlimited",
      "amount_usd": 15000.00,
      "risk": "critical",
      "approved_at": "2026-01-15T10:30:00Z",
      "last_used": "2026-05-20T14:22:00Z"
    }
  ],
  "total": 12,
  "summary": {
    "critical": 2,
    "high": 3,
    "medium": 4,
    "low": 3
  }
}
```

---

### GET /token/scan
Scan a token contract for rugpull/honeypot indicators.

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| address | address | Yes | Token contract address |
| chain | string | No | Chain (default: base) |

**Response:**
```json
{
  "token_name": "SafeMoon2",
  "token_symbol": "SMOON2",
  "safety_score": 23,
  "risk_level": "critical",
  "findings": [
    {
      "severity": "critical",
      "category": "ownership",
      "message": "Owner can mint unlimited tokens"
    },
    {
      "severity": "high",
      "category": "liquidity",
      "message": "Liquidity not locked — removable at any time"
    }
  ],
  "contract": {
    "owner": "0x...",
    "is_proxy": true,
    "verified": false,
    "ownership_renounced": false
  },
  "liquidity": {
    "total_locked_usd": 0,
    "lock_duration": "none",
    "lp_holders": 1
  },
  "holders": {
    "top10_percentage": 95.2,
    "total": 47,
    "whales": 3
  },
  "tax": {
    "buy": 5,
    "sell": 15,
    "modifiable": true
  },
  "honeypot": {
    "detected": false,
    "reason": null
  },
  "recommendation": "DO NOT BUY — Owner has unrestricted minting power and liquidity is unlocked"
}
```

---

### GET /token/honeypot
Dedicated honeypot detection via buy/sell simulation.

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| address | address | Yes | Token address |
| chain | string | No | Chain (default: base) |

**Response:**
```json
{
  "is_honeypot": true,
  "can_buy": true,
  "can_sell": false,
  "buy_tax": 5,
  "sell_tax": 99,
  "block_reason": "Transfer function contains blacklist check that blocks sells from non-whitelisted addresses",
  "simulations": [
    {"action": "buy_0.1_eth", "success": true, "gas_used": 185000},
    {"action": "sell_100%", "success": false, "gas_used": 0, "error": "execution reverted: blacklisted"}
  ],
  "high_tax_warning": false
}
```

---

### GET /score
Get safety score for a contract.

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| address | address | Yes | Contract address |
| chain | string | No | Chain (default: base) |

**Response:**
```json
{
  "score": 72,
  "risk_level": "medium",
  "breakdown": [
    {"category": "Code Quality", "score": 85, "note": "Verified, no critical bugs"},
    {"category": "Ownership", "score": 60, "note": "Owner has some privileges"},
    {"category": "Liquidity", "score": 80, "note": "80% locked for 6 months"},
    {"category": "Distribution", "score": 65, "note": "Top 10 hold 45%"},
    {"category": "History", "score": 70, "note": "Deployer has 2 prior contracts"}
  ],
  "risk_factors": [
    "Owner can adjust tax up to 25%",
    "Proxy contract — implementation can be changed"
  ],
  "positive_factors": [
    "Liquidity locked for 6 months",
    "Contract verified on explorer",
    "No mint function"
  ],
  "recommendation": "MODERATE RISK — Proceed with small position size only"
}
```

---

### GET /report
Full wallet security report.

**Params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| wallet | address | Yes | Wallet address |
| chain | string | No | Chain (default: base) |

---

### POST /revoke/build
Build unsigned revocation transaction.

**Body:**
```json
{
  "token": "0x...",
  "spender": "0x...",
  "chain": "base"
}
```

---

### POST /revoke/submit
Sign and submit revocation via Bankr.

**Body:**
```json
{
  "unsigned_tx": "0x...",
  "chain": "base"
}
```

---

### POST /report/submit
Submit a scam report to the community database.

**Body:**
```json
{
  "token": "0x...",
  "evidence_type": "honeypot|rugpull|phishing|scam|fake",
  "description": "Brief description of the scam",
  "chain": "base"
}
```

## Rate Limits

| Tier | Requests/min | Scans/day |
|------|-------------|-----------|
| Free | 10 | 5 |
| Scout (100+ $VIGIL) | 50 | 50 |
| Guardian (500+ $VIGIL) | 200 | 200 |
| Sentinel (1000+ $VIGIL) | 1000 | Unlimited |
| Archon (5000+ $VIGIL) | Unlimited | Unlimited |

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Invalid parameters |
| 401 | Invalid or missing API key |
| 403 | Tier quota exceeded |
| 404 | Token/wallet not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
