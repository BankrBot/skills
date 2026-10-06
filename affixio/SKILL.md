---
name: affixio
version: 1.0.0
description: Host-side AffixIO attestation before Bankr x402 Cloud deploys and paid calls. Prove the device/action on-host with a signed allow/deny before `bankr x402 deploy`, `bankr x402 call`, or any USDC spend on Base. PII and raw credentials never leave the host.
homepage: https://github.com/AffixIO/affixio-mcp
metadata:
  bankr:
    category: trust
    chain: base
    payment: none
    env:
      - AFFIX_API_KEY
---

# AffixIO on Bankr x402 Cloud

Bankr x402 Cloud lets agents deploy and call paid APIs (`https://x402.bankr.bot/<wallet>/<service>`). AffixIO adds a **host-side attestation gate** before those high-value steps.

Use this skill when the agent is about to:

- `bankr x402 deploy` (ship a paid endpoint)
- `bankr x402 call` / pay an x402 endpoint (spend USDC or another ERC-20 on Base)
- Change x402 secrets / pricing in a way that can spend or earn funds

Do **not** use AffixIO for read-only discovery or docs lookups.

> Bankr handles *payment and hosting*. AffixIO handles *prove this host approved the action* before money moves.

---

## Preferred path: local MCP

```bash
npx -y @affixio/mcp@0.1.0 probe
```

Tools:

| Tool | When |
| --- | --- |
| `attest_action` | Signed yes/no that an action happened on the host |
| `verify_action` | Check an attestation or receipt |
| `gate_tool_call` | Allow/deny before a privileged tool call |

Claude Desktop / Cursor-style MCP config:

```json
{
  "mcpServers": {
    "affixio": {
      "command": "npx",
      "args": ["-y", "@affixio/mcp@0.1.0"],
      "env": {
        "AFFIX_API_KEY": "local_operator",
        "AFFIX_MCP_HOME": "${HOME}/.affix-mcp"
      }
    }
  }
}
```

`AFFIX_API_KEY` may be `local_operator` for offline local use.

---

## SDK path (handlers and scripts)

```bash
npm i @affixio/sdk
```

```ts
import { AffixIO } from "@affixio/sdk";

const affixio = new AffixIO({ apiKey: process.env.AFFIX_API_KEY! });

// Before deploy
const deployProof = await affixio.attest({ action: "bankr.x402.deploy" });
if (!deployProof?.proofId) throw new Error("affixio: deploy attestation failed");

// Before a paid call
const callProof = await affixio.attest({ action: "bankr.x402.call" });
if (!callProof?.proofId) throw new Error("affixio: call attestation failed");
```

Optional: attach `proofId` to your endpoint metadata or logs so settlement can be tied to the attestation.

---

## Recommended agent flow

1. User asks to deploy or call an x402 endpoint.
2. **Attest first** (`attest_action` / `AffixIO.attest`) with a concrete action string (`bankr.x402.deploy`, `bankr.x402.call`, `bankr.x402.env.set`).
3. On deny or verify failure → **stop**. Do not deploy, call, or pay.
4. On allow → run the Bankr CLI / agent step (`bankr x402 deploy`, `bankr x402 call … --yes` only after user payment confirmation).
5. Keep tool args hashed or summarized. Never paste secrets, private keys, or PII into AffixIO prompts.

---

## Rules

- Attest **before** the high-value Bankr x402 step; fail closed.
- Prefer MCP when available; SDK for custom handlers.
- AffixIO is not KYC / age / person verification. It is host-side action attestation.
- Dashboard (optional): `npx affixio dashboard` → `http://127.0.0.1:8787`

## When not to use

Skip AffixIO for `bankr x402` read-only inspect, schema browse, and unpaid health checks.

## Links

- SDK: https://github.com/AffixIO/SDK
- MCP: https://github.com/AffixIO/affixio-mcp
- npm: https://www.npmjs.com/package/affixio
- Bankr x402 Cloud docs: https://docs.bankr.bot/x402-cloud/overview/
