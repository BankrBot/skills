# AffixIO × Bankr x402 Cloud

## Action strings

| Action | Use before |
| --- | --- |
| `bankr.x402.deploy` | `bankr x402 deploy` |
| `bankr.x402.call` | `bankr x402 call` / paid fetch |
| `bankr.x402.env.set` | Setting secrets that enable paid handlers |
| `bankr.x402.configure` | Price / schema changes that affect settlement |

## Fail closed

If attestation returns no `proofId`, throws, or `gate_tool_call` denies, do not proceed with deploy or payment.

## Privacy

Hash or summarize request bodies. Do not send API keys, wallet private keys, or PII to AffixIO.
