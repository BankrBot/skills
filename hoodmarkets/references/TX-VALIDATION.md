# Transaction validation (before Bankr /wallet/submit)

## Chain

Every transaction must have `chainId: 4663` (Robinhood Chain).

## Allowed `to` addresses (buy/sell)

| Step | `to` must be |
|------|----------------|
| `buy` | `known-contracts.json` → `contracts.swapHelper` |
| `sell` | `known-contracts.json` → `contracts.swapHelper` |
| `approve` | The **token** being sold (`tokenAddress` from request) |

Reject any other `to` for swap flows.

## Buy transaction

- `value` > 0 (ETH sent with `buy(token, minOut)`)
- `data` targets swap helper `buy` selector
- Token address in calldata must match user-requested `tokenAddress`

## Sell transaction

- `approve` (if present): spender = swap helper; amount ≥ sell amount
- `sell`: `value` = 0; token + amount in calldata match user intent

## Deploy / claim

- **Deploy:** no Bankr submit — server-side only
- **Claim:** no Bankr submit — `POST /api/agent/claim` or `claim-for-recipient`; on `ok: true` post `replyHint` (see `CLAIM-BANKR.md`)

## Abort if

- Wrong chainId
- Unknown contract address
- Calldata token mismatch
- User did not confirm the token ticker/address
