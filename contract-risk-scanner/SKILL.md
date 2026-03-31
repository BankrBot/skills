---
name: contract-risk-scanner
description: Pre-trade smart contract risk scanner for AI agents. Use when users ask whether a token or contract is safe, request honeypot checks, ownership privilege analysis, upgradeability risk, transfer restrictions, tax or fee behavior, blacklist or whitelist controls, or a go/no-go safety recommendation before buying or swapping. Triggers on phrases like "is this token safe", "check this CA", "honeypot scan", "rug check", "safe to buy", "contract audit", "token risk", or any contract address mentioned before a swap.
metadata:
  {
    "clawdbot":
      {
        "emoji": "🛡️",
        "homepage": "https://gopluslabs.io"
      }
  }
---

# Contract Risk Scanner

Contract Risk Scanner helps agents analyze token and smart contract safety before executing onchain actions.
It uses **GoPlus Security API** (free, no API key) + **DexScreener** to return a clear recommendation: GO, CAUTION, or AVOID.

Use this skill as a safety gate **before** any swap or buy. Pair with Bankr for execution after risk is assessed.

```
Contract Risk Scanner (Research)     Bankr (Execute)
────────────────────────────────  →  ─────────────────
Honeypot detection               →  Block or allow swap
Ownership privilege scan         →  Enforce max size limit
Transfer tax analysis            →  Adjust slippage setting
Liquidity lock/burn status       →  Set minimum liq threshold
Simulated buy/sell result        →  GO / CAUTION / AVOID gate
```

## Quick Start

No API key required. All checks run against free public endpoints.

```bash
# Install helper scripts
chmod +x scripts/*.sh

# Full risk scan of a token on Base
./scripts/scan.sh base 0x4200000000000000000000000000000000000006

# Quick honeypot-only check
./scripts/honeypot.sh base 0x4200000000000000000000000000000000000006

# Liquidity + LP lock status
./scripts/liquidity.sh base 0x4200000000000000000000000000000000000006
```

## Data Sources

| Source | API | Coverage | Auth |
|--------|-----|----------|------|
| GoPlus Security | `https://api.gopluslabs.io/api/v1` | Honeypot, ownership, tax, blacklist, proxy, mint | None (free) |
| DexScreener | `https://api.dexscreener.com/latest/dex` | LP status, liquidity depth, volume, age | None (free) |
| Basescan / Etherscan | `https://api.basescan.org/api` | Contract verification, ABI | Optional API key |

## Core Checks

### 1) Honeypot and Transfer Safety

```bash
# GoPlus token security endpoint
curl -s "https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xTOKEN" | jq .
```

Key fields from response:
- `is_honeypot`: `"1"` = cannot sell (critical)
- `buy_tax` / `sell_tax`: e.g. `"0.05"` = 5% tax
- `cannot_sell_all`: `"1"` = cannot sell full balance
- `transfer_pausable`: `"1"` = owner can pause all transfers
- `slippage_modifiable`: `"1"` = owner can change tax at will

### 2) Ownership and Privilege Risk

```bash
curl -s "https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xTOKEN" \
  | jq '{owner: .result."0xtoken".owner_address, renounced: .result."0xtoken".owner_change_balance}'
```

Key fields:
- `owner_address`: current owner (empty = renounced)
- `owner_change_balance`: `"1"` = owner can change balances
- `can_take_back_ownership`: `"1"` = ownership can be reclaimed
- `hidden_owner`: `"1"` = obscured privileged address
- `is_mintable`: `"1"` = owner can mint unlimited supply

### 3) Upgradeability and Proxy Risk

Key fields:
- `is_proxy`: `"1"` = proxy contract (implementation can change)
- `is_open_source`: `"0"` = not verified on-chain (treat as opaque)
- `external_call`: `"1"` = makes external calls that could be weaponized

### 4) Liquidity and Market Risk

```bash
# DexScreener: LP status, TVL, age, top pair
curl -s "https://api.dexscreener.com/latest/dex/tokens/0xTOKEN" \
  | jq '.pairs[0] | {dex: .dexId, liquidity: .liquidity.usd, age_hrs: .pairCreatedAt, fdv: .fdv}'
```

Key signals:
- `liquidity.usd` < $10,000 = dangerously thin
- `pairCreatedAt` < 24h ago = very new, high risk
- `priceChange.h24` > ±90% = extreme volatility
- Low volume / high FDV ratio = potential manipulation

```bash
# GoPlus: LP lock check
curl -s "https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xTOKEN" \
  | jq '{lp_locked: .result."0xtoken".lp_locked_percent, lp_burned: .result."0xtoken".lp_holder_analysis}'
```

### 5) Holder Concentration Risk

```bash
curl -s "https://api.gopluslabs.io/api/v1/token_security/8453?contract_addresses=0xTOKEN" \
  | jq '.result."0xtoken".holders | sort_by(-.percent) | .[0:5]'
```

Flag if top holder > 20% of supply or top 5 combined > 50%.

## Chain IDs for GoPlus

| Chain | Chain ID in GoPlus |
|-------|-------------------|
| Ethereum | `1` |
| Base | `8453` |
| Polygon | `137` |
| BSC | `56` |
| Arbitrum | `42161` |
| Solana | Use `/solana_security` endpoint |

## Output Format

Always return a structured report:

```
CONTRACT RISK REPORT
────────────────────
Token:        0x...
Chain:        Base
Risk Score:   72 / 100  (higher = riskier)
Severity:     HIGH
Confidence:   MEDIUM (unverified contract)

FINDINGS (most critical first):
1. [CRITICAL] Honeypot detected — cannot sell: is_honeypot = 1
2. [HIGH]     Owner can modify sell tax: slippage_modifiable = 1
3. [HIGH]     Liquidity only $4,200 USD — extremely thin
4. [MEDIUM]   Token created 3 hours ago
5. [LOW]      Top holder controls 18% of supply

RECOMMENDATION: AVOID
─────────────────────
Do not execute swap. Honeypot confirmed.

SUGGESTED LIMITS (if overriding to CAUTION):
  Max position:    $50
  Max slippage:    25%
  Min liquidity:   $10,000
```

## Risk Scoring Matrix

| Finding | Score Impact |
|---------|-------------|
| `is_honeypot = 1` | +60 (auto AVOID) |
| `cannot_sell_all = 1` | +40 |
| `transfer_pausable = 1` | +30 |
| `is_mintable = 1` + non-renounced | +25 |
| `slippage_modifiable = 1` | +20 |
| `hidden_owner = 1` | +20 |
| `is_proxy = 1` + non-open-source | +15 |
| `is_open_source = 0` | +15 |
| Liquidity < $10k | +20 |
| Token age < 24h | +15 |
| Top holder > 20% | +10 |

**Thresholds:**
- 0–29 → GO
- 30–59 → CAUTION
- 60+ → AVOID

## Prompt Examples

- Scan this contract before I buy: 0x... on Base
- Is this token a honeypot? 0x... on Ethereum
- Run a full risk report on this CA before I swap 200 USDC
- Give me a GO or AVOID decision for this token: 0x...
- Check ownership risks for this contract on Polygon
- Is the liquidity locked? 0x... on Base

## Safety Rules

- Never claim absolute safety — even GO score has residual risk.
- Always state confidence level (low if contract unverified, data incomplete).
- If `is_honeypot = 1`: output AVOID immediately, do not continue analysis.
- If key GoPlus fields return null: set confidence to LOW, escalate risk score by +15.
- Never suggest bypassing slippage protections or chain safeguards.
- All user-provided contract addresses must match valid EVM format (`0x` + 40 hex chars) before calling any API.

## Integration with Bankr

After scanning, pass result to Bankr for execution gating:

```bash
# 1. Run scan
RESULT=$(./scripts/scan.sh base 0xTOKEN)
RECOMMENDATION=$(echo "$RESULT" | grep "RECOMMENDATION:" | awk '{print $2}')

# 2. Gate execution
if [ "$RECOMMENDATION" = "AVOID" ]; then
  echo "Swap blocked: contract failed risk scan."
  exit 1
elif [ "$RECOMMENDATION" = "CAUTION" ]; then
  bankr agent prompt "Buy max $50 of 0xTOKEN on Base with 25% slippage"
else
  bankr agent prompt "Buy $200 of 0xTOKEN on Base"
fi
```

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| GoPlus returns `{code: 1}` | Invalid address or unsupported chain | Validate address format, confirm chain ID |
| All fields null | Contract not indexed by GoPlus | Set confidence LOW, use Basescan fallback |
| DexScreener `pairs: []` | No DEX pair found | Flag as no liquidity — AVOID |
| `is_open_source: "0"` | Unverified contract | Elevate risk +15, note in report |
| Network timeout | API unreachable | Retry once, then return partial report with missing fields listed |

## Resources

- GoPlus Security API: https://docs.gopluslabs.io
- GoPlus Token Security: https://api.gopluslabs.io/api/v1/token_security/{chainId}?contract_addresses={address}
- DexScreener API: https://docs.dexscreener.com
- Basescan API: https://docs.basescan.org/api-endpoints/contracts
- GoPlus supported chains: https://docs.gopluslabs.io/reference/supported-chains
