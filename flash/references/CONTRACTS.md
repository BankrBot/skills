# Contracts (Base mainnet, chain id 8453)

Machine-readable copy: [`../known-contracts.json`](../known-contracts.json). The scripts import that file, and `scripts/check-contracts.mjs` re-checks it against the chain. Every address below has code on Base, and every pool id equals `keccak256(abi.encode(poolKey))`. Checked 2026-10-24 at block 53,033,307.

The Safe `0x29C1BF0c85a9a479c1B47B847cd3Fb1C6dC5e5bD` owns every upgradeable contract. Protocol payouts go to the treasury `0xD1EC8245c8850A151843ce8a3AFdca3b19747706`.

## Tokens

| Token | Address | Decimals |
| --- | --- | --- |
| ETH (native, as a v4 currency) | `0x0000000000000000000000000000000000000000` | 18 |
| WETH | `0x4200000000000000000000000000000000000006` | 18 |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 |
| FLASH (total supply 69,420) | `0xD1Be6E31B44C3365Db5BE514ba570ac4fEc63d84` | 18 |
| QUANT | `0xb2000000000000000000006a9881C01617b77B08` | 18 |

Perp tokens and tokenized stocks are listed in [PERPS-QUANT.md](PERPS-QUANT.md) and [REVENUE-STOCKS-PORTFOLIO.md](REVENUE-STOCKS-PORTFOLIO.md).

## Uniswap v4 (canonical Base deployments)

| | |
| --- | --- |
| PoolManager | `0x498581fF718922c3f8e6A244956aF099B2652b2b` |
| Universal Router (pinned in the hooks' router registries) | `0x6fF5693b99212Da76ad316178A184AB56D299b43` |
| V4 Quoter (pinned: quotes are attributed to `from`) | `0xdc1b201BDd8731e0274168e4EFFFEB845bDb4303` |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11` |

Swap only through this Universal Router and quote only with this Quoter. The hooks attribute a trade (referral fee, King of the Hill bid) to the router's `msgSender()`. Other routers are not on the hooks' allowlist.

## Referral Coin (the FLASH/ETH pool)

| | |
| --- | --- |
| Hook (immutable shell) | `0x57b18C5f0e028aB86a0888d578dE23e65F072ACC` |
| Swap policy (fees, taxes, gas floor) | `0xc89e82f32832f995F992202ce78EA6F02ac2e1e4` |
| Referral registry (codes, binds, buckets, top-100) | `0x20E37314A4D52Ba1FB55a675a834665Cf2515857` |
| King of the Hill module | `0x2556ffbAb00D1993aD1BDA44fb6c0dc15fde7457` |
| Churn module | `0x499C325Cd561c1565F438Eb467BDc96940088C83` |
| Signature validator (6492 / 7702 / 1271) | `0x1C5263A8C32d5AFe55b379c1DfaC889b648172B3` |

## FlashV3 (QUANT and every launched token)

| | |
| --- | --- |
| Hook | `0xf4b67452C04017c706BEC809f39209f770Ef28Cc` |
| Registry (`poolOfToken`) | `0xCbddfe729982fadc5ff27e94db7fB4D76785377e` |
| Ledger (fee sweep, creator QUANT) | `0xB6267C0bFcbBEE354723f9f97b255Da287729A07` |
| Launcher | `0x347cC3B729116B5bf7d55501F7F5D6dAf4Ce5c5f` |
| Perp router | `0x4d1BD5F54432FEcBC1fCfE42746921d80680e2f1` |
| FLASH buyback | `0xFd57cE2838E1CE696d3626A6Ff9ca27B1E8D3264` |

## Tokenized Perps V2 (contracts named FlashPerpsV5*)

| | |
| --- | --- |
| Perps hook | `0x2f4a713980425DF85b2B756C7484565A9b8778C8` |
| Issuer (permanent; NAV, positions, QUANT minting, unwind) | `0x56a3e32134521Cefe75a2B8dB25D29a45E331BdD` |
| Fee sink | `0x88CcF70524822c0Eb2A7e4824A6a9e57410aF76D` |
| QUANT owner sink | `0xebb672403005A20Ef914b13487505E08Aa05F760` |
| Migrator (earlier perps to V2) | `0x87c9784070C4E134F7dE7627dA0038CA9f0473D6` |
| Limit orders (take-profit / stop-loss, `FlashPerpsV5LimitOrders`) | `0xf5d94BE034944C8706a12B6B4d4dE0dbEbc10824` |
| Lens (QUANT rate, protocol / account / market KPIs, `FlashPerpsV5Lens`) | `0x7D06a5C37fd91B85D6dC2f212467f1803895d0C2` |

## Churn (limit orders, Lattices)

| | |
| --- | --- |
| Churn core (proxy) | `0x35F1b89f4FEb2897CC1a6efF381d518D05824008` |
| Churn registry | `0x2EF26c31bC5160A748d066DBa1e26ab14E85D2ac` |
| Market FLASH/ETH (WETH quote) | `0x4b39bd7aad60303a9b91876aee70156afd01ab01a569ea973d3105df78756a7b` |
| Market QUANT/FLASH | `0xe4f1a55cd9ae77c991cb80e5d1ddb27e36e6371a8717feca8d0998724fc58292` |

## launch-v5 (bonding curves and Token Wars)

| | |
| --- | --- |
| Launchpad | `0x8aD3593A1c8a5249E7868975b2649B377c3bcCd0` |
| Launch router Q (ETH / FLASH / STOCK / PERP launches; use this) | `0x2e6640bca34BC34f3F4EF31cb19527EA80987911` |
| Executor Q (`poolKeyForQuote`) | `0x0C155b5FfBaa04f753d7D287D6bc4fBE0BcAf625` |
| Config (`quoteRouteOf`) | `0x64B866F63053680F14Da2f98a67C7b2BdFf960e6` |
| Shapes registry (modes, presets) | `0x79644eC342881E40efab1401eb5ceF265F93aE7D` |
| Curve factory | `0x69A1230A0b1bB326Cf3ebAAa4DAFDBC7eC627CeF` |
| Churn vault (curve backing) | `0x4344e5D6C2D5d29FcD77bc89A41f9C2478478094` |
| LP fee vault | `0x91a7123d0c402B5E8f5Dfd9C81f1575C05dBE060` |
| Token War V6 (live) | `0x793D3730040582fc58F3699F51396Dc6cD00dD3f` |
| War router V6 (ETH / USDC in) | `0x470e310f02625DAdaea471579f5ccC66fd606638` |

## Treasuries and Revenue Share

| | |
| --- | --- |
| treasury-v3 factory (`predictTreasury(token)`) | `0x128fab9a1f356868feb355858cc7CbdA7F296b91` |
| treasury-v3 config | `0xc7151Ee6458f3AAdD1B32aF05Be690c7d3669754` |
| QUANT treasury | `0x6A7faA6B8F0C7f66dFCa2Bb5dd1BCa0915bc55E5` |
| Treasury shares (creator cut per treasury, `FlashTreasuryShares`, ownerless) | `0x98C29eC362A4e76975002778Bb2E91B99e4A288F` |
| Revenue Share V2 (`FlashRevenueShareV2` proxy, Safe-owned; FLASH in, ETH out) | `0x7c36Ac8bec2D206984702790dB158fcAAFe69490` |
| Revenue Share V2 implementation | `0x0fca4d706F978812060b974dD7b2A65DA13F208A` |
| Retired Revenue Share vault (`FlashPoolStaking`, withdraw-only, no new revenue) | `0x5cf120b13086277f83f901ea4df4fA8A45d577b0` |

## Pool keys

`fee` is always `8388608` (`0x800000`, the v4 dynamic-fee flag): every hook sets its own fee.

| Pool | currency0 | currency1 | tickSpacing | hooks | Pool id |
| --- | --- | --- | --- | --- | --- |
| FLASH/ETH | ETH `0x0` | FLASH | 60 | Referral Coin hook | `0x8da9f93b7b96efd2091b9e2cc8cddf921d0237635adc5f046956576714a2824c` |
| QUANT/FLASH | QUANT | FLASH | 200 | FlashV3 hook | `0x91fe9428ae1ed2938acef94d466f7f40603cdfb47cdb33cf6639fb4c6dffba8c` |
| Perp `X` | USDC | perp token | 1 | Perps hook | see [PERPS-QUANT.md](PERPS-QUANT.md) |
| Launched token | lower of (token, quote) | higher | `executorQ.tickSpacing` (200 today) | FlashV3 hook | `launchpad.launchOf(token).poolId` |
| ETH/USDC pay leg (hookless) | ETH | USDC | 60 (fee 3000) or 10 (fee 500) | `0x0` | |

Never type out a launched token's key by hand. Read `executorQ.poolKeyForQuote(token, quote)` and require `keccak256(abi.encode(key)) == launchpad.launchOf(token).poolId == v3Registry.poolOfToken(token)`. The quote is WETH for an ETH-pair launch, FLASH for a FLASH pair, and `launchOf(token).quote` for STOCK and PERP pairs. `scripts/flash.mjs` runs this check before it builds any swap.
