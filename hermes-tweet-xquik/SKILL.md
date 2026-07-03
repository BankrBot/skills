---
name: hermes-tweet-xquik
description: |
  Use Hermes Tweet and Xquik for X/Twitter agent workflows.
  Plan social listening, account and follower analysis, post research, monitors,
  webhook alerts, REST API calls, MCP client setup, and safe tweet actions.
  Trigger when a user asks for Hermes Agent X/Twitter tooling, Xquik API access,
  X/Twitter monitoring, social research, or agent-driven tweet workflows.
---

# Hermes Tweet + Xquik

Use this skill when an agent needs X/Twitter workflows through Hermes Tweet or Xquik.

## Public Surfaces

- Hermes Tweet plugin: `https://github.com/Xquik-dev/hermes-tweet`
- Xquik docs for agents: `https://docs.xquik.com/llms.txt`
- REST OpenAPI schema: `https://xquik.com/openapi.json`
- MCP manifest: `https://xquik.com/.well-known/mcp.json`
- MCP endpoint: `https://xquik.com/mcp`

## Setup

1. Install Hermes Tweet from `https://github.com/Xquik-dev/hermes-tweet` when the runtime is Hermes Agent.
2. Store `XQUIK_API_KEY` in the agent or MCP client secret store for authenticated read and action workflows.
3. Keep `HERMES_TWEET_ENABLE_ACTIONS=true` disabled unless the user explicitly approved tweet actions.
4. Prefer read and research workflows first. Only plan write workflows when the user asks for them.

## Workflow Choice

- Use Hermes Tweet for Hermes Agent plugin workflows that need tool registration and X/Twitter actions.
- Use Xquik MCP when an MCP client should access X/Twitter tools through a remote endpoint.
- Use the REST API when the user needs typed HTTP integration, SDK generation, webhooks, or server-side automation.

## Safety

- Do not print API keys, OAuth tokens, cookies, or session material.
- Ask for confirmation before enabling any tweet action workflow.
- Keep write actions gated behind both `XQUIK_API_KEY` and `HERMES_TWEET_ENABLE_ACTIONS=true`.
- Prefer concise monitoring and research plans with clear output expectations.

## Useful Checks

```bash
curl -fsSL https://xquik.com/.well-known/mcp.json | jq .
curl -fsSL https://xquik.com/openapi.json | jq '.info.title'
```
