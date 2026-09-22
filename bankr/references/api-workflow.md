# Agent API Workflow Reference

The Agent API runs natural-language prompts as asynchronous jobs: `POST /agent/prompt` returns a job ID, you poll `GET /agent/job/{jobId}` until the job finishes, then read the result. The key needs `agentApiEnabled`. Exact request and response schemas, including every error body, are in the OpenAPI spec at **`https://docs.bankr.bot/openapi/api.yaml`** (the [Agent API overview](https://docs.bankr.bot/agent-api/overview) always links the current copy), so fetch it for a shape this page doesn't show. Send the key as `X-API-Key: <key>` or `Authorization: Bearer <key>`.

For synchronous wallet operations (`/wallet/*`), see [sign-submit-api.md](sign-submit-api.md), [portfolio.md](portfolio.md) and [transfers.md](transfers.md).

## Using the Bankr CLI

The CLI submits, polls and prints for you:

```bash
bankr agent prompt "What is my ETH balance?"   # submit, poll, print the response
bankr agent status <jobId>                      # one snapshot of a job
bankr agent status <jobId> --wait               # follow a running job to the end
bankr agent cancel <jobId>
```

From `@bankr/cli` 0.3.40, `bankr agent prompt` prints each status update as the run progresses. The progress goes to **stderr**, so `bankr agent prompt "..." > out.txt` captures only the final response. The CLI stops polling after 5 minutes; the job keeps running, and `bankr agent status <jobId> --wait` picks it back up.

## Submitting a prompt

```bash
curl -X POST "https://api.bankr.bot/agent/prompt" \
  -H "X-API-Key: $BANKR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "And what about SOL?", "threadId": "thr_ABC123"}'
```

- `prompt` is required, up to 10,000 characters.
- `threadId` continues a conversation. It must be a thread on this account, or the call answers `404 Thread not found`. Omit it to start a new thread; the response returns the new `threadId`. The CLI equivalents are `--continue` (last thread) and `--thread <id>`.
- `maxMode: { "enabled": true, "model": "<id>" }` runs this prompt on a gateway model billed from LLM credits (see [llm-gateway.md](llm-gateway.md)). A model outside the Max Mode lineup answers `400`; an unknown ID is ignored.
- The response is `202 Accepted` with `jobId`, `threadId` and `status: "pending"`. Nothing has executed yet.

Access and quotas are covered in [safety.md](safety.md#rate-limits): without Bankr Club or Max Mode the call answers `403 subscription_required`, and an exhausted quota answers `429`. A read-only key can prompt, but the agent only gets read tools. The key's recipient allowlist and token-launch flag are enforced inside the agent.

## Job states

| `status` | Meaning | What to do |
|----------|---------|------------|
| `pending` | Queued | Keep polling |
| `processing` | Running | Keep polling and show new `statusUpdates` |
| `completed` | Finished | Read `response` and `richData` |
| `failed` | The agent couldn't finish | Read `error`. The HTTP status is still `200` |
| `cancelled` | Cancelled | Stop |

Fields depend on the state. `response`, `richData` and `completedAt` come with `completed`; `error` and `completedAt` with `failed`; `startedAt` with `processing`; `cancelledAt` with `cancelled`. `cancellable: true` appears while the job is `pending` or `processing`, and `processingTime` (milliseconds) once it's known. `statusUpdates` (`{ message, timestamp }`) appears whenever the agent has reported progress. A job's `error` is the agent's own explanation, not a fixed code.

The Agent API never returns raw `transactions`; the agent describes what it executed in `response`.

## Polling

Poll about every 2 seconds; most jobs finish within a couple of minutes. `statusUpdates` only grows, so show progress by printing the entries past the count you last saw:

```bash
N=0
while :; do
  R=$(curl -s "https://api.bankr.bot/agent/job/$JOB_ID" -H "X-API-Key: $BANKR_API_KEY")
  echo "$R" | jq -r ".statusUpdates // [] | .[$N:][] | .message"
  N=$(echo "$R" | jq '.statusUpdates // [] | length')
  case $(echo "$R" | jq -r .status) in completed|failed|cancelled) break ;; esac
  sleep 2
done
echo "$R" | jq -r '.response // .error'
```

A job ID only resolves for the account that created it; any other account gets `404 Job not found`.

## Rich data

`richData` is an array of structured entries whose shape depends on what the agent did. Each has a `type`, such as `chart` or `image` (with a `url`) or `file-artifact` (a file the agent wrote, with a `downloadUrl`). `response` always carries the full text answer, so treat `richData` as optional.

## Cancelling

`POST /agent/job/{jobId}/cancel` is idempotent: cancelling a cancelled job answers `200` again, and a `completed` or `failed` job answers `400`. Cancelling stops the run at its next step, but a transaction already broadcast, or being broadcast when you cancel, still lands. Check the wallet before assuming nothing executed.
