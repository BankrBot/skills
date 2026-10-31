# Endpoint Record reason codes

Codes are stable within a `ruleVersion` (current: `2026-09-30`). Each reason has a
`level`: `scam` (evidence of a trap), `caution` (risk or uncertainty) or `note`
(information, never changes the verdict).

## Lead to BLOCK

| Code | Level | Meaning |
|---|---|---|
| `BLACKLISTED` | scam | Address on the blacklist. |
| `HONEYPOT_CONFIRMED` | scam | Trap confirmed by two independent sources, or by our own sell simulation plus one source. |
| `CANNOT_SELL_ALL` | scam | Holders cannot sell their full balance. |
| `SELL_TAX_EXTREME` | scam | Sell tax of 50 % or more. |
| `SELL_SIMULATION_FAILED` | caution | Our own simulated sale of a real holder was blocked or lost 50 % or more, while the external sources did not report a honeypot. |
| `LIQUIDITY_REMOVED` | caution | The token creator withdrew, net of own re-deposits, at least half of the peak liquidity of a Uniswap v2/v4 pool within 24 h of its first deposit, and did not move it to another young pool. Behaviour, not a trap in the code. |
| `NOT_TRADABLE` | caution | No DEX pool found, so no exit on a DEX. |

## Lead to RECHECK

| Code | Level | Meaning |
|---|---|---|
| `NEW_TOKEN` | caution | Contract or oldest pool younger than 24 h and not listed. |
| `LIQUIDITY_UNCHECKED` | caution | A young Uniswap v2/v4 pool exists, but its history could not be read completely or attributed (creator not found, possible migration, pool half emptied by another address, data missing). |
| `V4_HOOK_UNCHECKED` | caution | Main pool is a Uniswap v4 pool with a hook; hooks can restrict selling and are not checked. |
| `CHECK_INCOMPLETE` | caution | The contract check did not complete. |
| `HONEYPOT_SOURCES_DISAGREE` | caution | The two honeypot sources contradict each other. |
| `HONEYPOT_UNCONFIRMED` | caution | One source reports a honeypot, not confirmed by the other. |

## Caution only (action stays ALLOW unless another code applies)

| Code | Meaning |
|---|---|
| `OWNER_CAN_CHANGE_BALANCE` | Owner can change balances (read from code). |
| `OWNER_CAN_RECLAIM` | Ownership can be reclaimed after renouncing. |
| `HIDDEN_OWNER` | Hidden owner mechanism. |
| `MINTABLE` | Supply can be increased. |
| `BLACKLIST_FUNCTION` | Contract can block wallets. |
| `TRANSFER_PAUSABLE` | Transfers can be paused. |
| `UPGRADEABLE` | Proxy contract, logic can change. |
| `SELFDESTRUCT` | Contains selfdestruct. |
| `HIGH_TAX` | Buy plus sell tax above 10 %. |
| `VARIABLE_TAX` | Tax can be changed. |
| `LOW_LIQUIDITY` | DEX liquidity below 20,000 USD. |
| `NOT_LISTED` | Not listed on CoinGecko. |
| `SCAM_PATTERNS` | Strong match with known scam patterns. |

## Notes

| Code | Meaning |
|---|---|
| `OWNER_ACTIVE` | Ownership not renounced. |
| `CANONICAL_BRIDGE_TOKEN` | Token of the canonical Base bridge; its mint and balance rights belong to the bridge. |
| `ISSUER_CONTROLLED` | Established base asset (e.g. USDC, WETH, cbBTC) whose issuer holds admin rights by design. |
