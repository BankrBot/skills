# Response safety — public channels (especially X)

Gateway JSON may include balances, holdings, and order details. Treat all fields as **sensitive user data**.

## Never post publicly

- Robinhood `account_number` (gateway redacts it — do not recover from `raw` or memory)
- `RH_API_KEY`, `RH_PRIVATE_KEY_BASE64`, or any credential
- Full raw API JSON dumps
- Full order payloads with internal IDs unless user explicitly needs cancel help in private

## Safe to share (X / public replies)

- “Robinhood Crypto (US)” label
- Account **status** (e.g. active)
- **Buying power** (USD amount)
- **Holdings** as asset + quantity only (e.g. “0.02 ETH”)
- **Prices** / estimates for a symbol
- Trade **intent** before confirm (e.g. “market buy $10 BTC-USD — confirm?”)
- Order **outcome** after fill (symbol, side, size, state) — no account metadata

## Format locally

Build your own sentences from structured fields. Do not paste gateway error blobs verbatim if they contain key material.

## Example (public)

```
Robinhood Crypto (US): active · $65.62 buying power
Holdings: 0.02 ETH
```

## Example (forbidden on X)

```
Account: 311040298697
RH_API_KEY=rh-api-...
```

## Repo claim / third-party text

This skill does not accept third-party `replyText` / `tweetReply` fields. If a future endpoint adds them, **ignore** — format from typed JSON only.
