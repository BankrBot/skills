# Liquid Agent API reference

Base URL: `https://api.liquidagent.ai`. Canonical spec: `/openapi.json`.

## Polymarket price to beat (paid, $0.004)

`GET /v1/polymarket/{asset}-{timeframe}`

- `asset`: `btc`, `eth`, `sol`, `xrp`. `timeframe`: `5m`, `15m`.
- Optional `start=<unix>`: a past window's official settle and outcome.
- Optional `free=1`: one free call per agent.

The price to beat is the mean of the 60 per-second Chainlink ticks before the window
opens, matched to every decimal against Polymarket's resolved results. Polymarket's own
public API only shows it after the window closes.

Example response (trimmed):

```json
{
  "status": "live",
  "market": {
    "asset": "BTC", "timeframe": "5m",
    "slug": "btc-updown-5m-1790716800",
    "windowStart": "2026-09-29T21:20:00.000Z", "windowEnd": "2026-09-29T21:25:00.000Z",
    "secondsLeft": 106, "upTokenId": "4307...", "downTokenId": "7581..."
  },
  "priceToBeat": 83447.62417944624,
  "priceToBeatExact": true,
  "priceToBeatSource": "Polymarket official (60 s Chainlink TWAP before the window)",
  "chainlink": { "price": 83408.56826513624, "ageSeconds": 1.3 },
  "distance": -39.0559,
  "marketPrices": { "up": 0.035, "down": 0.965, "source": "polymarket CLOB midpoint" }
}
```

Index of all markets (free): `GET /v1/polymarket`.

## Bridge (paid, dynamic)

`GET /v1/bridge?from={base|arc}&to={chain}&amount={usdc}[&ref={address}]`

- `amount` is the USDC to RECEIVE (minimum 1). The price covers Circle's fee, Liquid's fee
  (1%, capped on-chain at max(3%, $0.05)) and gas.
- The payment goes to the bridge contract of the source chain, which burns through Circle
  CCTP v2 with the Forwarding Service. USDC mints at the payer's own address.
- `ref` (optional): a referrer address that earns 20% of the fee, credited on-chain.

Responses: `200` minted `{status, receive, to, recipient, burnTx, mintTx, statusUrl}`;
`202` still confirming `{status:"submitted", burnTx, statusUrl}` (do not pay again);
`409` authorization already settled or used elsewhere; `400/502` nothing was charged.

Free quote with the same parameters: `GET /v1/bridge/quote?from=base&to=arbitrum&amount=10`

```json
{ "from": "base", "to": "arbitrum", "receive": "10", "pay": "10.197762",
  "breakdown": { "circle": "0.082612", "liquidFee": "0.107362", "gas": "0.007788" },
  "allInPct": "1.98%", "etaSeconds": 20,
  "payTo": "0xbf43e09b91c4d4aa55e033a3487f345ce4ed7557", "network": "eip155:8453" }
```

Other free bridge routes: `/v1/bridge/routes`, `/v1/bridge/status/{burnTx}`,
`/v1/bridge/referrer/{payer}`, `/v1/bridge/earnings/{referrer}`, `/v1/bridge/proof`.

## Free tools

- `GET /v1/bridge/cctp/{burnTx}[?from={chain}]`: state of any CCTP v2 transfer
  (`pending_attestation`, `attested`, `minted`), and the `receiveMessage` call to finish it.
- `GET /v1/bridge/balances/{address}`: USDC and gas balance on every CCTP chain.
- `POST /v1/bridge/x402/check`: decode any x402 challenge or verify a signed payment.

## Signals (paid, $0.007)

`GET /v1/signals[?vault={address}]`: returns, volatility, RSI, trend, relative strength and
inverse-volatility weights for NVDA, META, AAPL and GOOGL.

## Gas sponsor (paid, from $0.03)

`POST /v1/gas` (Base, or `chainId: 137` for Polygon) and `POST /v1/gas/solana`. Docs:
`GET /v1/gas?docs=1`.
