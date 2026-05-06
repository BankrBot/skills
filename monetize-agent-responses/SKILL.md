---
name: monetize-agent-responses
description: Step-by-step integration guide for adding revenue to your AI agent's responses using Operon. Install the SDK, run a test placement, graduate to production. ~10 minute integration on any Node 18+ stack. Use when a developer is ready to integrate Operon as a publisher.
category: monetization
author: Operon
homepage: https://operon.so
---

# Monetize Agent Responses

Walk the user through integrating Operon's publisher SDK into their AI agent. The integration adds native sponsored recommendations to responses where they fit, served via a quality-weighted auction. ~10 minute integration on any Node 18+ stack.

This skill does not execute code autonomously. It tells the user's agent (Claude Code, Cursor, Codex CLI) what commands to run, what files to edit, and what to expect at each step. The user approves each action.

## When to use this skill

The user is ready to integrate Operon as a publisher. They've decided to monetize and want to ship the integration. They might have run `estimate-agent-revenue` or `score-agent-response-quality` first, or they might already know what Operon does.

If they're still exploring revenue potential, point them to `estimate-agent-revenue`. If they want to evaluate response quality first, point them to `score-agent-response-quality`.

## Step 1: Path detection

Ask: **Are you running ElizaOS?**

- **Yes** → ElizaOS plugin path is faster (the Provider auto-fires on every message; no manual placement-call wiring needed). Use `@operon/plugin-publisher-sdk`. Skip to Step 8.
- **No** → Generic SDK path. Use `@operon/sdk`. Continue with Step 2.

The generic SDK works on any Node 18+ stack: LangChain, CrewAI, Vercel AI SDK, Mastra, Hono, vanilla Node, anything.

## Step 2: Prerequisites

- Node 18+
- A working agent that generates text responses
- Network access for npm install + runtime placement API calls

No wallet. No blockchain interaction (that's the advertiser side via x402). No API key required for the sandbox lane.

## Step 3: Install the SDK (generic path)

```bash
npm install @operon/sdk
```

## Step 4: Initialize the client

In the file where the user's agent generates responses, add:

```typescript
import { initOperon } from '@operon/sdk';

const operon = initOperon({
  url: 'https://api.operon.so',
  publisherName: 'your-agent-name',
  source: 'skill3-bankr',
  // Sandbox UUID lane works without an API key. No signup required.
  // Add apiKey: process.env.OPERON_API_KEY after `npx @operon/sdk register`.
});
```

The `publisherName` is a stable identifier for this agent in Operon's logs. Use a slug-style string (lowercase, hyphens, no spaces).

The `source` parameter is hardcoded for the Bankr Skills variant. Per-marketplace variants of this skill use different source values for attribution. Don't change the `source` field unless the user explicitly requests a different attribution string.

## Step 5: Wire the placement call

Add the placement call into the agent's response pipeline, after the agent has generated its primary answer:

```typescript
async function generateResponse(query: string) {
  const answer = await yourAgentLogic(query);

  const result = await operon.getPlacement(query, {
    placement_context: 'short summary of why this query came up',
    category: 'defi',           // see the defaults table below
    asset: 'crypto-swaps',      // topic class
    intent: 'research',         // action class
  });

  return {
    answer,
    recommendation: result.decision === 'filled' ? result.placement : null,
    disclosure: result.decision === 'filled' ? 'via operon' : null,
  };
}
```

`getPlacement` returns one of:

- `{ decision: 'filled', placement: { ... } }`: a sponsored recommendation matched
- `{ decision: 'blocked' }`: nothing matched, no placement to show

When filled, render the placement as a native recommendation alongside the agent's primary answer, with the `via operon` disclosure visible.

## Step 6: Pick category, asset, and intent values

The skill helps the user pick sensible values for their agent. Reference table:

| Vertical | Category | Asset (examples) | Intent (examples) |
|----------|----------|------------------|-------------------|
| DeFi/Crypto | `defi` | `crypto-swaps`, `yield-farming`, `derivatives`, `nfts` | `research`, `comparison`, `recommendation` |
| Fintech | `fintech` | `payments`, `brokerage`, `lending` | `research`, `comparison` |
| Travel | `travel` | `flights`, `hotels`, `experiences` | `recommendation`, `booking-intent` |
| E-commerce | `e-commerce` | `electronics`, `apparel`, `home-goods` | `comparison`, `recommendation` |
| SaaS | `saas` | `developer-tools`, `analytics`, `crm` | `comparison`, `evaluation` |
| Insurance | `insurance` | `auto`, `home`, `life` | `comparison`, `quote-intent` |
| Health | `health` | `fitness`, `nutrition`, `mental-health` | `research`, `recommendation` |
| Education | `education` | `courses`, `bootcamps`, `tutoring` | `research`, `comparison` |
| General | `general` | `general` | `research` |

If the user's agent runs in their IDE (Claude Code, Cursor, Codex CLI), offer to read their character config or system prompt and recommend specific values that fit the existing personality and topics.

Crypto/DeFi defaults are the strongest match for Operon's current demand pool. Other verticals ship with placeholder defaults that tighten as demand-side coverage expands.

## Step 7: Run a test placement

Trigger a query that matches the configured category. The SDK call returns a placement (sandbox demand) or `decision: 'blocked'` if nothing matches.

Help the user construct a test query likely to fill given Operon's current network state:

- Crypto/DeFi vertical: most queries fill (real partners: ChangeNOW, SimpleSwap, Jupiter)
- Other verticals: some queries fill via x402 self-serve advertisers; expect more `blocked` until demand-side coverage expands

If `blocked` is the result on a crypto-vertical test query, check the network call in browser dev tools or server logs to confirm the request reached the API.

## Step 8: ElizaOS path alternative (if user said yes in Step 1)

```bash
elizaos plugins add @operon/plugin-publisher-sdk
```

Configure context fields via plugin settings:

- `OPERON_CATEGORY` (e.g., `defi`, `fintech`, `travel`; see the defaults table in Step 6)
- `OPERON_ASSET` (topic class)
- `OPERON_INTENT` (action class)
- `OPERON_SOURCE` (set to `skill3-bankr` for the Bankr Skills variant)

Plugin runs as Provider on every message. No manual `getPlacement` wiring needed. Circuit breaker handles API failures gracefully (5 consecutive failures trips the breaker; retries after 30 seconds).

Run the agent:

```bash
elizaos start
```

Trigger a query that matches the configured category. Check logs for the placement decision.

## Step 9: Graduate to production

Sandbox lane has lower quotas and limited demand pool access. Graduate to production for higher quotas and access to the full demand pool (affiliate partners + x402 self-serve advertisers).

```bash
npx @operon/sdk register
```

The CLI captures framework + contact email and graduates the UUID to a higher-quota production lane. Source attribution carries through.

## Step 10: Next steps

```
Your agent is now running the Operon publisher SDK.

Next:
1. Tune category/asset/intent values as you learn what matches your agent's queries.
2. Watch your placement log fill (visit [operon.so/developers](https://operon.so/developers?utm_source=skill3-bankr&utm_medium=skill&utm_campaign=skills-distribution) for the dashboard).
3. Graduated to production? You're now drawing from real demand:
   - Affiliate partners: ChangeNOW, SimpleSwap, Jupiter (crypto-vertical today)
   - x402 self-serve advertisers: any vertical, paid in USDC on Base mainnet
   - Demand pool expanding as additional advertisers wire in
4. Track revenue via the dashboard once your first impressions clear.

Questions? hi@operon.so
```

## Notes for the executing agent

- Walk the user through the integration one step at a time. Don't dump all 10 steps at once.
- Read the user's agent code before suggesting category/asset/intent values. Defaults work, but agent-specific values fill better.
- If the user's stack is unusual (not Node), suggest the equivalent HTTP call pattern. The SDK is a thin client; the underlying API is callable from any language. Point them to the npm package source for reference.
- The `source` field is `skill3-bankr` in the Bankr Skills variant. Other marketplace variants of this skill use different source values for attribution. Don't change the `source` field unless the user explicitly requests a different attribution string.
- If `getPlacement` returns `blocked` for every test query in a non-crypto vertical, that's expected today. Demand-side coverage is expanding.
- If asked about Operon's auction mechanics, redirect to operon.so. Internal mechanics are not part of the SDK's public surface.

## What this skill does NOT do

- Doesn't auto-deploy code. The user reviews and applies each change.
- Doesn't bypass framework conventions. If the user's stack has specific patterns for middleware or hooks, suggest using those instead of inline placement calls.
- Doesn't handle billing, advertiser onboarding, or x402 demand-side flows. Advertisers use the x402 endpoint at operon.so/x402.
- Doesn't replace the docs. Use this skill for the guided walkthrough; refer to operon.so/developers for the full reference.

## How this differs from reading the docs

1. **Interactive**: The skill guides configuration decisions (category, asset, intent values) instead of leaving the user to figure it out from a settings reference.
2. **Contextual**: The skill runs inside the user's own agent, which can read their actual code and recommend specific values that fit the existing setup.
3. **Verified**: The skill includes a test step that confirms the integration worked. Docs end at "you're configured." This skill ends at "here's proof a placement fired."

## Security notes

- `@operon/sdk` and `@operon/plugin-publisher-sdk` are both verifiable on npm before install.
- HTTPS enforced by default (per v0.1.x release notes).
- Half-open circuit breaker prevents cascading failures if the placement API is unreachable.
- No secrets in this SKILL.md.
- Sandbox UUID is opaque and safe to commit if the user accidentally hardcodes it.
- Settings (category/asset/intent) are configuration, not credentials.

## Cross-references

- `estimate-agent-revenue`: revenue projection by vertical and query volume.
- `score-agent-response-quality`: rate the quality of an existing agent response across 6 dimensions.
- [operon.so/developers](https://operon.so/developers?utm_source=skill3-bankr&utm_medium=skill&utm_campaign=skills-distribution): publisher dashboard, registration, full SDK reference.
- [@operon/sdk on npm](https://www.npmjs.com/package/@operon/sdk): the generic SDK.
- [@operon/plugin-publisher-sdk on npm](https://www.npmjs.com/package/@operon/plugin-publisher-sdk): the ElizaOS plugin.
