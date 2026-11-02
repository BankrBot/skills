# Launches (launch-v5 bonding curves) and per-token treasuries

A launch starts on a **bonding curve priced in FLASH**. When the curve raises its goal ($690 of FLASH, priced live), giving the token a $6,900 market cap, it locks and **graduates** into one FlashV3 Uniswap v4 pool against the launch's chosen quote. Backing is share-based: each buyer's FLASH sits in the curve's churn account and converts there. A curve sell redeems **your own** account's slice, less the sell fee, and never anyone else's.

Contracts:

| | |
| --- | --- |
| Launchpad | `0x8aD3593A1c8a5249E7868975b2649B377c3bcCd0` |
| Launch router Q (use it for every new launch) | `0x2e6640bca34BC34f3F4EF31cb19527EA80987911` |
| Skip-graduation direct launcher (no bonding curve; see the Skip graduation section) | `0x63AeDafc52368A97db0B452D527FE963F18BC47e` |
| Timed launch (see [Timed launch](#timed-launch-no-bonding-curve-launches-at-a-set-time)) | `0x29B8bBfE84F7f2E87f907EacBB388949ef7c0D67` |
| Executor T (timed launches, `poolKeyForQuote`) | `0x2b03b491fDEfF24CBB46D6F5ce1645DAA4767fc2` |
| Shapes registry | `0x79644eC342881E40efab1401eb5ceF265F93aE7D` |
| Config | `0x64B866F63053680F14Da2f98a67C7b2BdFf960e6` |

## Choices

| Field | Values |
| --- | --- |
| `pair` | `0` ETH (graduated pool quote = WETH), `1` FLASH / "SUB" (quote = FLASH), `2` STOCK (quote = a tokenized stock), `3` PERP (quote = a live perp token) |
| `quote` | STOCK: NVDAc, METAc, AAPLc, GOOGLc, AMZNc, MSFTc, MSTRc, SNDKc, SPCXc, TSLAc, MUc, PLTRc (addresses in [REVENUE-STOCKS-PORTFOLIO.md](REVENUE-STOCKS-PORTFOLIO.md)); usable only when `config.quoteRouteOf(stock).pool != 0`. PERP: live perp ids 0-14 only (never the retired generation). `0x0` for ETH / FLASH. |
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

The new token and curve are in the launchpad event `LaunchCreated(address indexed token, address indexed curve, address indexed creator, uint8 pair, uint256 goalFlash0, uint256 flashUsd18)`. The create transaction carries no metadata: the token's art, description and links come from a signed profile saved **before** it (next section).

## Token profile (image required, wallet-signed)

Every launch and war entry needs token art. The API stores a profile keyed by (kind, creator, name, ticker) and attaches it to the token when the create (or the war entry) is indexed. Without one the token has no image.

1. **Upload the image:** `POST https://api.tryflash.app/v1/uploads`, multipart field `image` (PNG or JPG, at most 10 MB), header `x-flash-uploader: <creator>`. It returns `{ "imageUrl": "..." }` after moderation.
2. **Build the message** (EIP-191, lines joined by `\n`):
   ```
   tryflash.app wants you to save a Flash token profile.

   Kind: launch                      (or war)
   Name: "<name as JSON string>"
   Ticker: "<symbol as JSON string>"
   Image: <imageUrl>
   Details: <keccak256(utf8(JSON.stringify([description, twitterUrl, websiteUrl])))>
   Chain ID: 8453
   Account: <creator, checksummed>
   Nonce: <32 lowercase hex chars, fresh>
   Issued At: <new Date().toISOString()>
   ```
   Missing description or links are empty strings. Every field is the exact text you send in step 4.
3. **Sign it** with the creator wallet (`personal_sign`). EOAs, ERC-1271 smart wallets and undeployed ERC-6492 wallets are accepted.
4. **Save it** within 10 minutes: `POST https://api.tryflash.app/v1/launch-v2/prepare` with headers `content-type: application/json` and `x-flash-uploader: <creator>`, body:
   ```json
   { "action": "launch", "name": "Agent Coin", "symbol": "AGC", "description": "", "imageUrl": "<from step 1>", "twitterUrl": "", "websiteUrl": "",
     "mode": "deep-lp", "quoteClass": "SUB", "quoteToken": "0xD1Be6E31B44C3365Db5BE514ba570ac4fEc63d84", "inputRouteId": "flash", "amountIn": "1",
     "profileAuth": { "nonce": "<step 2>", "issuedAt": "<step 2>", "signature": "<step 3>" } }
   ```
   `mode`, `quoteClass`, `quoteToken`, `inputRouteId` and `amountIn` are fixed values this profile store requires (exactly what the app sends); the real pair is chosen on chain at create. The name (1-32 characters) and ticker (2-10, stored upper-case) must match the on-chain create. Use `"action": "war"` for a war entry.
5. Send the create (`launch-create`) or the entry (`war-enter`) with the same name and ticker.

Errors: `TOKEN_IMAGE_REQUIRED` (400), `TOKEN_PROFILE_SIGNATURE_REQUIRED` (401, no `profileAuth`), `TOKEN_PROFILE_SIGNATURE_EXPIRED` / `_INVALID` (401), `_REPLAYED` (409), `TOKEN_CONTENT_REJECTED` (422). See [ERRORS.md](ERRORS.md).

Without a shell, the Flash MCP server (`https://api.tryflash.app/mcp`) does steps 2 and 4 for a launch: call `prepare_launch` with `from`, name, symbol, a non-empty description, imageUrl, `quoteToken` FLASH and a stock `rewardAsset` (e.g. NVDA); the first call returns `signMessage` plus `profileAuth { nonce, issuedAt }`; sign `signMessage` and call again with `profileAuth.signature` added. The MCP `build_launch`, `build_war_action` and `prepare_war_entry` target launch-v5 and Token Wars V6.

Gas is **not constant**. A create measured 8.0M-8.7M gas, a first buy ~526k, later buys ~164k. A **locking** buy auto-graduates in the same transaction and needs at least 9M gas left (`AUTO_GRADUATE_GAS`), otherwise it reverts `InsufficientGasForGraduation()`. Use `eth_estimateGas`; it handles this.

CLI: `launch-create --name "My Coin" --symbol MYC --pair PERP --quote ETH2xL --eth 0.01 --wallet W`, and add `--mode 1 --preset 1 --reward 0x...` for a shaped launch.

## Timed launch (no bonding curve, launches at a set time)

The Advanced option under "Skip graduation". The token is created immediately, so its address can be shared before it trades. Until the launch time anyone can enter; at the time, everything entered becomes one first buy.

- Contract `0x29B8bBfE84F7f2E87f907EacBB388949ef7c0D67` (verified on Basescan and Sourcify), pools through executor `0x2b03b491fDEfF24CBB46D6F5ce1645DAA4767fc2`. Same treasury, reward asset, modes and owner ladder as a curve launch. Each launch has its own accounting.
- Every launch opens at a $6,900 market cap. The first buy sets the price after that, and there is no cap on the raise.
- Half of the FLASH entered goes to the creator at launch. The other half churns toward ETH during the countdown, then funds the first buy.
- Tokens are shared in proportion to the FLASH each entrant put in. There is a $1 minimum entry, and entries close at `launchAt`.
- `launchAt` must be 5 minutes to 30 days ahead. Flash keepers launch at that time; after one hour anyone can.

| Action | CLI | MCP `build_timed_launch` action | Contract call |
| --- | --- | --- | --- |
| Create | `timed-create --name N --symbol S --pair ETH --in-minutes 60` (or `--at <unix or ISO>`, `--pay FLASH`, `--quote`, `--mode`, `--preset`, `--reward`) | `create` (after `prepare_launch`) | `createWithEth(input, minFeeFlash)` payable `0x1a94062f`, or `create(input)` `0x8e1a656a` after approving `currentCreationFee()` FLASH. `input` is `(name, symbol, pair, quote, shape, launchAt)` |
| Enter | `timed-enter --token T --pay ETH\|USDC\|FLASH --amount N` | `enter` | `enterWithEth(token, minFlash)` payable `0x509e40f3`, or `enterWithToken(token, tokenIn, amountIn, minFlash)` `0x6213c708` after approving `amountIn` |
| Launch | `timed-launch --token T` | `launch` | `launch(token, minQuote, minTokens)` `0xeea21274` |
| Claim tokens and leftovers | `timed-claim --token T` | `claim` | `claim(token)` `0x1e83409a` |
| Airdrop to entrants | `timed-airdrop --token T [--from N --count 100]` | `airdrop` | `airdrop(token, from, count)` `0xe1bc2967` |
| Abort | `timed-abort --token T` | `abort` | `abort(token)` `0x90cbfa19` |
| Refund | `timed-refund --token T [--account A]` | `refund` | `refund(token, account)` `0x5e30b8a6` |
| Read | `timed-list`, `timed-info --token T --wallet W` | `get_timed_launch` | `launchOf(token)` (status: 1 open, 2 launched, 3 aborted), `enteredOf`, `claimableOf`, `leftoverOf`, `leftoverQuoteOf`, `abortable` |

Save the token profile first ([Token profile](#token-profile-image-required-wallet-signed)). The new address is in `TimedLaunchCreated(token, creator, pair, quote, launchAt, fee, salt)`, and `timed-create` also returns `predictedToken`. After launch it trades like any launch: `swap --market T`.

Keepers airdrop tokens after launch, so a claim is only needed to get them sooner. If the FLASH/ETH pool cannot take the whole sale, keepers use `launchPartial` and the unsold FLASH goes back to entrants with their tokens.

A launch becomes abortable once entries close if its first buy would be under $10, or 3 days after its time if it still has not launched. Refunds can be sent by anyone, for any entrant.

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

## What a launch pays its creator

Run `launch-earnings --token T --wallet W` (MCP `get_launch_earnings`) after any launch. It lists each item below with its amount.

| Income | Which launches | How it arrives | Action |
| --- | --- | --- | --- |
| Half of the raise, in FLASH | Timed | Paid to the creator at launch | None |
| Curve creator fees, in FLASH | Curve | Claim | `launch-creator-claim --token T`, MCP `build_curve_trade` action `creator_claim`, `curve.claimCreatorFees(recipient)` `0xd6ae6e44` |
| Your tokens from your own buy | Curve, timed | Keeper airdrop, or claim | `launch-claim --token T` works on both. MCP `build_curve_trade` or `build_timed_launch` action `claim` |
| Creator cut of the token's treasury income | All | Keepers pay it to the recipient | None. Change the split or recipient with `treasury-shares --token T --reward-bps N --lp-bps N [--recipient A]`, MCP `build_treasury_shares` |
| QUANT | PERP pairs | Minted to the creator on a sweep | `quant-sweep --token T`, or `sweep(poolId)` on the FlashV3 ledger `0xB6267C0bFcbBEE354723f9f97b255Da287729A07`. Anyone can send it |

## Per-token treasuries (treasury-v3)

Every launch gets a treasury at `treasuryFactory.predictTreasury(token)` (`isTreasury(addr)` once it exists). The FlashV3 hook pays the creator share of swap fees there in-swap. Keepers convert fee tokens through the churn cascade and pay holder rewards in `rewardAsset`. Reads: `treasury.token()`, `quote()`, `controller()`, `mode()`, `rewardAsset()`. Controller-only settings (`setRewardAsset`, `setMode`, `setAgent`) are outside this skill. CLI: `treasury --token T`.

**Creator cut** (`FlashTreasuryShares` `0x98C29eC362A4e76975002778Bb2E91B99e4A288F`, ownerless): a treasury's income has two buckets, and the creator keeps a share of each; the rest goes to holder rewards.

| Bucket | What it is | Creator share |
| --- | --- | --- |
| LP | the FlashV3 hook's creator leg of every swap (the 1% quote fee and the sell tax) | `creatorLpBps` 0-80%, default 80% |
| Rewards | everything else (Lattice sales, churn cascade income, deposits) | `creatorRewardBps` 0-10%, default 5% |

Read `sharesOf(treasury)` -> `(creatorRewardBps, creatorLpBps, recipient, custom)`. Only the treasury's current `controller()` can call `setShares(treasury, creatorRewardBps, creatorLpBps, recipient)` (`0x05b75076`; recipient `0x0` = the controller) or `clearShares(treasury)` (`0xda3d2953`, back to 5% / 80%). The keeper pays the cut to `recipient`.
