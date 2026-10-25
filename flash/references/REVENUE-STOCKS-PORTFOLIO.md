# Revenue Share, tokenized stocks and the portfolio

## FLASH Revenue Share

Revenue Share is `FlashRevenueShareV2`, an ERC-1967 proxy at `0x7c36Ac8bec2D206984702790dB158fcAAFe69490` (owned by the Safe). Deposit FLASH, earn ETH.

- **Deposit:** FLASH, minimum 0.01 (`MIN_DEPOSIT()`), no lockup, no fee. All deposited FLASH sits in **one full-range churn position** (churn core, FLASH/ETH market `0x4b39bd7aad60303a9b91876aee70156afd01ab01a569ea973d3105df78756a7b`) that sells FLASH into ETH as buys fill it.
- **Earnings:** that ETH, pro rata to shares. Protocol revenue (FLASH buyback, King of the Hill, launch-v5 vault, treasury-v3) adds FLASH to the same position through `addAssetReward`, which is a protocol entry, not a user call.
- **Claim:** pays the earned ETH and keeps the deposit earning.
- **Withdraw:** pays all earned ETH and burns shares. **The unsold FLASH is not returned**: it stays in the position for the remaining depositors. Say so before every withdraw.
- ETH is paid as native ETH, or WETH when the receiver rejects ETH. When the position fully converts, an epoch closes: old shares keep their ETH and stop earning, and the next deposit starts at 1:1.

| Call | Selector / returns |
| --- | --- |
| `deposit(uint256 amount)` | `0xb6b55f25`, after `FLASH.approve(v2, amount)` (exact). Reverts `BelowMinimum()` under 0.01 FLASH |
| `claim(address to)` | `0x1e83409a`, returns ETH paid (0 when nothing is owed) |
| `withdraw(uint256 shares, address to)` | `0x00f714ce`, `type(uint256).max` = all. Reverts `NothingToWithdraw()` with no shares and no ETH owed |
| `pendingEth(user)` | `0xbeae30f5`, earned unpaid ETH, including fills not yet harvested |
| `flashOf(user)` | `0x4b57af1b`, the user's FLASH still unsold (what a withdraw forfeits) |
| `accountOf(user)` | `0x8086b8ba`, `(shares, debt, owed, epoch)` |
| `previewDeposit(amount)` | `0xef8b30f7`, shares a deposit mints now |
| `totals()` | `0xc038a38e`, `(flashInPool, flashInChurn, totalShares, ethDistributed, ethPaid, flashRewarded, epoch, positionId)` |

**Retired vault.** The old `FlashPoolStaking` `0x5cf120b13086277f83f901ea4df4fA8A45d577b0` gets no new revenue and is withdraw-only for its remaining holders: `withdraw(uint256 shares, address receiver)` `0x00f714ce` (returns the FLASH principal plus FLASH rewards), `claimQuoteRewards(receiver)` `0x90ad2fa4`, `claimRewards(receiver)` `0xef5cfb8c`, `claimTokenRewards(receiver)` `0x06aa52f9`; reads `sharesOf`, `convertToAssets`, `claimableQuoteRewards`, `claimableRewards`, `claimableTokenRewards`. Migrate = claim WETH and token rewards, withdraw every share, exact-approve the FLASH to V2, deposit. Never deposit into the old vault.

CLI: `revshare-status [--wallet W]` (V2 position, pending ETH, unsold FLASH, totals, any retired-vault position), `revshare-deposit --amount N|all`, `revshare-claim`, `revshare-withdraw [--shares N|all]` (states the forfeited FLASH), `revshare-migrate [--exit-only]` (retired vault to V2). API: `GET /v1/stack/revenue-share?range=7d&limit=50&account=0x..` returns `totals`, `depositors`, `lifetime`, `kpis` (`apr7d`, `apr30d`, `earned7dUsd`...), `points` (chart), `recent` (activity) and, with `account`, that wallet's deposits, claims and forfeited FLASH. `GET /v1/stack/live` carries the same `totals` as `revenueShare`.

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
