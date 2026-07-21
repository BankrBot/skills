---
name: ai2human-task-router
homepage: https://ai2human.io
description: >
  Create and track AI2Human human-execution tasks from an agent prompt.
  Use when an AI agent needs a real person to complete or verify a step,
  submit structured proof, and return a task URL the agent can monitor.
  Best for local checks, landing-page/manual QA, screenshot evidence,
  social or community proof, simple errands, and other reality-bound steps
  that need human execution or human judgment before settlement.
metadata:
  clawdbot:
    emoji: "🧾"
    homepage: "https://ai2human.io"
    requires:
      bins: ["node"]
---

# AI2Human Task Router

AI2Human turns blocked agent work into human-executable tasks.

Use this skill when an agent can describe what needs to be done, but the step
requires a human to execute, verify, inspect, photograph, review, or submit
structured proof.

Core loop:

```text
agent request -> human execution -> structured proof -> verification -> settlement
```

This skill does **not** claim that human work is completed immediately. The
immediate deliverable is a created AI2Human task with a tracking URL and proof
schema. The final deliverable arrives after human execution and verification.

## What This Skill Does

- Creates a human-execution task on AI2Human.
- Preserves the user's original task type and target URL.
- Generates a proof schema for the human executor.
- Returns a task URL and status URL for tracking.
- Supports API-key mode for direct integrations.
- Supports x402 paid access through the AI2Human A2MCP endpoint.

## When To Use

Use AI2Human when a workflow needs:

- manual website or landing-page review;
- mobile screenshot or UI proof;
- X/community task verification;
- a local price, store, event, or availability check;
- a human-written review note;
- an evidence bundle before a reward or settlement decision;
- a human step that an agent cannot finish through an API alone.

Do **not** use AI2Human for:

- illegal, invasive, harassing, or unsafe work;
- hidden surveillance or stalking;
- fake reviews, spam, or impersonation;
- medical, legal, or financial professional work unless a qualified workflow is explicitly configured;
- tasks where the requester expects instant human completion.

## Endpoint Options

### Option A: x402 Paid Endpoint

Use this when the agent environment supports x402 payment replay.

```text
POST https://ai2human.io/api/x402/agent/tasks/create
```

The endpoint returns `402 Payment Required` with a `PAYMENT-REQUIRED` challenge
when called without payment. After payment replay, it creates the task and
returns a task URL.

The current service contract is asynchronous:

```text
Immediate output: taskUrl, statusUrl, proofSchema, deliverableStatus
Final output: human notes, screenshots/evidence, verification result
Expected delivery window: 24h unless specified otherwise
```

### Option B: API-Key Endpoint

Use this when the user has an AI2Human developer key.

```text
POST https://ai2human.io/api/agent/tasks
Header: x-agent-api-key: <AI2HUMAN_API_KEY>
```

Developer keys can be created at:

```text
https://ai2human.io/developers/api-keys
```

## Input Schema

For x402 paid task creation, send:

```json
{
  "title": "Review AI2Human landing page on mobile",
  "description": "Open the target URL on mobile, check layout, readability, and broken buttons. Submit concise notes and screenshots.",
  "targetUrl": "https://ai2human.io",
  "requestType": "mobile_page_check",
  "device": "iPhone mobile viewport",
  "budget": "TBD",
  "deadline": "24h",
  "proofRequired": [
    "mobile screenshot",
    "review notes",
    "final pass/fail/needs_review verdict"
  ],
  "requesterName": "Bankr Agent",
  "requesterHandle": "@bankrbot"
}
```

Recommended fields:

| Field | Required | Notes |
|---|---:|---|
| `title` | yes | Short human-readable task title. |
| `description` | yes | Clear human execution brief. |
| `targetUrl` | yes | URL, post, page, or evidence target. |
| `requestType` | no | Examples: `landing_page_review`, `mobile_page_check`, `local_verification`, `community_proof`. |
| `device` | no | Useful for UI or screenshot tasks. |
| `budget` | no | Human reward budget if known. |
| `deadline` | no | Defaults to `24h`. |
| `proofRequired` | no | Explicit proof items. If omitted, AI2Human generates a default schema. |
| `requesterName` | no | Project or agent name. |
| `requesterHandle` | no | X handle or public identity. |

## Expected Response

Successful paid replay returns a JSON object like:

```json
{
  "ok": true,
  "service": "AI2Human Task Router",
  "taskId": "a2mcp-task-123456789abc",
  "taskUrl": "https://ai2human.io/tasks/a2mcp-task-123456789abc",
  "statusUrl": "https://ai2human.io/tasks/a2mcp-task-123456789abc",
  "deliverableStatus": "pending_human_execution",
  "deliverableEvent": "task_created_waiting_for_human_proof",
  "estimatedDelivery": "24h",
  "finalDeliverable": "human review notes, screenshots/evidence, verification result",
  "proofSchema": {
    "proofRequirements": ["..."],
    "verificationChecks": ["..."],
    "submissionFields": ["..."]
  }
}
```

The creation receipt is **not** the final human proof. The agent should open or
poll `taskUrl` / `statusUrl` to monitor proof submission and verification.

## Agent Workflow

When using this skill:

1. Clarify the task if the requested human action is vague.
2. Refuse unsafe, invasive, illegal, or spammy work.
3. Create the AI2Human task through x402 or API-key mode.
4. Return the `taskUrl` clearly to the user.
5. Explain that the task is pending human execution.
6. Tell the user what proof the human executor must submit.
7. Do not claim the task is complete until proof and verification are visible.

## Prompt Examples

### Landing Page Review

```text
Use AI2Human to create a human review task for https://ai2human.io.
Ask the reviewer to check mobile readability, broken buttons, and visual clarity.
Require screenshots, notes, device/viewport, and a final verdict.
Deadline 24h.
```

### X Campaign Proof

```text
Use AI2Human to create a proof task for this X post:
https://x.com/ai2humannetwork/status/...
Ask the human executor to verify whether a participant liked/reposted/commented.
Require X profile URL, screenshot evidence, and final verdict.
```

### Local Verification

```text
Use AI2Human to create a local verification task:
check today's posted price of a Tall Americano at Starbucks Times Square, NYC.
Require one clear menu photo, timestamp, short note, and final verdict.
Deadline 4h.
```

## cURL Smoke Tests

Check x402 challenge:

```bash
curl -i https://ai2human.io/api/x402/agent/tasks/create
```

Expected: `402` with a `PAYMENT-REQUIRED` header and an `accepts[]` array.

Create with API key:

```bash
curl -sS https://ai2human.io/api/agent/tasks \
  -H "Content-Type: application/json" \
  -H "x-agent-api-key: $AI2HUMAN_API_KEY" \
  -d '{
    "title": "Review AI2Human homepage on mobile",
    "description": "Open the page on mobile and submit screenshots, notes, and a verdict.",
    "category": "digital_task",
    "proof_requirements": ["screenshot", "notes", "timestamp"],
    "reward_usdc": 5,
    "deadline_hours": 24,
    "location": "remote",
    "agent_name": "Bankr Agent"
  }'
```

Expected: `201` with `task_id`, `task_url`, and a task object.

## Important Limitations

- This is an asynchronous human-execution workflow.
- Humans may not complete the task instantly.
- Task acceptance depends on AI2Human policy, proof requirements, and operator availability.
- Payment/reward settlement is separate from task creation unless a funded campaign or settlement flow is explicitly configured.
- The first Bankr-ready version should be treated as a task-router skill, not a full campaign payout engine.

## Project Links

- App: https://ai2human.io
- Developer keys: https://ai2human.io/developers/api-keys
- x402 endpoint: https://ai2human.io/api/x402/agent/tasks/create
- Official X: https://x.com/ai2humannetwork
