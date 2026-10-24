# Trading: FLASH, QUANT, launched tokens, perps

All Flash trading runs on Uniswap v4 pools with hooks. Quote with the pinned V4 Quoter and swap through the pinned Universal Router (see [CONTRACTS.md](CONTRACTS.md)). Aerodrome and other routers are not part of the stack.

CLI: `node scripts/flash.mjs quote|swap --market <M> --side buy|sell --amount <N> [--pay ETH|USDC|FLASH] [--exact-out] [--slippage-bps 500] --wallet <W>`

`--market` accepts `FLASH`, `QUANT`, a live perp symbol (`ETH2xL`, `BTC2xL`, ... see [PERPS-QUANT.md](PERPS-QUANT.md)), or a graduated launch token address.

## Fees (read live; the numbers are today's)

| Pool | Fee | Notes |
| --- | --- | --- |
| FLASH/ETH | 6.9% unreferred, 1.69% referred (`policy.FEE_UNREFERRED_BPS()` = 690, `FEE_REFERRED_BPS()` = 169) | Always taken in ETH. Referred 1.69% = 1% to the referrer + 0.69% to King of the Hill. Unreferred 6.9% = 0.9% KOTH + 4.14% top-100 pool + 1.86% treasury. |
| FLASH/ETH sells | + impact tax in FLASH (0% at 0% impact, ~0.3% at 1%, ~4.1% at 10%, up to 11% at 20% impact) + a rolling decline tax in ETH | Fee plus taxes are capped at `policy.MAX_TOTAL_BPS()` = 2,500 (25%). Preview with `policy.quoteSellTax(amount, exactIn)`. |
| FlashV3 (QUANT, launched tokens) | 1% in the quote token | 90% to the token's creator / treasury, 10% to the protocol (quote fees feed the FLASH buyback). Same impact-tax curve on large sells. |
| Perps | 0.05% | All of it goes to the fee sink, which feeds the FLASH buyback. |

The Quoter returns the amount after every fee and tax. The hooks guarantee quote == execution for the same state.

## Who the trade is attributed to

The Universal Router and V4 Quoter are pinned "caller context" contracts. The hook charges the fee of the address behind them: the `from` of the Quoter `eth_call`, or the signer of the router transaction. Quote with `account = the user's wallet`, otherwise a FLASH quote assumes the unreferred 6.9% fee.

## Gas (Base caps a transaction at 16,777,216 gas)

Each hook requires `gasleft() >= floor` at the start of the swap and reverts with `GasFloor()` / `SwapGasFloor()` below it. The floors only require gas; they burn nothing. The required limit is the same for every size and direction. Send `eth_estimateGas x 1.1`, never below the pool constant:

| Pool | Live floor (read) | Tx gas limit constant |
| --- | --- | --- |
| FLASH/ETH | `policy.gasFloor()` = 2,800,000 | 3,200,000 (+88,000 when the swap carries an in-swap referral bind) |
| FlashV3 pools | per kind (6,500,000) | 6,975,725 |
| Perps | `perpsHook.pools(poolId).gasFloor` | per market, 4.6M to 10.2M (see [PERPS-QUANT.md](PERPS-QUANT.md)) |
| Multi-hop pay routes | every hook on the path checks its own floor | estimate x 1.1 floored at the heaviest hop, or the sum of hop constants without an estimate |

Quotes need gas too: run Quoter `eth_call`s with `gas: 15000000`.

Smart wallets sending EIP-5792 bundles (`wallet_sendCalls`, Base MCP `send_calls`) size the gas themselves. `eth_estimateGas` already accounts for the floor, because its binary search finds the smallest limit that succeeds.

Verified on Base with `eth_simulateV1` and an explicit gas limit: a FLASH buy reverts `GasFloor()` at 3,100,000 and succeeds at 3,200,000.

## Approvals

- ETH input: none.
- ERC-20 input (USDC, FLASH, QUANT, perp tokens, WETH):
  1. `token.approve(Permit2, amount)`
  2. `Permit2.approve(token, UniversalRouter, uint160 amount, uint48 expiration)`, selector `0x87517c45`

  Skip each step that is already in place. Check with `token.allowance(user, Permit2)` and `Permit2.allowance(user, token, UniversalRouter)` (which returns amount, expiration, nonce). The scripts approve exact amounts with a 1-day Permit2 expiry, never unlimited.

## Universal Router calldata

The call is `UniversalRouter.execute(bytes commands, bytes[] inputs, uint256 deadline)`, selector `0x3593564c`. Use a 20-minute deadline.

Single pool. Use one command, `0x10` (V4_SWAP), whose input is `abi.encode(bytes actions, bytes[] params)`:

| Case | actions | params |
| --- | --- | --- |
| Native ETH in, exact-in | `0x06 0b 0f` | `SWAP_EXACT_IN_SINGLE(key, zeroForOne, amountIn, minOut, hookData)`, `SETTLE(ETH, amountIn, payerIsUser=false)`, `TAKE_ALL(out, minOut)` |
| ERC-20 in, exact-in | `0x06 0c 0f` | swap, `SETTLE_ALL(in, amountIn)`, `TAKE_ALL(out, minOut)` |
| Native ETH in, exact-out | `0x08 0b 0f` + UR command `0x04` | `SWAP_EXACT_OUT_SINGLE(key, zeroForOne, amountOut, maxIn, hookData)`, `SETTLE(ETH, 0, false)`, `TAKE_ALL(out, amountOut)`. Then SWEEP `(ETH, 0x...0001, 0)` returns unused ETH. Send `value = maxIn`. |
| ERC-20 in, exact-out | `0x08 0c 0f` | swap, `SETTLE_ALL(in, maxIn)`, `TAKE_ALL(out, amountOut)` |

The Universal Router's V4Router rejects the v4 SWEEP action (`UnsupportedAction(20)`), so refunds use the UR SWEEP command. `zeroForOne` is true when you pay `currency0`. `value` = amountIn for an ETH exact-in, maxIn for an ETH exact-out, else 0.

Pay routes (the app's "Pay with ETH / USDC / FLASH" on a buy) are exact-in only. Use one `0x10` command with actions `0x07 0b|0c 0f`: `SWAP_EXACT_IN((currencyIn, PathKey[] path, amountIn, minOut))`, then SETTLE / SETTLE_ALL, then TAKE_ALL of the final token. `PathKey = (intermediateCurrency, fee, tickSpacing, hooks, hookData)`. Quote the route with `Quoter.quoteExactInput((exactCurrency, path, exactAmount))`.

| Buying | Pay | Path |
| --- | --- | --- |
| QUANT / FLASH-quoted tokens | ETH | ETH -> FLASH (RC pool) -> token |
| QUANT / FLASH-quoted tokens | USDC | USDC -> ETH (hookless ETH/USDC) -> FLASH -> token |
| Perps (USDC quote) | ETH | ETH -> USDC (hookless) -> perp |
| Perps | FLASH | FLASH -> ETH (RC) -> USDC -> perp |
| FLASH | USDC | USDC -> ETH -> FLASH |

The hookless ETH/USDC leg has two pools: fee 3000 / spacing 60 and fee 500 / spacing 10. Quote both and use the better one. In a FLASH -> ETH hop the RC pool's ETH side only holds what FLASH buyers paid in, so large FLASH-funded routes can run out of depth.

## Slippage

The app uses 5% (500 bps) on every trade. For exact-in, `minOut = quoted * (10000 - bps) / 10000`. For exact-out, `maxIn = ceil(quoted * (10000 + bps) / 10000)`. A tighter value is fine. Never raise it silently.

## Graduated launch tokens

- An ETH-pair launch trades against **WETH**, not native ETH. Wrap first (`wrap-eth`, `WETH.deposit()`), then swap with WETH.
- A FLASH-pair (SUB) launch trades against FLASH. Pay with ETH or USDC through a pay route.
- STOCK and PERP pairs trade against that stock or perp token.
- Always derive the key from `executorQ.poolKeyForQuote` and check the pool id (see [CONTRACTS.md](CONTRACTS.md)).

## Trade-side effects to tell the user

- A FLASH buy whose gross ETH input is at least `koth.nextTrigger()` takes the King of the Hill throne ([REFERRALS-KOTH.md](REFERRALS-KOTH.md)).
- Selling FLASH while you lead King of the Hill forfeits your leader share.
- A referred wallet's single FLASH buy of at least `registry.codeThreshold()` (0.1 ETH) issues that wallet its own referral code.
- Selling a perp at a realized loss mints QUANT to the seller in the same transaction ([PERPS-QUANT.md](PERPS-QUANT.md)).
- Churn levels, Lattices and full-range positions can fill part of a buy at or above their floors in the same swap. The quote already includes this.
