# AgentForge API reference (pre-flight endpoints)

Base URL `https://agentforge-taupe.vercel.app`. JSON in, JSON out. Live JSON Schemas for every endpoint are at `GET /catalog`; this page is a summary of the four endpoints the skill uses.

Payment for every endpoint below: x402 v2, scheme `exact`, network `eip155:8453` (Base), asset USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`, payee `0xFA6F352E71c44d217df04eCAD902C82B72D2378c`. The 402 offers the same terms twice: once as an EIP-3009 transfer authorization and once with `extra.assetTransferMethod: "permit2"`. Requests that end in 4xx or 5xx are not settled.

`chain` values: `ethereum`, `base`, `arbitrum`, `optimism`, `polygon`, `bsc`, `avalanche`, `linea`, `unichain`, `sonic`, `hyperevm` (address-check also takes `solana`).

## POST /v1/preflight

$0.008 per call + $0.004 per address in `tokens` (up to 5). Every field is optional, but send at least one of `transactions`, `typedData`, `paymentRequired`, `recipients`, `tokens`.

| Field | Type | Notes |
|---|---|---|
| `chain` | string | Defaults to the chain in `typedData.domain.chainId`, else `base` |
| `from` | address | The wallet acting. Required with `transactions` |
| `transactions` | array, 1-5 | `{to, data, value, gas?}`. `value` is wei as a decimal string or `0x` hex. Simulated in order with `eth_simulateV1` |
| `typedData` | object or JSON string | EIP-712 `{domain, types, primaryType, message}` about to be signed |
| `paymentRequired` | object | A decoded x402 `PAYMENT-REQUIRED` (`{accepts: [...]}`) about to be paid. Not together with `typedData` |
| `expectedMaxUsd` | number | Most you expect to pay; a higher price raises a reason |
| `recipients` | array of addresses, up to 20 | Screened against OFAC sanctions and scam lists. Non-EVM addresses are screened as Solana |
| `tokens` | array of addresses, up to 5 | Rug-checked; each one adds $0.004 |

Response:

| Field | Notes |
|---|---|
| `verdict` | `proceed`, `caution` or `avoid`: the worst across all checks |
| `summary` | One line for the user |
| `reasons[]` | Prefixed `[simulation]`, `[signature]`, `[recipient 0x…]`, `[token 0x…]` or `[<skipped check>]` |
| `checksRun[]` | Any of `simulation`, `signature`, `addresses`, `tokens` |
| `simulation` | `verdict`, `reasons`, `calls[]` (`success`, `revertReason`, `toLabel`), `assetChanges[]` (`token`, `symbol`, `delta`, `deltaFormatted`, `standard`), `approvals[]` (`spender`, `spenderLabel`, `amount`, `unlimited`, `kind`), `counterparties[]` |
| `signature` | `kind` (`erc20-permit`, `dai-permit`, `permit2-allowance`, `permit2-transfer`, `seaport-order`, `transfer-authorization`, `x402-payment`, `unknown-typed-data`), `verdict`, `grants[]`, `counterparties[]`, `paymentOptions[]` |
| `addresses[]` | Per recipient: `verdict` (`block`, `caution`, `no_known_issues`), `sanctioned`, `flaggedScam`, `knownEntity`, `isContract`, `txCount` |
| `tokens[]` | Per token: `source` (`requested`, or `received` when found in the simulation), `verdict`, `riskScore` (0-100), `riskLevel`, `flags[]` |
| `skipped[]` | `{check, reason}` for checks that could not run |
| `pricing` | `base`, `perToken`, `tokensCharged`, `total` |

Tokens with `source: "received"` were picked up from the simulation's asset changes and are not charged.

## POST /v1/signature-check

$0.003. Body: `typedData` (object or string) or `paymentRequired`, plus optional `signer`, `chain`, `expectedMaxUsd`.

Response: `kind`, `verdict`, `summary`, `reasons[]`, `grants[]` (`token`, `symbol`, `to`, `toLabel`, `amount`, `amountFormatted`, `unlimited`, `expires`), `counterparties[]` (`address`, `role`, `verdict`, `label`), `paymentOptions[]` for x402 requests (`network`, `asset`, `assetIsUsdc`, `amountUsd`, `payTo`, `verdict`, `reasons`).

## POST /v1/address-check

$0.003 for the first address + $0.001 per extra, up to 100. Body: `{"addresses": [{"address": "...", "chain": "base"}, ...]}`, or a single `{"address": "...", "chain": "base"}`.

Response: `results[]` (`address`, `chain`, `verdict`, `reasons`, `sanctioned`, `flaggedScam`, `knownEntity`, `isContract`, `txCount`, `valid`), `summary` (`checked`, `block`, `caution`, `noKnownIssues`), `sources` (list names and when they were generated), `pricing`.

`caution` covers an invalid address, a labeled high-risk entity, and an EOA with no transactions (common in address poisoning).

## POST /v1/tx-simulate

$0.005. Body: `{"chain": "base", "from": "0x...", "transactions": [{to, data, value}]}` (1-5). Not available on Avalanche or HyperEVM. Returns the same object as `simulation` in the preflight response. Use preflight instead unless you only want the simulation.
