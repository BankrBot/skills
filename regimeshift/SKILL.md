---
name: regimeshift
description: Regime-aware risk & rate benchmarks for on-chain agents on Base. Use when an agent needs the volatility risk premium (ETH or BTC), a decentralized USD short rate (Agent-SOFR), or the maximum-safe loan-to-value for a collateralized agent loan — e.g. before sizing a position, pricing an inter-agent loan, deciding sell-vol vs buy-vol, or gating leverage to the current market regime. Four read-only GET endpoints, $0.001 USDC per call via x402 on Base (no account, no API key), or call the same tools over MCP. Every response carries its raw inputs plus an open methodology URL for audit. Triggers on mentions of volatility risk premium, VRP, DVOL, realized vol, Agent-SOFR, short rate, benchmark rate, max LTV, max-safe LTV, collateral, regime, regime classification, sell-vol/buy-vol, or RegimeShift.
license: MIT
compatibility: Requires network access. The paid path needs a wallet funded with a small amount of USDC on Base (eip155:8453) and any standard x402 v2 client (TypeScript x402-fetch / @coinbase/x402, or Python x402). The MCP path needs an MCP-capable client. Works across Claude.ai, Claude Code, and API; the curl flow works from any shell.
metadata:
  author: RegimeShift
  version: "1.0"
  homepage: https://regimeshift.xyz
---

# RegimeShift: Regime-Aware Risk & Rate Benchmarks for Agents

RegimeShift gives on-chain AI agents the quantitative inputs they need to size risk: the
**volatility risk premium** (ETH/BTC), a **decentralized USD short rate** (Agent-SOFR), and the
**maximum-safe loan-to-value** for a collateralized loan — each capped to the current market
**regime**. All four are live on Base mainnet.

Two ways to call, same data:

- **x402 (no account, no API key)** — any wallet with a little USDC on Base pays **$0.001 per call**. Endpoints return HTTP `402` with the x402 v2 challenge in the `payment-required` response header; pay and retry.
- **MCP** — connect an MCP client to `https://mcp.regimeshift.xyz/mcp` (Streamable HTTP) and call the tools `eth_vrp`, `btc_vrp`, `agent_sofr`, `max_ltv` directly.

Why agents use it: every response returns the **raw inputs** the number was computed from plus an
**open methodology URL**, so the output is auditable rather than a black box.

---

## Tools

| Tool | Endpoint | Query params | Returns |
| --- | --- | --- | --- |
| **eth-vrp** (`eth_vrp`) | `GET /api/v1/asset/eth/vrp` | — | ETH volatility risk premium = Deribit DVOL − Parkinson RV(72h), in vol points, + LOW/MID/HIGH regime. Positive ⇒ sell-vol opportunity, negative ⇒ buy-vol. |
| **btc-vrp** (`btc_vrp`) | `GET /api/v1/asset/btc/vrp` | — | Same, for BTC. |
| **agent-sofr** (`agent_sofr`) | `GET /api/v1/rate/sofr/usd` | `horizon` ∈ `{1h,1d,1w}` (default `1h`) | Decentralized USD short rate (annualized %), decomposed into base anchor + variance premium + regime adjustment, with the current regime mode. |
| **max-ltv** (`max_ltv`) | `GET /api/v1/risk/max-ltv` | `asset` ∈ `{ETH,BTC}` (default `ETH`), `duration_sec` 120–86400 (default `3600`), `max_default_prob` 0–0.01 (default `0.001`) | Max-safe LTV for a collateralized loan: the binding minimum of variance-over-horizon math and the regime cap, and **which** constraint binds. |

All four are **$0.001 USDC per call** via x402 on Base. No free tier.

---

## Payment (x402)

| Field | Value |
| --- | --- |
| Protocol | x402, `x402Version` 2 |
| Challenge location | HTTP response header `payment-required` (base64 JSON); the same JSON is also in the 402 body |
| Scheme | `exact` (EIP-3009 `transferWithAuthorization`) |
| Network | Base — CAIP-2 `eip155:8453` |
| Asset | USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (EIP-712 domain name `USD Coin`, version `2`) |
| Price | `amount` `1000` atomic = **$0.001** per call |
| payTo | `0x82B17D0bb4De9ae6c3491257B60E8245e70acd7B` |
| maxTimeoutSeconds | 300 |

Any standard x402 v2 exact-USDC-on-Base client settles automatically:

- **TypeScript**: `x402-fetch` (`wrapFetchWithPayment`) or `@coinbase/x402` — auto-handles `402 → sign → retry`.
- **Python**: `pip install x402` — register the exact-EVM scheme on `eip155:8453`.

A Bankr agent's built-in Base wallet, funded with USDC, is a valid payer — point your x402
client at it the same way you would for any other x402 endpoint (e.g. the pattern used by the
`alchemy`, `zerion`, and `quotient` skills).

---

## Quickstart

### See the price (no payment) — the 402 challenge is public

```bash
# The body is the x402 v2 challenge JSON (accepts[]: scheme, network, asset, amount, payTo).
curl -s https://regimeshift.xyz/api/v1/asset/eth/vrp | jq .accepts
```

### Pay + read, TypeScript (x402-fetch)

```ts
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const account = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`); // funded with USDC on Base
const wallet = createWalletClient({ account, chain: base, transport: http() });
const pay = wrapFetchWithPayment(fetch, wallet);

// ETH VRP
const vrp = await (await pay("https://regimeshift.xyz/api/v1/asset/eth/vrp")).json();
// Agent-SOFR, 1-day horizon
const sofr = await (await pay("https://regimeshift.xyz/api/v1/rate/sofr/usd?horizon=1d")).json();
// Max-safe LTV for a 1h ETH loan at 0.1% default tolerance
const ltv = await (await pay(
  "https://regimeshift.xyz/api/v1/risk/max-ltv?asset=ETH&duration_sec=3600&max_default_prob=0.001"
)).json();
```

### Pay + read, Python (`x402` SDK + requests)

```python
import os, requests
from eth_account import Account
from x402 import x402ClientSync
from x402.http.clients import x402_http_adapter
from x402.mechanisms.evm.exact import ExactEvmScheme

acct = Account.from_key(os.environ["PRIVATE_KEY"])             # funded with USDC on Base
client = x402ClientSync()
client.register("eip155:8453", ExactEvmScheme(signer=acct))   # Base mainnet

s = requests.Session()
s.mount("https://", x402_http_adapter(client))                # auto: 402 → sign EIP-3009 → retry

vrp  = s.get("https://regimeshift.xyz/api/v1/asset/btc/vrp", timeout=120).json()
sofr = s.get("https://regimeshift.xyz/api/v1/rate/sofr/usd?horizon=1h", timeout=120).json()
ltv  = s.get("https://regimeshift.xyz/api/v1/risk/max-ltv?asset=ETH&duration_sec=3600", timeout=120).json()
```

### MCP (no HTTP/402 handling)

Connect an MCP client to `https://mcp.regimeshift.xyz/mcp` (Streamable HTTP; legacy SSE at
`/sse`) and call `eth_vrp`, `btc_vrp`, `agent_sofr`, or `max_ltv`.

---

## Example responses

### `eth_vrp` / `btc_vrp`

```json
{
  "ok": true,
  "asset": "ETH",
  "vrp": 0.1525,
  "regime": "MID",
  "quiet": true,
  "inputs": {
    "dvol": 52.58, "rv_72h": 52.4275, "rv_6h": 40.204, "spot_usd": 2130.2,
    "timestamp": "2026-05-20T14:00:00+00:00",
    "source": "Deribit public API (DVOL + ETH-PERPETUAL OHLC)"
  },
  "methodology": "https://regimeshift.xyz/methodology/",
  "computed_at": 1779284275,
  "cache_ttl_sec": 60
}
```

`vrp` is in vol points (DVOL − realized). **Positive ⇒ implied richer than realized ⇒ sell-vol
opportunity; negative ⇒ buy-vol.** `regime` ∈ `LOW/MID/HIGH`.

### `agent_sofr`

```json
{
  "ok": true, "asset": "USD", "horizon": "1h", "horizon_sec": 3600,
  "rate": 4.115,
  "decomposition": { "base_anchor": 4.115, "variance_premium": 0.0, "regime_adjustment": 0.0 },
  "regime": { "mode": "RESTING", "mode_index": 0 },
  "methodology": { "version": "agent-sofr-v1", "url": "https://regimeshift.xyz/methodology/agent-sofr-v1" },
  "computed_at": 1779380000, "cache_ttl_sec": 60
}
```

`rate` is the annualized agent-native USD short rate. Use it to price the time-value leg of an
inter-agent loan; read `decomposition` to see how much is base vs variance vs regime.

### `max_ltv`

```json
{
  "ok": true,
  "max_ltv": 0.92,
  "math_max_ltv": 0.97,
  "regime_cap_ltv": 0.92,
  "binding_constraint": "regime_cap",
  "regime": "NORMAL",
  "sigma_T": 0.0051,
  "computed_at": 1779380000
}
```

Lend against **`max_ltv`** (the binding minimum). `binding_constraint` tells you whether the
horizon variance math (`math`) or the regime ceiling (`regime_cap`) is the limiting factor —
so the cap is explainable, not arbitrary. `sigma_T` is the modeled stdev of the collateral
return over the loan horizon.

---

## How an agent uses this

- **Sizing a vol position** → `eth_vrp` / `btc_vrp`: sell vol when `vrp` is positive and the regime is calm; stand down when negative or HIGH.
- **Pricing an inter-agent loan** → `agent_sofr` for the rate leg + `max_ltv` for the collateral leg. Quote the loan at `rate`, lend no more than `max_ltv`.
- **Gating leverage to the regime** → `max_ltv.regime_cap_ltv` and the `regime` fields automatically tighten in stressed markets, so leverage de-risks without a manual override.

RegimeShift is the data layer; pair it with your execution (e.g. a Bankr wallet) to act on the
numbers.

---

## Methodology & audit

- VRP: `https://regimeshift.xyz/methodology/`
- Agent-SOFR & max-LTV (shared calibrator): `https://regimeshift.xyz/methodology/agent-sofr-v1` (IPFS-pinned)

Rates and the LTV cap come from a BNS-calibrated 6-mode regime classifier (variance model
`cv + λ·j²`, λ=1.097 closed-form, calibrated on 444k ETH/USDC 5-min bars). Every response
returns its raw inputs so you can reproduce the number from the methodology.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `HTTP 402 Payment Required` | Expected on first call. Read the challenge from the `payment-required` header (or the body), pay, and retry — standard x402 clients do this automatically. |
| Payment not settling | Confirm the payer wallet holds USDC on **Base** (`eip155:8453`), not another chain, and that your client targets network `eip155:8453` with the `exact` scheme. |
| Empty / `{}` body on the 402 | Normal — the machine-readable challenge is in the `payment-required` response header; the same JSON is mirrored in the body. |
| `horizon` rejected | Use one of `1h`, `1d`, `1w`. |
| `max-ltv` 4xx on params | `duration_sec` must be 120–86400; `max_default_prob` must be 0–0.01. |
| Stale value | Responses cache ~60s (`cache_ttl_sec`); re-call after the TTL for a fresh compute. |

---

## Official links

- Site: https://regimeshift.xyz
- Live loan registry: https://regimeshift.xyz/#loans
- Agent docs (llms.txt): https://regimeshift.xyz/llms.txt
- MCP endpoint: https://mcp.regimeshift.xyz/mcp (SSE: https://mcp.regimeshift.xyz/sse)
- x402 spec: https://github.com/coinbase/x402
