# Revenue Share, tokenized stocks and the portfolio

## FLASH Revenue Share

Revenue Share is `FlashRevenueShareV3` (`version()` = `"3"`), an ERC-1967 proxy at `0x7c36Ac8bec2D206984702790dB158fcAAFe69490` (implementation `0x7Ba4b0d63fc449D130F7259C231A7204ddcC7820`, owned by the Safe). Stake FLASH, earn ETH.

- **Stake:** `deposit` stakes FLASH 1:1, minimum 0.01 (`MIN_DEPOSIT()`), no lockup, no fee. Staked FLASH stays in the contract, never in the churn. It is the flash-loan liquidity keepers borrow.
- **Revenue:** protocol FLASH (`addAssetReward` from the buyback, King of the Hill, launch-v5 vault and treasury-v3; a protocol entry, not a user call) plus flash-loan fees. `flush()` (anyone) moves that revenue FLASH into **one full-range churn position** (churn core, FLASH/ETH market `0x4b39bd7aad60303a9b91876aee70156afd01ab01a569ea973d3105df78756a7b`) that sells it into ETH as buys fill it.
- **Earnings:** the ETH those fills pay, pro rata to stake, paid as native ETH (WETH when the receiver rejects ETH). `harvest()` (anyone) books fills; `pendingEth` already counts unharvested fills.
- **Claim:** pays the earned ETH, keeps the stake earning.
- **Withdraw:** returns the staked FLASH (any amount, any time) plus all earned ETH. Nothing is forfeited, and withdrawing never takes FLASH out of the churn.

| Call | Selector / returns |
| --- | --- |
| `deposit(uint256 amount)` | `0xb6b55f25`, after an exact `FLASH.approve(revshare, amount)`; returns FLASH staked. Reverts `BelowMinimum()` under 0.01 FLASH |
| `claim(address to)` | `0x1e83409a`, returns ETH paid (0 when nothing is owed) |
| `withdraw(uint256 amount, address to)` | `0x00f714ce`, `type(uint256).max` = all; sends the FLASH and all earned ETH to `to`. Reverts `NothingToWithdraw()` with no stake and no ETH owed |
| `pendingEth(user)` | `0xbeae30f5`, earned unpaid ETH, including fills not yet harvested |
| `flashOf(user)` | `0x4b57af1b`, the user's staked FLASH (what a full withdraw returns) |
| `accountOf(user)` | `0x8086b8ba`, `(shares, debt, owed, epoch)`; `shares` = staked FLASH |
| `totals()` | `0xc038a38e`, `(flashInPool, flashInChurn, totalShares, ethDistributed, ethPaid, flashRewarded, epoch, positionId)`: `flashInPool` = `totalShares` = total staked, `flashInChurn` = revenue FLASH still unsold, `flashRewarded` = lifetime revenue FLASH |
| `revenue()` | `0x3e9491a2`, `(idle, flashFees, flashChurned)`: revenue FLASH waiting for `flush`, lifetime flash-loan fees, lifetime FLASH churned |
| `flush()` / `harvest()` | `0x6b9f96ea` / `0x4641257d`, anyone. `flush` reverts `NothingToFlush()` with no idle revenue |

### Flash loans (keepers)

The staked FLASH is lendable in one transaction, with the same API, callback and 30 bps fee as the old `FlashPoolStaking`, so existing borrowers point at the new address unchanged.

1. The keeper contract implements `onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes data) returns (bytes32)` (`0x23e30c8b`).
2. It calls `flashLoan(address receiver, uint256 amount, bytes data)` (`0xe0232b42`). The contract sends `amount` FLASH to `receiver`, then calls `receiver.onFlashLoan(msg.sender, FLASH, amount, fee, data)`.
3. The callback does its work, approves the Revenue Share proxy for `amount + fee` FLASH, and returns `keccak256("IFlashBorrower.onFlashLoan")` = `0xf51a74cb268a8f727edf953ddacc8f280294844b89df00cd2e0ae537e4b981d3` (`CALLBACK_SUCCESS()`).
4. The contract pulls `amount + fee`. The fee is revenue: it is flushed into the churn and paid to stakers as ETH.

Views: `flashFee(amount)` `0xa7af467a` = `ceil(amount * 30 / 10000)`, `maxFlashLoan(FLASH)` `0x613255ab` and `availableLiquidity()` `0x74375359` = FLASH held (stake plus idle revenue). Reverts: `InsufficientLiquidity()` (zero or above the balance), `BadCallback()` (wrong return value), `NotRepaid()` (balance short after the pull).

**Retired vault.** The old `FlashPoolStaking` `0x5cf120b13086277f83f901ea4df4fA8A45d577b0` gets no new revenue and is withdraw-only for its remaining holders: `withdraw(uint256 shares, address receiver)` `0x00f714ce` (returns the FLASH principal plus FLASH rewards), `claimQuoteRewards(receiver)` `0x90ad2fa4`, `claimRewards(receiver)` `0xef5cfb8c`, `claimTokenRewards(receiver)` `0x06aa52f9`; reads `sharesOf`, `convertToAssets`, `claimableQuoteRewards`, `claimableRewards`, `claimableTokenRewards`. Migrate = claim WETH and token rewards, withdraw every share, exact-approve the FLASH to Revenue Share, deposit. Never deposit into the old vault.

CLI: `revshare-status [--wallet W]` (staked FLASH, pending ETH, totals, revenue, flash-loan liquidity, any retired-vault position), `revshare-deposit --amount N|all`, `revshare-claim`, `revshare-withdraw [--amount N|all]` (reports `flashReturned` and `ethPaid`), `revshare-migrate [--exit-only]` (retired vault to Revenue Share). API: `GET /v1/stack/revenue-share?range=7d&limit=50&account=0x..` returns `totals`, `depositors`, `lifetime`, `kpis` (`apr7d`, `apr30d`, `earned7dUsd`...), `points` (chart), `recent` (activity) and, with `account`, that wallet's deposits, claims and withdrawals. `GET /v1/stack/live` carries the same `totals` as `revenueShare`.

## Tokenized stocks

Tokenized stocks are third-party tokens (B20, 18 decimals) that Flash uses as **STOCK-pair launch quotes**, **reward assets** and the underlyings of the 24/7 stock perps. Flash does not sell the stocks themselves. A user who wants stock exposure on Flash buys a stock perp (META2xL, AAPL2xL, GOOGL2xL, SPCX2xL, NVDA2xL) or launches a STOCK-paired token.

| Symbol | Name | Address |
| --- | --- | --- |
| NVDAc | Nvidia | `0xb20000000000000000000078ee7ce2fE4908108C` |
| METAc | Meta | `0xb2000000000000000000008bC8786B856E61707C` |
| AAPLc | Apple | `0xb200000000000000000000C2e324d24d7eEcd1fb` |
| GOOGLc | Alphabet | `0xb2000000000000000000002D0BA3164cc74f58B7` |
| AMZNc | Amazon | `0xb200000000000000000000d9192b6B456483C2E8` |
| MSFTc | Microsoft | `0xB200000000000000000000Ab99cFa739E253872B` |
| MSTRc | Strategy | `0xb2000000000000000000004884b426556b92883d` |
| SNDKc | Sandisk | `0xb200000000000000000000397293Cb8cda9a10c5` |
| SPCXc | SpaceX | `0xb2000000000000000000007b9fcbd005511aCBd5` |
| TSLAc | Tesla | `0xb2000000000000000000001e800a7f5189430cD0` |
| MUc | Micron | `0xb200000000000000000000Fd2f87532B90095211` |
| PLTRc | Palantir | `0xb2000000000000000000007d16372840dF4dAbbe` |

A stock can graduate a STOCK-pair launch only when `launchConfig.quoteRouteOf(stock).pool != 0x0`. Prices and the US session: `GET /v1/markets/stocks?symbols=NVDA,AAPL` (regular, extended and overnight), logos at `/v1/markets/stocks/:ticker/logo`.

## Portfolio

- `GET /v1/wallet/:account/balances` returns the wallet's ETH, FLASH, WETH, perp tokens, QUANT, stocks and launched tokens with quantities. Add `?fresh=1` to bypass the cache.
- `GET /v1/stack/perps/positions/:account` returns perps cost basis, unrealized and realized PnL, and trades.
- `GET /v1/stack/referral/:account` returns the referral code, referrer, earnings and claimable amounts.
- `GET /v1/stack/churn/:account` returns limit orders, full range and Lattices per market.
- On-chain fallbacks are in the CLI. `portfolio --wallet W` combines everything above, plus Revenue Share.
