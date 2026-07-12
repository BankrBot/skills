# Kupo Perps API — endpoint reference

Base URL: `https://api.kupo.gg/v1`
Auth: `Authorization: Bearer <KUPO_API_KEY>` on every request.
Content type: `application/json`.

Scopes: `GET` endpoints need a key with at least the `read` scope; every `POST` needs `trade` (or `full`).

Rate limiting: per-key token bucket (60/min free, up to 600/min diamond). Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; a 429 carries `Retry-After` (seconds).

Common error shape: `{ "error": "<human-readable message>", "code": "<machine-code>" }` with an appropriate 4xx/5xx status. Notable codes: `auth-invalid` (bad key), `scope-insufficient` (key scope too low), `rate-limited`.

---

## GET /perps/markets

Live market list (cached ~5s server-side). No account data — works with any key.

Response: `{ "markets": PerpMarket[] }`

```ts
interface PerpMarket {
  coin: string;          // exact id for orders — "BTC", "xyz:NVDA", "xyz:EUR"
  display: string;       // human symbol — "NVDA"
  category: "crypto" | "stocks" | "indices" | "commodities" | "fx";
  assetId: number;
  szDecimals: number;    // size precision when using sizeCoin
  maxLeverage: number;   // server caps any requested leverage at this
  markPx: number;
  oraclePx: number;
  funding: number;       // hourly funding rate (fraction)
  openInterestUsd: number;
  dayVolumeUsd: number;
  prevDayPx: number;     // 24h-ago price, for change calc
}
```

## GET /perps/account

The caller's perps account state.

Response: `{ "account": PerpAccount, "agent": AgentStatus }`

```ts
interface PerpAccount {
  accountValueUsd: number;
  withdrawableUsd: number;
  totalMarginUsedUsd: number;
  totalNtlPosUsd: number;      // total notional across positions
  spotUsdc: number;            // idle USDC on the HL spot side
  positions: PerpPosition[];
}

interface PerpPosition {
  coin: string;
  size: number;                // signed: positive = long, negative = short
  entryPx: number;
  positionValueUsd: number;
  unrealizedPnlUsd: number;
  returnOnEquityPct: number;
  liquidationPx: number | null;
  leverage: number;
  leverageType: string;        // "cross" in phase 1
  marginUsedUsd: number;
  fundingPaidUsd: number;
}

interface AgentStatus {
  agentAddress: string | null;
  approved: boolean;           // false → call POST /perps/agent/init once
  builderApproved: boolean;
}
```

## POST /perps/agent/init

One-time account setup (creates + approves the trading agent and the builder-fee approval). Idempotent. Requires the account to have been funded at least once (deposit on kupo.gg), otherwise returns 400 with Hyperliquid's message.

Body: `{}` — Response: `{ "ok": true, "agent": AgentStatus }` or `{ "error": string }`.

## POST /perps/order

Place a market or limit order.

Body:

```ts
{
  coin: string;              // from GET /perps/markets — never invented
  side: "buy" | "sell";      // buy = long, sell = short
  type: "market" | "limit";
  sizeUsd?: number;          // notional in USD (preferred) — or:
  sizeCoin?: number;         // size in the asset
  limitPx?: number;          // required when type = "limit"
  slippagePct?: number;      // market orders; sensible default applied
  reduceOnly?: boolean;      // true for closes — can only shrink the position
  leverage?: number;         // optional; cross margin; capped at maxLeverage
  tpPx?: number;             // optional take-profit trigger placed with entry
  slPx?: number;             // optional stop-loss trigger placed with entry
}
```

Response (200 on success, 400 on trade rejection):

```ts
{
  status: "filled" | "resting" | "error";
  oid?: number;        // order id (use for /perps/cancel)
  avgPx?: number;      // average fill price when filled
  totalSz?: number;    // filled size
  error?: string;
  tpslPlaced?: boolean;  // when tpPx/slPx were requested
  tpslError?: string;
}
```

## POST /perps/cancel

Body: `{ "coin": string, "oid": number }` — Response: `{ "ok": boolean, "error?": string }`.

## POST /perps/tpsl

Set / replace / clear TP-SL triggers on a live position. Replaces the whole set.

Body: `{ "coin": string, "tpPx": number | null, "slPx": number | null }` (number = set, null = clear).
Response: `{ "ok": boolean, "error?": string }`.

## GET /perps/orders

Open orders. Response: `{ "orders": OpenOrder[] }`

```ts
interface OpenOrder {
  coin: string;
  oid: number;
  side: "buy" | "sell";
  px: number;
  sz: number;
  ts: number;                    // placed-at, ms epoch
  triggerPx: number;             // 0 for plain limit orders
  reduceOnly: boolean;
  tpsl: "tp" | "sl" | null;      // set for trigger orders
}
```

## GET /perps/fills

Executed fills, most recent first (max 100). Response: `{ "fills": PerpFill[] }`

```ts
interface PerpFill {
  coin: string;
  side: "buy" | "sell";
  dir: string;            // "Open Long", "Close Short", "Liquidation"…
  px: number;
  sz: number;
  valueUsd: number;
  closedPnlUsd: number;   // realized PnL on closes
  feeUsd: number;
  time: number;           // ms epoch
  hash: string;
  oid: number;
}
```

## GET /perps/order-history

Order lifecycle history (placed → filled / canceled / rejected). Response: `{ "orders": [...] }`.

## GET /perps/portfolio

Account-value + PnL time series and traded volume, as aggregated by Hyperliquid's portfolio endpoint. Response: `{ "portfolio": ... }`. Use for "how is my perps PnL this week" style questions.

## GET /perps/twaps

Running TWAP orders. Response: `{ "twaps": [...] }` (each carries `twapId`, `coin`, remaining size/time).

## POST /perps/twap

Native Hyperliquid TWAP execution.

Body: `{ "coin": string, "side": "buy"|"sell", "sizeUsd"?: number, "sizeCoin"?: number, "minutes": number /* 5–1440 */, "randomize"?: boolean, "reduceOnly"?: boolean, "leverage"?: number }`
Response: `{ "status": "resting" | "error", ... }`.

## POST /perps/twap/cancel

Body: `{ "coin": string, "twapId": number }` — Response: `{ "ok": boolean }`.

---

## Not exposed via API (by design)

Deposits, withdrawals, and bridge status are only available in the Kupo terminal (kupo.gg → Portfolio → Perpetuals). An API key can trade the funded balance but can never move funds out of the account.

## Related spot endpoints (same key, same base URL)

The same API key also covers Kupo's spot surface — `GET /me`, `GET /quote`, `POST /swap`, `POST /sell`, `GET /balances/:wallet`, `GET /tokens/:address`, `GET /launches`, `GET /trending/:chain/:period`, spot `GET|POST|DELETE /orders`, and SSE streams `GET /stream/launches` + `GET /stream/swaps/:token`.
