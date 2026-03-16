# Walk State Contract

## Purpose

This document specifies the persisted state contract for stepwise bracket workflows:

- `walk-next`
- `walk-apply`
- `walk-run-policy`

The goal is reliable resumption across long-running agent sessions, retries, and multi-process handoffs.

## State File

Default path:

- `out/model-walk-picks.json`

Override with:

- `PICKS_FILE` env var
- `--picks-file` CLI option

## Persisted Shape

Current persisted shape (v1 behavior):

```json
{
  "updatedAt": "2026-03-13T00:00:00.000Z",
  "predictions": [1, 32, 17]
}
```

Rules:

- `predictions` is append-only in game order
- length must be `0..63`
- each value must be a valid winner seed (`1..64`)
- every new pick must be legal for the current matchup

## Command Semantics

### `walk-next`

- reads tournament + team data + picks
- replays picks deterministically
- returns next legal matchup (`teamA`, `teamB`) or `done: true`

### `walk-apply`

- validates `winnerSeed` for the current matchup
- appends one pick to state
- writes updated state file
- returns updated next state

### `walk-run-policy`

- loads policy function
- repeatedly evaluates current matchup and appends picks until completion
- writes updated state and final prediction output

## Resume & Retry Guidance

For robust agent orchestration:

1. treat `PICKS_FILE` as source of truth
2. call `walk-next` before each decision
3. call `walk-apply` exactly once per accepted decision
4. on uncertain execution, re-call `walk-next` to confirm current game index before applying

This avoids duplicate picks when retries happen.

## Concurrency Guidance

`walk` commands are currently single-writer oriented.

If multiple agents/processes may write:

- lock externally around `PICKS_FILE`, or
- assign one writer process and use message passing

Without coordination, concurrent writes can overwrite state.

## Compatibility Notes

- current persisted state does not yet include explicit `schemaVersion`
- consumers should tolerate additional future metadata fields
- state is intentionally minimal so it can be transported in chat/context as needed

## Planned Follow-up

- add `schemaVersion` to persisted picks state
- add optional integrity metadata (`expectedGameIndex`, checksum)
