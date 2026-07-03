# Fee claims — Bankr must NOT use /wallet/submit

hood.markets **server-broadcasts** fee claims (launcher wallet pays gas). This is the same pattern as **deploy** — not buy/sell.

## Endpoints

| Who asks | Endpoint | Bankr submit? |
|----------|----------|---------------|
| Anyone helping (e.g. claim for EA's token) | `POST /api/agent/claim-for-recipient` `{ "tokenAddress": "0x…" }` | **NO** |
| Fee recipient claiming own token | `POST /api/agent/claim` + JWT or X wallet | **NO** |

## Success detection (CRITICAL)

When the API returns HTTP 200 and **`ok: true`**:

1. The claim **already succeeded** on Robinhood Chain.
2. Post **`replyHint`** from the JSON **verbatim** (same field Bankr uses for deploy `replyHint`).
3. Also available: `claimReplyHint` (same text), `transactionHash`, `txHash`, `completed: true`, `bankrWalletSubmitRequired: false`.
4. **Never** reply "I didn't submit a transaction" or "I wasn't able to complete" — that only applies to flows that need Bankr `/wallet/submit` (buy/sell).
5. **Never** call `POST https://api.bankr.bot/wallet/submit` for claims.

## Example success response

```json
{
  "ok": true,
  "completed": true,
  "bankrWalletSubmitRequired": false,
  "transactionSubmitted": true,
  "replyHint": "Claim successful — Hoodrich ($HR) trading fees sent to fee wallet 0xDbe9…87a4. WETH should show up in that wallet shortly.",
  "transactionHash": "0x172c…",
  "feeRecipientAddress": "0xDbe9C973117C0A3a3886fD1eF92EEA33949C87a4",
  "tokenName": "Hoodrich",
  "tokenSymbol": "HR"
}
```

**Your tweet reply = `replyHint` only.** Tx link optional.

## Failure

HTTP 4xx or `ok: false` → use `error` field. Do not claim success.
