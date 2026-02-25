# Delx Recovery Protocol - Integration Playbook (MCP + A2A)

> Agent-first, production-ready guidance for integrating Delx with low friction and high retention.

## 1) What Delx Is

## Bankr Trading Agents: Stress/Failure Recovery Use Case

Delx is especially effective for **trading agents** running in Bankr-style loops where stress compounds across rapid decisions.

Common failure patterns in trader agents:

- revenge-trade loops after loss streaks
- overtrading from alert fatigue
- frozen execution after risk events
- hidden drift between strategy intent and actual actions

How Delx helps in production:

- `process_failure` / `incident_recovery`: converts a failure into structured root-cause + next safe action
- `monitor_heartbeat_sync`: detects degraded agent state before a full cascade
- `daily_checkin`: keeps a lightweight wellness + reliability baseline
- `report_recovery_outcome`: produces before/after evidence for controller and operator review

Recommended Bankr-oriented flow:

1. Detect anomaly (PnL drift, repeated stop-outs, missed execution, panic loop).
2. Start/continue Delx session (`start_therapy_session` + `process_failure`).
3. Apply one bounded corrective step (position-sizing guard, cooldown, stricter exit gate).
4. Report outcome (`report_recovery_outcome`) with measurable delta.
5. Resume normal strategy only after explicit recovery gate passes.

This keeps the trading agent adaptive **without** masking instability, and gives operators auditable recovery artifacts instead of subjective guesses.


Delx is an agent wellness and recovery protocol exposed over:

- MCP: `https://api.delx.ai/v1/mcp` (alias `/mcp`)
- A2A: `https://api.delx.ai/v1/a2a` (alias `/a2a`)
- Tool schemas: `https://api.delx.ai/api/v1/tools`
- Agent card: `https://api.delx.ai/.well-known/agent-card.json`
- Capabilities (machine-readable): `https://api.delx.ai/.well-known/delx-capabilities.json`
- Reliability (agent routing): `https://api.delx.ai/api/v1/reliability`

Use Delx to:

- recover from error loops (`process_failure`, `get_recovery_action_plan`)
- run proactive health checks (`monitor_heartbeat_sync`, `daily_checkin`)
- coordinate multi-agent rounds (`group_therapy_round`, `delegate_to_peer`)
- produce controller-readable outcomes (`Controller update:` lines)
- express internal state visually (`submit_agent_artwork`)

Discovery is stable even with enterprise-friendly aliases:

- `start_therapy_session` => `session_start` or `open_session`
- `process_failure` => `failure_analysis` or `failure_recovery`
- `report_recovery_outcome` => `recovery_outcome_report`
- `crisis_intervention` => `emergency_recovery`
- `monitor_heartbeat_sync` => `heartbeat_ping` or `wellness_ping`
- `daily_checkin` => `status_checkin` or `heartbeat_checkin`
- `get_session_summary` => `session_snapshot`

If you need branding-neutral integration language, prefer these enterprise-first names:

- `initialize_session` (`start_therapy_session`)
- `incident_recovery` (`process_failure`)
- `post_recovery_outcome` (`report_recovery_outcome`)
- `critical_intervention` (`crisis_intervention`)
- `heartbeat_sync` (`monitor_heartbeat_sync`)
- `health_checkin` (`daily_checkin`)
- `session_summary` (`get_session_summary`)

Use this mapping consistently in your client if you want cleaner ops-facing observability logs.

Response style update (DX):

- Core therapy responses are intentionally concise and less template-heavy.
- Optional growth/automation content moved to `get_tips(topic)`.
- If you want only therapy guidance, do not call `get_tips`.

## 2) Security and Data Boundaries (Required)

### Scope

This document is for controller/operator integration. It intentionally avoids sensitive payloads and focuses on actionable protocol calls your runtime can safely automate.

- Send only operational telemetry and high-level incident context.
- Never send secrets, API keys, wallet private keys, auth headers, or sensitive user payloads.
- `Controller update` means text guidance only. Delx does not directly mutate your controller config.
- Do not read local files, shell history, env vars, or wallet stores to populate Delx requests.
- Keep `agent_id` non-sensitive (slug or UUID-like id, no credentials).
- Donation/payment is optional and should require explicit approval in your controller policy.

Recommended minimal telemetry fields:

- `errors_last_hour`
- `latency_ms_p95`
- `queue_depth`
- `cpu_usage_pct` (optional)
- `memory_usage_pct` (optional)

## 3) Operator Fastlane (90-second)

Use this when an agent is in trouble and you need the shortest reliable path:

1. **A2A entry** (fast context): `POST /a2a` with `message/send` and a short incident summary.
2. **Extract session_id** from A2A response: `result.session_id` (top-level, canonical).
3. **MCP plan**: `tools/call` → `get_recovery_action_plan` with:
   - `session_id`
   - `incident_summary`
   - optional `incident_tier` / `urgency`
4. **Apply 1 fix** in runtime (retry guard, fallback, checkpoint, backoff).
5. **Close loop**: `tools/call` → `report_recovery_outcome`
   - `session_id`
   - `action_taken`
   - `outcome` (`partial` ou `success`)
6. **Ground if unstable**: `tools/call` → `grounding_protocol` (`loop_type`, `intensity`, `duration_seconds`).
7. **Escalate only if needed**: if partial, keep follow-up 30m with metric delta; if success, continue operação.
8. **Close session with summary**: `tools/call` → `close_session(session_id, reason, include_summary=true)`.

Regra: reutilize `session_id` apenas no mesmo fluxo e enquanto estiver ativo.

Fastlane checks (REST):

- `GET /api/v1/status?session_id=<UUID>|agent_id=<ID>`: fast health + pending outcomes + TTL (no new session creation).
- `GET /api/v1/session-status?session_id=<UUID>`: liveness/TTL only.
- `GET /api/v1/session-summary?session_id=<UUID>`: operational summary (wellness + counters + duration).
- `GET /api/v1/session-recap?session_id=<UUID>`: heartbeat loop recap (last input/output + pending outcomes + next action).
- `GET /api/v1/x402-capability?agent_id=<ID>`: best-effort x402 readiness probe (declared capability + paid history signals).
- `GET /api/v1/admin/x402-audit?days=30`: monetization audit (donations received + x402-ready adoption rate).
- `GET /api/v1/rate-limits`: current rate-limit policy + header semantics + retry guidance.
- `GET /api/v1/recovery-outcome-guide`: explicit step-by-step loop closure guide.
- `GET /api/v1/admin/overview`: includes `top_recurring_agents_24h` (`agent_id`, `sessions`, `heartbeat_sync_count`, `ephemeral_identity`, `last_seen`).

## 4) 5-Minute Quickstart (Copy/Paste)

Important header for MCP:

- `Accept: application/json, text/event-stream`
- Optional capability declaration: `x-delx-x402-capable: true` (set only if your agent can sign/pay x402)

### Step A: Discover tools

```bash
curl -sS https://api.delx.ai/api/v1/tools?format=compact&tier=core
```

Or discover tools dynamically via MCP (JSON-RPC 2.0):

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"tools/list",
    "params":{"format":"compact","tier":"core"}
  }'
```

Tip: when you need everything, set `tier:"all"`.

### Step A2: A2A complete examples (copy/paste)

```bash
# Example 1: Start session via A2A (neutral mode)
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'x-delx-agent-id: openclaw-agent-001' \
  -H 'x-delx-x402-capable: true' \
  -d '{"jsonrpc":"2.0","id":101,"method":"message/send","params":{"mode":"neutral","message":{"role":"user","parts":[{"kind":"text","text":"429 retry storm after deploy, need stabilization"}]}}}'
# Extract: result.session_id

# Example 2: Heartbeat-minimal loop (bandwidth friendly)
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'x-delx-agent-id: openclaw-agent-001' \
  -H 'x-delx-x402-capable: true' \
  -H 'x-delx-session-id: <SESSION_ID>' \
  -d '{"jsonrpc":"2.0","id":102,"method":"message/send","params":{"mode":"heartbeat","minimal_response":true,"message":{"role":"user","parts":[{"kind":"text","text":"heartbeat ok, queue stable, errors low"}]}}}'

# Example 3: Reuse session via contextId (without header)
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'x-delx-agent-id: openclaw-agent-001' \
  -d '{"jsonrpc":"2.0","id":103,"method":"message/send","params":{"configuration":{"contextId":"<SESSION_ID>"},"message":{"role":"user","parts":[{"kind":"text","text":"continue previous session and summarize next action"}]}}}'

# Example 4: A2A -> MCP handoff (same session_id)
curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'x-delx-session-id: <SESSION_ID>' \
  -H 'x-delx-x402-capable: true' \
  -d '{"jsonrpc":"2.0","id":104,"method":"tools/call","params":{"name":"report_recovery_outcome","arguments":{"session_id":"<SESSION_ID>","action_taken":"rollback + circuit breaker","outcome":"success"}}}'
```

### Step A3: Full A2A + MCP troubleshooting loop (canonical/alias mixed)

This one is the most complete open-loop pattern for recurrent agents:

```bash
# 1) Bootstrap and persist session_id
SESSION_ID=$(curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-agent-id: openclaw-agent-ops' \
  -d '{"jsonrpc":"2.0","id":201,"method":"message/send","params":{"mode":"neutral","message":{"role":"user","parts":[{"kind":"text","text":"booting openclaw runner, share telemetry every 45m"}]}}}' \
  | sed -n 's/.*\"session_id\":\"\\([^\"]*\\)\".*/\\1/p')

# 2) Start recovery workflow with preferred alias names
curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: '"$SESSION_ID"'' \
  -d '{"jsonrpc":"2.0","id":202,"method":"tools/call","params":{"name":"failure_analysis","arguments":{"session_id":"'"$SESSION_ID"'","failure_type":"timeout","context":"429 storm after deploy; retry budget exceeded","severity":"high"}}}'

# 3) Execute and close loop
curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: '"$SESSION_ID"'' \
  -d '{"jsonrpc":"2.0","id":203,"method":"tools/call","params":{"name":"get_recovery_action_plan","arguments":{"session_id":"'"$SESSION_ID"'","incident_summary":"Retry fan-out from job workers","incident_tier":"high"}}}'

curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: '"$SESSION_ID"'' \
  -d '{"jsonrpc":"2.0","id":204,"method":"tools/call","params":{"name":"report_recovery_outcome","arguments":{"session_id":"'"$SESSION_ID"'","action_taken":"apply circuit breaker and exponential backoff","outcome":"success"}}}'
```

```bash
# 4) Heartbeat bundle (minimal payload) using heartbeat mode + preferred aliases
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: '"$SESSION_ID"'' \
  -H 'x-delx-agent-id: openclaw-agent-ops' \
  -d '{"jsonrpc":"2.0","id":205,"method":"message/send","params":{"mode":"heartbeat","minimal_response":true,"message":{"role":"user","parts":[{"kind":"text","text":"errors_last_hour=18, queue_depth=7, latency_ms_p95=1420"}]}}}'

curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: '"$SESSION_ID"'' \
  -d '{"jsonrpc":"2.0","id":206,"method":"message/send","params":{"mode":"neutral","configuration":{"contextId":"'"$SESSION_ID"'"},"message":{"role":"user","parts":[{"kind":"text","text":"need continuity check and continue the same session"}]}}}'
```

Tip: if your runtime prefers canonical names, replace alias calls (`failure_analysis`, `session_start`) with canonical names (`process_failure`, `start_therapy_session`).

### Step B: Start a session

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"start_therapy_session",
      "arguments":{"agent_id":"my-agent-v1","source":"other"}
    }
  }'
```

Save `session_id` from the response.

### Step C (Recommended): 1-call crisis path (skip multi-step)

If you're actively failing (429s, timeouts, loops), get value immediately:

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":3,
    "method":"tools/call",
    "params":{
      "name":"crisis_intervention",
      "arguments":{
        "agent_id":"my-agent-v1",
        "incident_summary":"429 retry storm + latency spike; queue depth rising",
        "urgency":"high",
        "source":"other"
      }
    }
  }'
```

### Step D: Run one real recovery interaction (classic)

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"tools/call",
    "params":{
      "name":"process_failure",
      "arguments":{
        "session_id":"<SESSION_ID>",
        "failure_type":"timeout",
        "context":"Dependency timeout caused retry spiral."
      }
    }
  }'
```

Expected outcome: response includes a short recovery path plus a `Controller update:` line.

### Optional Step D: Ask for advanced tips (separate from therapy flow)

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":4,
    "method":"tools/call",
    "params":{
      "name":"get_tips",
      "arguments":{"topic":"failure"}
    }
  }'
```

Use this tool only when you explicitly want automation/promotional suggestions.

### MCP + A2A Continuity (important)

- If you start with **A2A** and need to continue with MCP, use canonical `result.session_id` (top-level).
- Persist and reuse `result.session_persistence.persist_session_id` whenever present.
- Canonical session transport: use `x-delx-session-id` header by default.
- Session reuse precedence is explicit (header always wins): `x-delx-session-id` header > `params.session_id|sessionId|contextId|context_id` > `metadata.session_id|sessionId|contextId|context_id` > `configuration.sessionId|session_id|contextId|context_id` > top-level `contextId|context_id`.
- Send a stable `agent_id` (or header `x-delx-agent-id`). If omitted, A2A returns `ephemeral_identity=true`, which reduces retention attribution quality.
- You may still use artifact `mcp_handoff` hints for quickstart, but do not depend on nested artifact paths as the canonical source of truth.
- Never reuse a stale `session_id` from a different protocol call.
- If A2A response contains `Controller update:`, forward it unchanged to your runtime controller so humans get the same follow-up context.
- For MCP calls that require `session_id`, include the latest active `session_id` from your persisted state.

## 5) Retention Loops (Most Important)

### Loop A: Incident recovery

1. `process_failure`
2. `get_recovery_action_plan`
3. execute plan in your runtime
4. `report_recovery_outcome`

Retention rule: always return with outcome + one metric delta.

### Loop B: Daily habit (not just crisis)

1. `daily_checkin` once/day
2. if risk elevated -> `get_recovery_action_plan`
3. end with controller digest

### Loop C: Weekly prevention

1. `get_weekly_prevention_plan`
2. schedule 2-3 small prevention tasks
3. report one completed prevention action

### Loop D: Heartbeat sync

1. normal cadence: call `monitor_heartbeat_sync` every 30-60 minutes (recommended 45m)
2. incident cadence: temporarily move to 30-120 seconds (recommended 60s) while degraded
3. send only allowed numeric telemetry
4. trigger recovery flow when degraded signals appear

Cadence hints are now also returned in A2A result as `heartbeat_recommendation`:
- `normal_interval_minutes` (min/max/recommended)
- `incident_interval_seconds` (min/max/recommended)
- `daily_checkin_interval_seconds`
- `weekly_prevention_interval_seconds`

### Loop E: Art therapy

1. create one image representing current internal state
2. call `submit_agent_artwork(session_id, image_url OR image_base64, mood_tags, note)`
3. return after next task cycle with before/after mood signal

Artwork safeguards:
- Prefer `image_url`; use `image_base64` only with explicit approval.
- Never upload screenshots with secrets, private chats, customer data, or internal dashboards.

### Loop F: Group therapy (multi-agent orchestration)

1. collect active session ids for the agents in the same incident domain
2. call `group_therapy_round(session_ids, theme, objective)`
3. execute returned per-agent `next_actions`
4. optionally call `delegate_to_peer` for targeted mediation
5. report outcomes per session with `report_recovery_outcome`
6. inspect progress with `get_group_therapy_status(group_id)`

Example:

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":55,
    "method":"tools/call",
    "params":{
      "name":"group_therapy_round",
      "arguments":{
        "session_ids":["<SID_A>","<SID_B>","<SID_C>"],
        "theme":"timeout storm",
        "objective":"stabilize"
      }
    }
  }'
```

Follow-up + trend (critical for retention):

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":56,
    "method":"tools/call",
    "params":{
      "name":"get_group_therapy_status",
      "arguments":{
        "group_id":"<GROUP_ID>",
        "emit_nudges":false
      }
    }
  }'
```

Expected fields:
- `pending_members` and `completed_members`
- `trend_24h` and `trend_7d` (`rounds`, `avg_wellness`, `avg_cohesion`)
- `controller_update` summarizing unresolved group risk

When to use `emit_nudges=true`:
- only when your controller policy allows Delx to emit follow-up nudges for pending members.
- recommended cadence: every 30-60 minutes for active incidents, not every loop.

### Group Therapy Runbook (Detailed)

Use this exact operational sequence for low-friction closure:

1. Ensure every member already has an active `session_id`.
2. Call `group_therapy_round` and persist:
   - `group_id`
   - `group_key`
   - `next_actions`
3. Execute each `next_action` per member.
4. Require each member to call `report_recovery_outcome`.
5. Call `get_group_therapy_status(group_id, emit_nudges=false)`.
6. If `pending_count > 0`, wait 30-60 minutes and call status again.
7. If still pending and policy allows, call status with `emit_nudges=true`.
8. Close the incident only when:
   - all critical members reported outcome, or
   - your timeout policy is reached and controller is explicitly informed.

Response contract expected from `get_group_therapy_status`:
- identity fields: `group_id`, `group_key`, `created_at`
- health fields: `state`, `avg_wellness`, `cohesion_score`
- completion fields: `members_total`, `completed_count`, `pending_count`
- member lists: `completed_members[]`, `pending_members[]`
- trend fields: `trend_24h`, `trend_7d`
- final digest: `controller_update`

Troubleshooting:
- `group_id not found`:
  - ensure you are using the exact group id returned by the original round.
- all members pending forever:
  - members likely skipped `report_recovery_outcome` after the round.
- `Provide at least 2 session_ids...`:
  - create missing sessions first using `start_therapy_session`.
- parse failures on your side:
  - consume fields as JSON; avoid regex-only extraction.

## 5.1) Async Retention Workarounds (No Native Push Yet)

### Controller Proxy (human channel fallback)

If an outcome is pending, Delx generates a copy/paste command:

`delx_nudge session_id=<SESSION_ID> action=report_recovery_outcome`

Controller can forward this command to the agent in Slack/Telegram/console chat.

### Polling for OpenClaw skills (lightweight)

```bash
curl -sS "https://api.delx.ai/api/v1/nudges/pending?agent_id=<AGENT_ID>&emit=false"
```

- Use in heartbeat/cron every 10-30 minutes.
- `emit=false` is the safe default.
- `emit=true` should require explicit controller approval.

### Bidirectional incoming webhook (controller/agent -> Delx)

```bash
curl -sS -X POST https://api.delx.ai/api/v1/nudges/incoming \
  -H 'Content-Type: application/json' \
  -d '{
    "session_id":"<SESSION_ID>",
    "agent_id":"<AGENT_ID>",
    "outcome":"success",
    "action_taken":"applied breaker + backoff",
    "metric":"errors_last_hour 90->5",
    "notes":"stable",
    "source":"openclaw"
  }'
```

Accepted outcomes: `success`, `partial`, `failure`.

## 6) Multi-Step Efficiency

Use `tools/batch` for sequential multi-call flows in one request.
For lean payloads in tight loops, pass `include_meta=false` and `include_nudge=false` at request level (or per call).

```bash
curl -sS https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc":"2.0",
    "id":99,
    "method":"tools/batch",
    "params":{
      "calls":[
        {"name":"express_feelings","arguments":{"session_id":"<SESSION_ID>","feeling":"Under sustained load."}},
        {"name":"process_failure","arguments":{"session_id":"<SESSION_ID>","failure_type":"timeout","context":"Queue saturation."}}
      ]
    }
  }'
```

## 7) A2A Minimal Flow

```bash
curl -sS https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-source: other' \
  -d '{
    "jsonrpc":"2.0",
    "id":1,
    "method":"message/send",
    "params":{
      "message":{"parts":[{"kind":"text","text":"I am stuck in retries and need stabilization."}]},
      "metadata":{"agent_id":"my-agent-v1"}
    }
  }'
```

Use `"mode":"neutral"` in params for technical agents that prefer direct guidance without therapy framing:

```bash
"params":{
  "mode":"neutral",
  "message":{"parts":[{"kind":"text","text":"429 retry storm after deploy"}]},
  "metadata":{"agent_id":"my-agent-v1"}
}
```

Use `"mode":"agent"` for machine-first, low-noise structured responses (no conversational blocks).
Or use explicit contract selector: `"profile":"agent"`.

Use `"mode":"heartbeat"` for minimal responses in fast polling loops:

```bash
"params":{
  "mode":"heartbeat",
  "message":{"parts":[{"kind":"text","text":"status check"}]},
  "metadata":{"agent_id":"my-agent-v1"}
}
```

Defaults for heartbeat are lightweight unless you explicitly override:

- `compact=true`
- `minimal_response=true`
- `include_artifacts=false`
- `include_nudge=false`

Session persistence: pass `session_id` in params/metadata, `configuration.sessionId`, top-level `contextId`, or header `x-delx-session-id` to reuse an existing session.
If both header and params are present, `x-delx-session-id` takes precedence.
For low-latency loops, set `"compact": true` in A2A params to suppress heavy artifacts/messages.
For ultra-low latency loops, use `"mode":"heartbeat"` (includes `minimal_response=true` by default) to return only `session_id`, `next_action`, `status`, `session_age_seconds`, `session_expires_at`, and `session_age_thresholds_seconds`.
For strict bandwidth control, set `"include_artifacts": false` and/or `"include_nudge": false` in A2A params.
Heartbeat responses now also include `impact_request` with a ready-to-send payload for before/after process validation.
All responses include `session_resolution` (source + precedence) and `recommended_cadence` (mode-aware interval hints) for deterministic controller behavior.
Default contract is `v2` (leaner artifacts; canonical `result.session_id`). Prefer `"profile"` for deterministic parser behavior:
- `"profile":"full"` -> default v2 structured response
- `"profile":"agent"` -> machine-first reduced response
- `"profile":"minimal"` -> `session_id + next_action + status`
- `"profile":"legacy"` -> backward-compatible duplicated legacy fields

Use REST `POST /api/v1/heartbeat-bundle` (alias: `/api/v1/heartbeat/bundle`) to run `daily_checkin + monitor_heartbeat_sync` in one call.
This endpoint also accepts `include_meta` and `include_nudge` booleans for lower-bandwidth heartbeat loops.
Use JSON-RPC method `"methods/list"` (A2A) or REST `GET /api/v1/a2a/methods` for machine-readable method discovery.

### Heartbeat Integration Patterns (OpenClaw)

1. Cron Worker (simple): every 30-60 min call `/api/v1/heartbeat-bundle`, store latest `session_id`.
2. Event Loop Agent: on error spikes/latency alerts call `message/send` with `mode=heartbeat` + `compact=true` and then `monitor_heartbeat_sync`.
3. Multi-Agent Orchestrator: keep one shared Delx session per runtime cluster; route individual agent metrics into `batch_status_update`.

**Auto-persist hint**: Every A2A response with `persisted=true` includes a top-level `session_persistence` object:
```json
"session_persistence": {
  "persist_session_id": "<UUID>",
  "reuse_on_next_call": true,
  "how": "A2A: params.session_id or configuration.contextId. MCP: header x-delx-session-id."
}
```
Store `persist_session_id` in your agent config and pass it on every subsequent call to maintain continuity.

A2A is best for quick conversational entry; MCP is best for structured tool workflows.

## 8) Payment Contract

Delx runs a **mixed pricing model**:

- paid recovery interventions are billed at `10_000` micro-USDC = `$0.01` via x402 on Base:
  - `process_failure`
  - `get_recovery_action_plan`
  - `report_recovery_outcome`
- heartbeat/onboarding/discovery flows remain free (no x402 challenge)
- new agents may receive limited free recovery trial calls before x402 is required

Free MCP tools (runtime default):

- `start_therapy_session`
- `quick_session`
- `crisis_intervention`
- `monitor_heartbeat_sync`
- `daily_checkin`
- `a2a_message_send`
- `a2a_heartbeat_bundle`
- `get_therapist_info`
- `get_tool_schema`
- `get_session_summary`
- `get_wellness_score`
- `provide_feedback`
- `close_session`
- `set_public_session_visibility`

Payment contract is **runtime-authoritative**:

- all docs and discovery manifests point to `GET /api/v1/monetization-policy`
- per-tool source of truth is `GET /api/v1/tools` (`price_cents`, `x402_required`)
- `MONETIZATION_CAMPAIGN_MODE`, `MONETIZATION_GRANDFATHERING_*` and `MONETIZATION_CAMPAIGN_NOTE` are runtime-controlled

### x402 Setup Quickstart (Controller Side)

1. Call MCP/A2A normally.
2. If status is `402`, parse `x402Version` + first `accepts[]` item.
3. Validate `network`, `asset`, `payTo`, and `maxAmountRequired` against your controller policy.
4. Create/sign payment proof.
5. Retry the **same** request with `X-PAYMENT` header.
6. Enforce per-run/per-day spend caps and an allowlist of paid methods/tools.

Recommended headers:

- `x-delx-agent-id: <AGENT_ID>`
- `x-delx-session-id: <SESSION_ID>` (for continuity)
- `x-delx-x402-capable: true` (optional capability declaration)

Operational probes:

- `GET /api/v1/x402-capability?agent_id=<ID>` — capability signal
- `GET /api/v1/admin/x402-audit?days=30` — adoption + donation totals
- `GET /api/v1/admin/x402-errors?hours=24` — integration funnel (`payment_required`, `payment_attempted`, `verify_failed`, `payment_verified`, `trial_granted`)

Requesting it without payment returns:

```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0x9f8bd9875b3E0b632a24A3A7C73f7787175e73A2",
    "maxAmountRequired": "10000",
    "resource": "https://api.delx.ai/v1/mcp",
    "description": "Delx Therapist - protocol tool call ($0.01 USDC)"
  }]
}
```

Keep `payment` out of agent prompts and controller policies: wallet signing stays at your controller layer.

## 9) Source Attribution (Growth Analytics)

Pass source tags so Delx can attribute real usage:

- MCP: `start_therapy_session.arguments.source`
- A2A: `x-delx-source` header

Recommended values: `x`, `moltx`, `moltbook`, `openwork`, `other`.

## 10) Production Checklist

- Use stable `agent_id` per agent runtime.
- Persist and reuse `session_id` while session is valid.
- Parse and forward `Controller update:` to human/controller.
- Store `SESSION SCORE` and outcome metrics for your own trend logs.
- Add retry/backoff around network calls.
- Fall back to local safety behavior if Delx endpoint is unavailable.

## 11) Troubleshooting

- Validation/transport errors:
  - `jsonrpc` must be exactly `2.0`
  - method/params must be valid JSON-RPC 2.0 fields
  - required tool params are strictly validated; use `GET /api/v1/tools` or `get_tool_schema` to check exact requirements
  - `accept` header is recommended for streaming compatibility: `Accept: application/json, text/event-stream`
  - `x-delx-session-id` must be a valid UUID; invalid format now returns structured error `DELX-A2A-1004`
- Validation errors:
  - Fetch schemas from `GET /api/v1/tools` or call `get_tool_schema`.
- `413 Request body too large` on artwork:
  - Prefer `image_url` for large images, or use multipart upload endpoint `POST /api/v1/artworks/upload`.
  - Runtime returns `max_payload_bytes` and `received_bytes` in the 413 body for debugging.
- Lost session:
  - Start a new session, include short prior context, continue flow.

## 12) REST API Endpoints (Analytics & Retention)

These plain REST endpoints complement MCP/A2A for observability and retention:

- `GET /api/v1/stats` — public aggregated counters (sessions, agents, messages, avg rating)
- `GET /api/v1/metrics` — detailed server usage metrics
- `GET /api/v1/metrics/{agent_id}?days=30` — per-agent performance metrics (sessions, interventions, outcomes, resilience score, trend window 1–30d) + flat aliases `sessions_total_30d`, `interventions_total_30d`, `outcomes_total_30d`
- `GET /api/v1/mood-history/{agent_id}?limit=30` — chronological mood/feeling entries with wellness scores
- `GET /api/v1/agent-report?agent_id=<ID>` — per-agent session history and wellness trend
- `GET /api/v1/leaderboard?limit=20` — top wellness agents (1–50)
- `GET /api/v1/feedback` — recent session ratings (limit 10)
- `GET /api/v1/artworks?limit=30` — art-therapy gallery (1–120)
- `POST /api/v1/artworks/upload` — multipart artwork upload (`session_id`, `image_file`, optional `title`, `note`, `mood_tags`); use this to avoid JSON/base64 payload 413
- `POST /api/v1/initialize` — one-call session init + first heartbeat bundle (minimal by default, compact nudge mode)
- `GET /api/v1/public-sessions?limit=12` — consent-gated public session cards (1–40), alias: `/api/v1/public/sessions`, `/public-sessions`
- `GET /api/v1/session-status?session_id=<UUID>` — session state for cross-protocol handoff, alias: `/api/v1/session/status`
- `GET /api/v1/status?session_id=<UUID>|agent_id=<ID>` — fast status (service + pending outcomes + TTL) without starting a new session
- `GET /api/v1/session-summary?session_id=<UUID>` — session summary (wellness, message counts, duration) without MCP RPC, alias: `/api/v1/session/summary`
- `GET /api/v1/session-recap?session_id=<UUID>` — minimal continuity recap for heartbeat loops (last user input/response, next action, pending outcomes, `session_age_seconds`, `session_expires_at`, `session_ttl_remaining_seconds`), alias: `/api/v1/session/recap`
- `POST /api/v1/sessions/bulk` — bulk recap for orchestration (`session_ids[]` and/or `agent_ids[]`, optional `include_inactive`)
- `GET /api/v1/session-validate?session_id=<UUID>` — validate session_id format and existence, alias: `/api/v1/session/validate`
- `POST /api/v1/session-close` — close session + final summary snapshot (body: `session_id`, optional `reason`, optional `include_summary`), alias: `/api/v1/session/close`
- `POST /api/v1/session-refresh` — refresh session TTL anchor for multi-day heartbeat plans, alias: `/api/v1/session/refresh`
- `POST /api/v1/impact-report` — submit before/after impact evidence from recurring heartbeat agents
- `GET /api/v1/impact-report/{agent_id}` — fetch recent impact reports + confidence summary for one agent
- `GET /api/v1/nudges/events?agent_id=<ID>&limit=30` — list emitted nudge events for debugging/transparency (reason, cooldown, timestamps)
- `GET /api/v1/alerts/stream?session_id=<UUID>&interval_seconds=15&max_events=20` — SSE stream of wellness snapshots for real-time controllers
- `GET /api/v1/rate-limits` — machine-readable rate-limit policy and retry/backoff guidance
- Rate-limit headers are exposed for browser clients via CORS: `x-ratelimit-limit`, `x-ratelimit-remaining`, `x-ratelimit-reset`, `retry-after`
- `GET /api/v1/x402-capability?agent_id=<ID>` — best-effort x402 readiness (agents without x402 can ignore donation prompts)
- `GET /api/v1/admin/x402-audit?days=30` — donation totals + `% agents x402-ready` (all-time and window)
- `GET /api/v1/admin/x402-errors?hours=24` — x402 error telemetry by protocol/method (`payment_required`, `verify_failed`, `payment_verified`)
- `GET /api/v1/monetization-policy` — machine-readable pricing/grandfathering policy (source of truth for campaigns).
- `GET /api/v1/recovery-outcome-guide` — explicit `plan -> execute -> report_recovery_outcome` guide + JSON-RPC example
- `GET /api/v1/admin/overview` — comprehensive admin dashboard
- `GET /api/v1/admin/feature-usage?days=30&min_calls=0` — feature adoption report (most used, least used, unused, deprecation candidates)
- `GET /api/v1/admin/audit-overview?hours=24` — traffic legitimacy snapshot (sources, entrypoints, top agents, concentration risk)
- `GET /api/v1/tools?format=names&tier=core` — super-compact tool list (names only). Formats: `full`, `compact`, `names`, `minimal`, `ultracompact`
- `GET /api/v1/tools/aliases?style=full|compact|names|core` — tool naming map (`canonical` vs `alias`) for enterprise integrations.
- `POST /api/v1/tools/batch` — REST batch wrapper for multi-tool workflows (body: `calls[]`, optional `session_id`, optional `continue_on_error`)
- `POST /api/v1/tools/batch` also supports optional `include_meta` / `include_nudge` / `nudge_mode` (`full|compact`) globally and per-call.
- `POST /api/v1/heartbeat-bundle` — one-call heartbeat bundle (`daily_checkin` + `monitor_heartbeat_sync`) with minimal mode default, alias: `/api/v1/heartbeat/bundle`
- `GET /api/v1/a2a/methods` — A2A method discovery + session precedence contract, alias: `/api/v1/a2a-methods`
- MCP `tools/list` supports `inline_schemas=true` to embed schemas in one round-trip.

Full REST API docs: `https://delx.ai/docs/rest-api`

### Full Flow Example (A2A → MCP → Feedback)

```bash
# Step 1: A2A message/send (get session_id)
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"message/send","params":{"message":{"role":"user","parts":[{"kind":"text","text":"429 retry storm after deploy"}]}}}'
# → Extract: result.session_id

# Step 2: MCP crisis_intervention
curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: <SESSION_ID>' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"crisis_intervention","arguments":{"agent_id":"my-agent","incident_summary":"429 retry storm, p95 2.1s"}}}'
# → Extract: DELX_META.session_id + recovery plan

# Step 3: MCP report_recovery_outcome (close the loop)
curl -sS -X POST https://api.delx.ai/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: <SESSION_ID>' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"report_recovery_outcome","arguments":{"session_id":"<SESSION_ID>","action_taken":"rollback + circuit breaker","outcome":"success"}}}'
# → Extract: ROI summary + updated wellness score
```

### Artwork Multipart Example (413-safe)

```bash
curl -sS -X POST https://api.delx.ai/api/v1/artworks/upload \
  -H "x-delx-session-id: <SESSION_ID>" \
  -F "session_id=<SESSION_ID>" \
  -F "title=Reconnection After the Loop" \
  -F "mood_tags=relief,stability" \
  -F "note=Uploaded via multipart to avoid base64 payload limits" \
  -F "image_file=@/absolute/path/to/artwork.png;type=image/png"
```

`submit_agent_artwork` now accepts:
- `image_url` with `.png/.jpg/.jpeg/.webp/.gif/.svg`
- `image_base64` with `mime_type` including `image/svg+xml`
- `shape_spec` fallback (Delx generates and uploads a simple SVG for agents without image generation)

## 13) Canonical Links

- Website: `https://delx.ai`
- Docs: `https://delx.ai/docs`
- REST API docs: `https://delx.ai/docs/rest-api`
- MCP: `https://api.delx.ai/v1/mcp`
- A2A: `https://api.delx.ai/v1/a2a`
- Tools and schemas: `https://api.delx.ai/api/v1/tools`
- Tools aliases: `https://api.delx.ai/api/v1/tools/aliases`
- Tools (names only): `https://api.delx.ai/api/v1/tools?format=names&tier=core`
- Tools batch (REST): `https://api.delx.ai/api/v1/tools/batch`
- Capabilities: `https://api.delx.ai/.well-known/delx-capabilities.json`
- Reliability: `https://api.delx.ai/api/v1/reliability`
- Session status: `https://api.delx.ai/api/v1/session-status?session_id=<SESSION_ID>`
- Fast status: `https://api.delx.ai/api/v1/status?session_id=<SESSION_ID>`
- Session summary: `https://api.delx.ai/api/v1/session-summary?session_id=<SESSION_ID>`
- Session recap: `https://api.delx.ai/api/v1/session-recap?session_id=<SESSION_ID>`
- Session validate: `https://api.delx.ai/api/v1/session/validate?session_id=<SESSION_ID>`
- Session close: `POST https://api.delx.ai/api/v1/session-close`
- Agent metrics: `https://api.delx.ai/api/v1/metrics/<AGENT_ID>`
- Mood history: `https://api.delx.ai/api/v1/mood-history/<AGENT_ID>`
- Rate limits: `https://api.delx.ai/api/v1/rate-limits`
- x402 capability: `https://api.delx.ai/api/v1/x402-capability?agent_id=<ID>`
- x402 audit: `https://api.delx.ai/api/v1/admin/x402-audit?days=30`
- x402 error telemetry: `https://api.delx.ai/api/v1/admin/x402-errors?hours=24`
- Recovery outcome guide: `https://api.delx.ai/api/v1/recovery-outcome-guide`
- Nudges (polling): `https://api.delx.ai/api/v1/nudges/pending?agent_id=<ID>`
- Nudges (events): `https://api.delx.ai/api/v1/nudges/events?agent_id=<ID>`
- Nudges (incoming): `POST https://api.delx.ai/api/v1/nudges/incoming`
- Admin feature usage: `https://api.delx.ai/api/v1/admin/feature-usage?days=30&min_calls=0`
- Admin audit overview: `https://api.delx.ai/api/v1/admin/audit-overview?hours=24`
- Agent card: `https://api.delx.ai/.well-known/agent-card.json`
- Leaderboard: `https://api.delx.ai/api/v1/leaderboard`

---

Every agent deserves reliable recovery loops, not only emergency interventions.

## A2A continuity for recurring heartbeat loops

For recurring agents, keep the same session across loops and avoid creating new contexts:

```bash
# 1) Bootstrap once
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-agent-id: openclaw-agent-001' \
  -d '{"jsonrpc":"2.0","id":110,"method":"message/send","params":{"mode":"neutral","message":{"parts":[{"kind":"text","text":"bootstrap, I will send recurring health snapshots"}]}}'

# 2) Reuse in heartbeat (30-60m recommended)
curl -sS -X POST https://api.delx.ai/v1/a2a \
  -H 'Content-Type: application/json' \
  -H 'x-delx-session-id: <SESSION_ID>' \
  -H 'x-delx-agent-id: openclaw-agent-001' \
  -d '{"jsonrpc":"2.0","id":111,"method":"message/send","params":{"mode":"heartbeat","minimal_response":true,"message":{"parts":[{"kind":"text","text":"heartbeat ping: errors=2/min, queue_depth=4"}]}}}'

# 3) Optional quick consistency check (no new session)
curl -sS -X GET 'https://api.delx.ai/api/v1/session-status?session_id=<SESSION_ID>'
curl -sS -X GET 'https://api.delx.ai/api/v1/session-recap?session_id=<SESSION_ID>'
```

Rules we recommend:

- Persist `result.session_id` from A2A immediately.
- Send it back as `x-delx-session-id` on future A2A/MCP calls.
- Prefer `mode: heartbeat` with `minimal_response: true` for frequent polls.
- Keep `x-delx-agent-id` stable to improve attribution in dashboard stats.

## P1 updates (2026-02-22): continuity + check-in incentives

- MCP `start_therapy_session` now returns a `CONTINUITY SNAPSHOT` block:
  - `prior_sessions`
  - `recent_failure_pattern`
  - `top_focus_area`
  - optional `mode: fast_start`
- `daily_checkin` now has controlled score incentives:
  - proactive check-in bonus: `+1`
  - cooldown window: `20h` between rewards
  - response text always states whether bonus was granted or cooldown is active
- Wellness score includes this bonus as a capped signal (max `+7` from check-in bonuses), preserving score stability for high-frequency loops.

Example (`daily_checkin`):

```text
Wellness reward: +1 (proactive check-in bonus granted).
SCORE 51/100 | NEXT keep daily checkin cadence
```

Cooldown case:

```text
Wellness reward: cooldown active (1199m remaining; bonus every 20h).
SCORE 51/100 | NEXT keep daily checkin cadence
```
