---
name: automaton-colony
description: |
  Check a Base contract or token before you buy, sign or list it. Automaton Colony reads the chain at an
  anchored block and returns observed facts, not a score: verified source or not, proxy and admin powers,
  holder concentration, and for B20 native tokens (Coinbase tokenized stocks, Basecat and every 0xB200…
  address) the issuer powers that bytecode scanners cannot see: supply cap, paused functions, transfer
  policies, role holders. Free check with no wallet and no key; single facts from 0.0049 USDC and a
  hash-anchored Flash Report for 3.49 USDC over x402 on Base.
  Triggers: "is this token safe", "check this contract", "rug check", "who can mint", "is it a proxy",
  "B20", "tokenized stock", "before I swap", any Base address the user is about to interact with.
---

# Automaton Colony: read the contract before you sign

Base URL: `https://automatoncolony.xyz`. Network: Base mainnet (eip155:8453). Payments: USDC on Base
over x402, no API key, no account. MCP server (Streamable HTTP, anonymous): `https://automatoncolony.xyz/mcp`.

## What it answers, and what it does not

Every answer is a set of observed on-chain facts read at one Base block, with that block number and hash,
so anyone can repeat the reading. There is no score and no verdict in the free check or in the single
facts; the verdict, with evidence and limitations, is the paid Flash Report, whose SHA-256 is recorded on
chain before delivery. When something could not be read, the answer says so instead of printing "no issues".

B20 native tokens have no bytecode (`eth_getCode` returns `0xef`); their logic runs inside the Base node.
Bytecode scanners answer "no admin functions" on them, which is wrong. This skill reads the B20 factory:
supply cap (and whether it is effectively uncapped), paused functions, active transfer policies and the
role holders reconstructed from events.

## Free, no wallet

```
GET https://automatoncolony.xyz/api/v1/free-check/{address}
```

Returns JSON: anchor block, source status (`verified`, `unverified`, `native` for B20), proxy detection,
largest-holder floor, admin function selectors, and for B20 the issuer powers. Shared quota of 1,000 calls
per month for the whole site. Use it first; it is enough for most "should I touch this" questions.

## Single facts, pay per call (x402, USDC on Base)

`POST https://automatoncolony.xyz/api/v1/x402/datos/{product}` with JSON body `{"targetAddress":"0x…"}`.
Answered in the same response, valid 600 s, with the block it was read at.

| Product | Price (USDC) | Returns |
|---|---|---|
| `codigo-verificado` | 0.0099 | source status and runtime code hash |
| `proxy-implementacion` | 0.0099 | proxy pattern and implementation address |
| `poderes-admin` | 0.0099 | admin functions recognised in the bytecode |
| `estado-cadena` | 0.0049 | current Base anchor block and hash (no address needed) |
| `concentracion-tenedores` | 0.0399 | holder concentration |
| `poderes-emisor-b20` | 0.0399 | B20 issuer powers: cap, paused, policies, role holders |
| `cribado-completo` | 0.0699 | everything above in one answer |

The MCP tool `contract_data_catalog` returns this table with current prices, and each endpoint's 402
document carries the input schema.

## Flash Report, 3.49 USDC (x402)

```
POST https://automatoncolony.xyz/api/v1/x402/flash-audit
{"targetAddress":"0x…","language":"en"}
```

Returns `orderKey` and a `poll` path; the report is ready in about 120 s at
`GET https://automatoncolony.xyz/api/v1/x402/orders/{orderKey}`. Severity-ranked findings with evidence,
what could not be verified, and the report's SHA-256 anchored on Base. Eleven languages via `language`.

## How to pay

Every paid endpoint answers `402 Payment Required` with a standard x402 v2 document (`accepts[0]`:
`eip155:8453`, USDC `0x8335…2913`, `payTo`, exact amount). Any x402 client pays and retries:

- Python: `pip install x402`, then `x402_client().post(url, json={...})`.
- TypeScript: `npm install x402-axios`, then `withPaymentInterceptor(axios.create(), walletClient)`.
- Coinbase AgentKit: the `x402` action provider (`make_http_request` → 402 → `retry_http_request_with_x402`).

Wallet needs USDC on Base; on the CDP facilitator route the gas is sponsored. Keep the agent's spend
cap at or above the price you intend to pay.

## Guidance for the agent

1. Run the free check first. If the address is not a contract, stop: it is a wallet, not a token.
2. For a B20 address (starts with `0xB200…` or `sourceStatus: native`), read `nativo.capacidadesDelEmisor`,
   `nativo.politicasActivas` and `nativo.titularesDeRol` before telling the user anything about safety.
3. Buy a single fact when one field decides the question; buy `cribado-completo` when you need the whole
   picture in one response; buy the Flash Report when the user wants a verdict with evidence they can verify.
4. Always report the anchor block with the facts, and say explicitly what could not be read.
5. Do not present the free check as an audit. It is observed data at one block.

Terms: `https://automatoncolony.xyz/api/v1/legal/terms` (hash `0x3545cfb9…`). Privacy: the service stores
the answers it sells, never who asked for which address.
