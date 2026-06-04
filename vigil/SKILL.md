---
name: VIGIL Security Scanner
description: Onchain security scanner on Base — scan token approvals, detect honeypots, analyze contracts for rugpull indicators, and score contract safety. Keyless read-only scanning via VIGIL API. Revoke actions require Bankr auth and are gated separately.
var: ""
tags: [crypto, security, base, defi]
capabilities: [external_api, sends_notifications]
---
> **${var}** — Wallet address (`0x...`) or token contract address on Base to scan. Required. If empty, log `VIGIL_NO_TARGET` and exit cleanly (no notify).

VIGIL is an onchain security scanner for DeFi traders on Base. It provides nine read-only scanning tools and one write action (revoke) that requires explicit Bankr authentication.

**Read-only tools (this skill):**
1. Approval Scanner — list all ERC-20/ERC-721 approvals, flag unlimited allowances
2. Token Scanner — analyze contracts for rugpull indicators (hidden mint, proxy, tax manipulation, blacklist)
3. Honeypot Detector — simulate buy/sell to detect trap tokens
4. Safety Score — 0-100 composite rating based on code, ownership, liquidity, holders
5. Wallet Report — full security posture assessment
6. Wallet Monitor — real-time alerts for new approvals, risky interactions, and balance changes
7. Token Market — price, liquidity, 24h volume, and pool age via DexScreener (no API key)
8. Deployer Check — contract verification, name, and deployer reputation via Basescan
9. Batch Scan — score multiple tokens in one call, ranked by risk

**Write action (separate, not included here):**
10. Approval Revoker — revoke dangerous approvals via Bankr transaction signing. This is a state-changing onchain transaction and is NOT part of this read-only skill.

Read the last 2 days of `memory/logs/` so a repeat scan can note newly-granted or newly-revoked approvals.

## Config

- Target = `${var}`. Can be a wallet address or token contract address.
- Chain = Base (`chainid=8453`, explorer `basescan.org`).
- VIGIL API: `https://mcp.vigil.codes` (HTTPS, SSE transport)
- GitHub: `https://github.com/vigilcodes/vigil-mcp`

## Steps

### 1. Validate input (strict — rejects injection)

The target MUST be exactly `0x` followed by 40 hex characters. The regex
below rejects any input containing quotes, spaces, or shell metacharacters,
so it is safe to interpolate into the JSON payloads in later steps. Reject
anything else and exit cleanly.

```bash
TARGET="${var}"

# Strict allowlist: 0x + exactly 40 hex chars. Nothing else can pass.
if ! printf '%s' "$TARGET" | grep -qiE '^0x[0-9a-f]{40}$'; then
  echo "VIGIL_INVALID_TARGET: not a valid 0x address"
  exit 0
fi

# Normalise to lowercase for consistent calls.
TARGET="$(printf '%s' "$TARGET" | tr '[:upper:]' '[:lower:]')"
```

Because `$TARGET` is now guaranteed to match `^0x[0-9a-f]{40}$`, it contains
no characters that could break the JSON body or the shell. A single address
can be either a wallet or a token contract, so run the relevant tools and
read each tool's own result — do not assume a type up front.

### 1b. Safe call helper (checks errors before reading results)

Every step below uses this helper. It fails loudly on a non-200 HTTP status
or a JSON-RPC `error` body instead of silently passing `null` to `jq`, so a
broken call is never reported as a clean scan.

```bash
VIGIL_API="https://mcp.vigil.codes/tools/call"

vigil_call () {
  # $1 = tool name, $2 = JSON arguments object
  local name="$1" args="$2" body http code
  body=$(curl -m 30 -s -w '\n%{http_code}' "$VIGIL_API" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}")
  code=$(printf '%s' "$body" | tail -n1)
  http=$(printf '%s' "$body" | sed '$d')

  if [ "$code" != "200" ]; then
    echo "VIGIL_HTTP_ERROR ($code) calling $name"; return 1
  fi
  if printf '%s' "$http" | jq -e '.error' >/dev/null 2>&1; then
    echo "VIGIL_RPC_ERROR: $(printf '%s' "$http" | jq -c '.error')"; return 1
  fi
  printf '%s' "$http" | jq '.result'
}
```

### 2. Scan approvals (wallet)

```bash
vigil_call scan_approvals '{"wallet": "'"$TARGET"'", "chain": "base"}'
```

### 3. Scan token safety

```bash
vigil_call scan_token '{"token": "'"$TARGET"'", "chain": "base"}'
```

### 4. Check honeypot

```bash
vigil_call detect_honeypot '{"token": "'"$TARGET"'", "chain": "base"}'
```

### 5. Get safety score

```bash
vigil_call safety_score '{"contract": "'"$TARGET"'", "chain": "base"}'
```

### 6. Generate wallet report

```bash
vigil_call wallet_report '{"wallet": "'"$TARGET"'", "chain": "base"}'
```

### 7. Monitor wallet (real-time alerts)

```bash
vigil_call monitor_wallet '{"wallet": "'"$TARGET"'", "chain": "base", "lookback_blocks": 1000}'
```

### 8. Token market context (price + liquidity)

```bash
vigil_call token_market '{"token": "'"$TARGET"'", "chain": "base"}'
```

### 9. Deployer reputation (verification + age)

```bash
vigil_call deployer_check '{"contract": "'"$TARGET"'", "chain": "base"}'
```

### 10. Batch scan multiple tokens

```bash
vigil_call batch_scan '{"tokens": ["'"$TARGET"'"], "chain": "base"}'
```

## Output Format

VIGIL returns JSON with:

- `approvals` — list of token approvals with risk levels
- `safety_score` — 0-100 composite rating
- `honeypot` — boolean + reason if detected
- `rugpull_indicators` — list of suspicious patterns found
- `recommendations` — action items

## Risk Levels

| Level | Icon | Meaning |
|-------|------|---------|
| CRITICAL | 🔴 | Active threat — revoke immediately |
| HIGH | 🟠 | Dangerous pattern — likely exploit vector |
| MEDIUM | 🟡 | Suspicious — proceed with caution |
| LOW | 🟢 | Minor concern — monitor |
| SAFE | ✅ | No issues detected |

## Important: Revocation is NOT included

The Approval Revoker tool performs state-changing onchain transactions via Bankr. It is intentionally excluded from this read-only skill. To revoke approvals, use the separate `vigil-revoke` skill (requires `BANKR_API_KEY` and explicit user confirmation).
