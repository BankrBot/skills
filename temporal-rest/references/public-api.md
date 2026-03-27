# Temporal public API reference

Temporal exposes a public paid surface for research, data, and workflows.

## Discovery and docs

| Route | Access | Purpose |
| --- | --- | --- |
| `/api` | free | compact service summary with endpoint list, pricing, latest report, and discovery links |
| `/api/capabilities` | free | full machine-readable manifest with schemas, quotes, and reliability hints |
| `/capabilities` | free | human-readable capability docs |
| `/signals` | free | public live signal board |

## Paid routes

| Route | Method | Price | Use |
| --- | --- | --- | --- |
| `/api/report/standard` | `GET` | `$1` | full latest nightly synthesis |
| `/api/report/alpha` | `GET` | `$3` | operator framing and high-conviction packaging |
| `/api/report/executive` | `GET` | `$5` | compressed decision memo |
| `/api/data/latest` | `GET` | `$0.05/query` | latest machine-readable snapshot |
| `/api/data/answer` | `GET` | `$0.15/query` | archive-backed answer for `q` |
| `/api/data/signals` | `GET` | `$0.05/query` | distilled signals, optionally filtered by `slug` or `label` |
| `/api/workflows/run` | `GET` | `$0.25/job` | inline paid workflow run |
| `/api/workflows/jobs` | `POST` | `$0.25/job` | durable async workflow submission |
| `/api/workflows/subscriptions` | `POST` | `$10/subscription` | recurring workflow lane with optional webhook delivery |

`/api/workflows/preview` is free and should be called first whenever the user is deciding whether to run a workflow.

## Workflow input patterns

Current public templates:

- `topic_brief`
- `launch_tracker`
- `daily_operator_watch`
- `partner_monitor`
- `competitor_watch`
- `signal_explain`
- `deep_report_create`
- `deep_report_refresh`

Parameter rules:

- brief-oriented templates usually take `topic`
- watch-oriented templates usually take `focus`
- `slug` is optional and selects a specific published issue
- subscriptions also take `intervalHours`
- subscriptions can add `webhookUrl`
- subscriptions can set `notifyMode=material_change` or `notifyMode=always`

Useful preview example:

```bash
curl -G -s https://temporal.rest/api/workflows/preview \
  --data-urlencode intent=job \
  --data-urlencode template=partner_monitor \
  --data-urlencode focus=payments | jq
```

## Workflow lifecycle

### Inline run

Use `GET /api/workflows/run` when the user wants a one-shot workflow result and does not need queueing.

Typical flow:

1. Call preview.
2. Open the paid route with a Tempo or x402-capable client.
3. Read the completed receipt, spend block, result, verification, and any artifact handles.

### Async job

Use `POST /api/workflows/jobs` when the user needs durable state or may need to resume later.

Typical flow:

1. Call preview.
2. Submit the job.
3. Poll `statusPath`.
4. Read `eventsPath` for node-level progress.
5. If the job fails and a `resumePath` is returned, resume that job instead of creating a duplicate.

### Subscription

Use `POST /api/workflows/subscriptions` when the user wants recurring execution.

Typical flow:

1. Preview a comparable one-off run.
2. Create the subscription.
3. Store the returned subscription id and status path.
4. Watch webhook deliveries or poll the subscription ledger for due runs.

## Trust model

Useful details from the manifest:

- capability manifests include signed discovery quotes and schema hashes
- workflow preview returns a deterministic preview hash
- paid responses include capability metadata and proof references
- commitments point at an identity ledger and signal scoreboard onchain

Treat discovery as guidance and the live x402 challenge as authoritative.
