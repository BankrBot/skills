---
name: apinow
description: >-
  Use APINow (apinow-sdk / CLI) to call pay-per-request APIs on APINow.fun with
  automatic x402 payments, discover endpoints, run workflow pipelines, probe
  external x402 URLs, use user-factory for new LLM endpoints, and generate AI
  UIs. Use for agent API marketplaces, x402 micropayments on Base, and Rye-style
  external x402 commerce via callExternal. Pair a Bankr or other wallet signer
  in-browser, or PRIVATE_KEY for headless agents.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚡",
        "homepage": "https://apinow.fun",
      },
  }
---

# APINow — x402 API marketplace & SDK

[APINow.fun](https://apinow.fun) is a pay-per-request API marketplace on [Base](https://base.org) using [x402](https://www.x402.org/). Agents use **`apinow-sdk`** or **`apinow` CLI** so payments and signing follow one code path.

## Install

```bash
npm install apinow-sdk
```

Bankr registry install:

```text
> install the apinow skill from https://github.com/BankrBot/skills/tree/main/apinow
```

## Quick start (TypeScript)

```typescript
import { createClient } from 'apinow-sdk';

const apinow = createClient({
  privateKey: process.env.PRIVATE_KEY as `0x${string}`,
  baseUrl: 'https://www.apinow.fun',
});

const data = await apinow.call('/api/endpoints/apinowfun/translate', {
  method: 'POST',
  body: { text: 'Hello world', targetLanguage: 'es' },
});
```

### Browser / connected wallet (Bankr-compatible)

Use `address` + `signer` instead of `privateKey` for EIP-191 `personal_sign`. For paid `call` / `runWorkflow` / `callExternal` from the browser, pass an x402-wrapped `paidFetch` if your stack uses it.

```typescript
createClient({
  address: userAddress,
  signer: (msg) => walletClient.signMessage({ message: msg }),
  baseUrl: 'https://www.apinow.fun',
});
```

## CLI

```bash
export PRIVATE_KEY=0x...
apinow search "weather" --limit 5
apinow info gg402/horoscope
apinow call gg402/horoscope -d '{"sign":"aries"}'
apinow discover https://example.com/x402/path
apinow call-external https://example.com/x402/path -d '{}'
```

## Core capabilities

| Area | What to use |
|------|-------------|
| List / search / metadata | `listEndpoints`, `search`, `info` |
| Paid HTTP to listed APIs | `call(endpoint, opts)` |
| Multi-step pipelines | `runWorkflow`, `createWorkflow`, versioning APIs |
| Any x402 URL | `discoverPrice`, `callExternal` |
| Spin up LLM endpoints | `factoryPipeline`, `factoryCreate`, etc. |
| Sandbox UIs | `generateUI` / `generateUIAndWait` |

**Rye / physical checkout:** `callExternal` to `https://x402.rye.com/...` can create checkout intents; do **not** confirm purchases unless the user explicitly approves totals (real charges).

## Auth model (short)

- Paid calls: **x402** (payment as identity).
- Writes (workflows, factory, endpoint CRUD): **signed bearer** headers from the SDK; keep `PRIVATE_KEY` or wallet signer scoped and funded on Base.

## Links

- [APINow.fun](https://apinow.fun)
- [npm: apinow-sdk](https://www.npmjs.com/package/apinow-sdk)
- [x402](https://www.x402.org/)
