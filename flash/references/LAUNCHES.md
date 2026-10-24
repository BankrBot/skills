# Launches (launch-v5 bonding curves) and per-token treasuries

A launch starts on a **bonding curve priced in FLASH**. When the curve raises its goal ($690 of FLASH, priced live), giving the token a $6,900 market cap, it locks and **graduates** into one FlashV3 Uniswap v4 pool against the launch's chosen quote. Backing is share-based: each buyer's FLASH sits in the curve's churn account and converts there. A curve sell redeems **your own** account's slice, less the sell fee, and never anyone else's.

Contracts:

| | |
| --- | --- |
| Launchpad | `0x8aD3593A1c8a5249E7868975b2649B377c3bcCd0` |
| Launch router Q (use it for every new launch) | `0x2e6640bca34BC34f3F4EF31cb19527EA80987911` |
| Shapes registry | `0x79644eC342881E40efab1401eb5ceF265F93aE7D` |
| Config | `0x64B866F63053680F14Da2f98a67C7b2BdFf960e6` |

## Choices

| Field | Values |
| --- | --- |
| `pair` | `0` ETH (graduated pool quote = WETH), `1` FLASH / "SUB" (quote = FLASH), `2` STOCK (quote = a tokenized stock), `3` PERP (quote = a live perp token) |
| `quote` | STOCK: NVDAc, METAc, AAPLc, GOOGLc, AMZNc, MSFTc, MSTRc, SNDKc, SPCXc, TSLAc, MUc, PLTRc (addresses in [REVENUE-STOCKS-PORTFOLIO.md](REVENUE-STOCKS-PORTFOLIO.md)); usable only when `config.quoteRouteOf(stock).pool != 0`. PERP: live perp ids 6-11 and 16-24 only (never 0-5 or 12-15). `0x0` for ETH / FLASH. |
| `name`, `symbol` | symbol 1-12 letters or digits |
| `mode` (curve split) | `0` Deep (participants 10% / liquidity 50% / creator churn 35% / protocol churn 5%), `1` Degen. Read `shapes.mode(id)` for the live split and the `enabled` flag. |
| `preset` (owner Lattice / burn shape) | `0` Long-term, `1` Fast burn. Read `shapes.preset(id)`. |
| `rewardAsset` | What the token's treasury buys and pays holders. `0x0` = the pair default (WETH, FLASH, or the stock / perp quote). Any token is accepted for ETH / FLASH pairs. A Token War STOCK / PERP entry must use 0 or its quote. |

Creation fee: $0.169 in FLASH (`launchpad.currentCreationFee()`, FLASH wei; ~0.124 FLASH today).

PERP-pair launches earn **creator QUANT** from losses realized in their pool ([PERPS-QUANT.md](PERPS-QUANT.md)).

## Create

**Default shape (mode 0, preset 0, pair-default reward): one transaction.** The router converts the ETH to FLASH through the FLASH/ETH pool, pays the creation fee, and spends the rest as the creator's first buy.

- ETH / FLASH pair: `routerQ.createWithEth((name, symbol, pair), minFlashOut, minTokens, recipient)`, payable, selector `0xce6c7a89`.
- STOCK / PERP pair: `routerQ.createWithEthQuoted((name, symbol, pair), quote, minFlashOut, minTokens, recipient)`, payable, selector `0xbd104112`.
- `minFlashOut` = an unattributed ETH -> FLASH quote on the FLASH/ETH pool minus slippage. The router's vault is referred, so it receives at least that. It must exceed the creation fee. `minTokens` may be 0 on the first buy.

**Custom shape (any non-default mode, preset or reward): straight to the launchpad, fee paid in FLASH, no first buy.**

1. `FLASH.approve(launchpad, fee + margin)`
2. `launchpad.createLaunchShaped((name, symbol, pair), shape)` (`0x29458fbd`), or `createLaunchQuoted((name, symbol, pair), quote, shape)` (`0x41701c70`) for STOCK / PERP
3. First buy with `launch-buy`

```
shape = (uint8 mode, uint8 preset, bool overrideStockpile=false, uint16 stockpileBps=0,
         (uint16,uint16,uint16,uint16) split = (0,0,0,0),
         (uint24 widthTicks=0, uint16 binsBelowLaunch=0, uint8 count=0, (uint16,int24,uint32)[8] segments = zeros) lattice,
         address rewardAsset, uint8 ownerLadder=0)          zeros = the registry's mode / preset values
```

The new token and curve are in the launchpad event `LaunchCreated(address indexed token, address indexed curve, address indexed creator, uint8 pair, uint256 goalFlash0, uint256 flashUsd18)`. Token art and description are set in the app; this skill creates the on-chain token.

Gas is **not constant**. A create measured 8.0M-8.7M gas, a first buy ~526k, later buys ~164k. A **locking** buy auto-graduates in the same transaction and needs at least 9M gas left (`AUTO_GRADUATE_GAS`), otherwise it reverts `InsufficientGasForGraduation()`. Use `eth_estimateGas`; it handles this.

CLI: `launch-create --name "My Coin" --symbol MYC --pair PERP --quote ETH2xL --eth 0.01 --wallet W`, and add `--mode 1 --preset 1 --reward 0x...` for a shaped launch.

## Trade the curve (phase 1, TRADING)

| Action | Call |
| --- | --- |
| Buy with ETH | `routerQ.buyWithEth(token, minFlashOut, minTokens, recipient)`, payable, `0x8f36afcb` |
| Buy with FLASH | `FLASH.approve(curve, gross)`, then `curve.buy(grossFlashIn, minTokensOut, recipient)`, `0x59a87bc1` |
| Quote a buy | `curve.quoteBuy(grossFlashIn)` -> `(flashSpent, tokensOut, refundAmount)` |
| Sell | `curve.sell(tokensIn, minFlashOut, recipient)`, `0xd04c6983`. Preview `curve.quoteSell(account, tokensIn)` -> `(notional, baseOut, quoteOut)`; use `minFlashOut = baseOut x (1 - slippage)` |
| Position | `curve.claimableTokensOf(account)`: curve tokens are a claim, not an ERC-20 balance, until graduation |
| Fees now | `curve.currentFeeBps()` -> `(buyBps, sellBps)`. Sells pay more than buys. |
| State | `launchpad.launchOf(token)` -> `(creator, curve, salt, poolId, pair, graduated, aborted, launchToleranceBps, name, symbol, shape, quote)`; `curve.phase()` (0 PENDING, 1 TRADING, 2 READY, 3 GRADUATED, 4 ABORTED); `spotPrice()`, `principalRaised()`, `goalFlashNow()`, `tokensSold()` |
| List | `launchpad.launchesLength()`, `launchAt(i)`, or `GET /v1/stack/launches` / `/v1/stack/launches/:token` |

CLI: `launch-list`, `launch-info --token T [--wallet W]`, `launch-buy --token T --eth 0.01` (or `--flash 5`), `launch-sell --token T --amount all`.

## Graduate, claim, refund, creator fees

| Action | Call |
| --- | --- |
| Graduate (permissionless, once READY) | `launchpad.finalize(token)`, `0x4ef39b75`. `BelowGoal(requiredUsd18, realisedUsd18)` means the graduation would realise less than the goal through the FLASH/ETH pool. ETH, STOCK and PERP launches wait for ETH depth there; FLASH launches do not. `curve.poke()` re-checks the lock at the live price. |
| Claim launched tokens (after GRADUATED) | `curve.claim(recipient)`, `0x1e83409a`. A small claim fee applies. |
| Airdrop batch (permissionless) | `curve.airdrop(from, count)`, `0x6f243a9c`, up to 400 per batch. Positions under the airdrop minimum must claim themselves. |
| Refund (after ABORTED) | `curve.refundAborted(recipient)`, `0x46b2a95e`. Returns your own account's outcome. |
| Creator fees (FLASH) | `curve.claimCreatorFees(recipient)`, `0xd6ae6e44`, creator only. Preview `curve.creatorFeesOwed()`. |

After graduation the token trades on its FlashV3 pool: `swap --market <token>` ([TRADING.md](TRADING.md)). The pool's 1% fee pays 90% to the creator side, in-swap, to the token's treasury, and 10% to the protocol.

CLI: `launch-graduate`, `launch-poke`, `launch-claim`, `launch-airdrop --from 0 --count 200`, `launch-refund`, `launch-creator-claim` (each `--token T --wallet W`).

Verified 2026-10-24 by `eth_simulateV1` on Base: shaped create, then approve, `curve.buy`, `quoteSell`, `curve.sell`, `creatorFeesOwed`, `claimCreatorFees`, and `routerQ.buyWithEth`, all in one simulated block. Router creates for all four pairs (ETH, FLASH, STOCK NVDAc, PERP ETH2xL) also simulated.

## Per-token treasuries (treasury-v3)

Every launch gets a treasury at `treasuryFactory.predictTreasury(token)` (`isTreasury(addr)` once it exists). The FlashV3 hook pays the creator share of swap fees there in-swap. Keepers convert fee tokens through the churn cascade and pay holder rewards in `rewardAsset`. Reads: `treasury.token()`, `quote()`, `controller()`, `mode()`, `rewardAsset()`. Controller-only settings (`setRewardAsset`, `setMode`, `setAgent`) are outside this skill. CLI: `treasury --token T`.
