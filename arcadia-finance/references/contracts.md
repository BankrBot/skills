# Arcadia Contract Addresses

Supported chains: Base (8453), Unichain (130).

## Protocol (same on all chains)

| Contract   | Address                                    |
| ---------- | ------------------------------------------ |
| Factory    | 0xDa14Fdd72345c4d2511357214c5B89A919768e59 |
| Registry   | 0xd0690557600eb8Be8391D1d97346e2aab5300d5f |
| Liquidator | 0xA4B0b9fD1d91fA2De44F6ABFd59cC14bA1E1a7Af |

## Lending Pools (Base)

| Pool     | Address                                    |
| -------- | ------------------------------------------ |
| LP_WETH  | 0x803ea69c7e87D1d6C86adeB40CB636cC0E6B98E2 |
| LP_USDC  | 0x3ec4a293Fb906DD2Cd440c20dECB250DeF141dF1 |
| LP_CBBTC | 0xa37E9b4369dc20940009030BfbC2088F09645e3B |

## Key Tokens (Base)

| Token | Address                                    | Decimals |
| ----- | ------------------------------------------ | -------- |
| WETH  | 0x4200000000000000000000000000000000000006 | 18       |
| USDC  | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 6        |
| cbBTC | 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf | 8        |
| AERO  | 0x940181a94A35A4569E4529A3CDfB74e38FD98631 | 18       |

## Asset Managers

Rebalancers, compounders, and yield claimers are deployed per DEX protocol. Use `read_asset_manager_intents` to discover available automations and their addresses.
