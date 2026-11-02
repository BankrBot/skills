# Tokenized perps and QUANT

## What a Flash perp is

A perp is an ERC-20 (B20) token, 18 decimals, that tracks a leveraged long or short. Buy it with USDC to open the position and sell it back to close. The position is simply the token balance: there is no margin account, no liquidation call and no funding transaction. Price = `issuer.navPerToken(id)` (USDC 6 dp per 1e18 tokens). Leverage targets the label (2x, or "Max" ~3.2x for ETHMAXL) and drifts inside a band before the vault rebalances. That drift is the main risk: a leveraged token can lose most of its value in a sharp move. The trading fee is 0.05% each way.

Contracts: hook `0xc4dF67D58fb02Ecc2499FDAcC4D1d71fEa4FB8C8`, issuer `0x1BBd2F85191d2D94fA51bc26e5AB70c2eB7c5941`.

## Markets

Pool key: `(USDC, perpToken, 8388608, tickSpacing 1, perps hook)`. USDC sorts below every perp token, so USDC is `currency0`: a buy is `zeroForOne = true`. `gasTx` is the tested transaction gas limit. Trade only the live ids. Read `GET /v1/stack/markets` for status, NAV and buy capacity.

| id | Symbol | Token | Pool id | gasTx |
| --- | --- | --- | --- | --- |
| 0 | ETH2xL | `0xB20000000000000000000045645B86D331D437d6` | `0xc728602ddd657a32f49552fd2fc5677c43323503eecd49848cc7ca7f9c3f1e5e` | 5,687,346 |
| 1 | BTC2xL | `0xB2000000000000000000005a7B792e9ba8E4E2A7` | `0x07fec85dd7b933793736f7d9d556bb8a91924370e583336ef1ca76c11a3dca4d` | 9,370,000 |
| 2 | ETHMAXL | `0xb20000000000000000000055b2BAA2A007561f28` | `0x864aebb0f51a31dcc7cd272f02926661a736e1eca17ff88c28c5820b73bfe8c2` | 5,581,152 |
| 3 | XRP2xL | `0xb20000000000000000000051fB852b1e49874EAB` | `0x41985b76231e04e4ad7287c27ef91de0279edf90ccade8b54c2ec3e793881ba8` | 8,030,328 |
| 4 | NVDA2xL | `0xB2000000000000000000003Ef9c53D3d360fBC35` | `0xf7c1c5ca3a3029d05237f2442277d2a95e37ebed9fed23e736928a886da27066` | 6,912,352 |
| 5 | ETH2xS (short) | `0xb20000000000000000000067D3a1F52414FbA767` | `0x2b71f2301930fee90b33c3870f53fde2669ea3c5890bc43eace4ac8163e0290c` | 7,031,000 |
| 6 | HYPE2xL | `0xb200000000000000000000a2017cDBe6C67943f2` | `0xf03fae0b6186127a75a0199ec2206fc484d87d771249eaaa3273feb8eeaa1201` | 5,101,183 |
| 7 | SOL2xL | `0xB200000000000000000000D96958F9f5261C833E` | `0x4779a46f329dd648a988231b61269699846216fdba6774ba3fee116ef917dff2` | 8,562,975 |
| 8 | ZEC2xL | `0xB20000000000000000000058330Df506882E5414` | `0xf8afa4f573d77256858a9c2a235788ac3c7ac43f59a8085c170e9e658d7328cc` | 4,626,000 |
| 9 | AERO2xL | `0xb200000000000000000000c9b1245A5dfA2B0330` | `0x25e1b3e5cbbefe400bfe8734af3649e01c625ab21684a438c398f0fd03dad181` | 10,280,000 |
| 10 | DOGE2xL | `0xb200000000000000000000EC9F09Aac2EF156A30` | `0x73392a539251c1e078bcb39496e4396e872c45b6f3eee110275b62d043567901` | 6,060,283 |
| 11 | META2xL (24/7) | `0xB200000000000000000000424C01815023337579` | `0x01bac7813803bb976b0331b4194354e14e77052b6c9bc97911de37373559796a` | 6,706,000 |
| 12 | AAPL2xL (24/7) | `0xB2000000000000000000000F0e67e61cB92DfcD7` | `0xb975aebd20666080c6e4744adb5afc2d338b0a85e8c4c57b461ee25b068e7003` | 4,994,988 |
| 13 | GOOGL2xL (24/7) | `0xB2000000000000000000009d4d399289638fc54A` | `0xc5cedee5a52a50e7d98bae592390ac552f4f63bb778c73d68587e1a2b975f884` | 6,912,352 |
| 14 | SPCX2xL (24/7) | `0xb2000000000000000000006141c3C67B314CBFc4` | `0xf0f44ea451f2f5a310d42b9345a1b3cb4a73d6e1d6338bbaea5a83ea44377e58` | 5,211,000 |

**Retired generation (do not buy):** old ids 0-24 on the retired hook `0x2f4a713980425DF85b2B756C7484565A9b8778C8` and issuer `0x56a3e32134521Cefe75a2B8dB25D29a45E331BdD`. Holders move into the live market with the migrator (below), or exit with `token.approve(retiredIssuer, amount)` then `retiredIssuer.unwind(oldId, amount, minUsdcOut, to)`. Each entry's `successor` in `known-contracts.json` is its live market id.

The full list with vaults is in [`../known-contracts.json`](../known-contracts.json).

The hook floor can be raised by the owner: read `perpsHook.pools(poolId)`, which returns `(marketId, registered, usdcIs0, gasFloor)`, and keep the gas limit above floor + ~450k. Prefer `eth_estimateGas x 1.1`.

## Buy, sell, read

- **Quote:** `V4Quoter.quoteExactInputSingle((key, zeroForOne, amount, 0x))` with `gas: 15000000`. Quotes are never refused for size: capacity the issuer cannot fill comes from the hook's backstop. `issuer.buyCapacityUsdc(id)` shows the engine's room.
- **Buy with USDC:** Permit2 approvals, then `execute` with actions `0x06 0c 0f` (see [TRADING.md](TRADING.md)). **With ETH or FLASH:** the pay routes ETH -> USDC -> perp and FLASH -> ETH -> USDC -> perp.
- **Sell:** `zeroForOne = false`, input = the perp token (Permit2 approvals for the perp token).
- **Position:** `perp.balanceOf(user)`, value = balance x NAV. `issuer.positionOf(id, user)` returns `(shares, basisUsdc, avgCostPerToken)`, so PnL = value - basisUsdc. `GET /v1/stack/perps/positions/:account` adds the trade history ledger. `GET /v1/stack/perps/:id/nav` is the NAV chart.

CLI:
- `swap --market ETH2xL --side buy --amount 25 --wallet W` (USDC). Add `--pay ETH` to pay in ETH.
- `swap --market ETH2xL --side sell --amount all --wallet W` sells the whole balance.
- `perp-positions --wallet W`
- `perp-unwind --market <retired token> --amount all --wallet W` exits a retired market to USDC.

## Take-profit and stop-loss (limit orders)

`FlashPerpsV5LimitOrders` `0x6b9337131739D7C368dFFc08E6b2f4D007961f06` lists TP / SL orders on chain, like an NFT listing: the tokens stay in the wallet, and the holder approves the contract for the perp token. Allowlisted keepers fill an order when the **issuer's on-chain NAV** (`navPerToken(id)`) meets its trigger, by selling exactly `qty` in the market's perps pool on the holder's behalf. Cost basis, realized PnL and the QUANT loss reward move exactly as for a normal sell.

- **Take profit** (`kind 0`): fills at NAV >= `triggerNav`. The holder receives exactly `qty x triggerNav x 99.9%` (`takeProfitOut(qty, triggerNav)`); the fill reverts if the sale pays less.
- **Stop loss** (`kind 1`): fills at NAV <= `triggerNav`. The holder receives the sale proceeds minus 0.1%, never less than their own `minOut` floor (the app default is 2% under `qty x stop`).
- **Fee:** 0.1% (`FEE_PIPS` = 1000, constant). It reimburses the keeper's gas (capped at 1 USDC) and the rest goes to the FLASH buyback.
- **Minimum:** `qty x triggerNav >= minOrderUsdc()` = $10 today (`BelowMinimum`).
- Units: `qty` in perp tokens (18 dp), `triggerNav` in USDC (6 dp) per 1e18 tokens, `expiry` in unix seconds (0 = good till cancelled).
- The allowance (and balance) must still cover `qty` when a keeper fills. `check(id)` returns `(code, nav)`: 0 fillable, 1 not open, 2 expired, 3 paused, 4 oracle down, 5 trigger not met, 6 balance short, 7 allowance short.

| Action | Call | Selector |
| --- | --- | --- |
| Approve (once, covering every open order's qty) | `perpToken.approve(0xf5d9...0824, qty)` | `0x095ea7b3` |
| One order | `place(marketId, kind, qty, triggerNav, minOut, expiry)` (`minOut` is ignored for TP) | `0xfb582da7` |
| Linked TP + SL on the same qty (one fill cancels the other) | `placePair(marketId, qty, tpNav, slNav, slMinOut, expiry)`, `slNav < tpNav` | `0x5976f9d6` |
| Re-price / re-size | `update(id, qty, triggerNav, minOut, expiry)` | `0x86904ccf` |
| Cancel (works while paused) | `cancel(uint256[] ids)` | `0x2e340823` |

API: `GET /v1/stack/perps/orders` (contract, fee, live flag), `GET /v1/stack/perps/orders/:account` (`?status=open`), `GET /v1/stack/perps/orderbook/:marketId` (open depth by trigger). The `/v1/live` websocket pushes `perp.order.created`, `.updated`, `.filled` and `.cancelled`.

CLI:
- `perp-orders --wallet W [--status open]`
- `perp-tpsl --market ETH2xL --amount all --tp 1.25 --sl 0.85 [--sl-min 120] [--expiry-days 30] --wallet W` (`--tp` or `--sl` alone places one order; NAVs are USDC per token)
- `perp-order-cancel --ids 12,13 --wallet W`

## QUANT

QUANT (`0xB2000000000000000000008a865BAD54481CD395`, max supply 6,942,000) is the perps loss-reward token. It trades against FLASH on the QUANT/FLASH FlashV3 pool, and its fees fund the QUANT treasury `0x669Ef174655d011aE80f66aFeF97b6C8Cec3B568`.

**How traders earn it (automatic, no claim):** selling or unwinding a perp at a **realized loss** makes the issuer mint QUANT to the seller in that same transaction.

- The mint follows a Lomax curve of cumulative protocol-wide realized loss `L` (USD): `minted(L) = R x (1 - (1 + L/K)^-a)`, with `R = 2,776,800`, `a = 0.121754` and `K = $338,086.51`.
- The rate starts at 1 QUANT per $1 of loss and tapers: $1M of losses distributes ~15%, $100M ~50%.
- Each mint is split 80% to the trader and 20% to the protocol.
- A QUANT mint failure never blocks the exit.
- `issuer.quantMinted()` is the running total.

**How launch creators earn it ("creator QUANT", `claimMemeQuant`):** a token launched on a **PERP** pair (pool kind 4) earns QUANT from its pool.

- For losses realized inside that pool, 50% (`MEME_SHARE_BPS`) of the trader's QUANT accrues to the pool instead of the trader.
- The accrued QUANT is minted to the pool creator (`v3Hook.creatorOf(poolId)`, the launch's creator or treasury) through `issuer.claimMemeQuant(poolId, to)`. Only the pool's bound recipient, the FlashV3 ledger, can call it.
- Any user triggers it, permissionlessly, with **`v3Ledger.sweep(poolId)`** (selector `0x248eb4ec`). The same call also routes the pool's fees. Swaps on the pool trigger it too (`autoSweep`).
- Owed amount: `issuer.memeRoutes(poolId)` returns `(recipient, owed)`; claimable = `owed - 1` when `owed > 1`.

CLI:
- `quant-status [--wallet W]`
- `quant-sweep --token <launched PERP-pair token> --wallet W` (or `--pool <poolId>`)
- Trade QUANT: `swap --market QUANT --side buy --amount <FLASH>`, or `--pay ETH|USDC`.

API: `GET /v1/stack/quant` returns supply, issuer mints, price, volume and mint stats. Its `mints.lossUsdFloat` field is mis-scaled; use `mints.lossUsd`, which is USDC with 6 decimals.

**QUANT stats lens:** `FlashPerpsV5Lens` `0xCdF61E2DF06d19cbc95889Bcf454C8BCEBD916cB` reads the live issuer:

| Call | Returns |
| --- | --- |
| `globalKpi()` | `(profit, loss, quantMinted, quantLive)`: protocol-wide realized profit and loss (USDC 6 dp) and QUANT minted |
| `quantRateNow()` | QUANT-wei per $1 of realized loss right now |
| `previewQuant(lossUsd6)` | `(user, tax)`: QUANT a loss of that size would mint now (80 / 20) |
| `accountKpi(account)` | `(profit, loss, quantReceived)` |
| `marketKpi(id)` | `(usdcIn, usdcOut, profit, loss)` |
| `unrealizedPnl(id, account)` | int256 USDC 6 dp |

`quant-status` reads it.

## Migrating from the earlier perps

Holders of v1 perps (the `0x4f57...` hook's B20 tokens and legacy vault shares) and of the retired V5 generation (sold on its old pool through `0x2f4a713980425DF85b2B756C7484565A9b8778C8`) move into the live markets with the stateless migrator `0x297D61F5F231bb2E512f11f332Ea6B9E2709b9D3`:

```
migrate((address token,uint256 amount,uint8 pull,uint256 permitDeadline,uint8 v,bytes32 r,bytes32 s,
         uint256 permit2Nonce,bytes permit2Signature,uint256 minUsdcOut,uint256 v5Id,uint256 minV5Out)[] items,
        uint256 deadline) returns (uint256[] v5Out)
```

- **pull:**
  - `0` = an allowance to the migrator
  - `1` = an EIP-2612 permit signature (every `0xb200...` v1 token; domain = `token.name()`, version "1")
  - `2` = a Permit2 SignatureTransfer
- Each item exits its v1 position through a constructor-fixed route and buys the V2 market `v5Id`. Any leg under its minimum reverts the whole transaction.
- The per-route `minUsdcOut` quotes and the v1 -> V2 mapping live in `app/src/perpV5Migration.config.ts`. That mapping is not in this skill's CLI: direct users to the app's one-transaction migration (tryflash.app, Perps).
