# Paying cryptofeed402 with x402

## Pinned terms

| Field | Value |
|---|---|
| x402 version | 2 |
| scheme | `exact` |
| network | `eip155:8453` (Base mainnet) |
| asset | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (USDC, 6 decimals) |
| payTo | `0x93e4B468A88B1f084Efc781ec7A1E2D195a40D22` |
| facilitator | Coinbase CDP |

| Route | amount (base units) | USD |
|---|---|---|
| `/perps/{symbol}` | 2000 | $0.002 |
| `/sentiment/{symbol}` | 2000 | $0.002 |
| `/funding/extreme` | 2500 | $0.0025 |
| `/price/{symbol}` | 2500 | $0.0025 |
| `/brief/latest` | 15000 | $0.015 |

An advertised amount above the table means stop and ask the user. A lower amount is fine.

## Sequence

1. `GET` the route with no payment header. Expect `402` with a `PAYMENT-REQUIRED` header
   (base64 JSON) and the same requirements in the JSON body (`accepts[]`).
2. Pick the `accepts[]` entry and check every pinned field above. If any field differs, stop.
3. Pay with the Bankr CLI, capped at the route price:
   `bankr x402 call <url> --max-payment <price>`. Never pass `-y` / `--ni`.
   With another x402 v2 client, sign the payment and retry the identical request with the
   `PAYMENT-SIGNATURE` header.
4. A `200` carries a `PAYMENT-RESPONSE` header with the settlement. You are charged only when
   the response succeeds. (`--raw` hides that header; drop it if you need the settlement.)

Keep method, path and query identical between the unpaid request and the paid retry.

## Optional attribution

Add `?ref=bankr` to any URL. It does not change the price or payment matching.
