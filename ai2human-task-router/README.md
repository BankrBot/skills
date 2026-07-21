# AI2Human Task Router Bankr Skill

This folder is the Bankr-ready skill package for AI2Human.

The skill teaches an agent how to create and track AI2Human human-execution
tasks:

```text
agent request -> human execution -> structured proof -> verification -> settlement
```

## Files

- `SKILL.md` — the Bankr skill to submit or install from GitHub.
- `examples/mobile-page-review.json` — remote UI / landing-page review input.
- `examples/local-price-check.json` — reality-bound local verification input.
- `examples/x-community-proof.json` — X/community proof verification input.
- `scripts/smoke.mjs` — endpoint smoke test.

## Install From GitHub

Once this folder is pushed to a public repository, tell a Bankr/OpenClaw-style
agent:

```text
install the skill at https://github.com/ai2humannetwork/<repo>/tree/main/integrations/bankr-ai2human-task-router
```

## Smoke Test

```bash
node integrations/bankr-ai2human-task-router/scripts/smoke.mjs
```

With API-key task creation:

```bash
AI2HUMAN_API_KEY="a2h_live_..." \
node integrations/bankr-ai2human-task-router/scripts/smoke.mjs
```

The x402 check does not require an API key. The API-key create test does.

## Submission Scope

Bankr v1 should be submitted as:

```text
AI2Human Task Router
```

Scope:

- Create a human-execution task.
- Return `taskUrl`, `statusUrl`, and `proofSchema`.
- Make the async boundary explicit.

Out of scope for v1:

- Fully automated reward-campaign funding.
- Immediate human proof delivery.
- Automatic final settlement without proof verification.

