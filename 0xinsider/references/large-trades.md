# Large trades

Large trades on Polymarket sports and esports markets, as 0xinsider ingests
them: what was traded, by which graded wallet, and how unusual it was.

## Calls

| Need | REST | MCP tool |
| --- | --- | --- |
| Recent feed | `GET /api/v1/large-trades` | `get_large_trades` |
| One trade | `GET /api/v1/large-trades/{id}` | `get_large_trade` |
| History replay | `GET /api/v1/large-trades/history` | `get_large_trades_history` |
| Resumable event cursor | `GET /api/v1/events/feed/since` | `get_event_replay_since` |
| Large open positions | `GET /api/v1/large-positions` | `get_large_positions` |

```bash
curl -s 'https://0xinsider.com/sandbox/api/v1/large-trades?limit=25'
```

Page with the documented cursor. The feed moves while it is read, so an offset
silently skips or repeats rows.

The `/whale-trades` paths and the `get_whale_trade*` tools are deprecated
aliases of these. On 2027-02-01 the paths start returning `410 Gone` and the
tools are removed.

## Review score

Every feed trade carries `review_score`, from 0.0 to 1.0. It ranks attention,
not outcomes: a 0.9 means the trade is unusual enough to look at, not that the
position wins. `recorded_review_score` is the score written when the row was
inserted; it is null for rows before 2026-08-03 and is never backfilled.
`signal_score` and `recorded_signal_score` are deprecated aliases of the two.

It is a separate quantity from a suspicious-trade flag's 0 to 100
`suspicion_score`, and the two do not convert. Never present either as a
probability or an expected return.

## Counterparties

A large trade fills against other orders. Two paged sub-resources show who was
on the other side:

- `GET /api/v1/large-trades/{id}/counterparties/executions` (`get_large_trade_counterparty_executions`)
- `GET /api/v1/large-trades/{id}/counterparties/executions/{execution_id}/makers` (`get_large_trade_counterparty_makers`)

Follow the cursor to completion before totaling anything. A partial page is a
partial total, not a small one.

## Replay before settlement

`GET /api/v1/large-trades/history` answers what large-trade activity a market
saw before it resolved. Constrain it by `condition_id` and a `from`/`to` window
rather than pulling the whole range and filtering client side.

`GET /api/v1/events/feed/since` replays from a cursor you hold, so an alert or
incremental sync that restarts neither drops nor duplicates events.

## Push

`GET /api/v1/stream` is a resumable SSE stream. Webhooks are the push
alternative: create a destination under `/api/v1/webhooks`, verify it, read
`/api/v1/webhooks/events` for the event catalog, rotate the signing secret with
`/api/v1/webhooks/{id}/rotate-secret`, and verify every delivery signature.

## Coverage

The feed covers sports and esports markets only, and it is what 0xinsider
ingests from Polymarket, not complete exchange history. Report counts as "in
the tracked feed", and never imply a zero where the answer is an absence of
coverage.
