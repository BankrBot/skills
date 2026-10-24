# Revenue Share, tokenized stocks and the portfolio

## FLASH Revenue Share

Revenue Share is the protocol's single revenue-share vault: `0x5cf120b13086277f83f901ea4df4fA8A45d577b0`.

- **Deposit:** FLASH, with no lockup and no deposit fee.
- **Earnings:** protocol revenue (WETH quote rewards and FLASH rewards from the buyback and fee routing) plus flash-loan fees (`flashFeeBps()` = 30).
- **Withdraw:** any time, as shares.

Neither the Referral Coin nor FlashV3 has a per-token staking contract: this vault is the only one.

| Call | Selector / returns |
| --- | --- |
| `token()` / `quoteToken()` | FLASH / WETH |
| `totalAssets()`, `totalShares()`, `convertToShares(a)`, `convertToAssets(s)` | vault math |
| `sharesOf(user)`, `principalOf(user)` | position |
| `claimableQuoteRewards(user)`, `claimableRewards(user)`, `claimableTokenRewards(user)` | WETH, FLASH, other token rewards |
| `deposit(uint256 assets, address receiver)` | `0x6e553f65`, after `FLASH.approve(vault, assets)` |
| `withdraw(uint256 shares, address receiver)` | `0x00f714ce` |
| `claimQuoteRewards(receiver)` / `claimRewards(receiver)` / `claimTokenRewards(receiver)` | `0x90ad2fa4` / `0xef5cfb8c` / `0x06aa52f9` |

`PermanentOwnerStake()` is the protocol owner's locked stake. It only affects the owner's wallet.

CLI: `revshare-status [--wallet W]`, `revshare-deposit --amount 100`, `revshare-withdraw [--shares N|all]`, `revshare-claim` (claims every non-zero reward). Earnings history: `GET /v1/tokens/0xD1Be6E31B44C3365Db5BE514ba570ac4fEc63d84/chart` (Revenue Share series).

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
