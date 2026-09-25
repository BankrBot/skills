# Large trades

Large trades on Polymarket sports and esports markets, as 0xinsider ingests
them: what was traded, by which graded wallet, and how unusual it was.

## Calls

| Need | REST | MCP tool |
| --- | --- | --- |
| Recent feed | `GET /api/v1/whale-trades` | `get_whale_trades` |
| One trade | `GET /api/v1/whale-trades/{id}` | `get_whale_trade` |
| History replay | `GET /api/v1/whale-trades/history` | `get_whale_trades_history` |
| Resumable event cursor | `GET /api/v1/events/feed/since` | `get_event_replay_since` |
| Large open positions | `GET /api/v1/large-positions` | `get_large_positions` |

```bash
curl -s 'https://0xinsider.com/sandbox/api/v1/whale-trades?limit=25'
```

Page with the documented cursor. The feed moves while it is read, so an offset
silently skips or repeats rows.

## Significance score

Every feed trade carries a significance score from 0.0 to 1.0. It ranks
attention, not outcomes: a 0.9 means the trade is unusual enough to look at,
not that the position wins. It is a separate quantity from Insider Radar's
0 to 100 review score and the two do not convert. Never present it as a
probability or an expected return.

## Counterparties

A large trade fills against other orders. Two paged sub-resources show who was
on the other side:

- `GET /api/v1/whale-trades/{id}/counterparties/executions`
- `GET /api/v1/whale-trades/{id}/counterparties/executions/{execution_id}/makers`

Follow the cursor to completion before totaling anything. A partial page is a
partial total, not a small one.

## Replay before settlement

`GET /api/v1/whale-trades/history` answers what large-trade activity a market
saw before it resolved. Constrain it by market and time window rather than
pulling the whole range and filtering client side.

`GET /api/v1/events/feed/since` replays from a cursor you hold, so an alert or
incremental sync that restarts neither drops nor duplicates events.

## Push

`GET /api/v1/stream` is a resumable SSE stream. Webhooks are the push
alternative: create a destination under `/api/v1/webhooks`, verify it, read
`/api/v1/webhooks/events` for the event catalog, rotate the signing secret with
`/api/v1/webhooks/{id}/rotate-secret`, and verify every delivery signature.

## Coverage

The feed is what 0xinsider ingests from Polymarket, not complete exchange
history. Report counts as "in the tracked feed", and never imply a zero where
the answer is an absence of coverage.
