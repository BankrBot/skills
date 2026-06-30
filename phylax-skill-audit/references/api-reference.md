# Phylax API Reference

## Hosted audit endpoint

```
POST https://usephylax.com/api/audit
Content-Type: application/json
```

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `skill_source` | string | yes | GitHub-style path or HTTPS URL to SKILL.md |
| `skill_md` | string | no | Raw SKILL.md content (skips remote fetch) |
| `contracts` | string[] | no | `0x... (chainId:8453)` — auto-extracted if omitted |
| `endpoints` | string[] | no | HTTPS URLs — auto-extracted if omitted |
| `chain_id` | number | no | Default `8453` (Base) |
| `mode` | string | no | `fast` (default) or `deep` |

### Response

```jsonc
{
  "skill": "github.com/owner/repo/SKILL.md",
  "verdict": "ALLOW",       // ALLOW | WARN | DENY
  "score": 97,              // 0–100
  "findings": [
    { "id": "PI-001", "severity": "Critical", "message": "...", "evidence": "..." }
  ],
  "summary": "One-paragraph human summary.",
  "ttl": "24h"
}
```

Rate limit: 20 requests/min per IP.

`GET https://usephylax.com/api/audit` returns self-describing usage docs.

## Verdict badge

```
GET https://usephylax.com/api/badge?skill=owner/repo&mode=fast
```

Returns SVG: `phylax | ALLOW 97`

## Security (v0.2.2+)

- Blocks SSRF targets (localhost, private IPs, cloud metadata)
- Requires HTTPS for remote fetches in production
- Rejects local file paths as `skill_source` on hosted API
- Validates redirect chains on endpoint probes

## npm / CLI

```bash
npx phylax@0.2.2 --skill ./SKILL.md
npx phylax@0.2.2 --skill ./SKILL.md --mode deep
```

Exit codes: `0` = ALLOW, `1` = WARN, `2` = DENY
