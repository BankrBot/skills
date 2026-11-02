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
| QUANT | `0xB2000000000000000000008a865BAD54481CD395` | 18 |

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
| Hook (immutable shell) | `0x77424a443429Be042afd9D88421945eFA38E6acC` |
| Swap policy (fees, taxes, gas floor) | `0xc89e82f32832f995F992202ce78EA6F02ac2e1e4` |
| Referral registry (codes, binds, buckets, top-100) | `0x20E37314A4D52Ba1FB55a675a834665Cf2515857` |
| King of the Hill module | `0x2556ffbAb00D1993aD1BDA44fb6c0dc15fde7457` |
| Churn module | `0x499C325Cd561c1565F438Eb467BDc96940088C83` |
| Signature validator (6492 / 7702 / 1271) | `0x1C5263A8C32d5AFe55b379c1DfaC889b648172B3` |

## FlashV3 (QUANT and every launched token)

| | |
| --- | --- |
| Hook | `0x6aeABB2029DCc4758c168A0651Dc4F49aD9928CC` |
| Registry (`poolOfToken`) | `0xCbddfe729982fadc5ff27e94db7fB4D76785377e` |
| Ledger (fee sweep, creator QUANT) | `0xB6267C0bFcbBEE354723f9f97b255Da287729A07` |
| Launcher | `0x347cC3B729116B5bf7d55501F7F5D6dAf4Ce5c5f` |
| Perp router | `0xd3c45B855BB71cfFF9F77732a6f1C1e3feF1f80e` |
| FLASH buyback | `0xFd57cE2838E1CE696d3626A6Ff9ca27B1E8D3264` |

## Tokenized Perps V2 (contracts named FlashPerpsV5*)

| | |
| --- | --- |
| Perps hook | `0xc4dF67D58fb02Ecc2499FDAcC4D1d71fEa4FB8C8` |
| Issuer (permanent; NAV, positions, QUANT minting, unwind) | `0x1BBd2F85191d2D94fA51bc26e5AB70c2eB7c5941` |
| Fee sink | `0x0b95dcF3B69644Ab108E7f17bC703616f7da06D9` |
| QUANT owner sink | `0x1296988A7807866842D1aeeFdbbA8A4E0bD9e9Df` |
| Migrator (v1 and retired perps to the live markets) | `0x297D61F5F231bb2E512f11f332Ea6B9E2709b9D3` |
| Limit orders (take-profit / stop-loss, `FlashPerpsV5LimitOrders`) | `0x6b9337131739D7C368dFFc08E6b2f4D007961f06` |
| Lens (QUANT rate, protocol / account / market KPIs, `FlashPerpsV5Lens`) | `0xCdF61E2DF06d19cbc95889Bcf454C8BCEBD916cB` |

## Churn (limit orders, Lattices)

| | |
| --- | --- |
| Churn core (proxy) | `0x35F1b89f4FEb2897CC1a6efF381d518D05824008` |
| Churn registry | `0x2EF26c31bC5160A748d066DBa1e26ab14E85D2ac` |
| Market FLASH/ETH (WETH quote) | `0x4b39bd7aad60303a9b91876aee70156afd01ab01a569ea973d3105df78756a7b` |
| Market QUANT/FLASH | `0xda2edfc201813ec11a6b8e6271dae076e5ec3a3e7d244bdffe1e62638f65b65a` |

## launch-v5 (bonding curves and Token Wars)

| | |
| --- | --- |
| Launchpad | `0x8aD3593A1c8a5249E7868975b2649B377c3bcCd0` |
| Launch router Q (ETH / FLASH / STOCK / PERP launches; use this) | `0x2e6640bca34BC34f3F4EF31cb19527EA80987911` |
| Skip-graduation direct launcher (no curve; ETH / USDC / FLASH pay, $10 min first buy) | `0x63AeDafc52368A97db0B452D527FE963F18BC47e` |
| Timed launch (no curve; token exists before its launch time; entries pooled into one first buy) | `0x29B8bBfE84F7f2E87f907EacBB388949ef7c0D67` |
| Executor T (timed launches, `poolKeyForQuote`) | `0x2b03b491fDEfF24CBB46D6F5ce1645DAA4767fc2` |
| Executor Q (`poolKeyForQuote`) | `0xF643E3ecc9966f02A270D487635D19EB2722479e` |
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
| QUANT treasury | `0x669Ef174655d011aE80f66aFeF97b6C8Cec3B568` |
| Treasury shares (creator cut per treasury, `FlashTreasuryShares`, ownerless) | `0x98C29eC362A4e76975002778Bb2E91B99e4A288F` |
| Revenue Share (`FlashRevenueShareV4` proxy, Safe-owned; stake FLASH, earn ETH streamed over 24 h, FLASH flash loans) | `0x7c36Ac8bec2D206984702790dB158fcAAFe69490` |
| Revenue Share V3 implementation | `0x7Ba4b0d63fc449D130F7259C231A7204ddcC7820` |
| Retired Revenue Share vault (`FlashPoolStaking`, withdraw-only, no new revenue) | `0x5cf120b13086277f83f901ea4df4fA8A45d577b0` |

## Pool keys

`fee` is always `8388608` (`0x800000`, the v4 dynamic-fee flag): every hook sets its own fee.

| Pool | currency0 | currency1 | tickSpacing | hooks | Pool id |
| --- | --- | --- | --- | --- | --- |
| FLASH/ETH | ETH `0x0` | FLASH | 60 | Referral Coin hook | `0x170ca02dfd2fe3aff821378f163b47082db366340dbe655dc999fe78b41e33d9` |
| QUANT/FLASH | QUANT | FLASH | 200 | FlashV3 hook | `0xda58d5f7017459cb8e3825fbfeec1229d6b7487fa26b8a58216c6ed0fbf619b6` |
| Perp `X` | USDC | perp token | 1 | Perps hook | see [PERPS-QUANT.md](PERPS-QUANT.md) |
| Launched token | lower of (token, quote) | higher | `executorQ.tickSpacing` (200 today) | FlashV3 hook | `launchpad.launchOf(token).poolId` |
| ETH/USDC pay leg (hookless) | ETH | USDC | 60 (fee 3000) or 10 (fee 500) | `0x0` | |

Never type out a launched token's key by hand. Read `executorQ.poolKeyForQuote(token, quote)` and require `keccak256(abi.encode(key)) == launchpad.launchOf(token).poolId == v3Registry.poolOfToken(token)`. The quote is WETH for an ETH-pair launch, FLASH for a FLASH pair, and `launchOf(token).quote` for STOCK and PERP pairs. `scripts/flash.mjs` runs this check before it builds any swap.
