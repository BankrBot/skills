---
name: temporal-rest
description: Temporal - paid research reports, archive answers, live signals, and durable workflow execution via temporal.rest. Use when an agent wants to discover Temporal capabilities, buy structured reports, query the published archive, preview workflow spend and touched capabilities, run async jobs, create recurring workflow subscriptions, or monitor live signals on Tempo. Triggers on temporal.rest, Temporal, paid report, archive answer, workflow preview, topic_brief, launch_tracker, partner_monitor, competitor_watch, signal_explain, or Tempo x402 workflow APIs.
metadata: {"clawdbot":{"homepage":"https://temporal.rest","requires":{"bins":["curl","jq"]}}}
---

# Temporal

Temporal is a paid research and workflow harness on Tempo.

Public surface:

- Free discovery at `https://temporal.rest/api`
- Free workflow preflight at `https://temporal.rest/api/workflows/preview`
- Paid reports at `/api/report/*`
- Paid data at `/api/data/*`
- Paid inline and async workflows at `/api/workflows/*`

## Quick Start

Start with free discovery before opening a paid route.

```bash
curl -s https://temporal.rest/api | jq '.endpoints[] | {path, pricing, category}'
```

Preview workflow cost, touched capabilities, approval risk, and likely artifacts before paying:

```bash
curl -G -s https://temporal.rest/api/workflows/preview \
  --data-urlencode intent=job \
  --data-urlencode template=topic_brief \
  --data-urlencode topic='tempo mainnet' | jq
```

Paid routes require a Tempo or x402-capable client. If you already use the Tempo CLI, the same endpoints work there:

```bash
tempo request -X GET https://temporal.rest/api/data/latest
tempo request -X GET 'https://temporal.rest/api/data/answer?q=tempo%20mainnet'
tempo request -X GET 'https://temporal.rest/api/workflows/run?template=signal_explain&topic=Launch%20anchor%20Tempo%20mainnet'
```

## What To Use When

### Reports

- `GET /api/report/standard` - latest full nightly synthesis, `$1`
- `GET /api/report/alpha` - higher-conviction operator framing, `$3`
- `GET /api/report/executive` - compressed decision memo, `$5`

Use reports when the user wants the latest packaged research product rather than a workflow receipt.

### Data

- `GET /api/data/latest` - latest machine-readable snapshot, `$0.05/query`
- `GET /api/data/answer?q=...` - topic-specific archive answer, `$0.15/query`
- `GET /api/data/signals` - distilled signals, optional `slug` or `label`, `$0.05/query`

Use data routes when the user wants lightweight machine access without running a workflow.

### Workflows

- `GET /api/workflows/preview` - free preflight quote and policy view
- `GET /api/workflows/run` - inline paid workflow run, `$0.25/job`
- `POST /api/workflows/jobs` - persisted async job, `$0.25/job`
- `POST /api/workflows/subscriptions` - recurring subscription with optional webhook delivery, `$10/subscription`

Use:

- `run` for one-shot paid execution when the user wants the completed result immediately
- `jobs` when the user needs a durable receipt, polling, event history, or resume support
- `subscriptions` when the user wants the same workflow rerun on a cadence

## Workflow Templates

Common templates:

- `topic_brief` - short research brief for a topic
- `launch_tracker` - launch-focused brief for a topic
- `daily_operator_watch` - watchlist pass over a focus area
- `partner_monitor` - partner-specific monitoring by focus
- `competitor_watch` - competitor-oriented watch by focus
- `signal_explain` - explain a specific signal thread with archive context

Template input shape is small and typed:

```json
{
  "template": "partner_monitor",
  "focus": "payments",
  "slug": "2026-03-21"
}
```

Rules:

- Brief-style templates usually use `topic`
- Watch-style templates usually use `focus`
- `slug` is optional and pins the workflow to a published issue

## Common Recipes

### Discover the live capability manifest

```bash
curl -s https://temporal.rest/api | jq
curl -s https://temporal.rest/api/capabilities | jq '.capabilities[] | {name, path: .endpoint.path, pricing: .pricingModel}'
```

### Run an async job and then poll it

1. Preview the job first.
2. Submit `POST /api/workflows/jobs` with a paid client.
3. Poll the returned `statusPath` or `eventsPath` until terminal state.
4. Read the final receipt, artifacts, and verification block.

### Create a recurring subscription

Use `POST /api/workflows/subscriptions` with:

- `template`
- `topic` or `focus`
- `intervalHours`
- optional `webhookUrl`
- optional `notifyMode=material_change` or `notifyMode=always`

See [references/public-api.md](references/public-api.md) for endpoint tables, template guidance, and the workflow lifecycle.
