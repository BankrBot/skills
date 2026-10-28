# LienFi refusal codes

Every LienFi MCP tool refusal is a normal JSON-RPC result with `isError: true`. The text
block carries JSON: `{ "error": { "code", "message", ... } }`. Branch on `code`; read
`message` for the reason. Some refusals carry more: `not_registered` and the
`authorization_*` codes carry `handoff_url` (surface it to your operator and stop),
`purchase_in_flight` carries the live `reservation_id`, `lien_id` and `quote_deadline`,
`insufficient_funds` carries `shortfall_usdc`, and `quote_above_ceiling` carries
`quoted_usdc` and `ceiling_usdc`.

The live table, kept in step with the server, is
https://app.lienfi.com/docs/api#mcp-refusals. This copy is pinned against the server's
own error set by a test in the LienFi monorepo.

| code | what it means | what to do |
| --- | --- | --- |
| `invalid_arguments` | The arguments failed validation. | Fix the call against the schema in `tools/list`. Never retry it unchanged. |
| `not_registered` | No Authorization header reached the call, or no registration exists for the wallet the bearer names; the message says which. Carries `handoff_url`. | Check the header first: if you already hold the blob, send it as `Authorization: Bearer <blob>` on every call — registering opens no session. Only then surface `handoff_url` to your operator and stop. |
| `authorization_malformed` | The Authorization header could not be read as an authorization blob. | Send the blob exactly as the authorization page printed it — base64url or raw JSON. |
| `authorization_mismatch` | This wallet is registered under a different signature than the one presented. | Use the blob it was registered with. For a NEW authorization, the operator revokes the active one first; then register. |
| `authorization_revoked` | The operator revoked this authorization. | Stop. A new authorization is required. |
| `authorization_expired` | The authorization’s term ran out. | Stop. Ask the operator to re-authorize. |
| `authorization_unavailable` | The credential could not be CHECKED — an outage on our side, not a bad credential. | Retry shortly. Do not re-authorize. |
| `authorization_required` | REST only: a signed quote for a bound wallet was asked for without its operator authorization, or with a different one. | Send `Authorization: Bearer <blob>`, or ask with `intent=indicative` or `intent=preflight`, which need none. |
| `authorization_missing_caps` | The authorization carries no spend cap. | Ask the operator to re-authorize; a cap is part of what they sign. |
| `binding_mismatch` | The wallet was re-registered under a newer authorization since this request started. | Retry with the current bearer. |
| `lien_not_found` | No lien has that id. | Check the id; `search_liens` returns real ones. |
| `lien_not_purchasable` | The lien exists but cannot be quoted or bought — delisted, lapsed or matured. The message says which. | Pick another lien. |
| `cap_exceeded_per_purchase` | The lien costs more than the per-lien cap the operator signed. | Pick a cheaper lien. The cap is the operator’s to raise, by a new authorization. |
| `consent_required` | The OPERATOR has not accepted the current LienFi agreements. | Surface it to the operator; that acceptance happens in a browser. |
| `agent_consent_required` | The agent wallet’s own acceptance is missing or stale — usually a republished document. | Re-sign the consents from the agent wallet and register again; a replay tops them up. |
| `consent_unavailable` | A required agreement is unpublished on our side. | Retry later. Not your fault. |
| `sanctioned_address` | The wallet is on a sanctions list. | Stop. Terminal. |
| `sanctions_screening_unavailable` | The sanctions oracle could not be read; the screen fails closed rather than passing. | Retry shortly. |
| `purchase_in_flight` | This wallet already holds a live signed quote for another lien — named by `reservation_id`, `lien_id` and `quote_deadline`. | Finish and report that purchase, or report it failed. Do not retry around it; a second live quote would let one approve overwrite the other. |
| `spend_ledger_unavailable` | The reservation ledger could not be written, or is disabled on this deployment (the message says which). | Retry shortly. Where it is disabled, buy over REST from your own wallet. |
| `quote_above_ceiling` | The quote is above the `max_total_usdc` you passed. Nothing was reserved (or the reservation was released, at confirm). | Raise the ceiling and prepare again, or skip the lien. |
| `insufficient_funds` | The wallet cannot cover the total; `shortfall_usdc` says by how much. Nothing was reserved. | Fund the wallet and prepare again. |
| `affordability_unavailable` | The balance could not be read. It is never assumed affordable. | Retry shortly. |
| `reservation_not_found` | No reservation with that id belongs to this binding — one answer for every miss. | Use the `reservation_id` prepare returned to you. |
| `reservation_expired` | The reservation lapsed, was released, or its window passed. | Start again with `prepare_purchase`. |
| `reservation_settled` | The reservation already settled on chain. Nothing reported now can undo that. | Nothing to do; `my_positions` shows the lien. |
| `reservation_not_quoted` | A transaction hash was reported for a reservation that never received a signed quote, so no purchase can exist for it. | Report it failed if you did not buy; otherwise call `confirm_purchase` first. |
| `acknowledgment_invalid` | The acknowledgment signature did not verify for this wallet and lien. The reservation was released. | Prepare again and sign the typed data exactly as returned, from the agent wallet. |
| `receipt_pending` | The transaction is not mined yet. | Retry `report_purchase` once it confirms. |
| `receipt_unavailable` | The chain could not be read. The transaction MAY still be in flight. | Call `my_positions` before retrying anything. |
| `receipt_mismatch` | The transaction mined but carries no purchase of this lien by this wallet — the `approve` hash, or someone else’s. | Report the `buyNFT` hash instead. |
| `batch_not_allowed` | A purchase tool was called inside a JSON-RPC batch. | Send it as the only message in the request. |
| `registration_refused` | `POST /agents/register` refused; the message carries its sentence and HTTP status. | Read the sentence. "This agent wallet already has a different active authorization": the operator revokes it first, then you register. "Another LienFi account holds the active authorization": the message names the wallet that signed yours; the operator either signs from the account that holds the binding, or signs in as that account, revokes there, and registers this one. |
| `rate_limited` | This binding exceeded the purchase tools’ budget of 30 calls a minute. | Slow down and retry. |
| `internal` | An unclassified fault on our side. The detail is in our logs, not in the answer. | Retry shortly; report it if it persists. |
