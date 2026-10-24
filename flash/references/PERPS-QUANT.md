# Tokenized perps and QUANT

## What a Flash perp is

A perp is an ERC-20 (B20) token, 18 decimals, that tracks a leveraged long or short. Buy it with USDC to open the position and sell it back to close. The position is simply the token balance: there is no margin account, no liquidation call and no funding transaction. Price = `issuer.navPerToken(id)` (USDC 6 dp per 1e18 tokens). Leverage targets the label (2x, or "Max" ~3.2x for ETHMAXL) and drifts inside a band before the vault rebalances. That drift is the main risk: a leveraged token can lose most of its value in a sharp move. The trading fee is 0.05% each way.

Contracts: hook `0x2f4a713980425DF85b2B756C7484565A9b8778C8`, issuer `0x56a3e32134521Cefe75a2B8dB25D29a45E331BdD`.

## Markets

Pool key: `(USDC, perpToken, 8388608, tickSpacing 1, perps hook)`. USDC sorts below every perp token, so USDC is `currency0`: a buy is `zeroForOne = true`. `gasTx` is the tested transaction gas limit. Trade only the live ids. Read `GET /v1/stack/markets` for status, NAV and buy capacity.

| id | Symbol | Token | Pool id | gasTx |
| --- | --- | --- | --- | --- |
| 6 | ETH2xL | `0xB2000000000000000000009644514B1eAC20d754` | `0xd32c5c8820daffedcd738efc1390364caa6271267c1f210c9bfb15a0a3714740` | 5,687,346 |
| 7 | BTC2xL | `0xB200000000000000000000BfDAb3110AA73808B1` | `0x48fae8038953262a8f2fcbc689b2ff1c420519e46f596cb2c33570fc09e67d86` | 9,361,528 |
| 8 | ETHMAXL | `0xB200000000000000000000481F439A9be136f219` | `0xad8e84241670d7177f1e5a304087f25e0ceee837c1caa3aba3313d3adc4856f1` | 5,581,152 |
| 9 | XRP2xL | `0xB2000000000000000000005645a1D8b9AFcC8248` | `0x4df1107e0fdfed1d6462a8bf2567a743991efc54eb0a17f77affda77b9e801b6` | 8,030,328 |
| 10 | NVDA2xL | `0xb200000000000000000000563d2cA1451d746f9F` | `0xc5ff9e9bb8750d3c1ea6df1a5abedc676fa0a1d1c7e2b410c051bbe3e70538ba` | 6,912,352 |
| 11 | ETH2xS (short) | `0xB200000000000000000000f4091be2E8DB3a1896` | `0x9e015d71030c197527a58608da0eaa085581ae14bb2e7de619e1593666fae88c` | 7,018,546 |
| 16 | HYPE2xL | `0xB200000000000000000000801E479e58E1a90D01` | `0x29309d0a7a13819cc26748ca3639d40e68081c7507ec53925009cd1b3432b721` | 5,101,183 |
| 17 | SOL2xL | `0xB200000000000000000000130f5fb5d65ccF99fd` | `0x67fa8e0ab2679c79eeb89f6940ce30894459c7b5332e2df20ac1a506b3874be3` | 8,562,975 |
| 18 | ZEC2xL | `0xb200000000000000000000263519E3A799902bC5` | `0x17e2fc66a768fecc3a40eabe092c4f661e0c67cca63511281d9727e849085ec7` | 4,622,051 |
| 19 | AERO2xL | `0xb200000000000000000000C26EDebFDF721e65aD` | `0x34472ee38b2ea40dce9a95314abf5a1e7794e87b7e751c77d677839fee28e8d9` | 10,213,597 |
| 20 | DOGE2xL | `0xb200000000000000000000AdA095D32710fe96C1` | `0xf622e7b4efc235194f4131422d8f31829346dd8e9dcb9676384cd8a443d2bda8` | 6,060,283 |
| 21 | META2xL (24/7) | `0xB200000000000000000000B1c6b3E5FA1852f63a` | `0x6cf88bf5eb244a8546b17b150068ed1cccf359e382da598d9976b62965b2abea` | 6,699,126 |
| 22 | AAPL2xL (24/7) | `0xB20000000000000000000051Ae96aa4abc47dE20` | `0xad67e819cd1afb730340d99f11dfadc9e6d1fc54caacd9e47fdf8963d2229018` | 4,994,988 |
| 23 | GOOGL2xL (24/7) | `0xb20000000000000000000020162d13881075382e` | `0xaa2409e6f2f84adde5e489d8081fc8296d3b469692321665fb9ae968738b906e` | 6,912,352 |
| 24 | SPCX2xL (24/7) | `0xb200000000000000000000046e16550458738e91` | `0xcd7f12c7115661c319b609c5411323069c7e3a08ddc594e38398e3e7a6ce37b2` | 5,208,214 |

**Exit-only markets (do not buy):**

- id 0 ETH2x (`0xB20000000000000000000020a813f90628801EF6`) can still be sold on its pool.
- ids 1-5 (BTC2x, ETHMAX, XRP2x, NVDA2x, the earlier ETH2xS) exit through `issuer.unwind(id, amount, minUsdcOut, to)`, after `token.approve(issuer, amount)`.
- ids 12-15 were never seeded.

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
- `perp-unwind --market BTC2x --amount all --wallet W` for exit-only ids 1-5.

## Take-profit and stop-loss (limit orders)

`FlashPerpsV5LimitOrders` `0xf5d94BE034944C8706a12B6B4d4dE0dbEbc10824` lists TP / SL orders on chain, like an NFT listing: the tokens stay in the wallet, and the holder approves the contract for the perp token. Allowlisted keepers fill an order when the **issuer's on-chain NAV** (`navPerToken(id)`) meets its trigger, by selling exactly `qty` in the market's perps pool on the holder's behalf. Cost basis, realized PnL and the QUANT loss reward move exactly as for a normal sell.

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

QUANT (`0xb2000000000000000000006a9881C01617b77B08`, max supply 6,942,000) is the perps loss-reward token. It trades against FLASH on the QUANT/FLASH FlashV3 pool, and its fees fund the QUANT treasury `0x6A7faA6B8F0C7f66dFCa2Bb5dd1BCa0915bc55E5`.

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

**QUANT stats lens:** `FlashPerpsV5Lens` `0x7D06a5C37fd91B85D6dC2f212467f1803895d0C2` reads the live issuer:

| Call | Returns |
| --- | --- |
| `globalKpi()` | `(profit, loss, quantMinted, quantLive)`: protocol-wide realized profit and loss (USDC 6 dp) and QUANT minted |
| `quantRateNow()` | QUANT-wei per $1 of realized loss right now |
| `previewQuant(lossUsd6)` | `(user, tax)`: QUANT a loss of that size would mint now (80 / 20) |
| `accountKpi(account)` | `(profit, loss, quantReceived)` |
| `marketKpi(id)` | `(usdcIn, usdcOut, profit, loss)` |
| `unrealizedPnl(id, account)` | int256 USDC 6 dp |

`quant-status` reads it.

## Migrating from the earlier perps (v1 -> V2)

Holders of the retired generation (the `0x4f57...` hook's B20 tokens and legacy vault shares) move with the stateless migrator `0x87c9784070C4E134F7dE7627dA0038CA9f0473D6`:

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
