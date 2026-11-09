# Arcadia Contract Addresses

Supported chains: Base (8453), Unichain (130), Optimism (10), Robinhood (4663).

## Shared Addresses

| Contract   | Address                                    |
| ---------- | ------------------------------------------ |
| Factory    | 0xDa14Fdd72345c4d2511357214c5B89A919768e59 |
| Registry   | 0xd0690557600eb8Be8391D1d97346e2aab5300d5f |
| Liquidator | 0xA4B0b9fD1d91fA2De44F6ABFd59cC14bA1E1a7Af |

Lending pools (same CREATE2 addresses across chains; Unichain has none):

| Pool     | Address                                    | Chains                    |
| -------- | ------------------------------------------ | ------------------------- |
| LP_WETH  | 0x803ea69c7e87D1d6C86adeB40CB636cC0E6B98E2 | Base, Optimism, Robinhood |
| LP_USDC  | 0x3ec4a293Fb906DD2Cd440c20dECB250DeF141dF1 | Base, Optimism            |
| LP_CBBTC | 0xa37E9b4369dc20940009030BfbC2088F09645e3B | Base only                 |
| LP_USDG  | 0xf37c0C5996503Fdd2b5CCCE36E659cD30393AE59 | Robinhood only            |

## Asset Managers

Rebalancers, compounders, and yield claimers are deployed per DEX protocol. Most share the same address on every chain.

Protocol availability per chain:

- **Base**: Slipstream V1, V2, V3, Uniswap V3, V4, Aero CL (MetadexCL V1), CoW Swap.
- **Optimism**: Slipstream V1, V3, Uniswap V3, V4, Aero CL (MetadexCL V1) (no V2, no CoW Swap). V3 uses different AM addresses than Base (exception to the deterministic deployment pattern).
- **Unichain**: Slipstream V1, Uniswap V3, V4 (no V2/V3, no CoW Swap)
- **Robinhood**: Uniswap V3, V4 and Aero CL (no Slipstream V1-V3, no Aerodrome V1, no CoW Swap). Lending pools are WETH and USDG, there is no USDC on this chain.

Use `read_asset_manager_intents` to discover available automations and their addresses per chain.

## Chain-Specific Tokens

### Base (8453)

| Token         | Address                                    | Decimals |
| ------------- | ------------------------------------------ | -------- |
| WETH          | 0x4200000000000000000000000000000000000006 | 18       |
| USDC          | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 | 6        |
| cbBTC         | 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf | 8        |
| AERO          | 0x3f5bF3EdAc59d650D8fDf9657a71F2f904A3a4Ee | 18       |
| AERO (legacy) | 0x940181a94A35A4569E4529A3CDfB74e38FD98631 | 18       |

### Optimism (10)

| Token  | Address                                    | Decimals |
| ------ | ------------------------------------------ | -------- |
| WETH   | 0x4200000000000000000000000000000000000006 | 18       |
| USDC   | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 | 6        |
| OP     | 0x4200000000000000000000000000000000000042 | 18       |
| VELO   | 0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db | 18       |
| WBTC   | 0x68f180fcCe6836688e9084f035309E29Bf0A2095 | 8        |
| wstETH | 0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb | 18       |

### Unichain (130)

| Token | Address                                    | Decimals |
| ----- | ------------------------------------------ | -------- |
| WETH  | 0x4200000000000000000000000000000000000006 | 18       |
| USDC  | 0x078D782b760474a361dDA0AF3839290b0EF57AD6 | 6        |
| WBTC  | 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c | 8        |
| UNI   | 0x8f187aA05619a017077f5308904739877ce9eA21 | 18       |
| VELO  | 0x7f9AdFbd38b669F03d1d11000Bc76b9AaEA28A81 | 18       |
