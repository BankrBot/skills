---
name: apinow
description: >-
  Use APINow (apinow-sdk / CLI) to discover, inspect, call, compose, publish,
  and monetize pay-per-request APIs on APINow.fun with automatic x402 settlement
  on Base. Use for API marketplace discovery, paid endpoint calls, workflow
  pipelines, external x402 URLs, LLM endpoint creation via user-factory, AI UI
  generation, and agent commerce probes such as Rye checkout intents. Works
  headless with PRIVATE_KEY or in apps with a connected wallet signer such as
  Bankr-compatible wallets.
metadata:
  {
    "clawdbot":
      {
        "emoji": "⚡",
        "homepage": "https://apinow.fun",
      },
  }
---

# APINow - x402 API marketplace, SDK, CLI, workflows, and UI generation

[APINow.fun](https://apinow.fun) is a pay-per-request API marketplace on [Base](https://base.org) using [x402](https://www.x402.org/). Agents use **`apinow-sdk`** or the **`apinow` CLI** to discover APIs, pay for calls, create and run workflows, proxy external x402 endpoints, create LLM endpoints, and generate sandbox UIs.

## When to use this skill

Use this skill when the user wants to:

- Find an API endpoint by capability, price, schema, namespace, or owner.
- Call a paid APINow endpoint with automatic x402 payment.
- Run or manage a multi-endpoint workflow pipeline.
- Call an external x402 URL through APINow (`discoverPrice`, `callExternal`).
- Create, test, publish, update, version, or delete an APINow endpoint.
- Generate an LLM-backed endpoint from a prompt via user-factory.
- Generate an interactive AI UI for an existing endpoint.
- Integrate APINow into a headless agent, browser app, Bankr wallet flow, or other connected wallet signer.

Do not use APINow for arbitrary web scraping or non-x402 payments. For external x402 commerce, discover and quote first; only perform final purchase/confirm steps after explicit user approval.

## Install the skill

Bankr skill registry install:

```text
> install the apinow skill from https://github.com/BankrBot/skills/tree/main/apinow
```

After installing the skill, install the SDK in the project that will call APINow:

```bash
npm install apinow-sdk
```

Run CLI commands with the package binary:

```bash
npm exec -- apinow --help
```

If `npm exec -- apinow` is unavailable in your package manager, use the local binary directly: `./node_modules/.bin/apinow`.

## Full system setup

### Headless agent / server

Use a funded EVM private key on Base for paid x402 calls and signed write operations.

```bash
export PRIVATE_KEY=0x...
export APINOW_BASE_URL=https://www.apinow.fun
```

`APINOW_BASE_URL` is optional; the production default is `https://apinow.fun` or `https://www.apinow.fun` depending on the SDK version. Set it explicitly in examples and production agents to avoid ambiguity.

### Browser or connected wallet

Use `address` + `signer` for signed auth. Paid browser calls require an x402-capable `paidFetch` if the app performs paid calls client-side.

```typescript
import { createClient } from 'apinow-sdk';

const apinow = createClient({
  address,
  signer: (message) => walletClient.signMessage({ message }),
  baseUrl: 'https://www.apinow.fun',
});
```

### Bankr-style wallet flow

If the environment exposes a Bankr-compatible signer, wire it through the same `signer(message)` shape. The private key never needs to be passed to browser code.

```typescript
const apinow = createClient({
  address: bankrWalletAddress,
  signer: (message) => bankr.signMessage(message),
  baseUrl: 'https://www.apinow.fun',
});
```

## Smoke test

Before spending money, verify discovery and metadata calls. These are public reads.

```bash
npm exec -- apinow search "weather" --limit 5
npm exec -- apinow list --sort newest --limit 5
npm exec -- apinow info gg402/horoscope
```

Then perform one small paid call with a spending cap appropriate for the endpoint.

```bash
PRIVATE_KEY=0x... npm exec -- apinow call gg402/horoscope \
  --max-cost 0.05 \
  -d '{"sign":"aries"}'
```

## Core SDK client

```typescript
import { createClient } from 'apinow-sdk';

const rawPrivateKey = process.env.PRIVATE_KEY;
if (!rawPrivateKey) throw new Error('PRIVATE_KEY is required');

const apinow = createClient({
  privateKey: rawPrivateKey.startsWith('0x')
    ? (rawPrivateKey as `0x${string}`)
    : (`0x${rawPrivateKey}` as `0x${string}`),
  baseUrl: process.env.APINOW_BASE_URL ?? 'https://www.apinow.fun',
  policy: {
    maxPerQueryUsd: 0.25,
    maxPerDayUsd: 5,
  },
});
```

## Discover and call endpoints

Prefer this sequence: `search` -> `info` -> validate schema/price -> `call`.

```typescript
const matches = await apinow.search('translate text', 5);
const details = await apinow.info('apinowfun', 'translate');

const result = await apinow.call('/api/endpoints/apinowfun/translate', {
  method: 'POST',
  maxCostUsd: 0.05,
  body: {
    text: 'Hello world',
    targetLanguage: 'es',
  },
});
```

CLI equivalent:

```bash
npm exec -- apinow search "translate text" --limit 5
npm exec -- apinow info apinowfun/translate
PRIVATE_KEY=0x... npm exec -- apinow call apinowfun/translate \
  --max-cost 0.05 \
  -d '{"text":"Hello world","targetLanguage":"es"}'
```

## Workflows

Workflows chain multiple endpoints into one paid DAG pipeline with payment splitting. Use workflows when the user wants a repeatable multi-step API process rather than one endpoint call.

```typescript
const workflows = await apinow.listWorkflows({ status: 'active', limit: 10 });

const output = await apinow.runWorkflow('f5d40784593aa972', {
  query: 'birthday gift ideas for a friend who loves cooking',
}, {
  maxCostUsd: 0.50,
});
```

Useful workflow commands:

```bash
npm exec -- apinow workflows --status active
npm exec -- apinow workflow f5d40784593aa972
PRIVATE_KEY=0x... npm exec -- apinow run-workflow f5d40784593aa972 \
  --max-cost 0.50 \
  -d '{"query":"gift ideas"}'
```

Workflow owners can create versions instead of editing live behavior in-place:

```typescript
await apinow.createWorkflowVersion('f5d40784593aa972', {
  totalPrice: '0.12',
  changelog: 'Tune prompt and raise price after usage spike',
});

await apinow.setDefaultWorkflowVersion('f5d40784593aa972', 2);
```

## External x402 proxy

Use this for x402 endpoints that are not listed directly on APINow.

```typescript
const price = await apinow.discoverPrice(
  'https://example.com/x402/profile',
  'POST',
);

const data = await apinow.callExternal('https://example.com/x402/profile', {
  method: 'POST',
  body: { handle: 'apinow' },
});
```

For SDK external calls, set `policy.maxPerQueryUsd` on the client to enforce a default spend ceiling. For CLI external calls, use `--max-cost`.

CLI:

```bash
npm exec -- apinow discover https://example.com/x402/profile --method POST
PRIVATE_KEY=0x... npm exec -- apinow call-external https://example.com/x402/profile \
  --method POST \
  --max-cost 0.05 \
  -d '{"handle":"apinow"}'
```

### Rye / physical commerce guardrail

Rye exposes physical checkout intents over x402 at `https://x402.rye.com`. Creating or inspecting a checkout intent can be a safe quote step. Confirming can place a real order.

Rules for agents:

- It is OK to create a checkout intent or inspect an existing intent when the user requested a quote.
- Do not call a Rye confirm endpoint unless the user explicitly approves the final product total, taxes, shipping, fees, and destination.
- Do not rely on URL-only discovery for final confirm pricing; use the real intent and body.
- Always pass a conservative `maxCostUsd` / `--max-cost`, or configure `policy.maxPerQueryUsd`, for x402 calls.

## User-factory: create LLM endpoints

Use user-factory when the user wants to turn a prompt into a hosted, monetizable API endpoint.

```typescript
const created = await apinow.factoryPipeline('Score startup pitches on 8 criteria', {
  markup: { markupPercent: 30 },
});

console.log(`${created.endpoint.namespace}/${created.endpoint.endpointName}`);
```

CLI:

```bash
PRIVATE_KEY=0x... npm exec -- apinow factory-pipeline \
  "Score startup pitches on 8 criteria" \
  --markup 30
```

## Generate AI UIs

Use UI generation when the user wants an embeddable or inspectable sandbox frontend for an endpoint.

```typescript
const details = await apinow.info('gg402', 'horoscope');

const ui = await apinow.generateUIAndWait({
  endpointName: details.endpointName,
  namespace: details.namespace,
  description: details.description,
  querySchema: details.querySchema,
  responseSchema: details.responseSchema,
  examples: details.exampleQuery
    ? [{ input: details.exampleQuery, output: details.exampleOutput }]
    : undefined,
  customPrompt: 'Use a clean dark theme with clear loading and error states',
});

if (!ui.source) throw new Error(`UI generation failed: ${ui.errorMessage}`);

console.log(ui.source['main.ts']);
console.log(ui.source['main.css']);
```

CLI:

```bash
PRIVATE_KEY=0x... npm exec -- apinow ui-generate gg402/horoscope \
  --prompt "clean dark theme with clear loading and error states"
npm exec -- apinow ui-list gg402/horoscope --sort recent
npm exec -- apinow ui-get <id> --source-only
```

## Endpoint CRUD

Use endpoint CRUD only when the user is intentionally publishing or maintaining an API listing.

Common lifecycle:

1. Create endpoint config.
2. Test the endpoint with safe inputs.
3. Publish / update metadata and price.
4. Monitor usage and iterate via updates or workflow versions.

SDK methods include:

- `createEndpoint(config)`
- `getEndpoint(id)`
- `updateEndpoint(id, updates)`
- `deleteEndpoint(id)`

All mutating calls require signed auth from `PRIVATE_KEY` or a connected wallet signer.

## Capability map

| Goal | SDK / CLI |
|------|-----------|
| Search endpoint catalog | `search`, `listEndpoints`, `apinow search`, `apinow list` |
| Inspect schema, price, wallet | `info`, `apinow info` |
| Pay and call listed endpoint | `call`, `apinow call` |
| Run multi-step pipeline | `runWorkflow`, `apinow run-workflow` |
| Manage workflow versions | `createWorkflowVersion`, `setDefaultWorkflowVersion`, version CLI commands |
| Probe external x402 price | `discoverPrice`, `apinow discover` |
| Pay and call external x402 | `callExternal`, `apinow call-external` |
| Create LLM endpoint | `factoryPipeline`, `factoryCreate`, `apinow factory-*` |
| Generate UI source | `generateUIAndWait`, `apinow ui-*` |
| Publish/manage endpoints | endpoint CRUD SDK methods |

## Auth and payment model

- Public reads: `search`, `listEndpoints`, `info`, workflow metadata reads.
- Paid calls: x402 payment is attached automatically by SDK / CLI.
- Writes: SDK signs an auth header with `PRIVATE_KEY` or wallet signer.
- Funding: keep the paying wallet funded with Base USDC or the asset required by the endpoint's x402 terms.
- Spending limits: pass `maxCostUsd` for listed endpoint/workflow SDK calls, configure `policy.maxPerQueryUsd` for client-wide limits, and pass `--max-cost` for CLI paid calls.

## Operational rules for agents

- Inspect schemas before calling paid endpoints.
- Ask for confirmation before high-cost calls, physical purchases, irreversible writes, deletes, or publishing monetized endpoints.
- Never print, log, commit, or expose `PRIVATE_KEY`.
- Prefer `APINOW_BASE_URL=https://www.apinow.fun` for production examples.
- For browser apps, never embed private keys; use connected wallet signing.
- Treat generated UI source as untrusted until reviewed before deploying it into an app.
- If a call fails with an x402/payment error, check wallet balance, chain/network, max cost, and endpoint price first.

## Links

- [APINow.fun](https://apinow.fun)
- [npm: apinow-sdk](https://www.npmjs.com/package/apinow-sdk)
- [x402](https://www.x402.org/)
