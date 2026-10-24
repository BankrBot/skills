# Limit orders, limit-order curves and Lattices (the churn)

The churn (`0x35F1b89f4FEb2897CC1a6efF381d518D05824008`) is Flash's on-chain OTC book. Tokens deposited there sell **inside other people's buys** on the Flash hook pools, in the same swap, so sellers never dump into the pool. The quote includes these fills.

| Product | What it is | Fills |
| --- | --- | --- |
| **Level** (limit order, "bin") | Tokens with a **floor price**. They sell only at or above the floor, lowest floor first, as a buy pushes the price across it. No upper bound. | In-swap, at the floor or better. The depositor keeps 69% of any surplus above the floor; 31% goes to the protocol. Proceeds wait in the position: claim them. |
| **Curve order** | Many levels in one `depositLevels` call: a limit-order curve. | Each level as above. |
| **Full range** | No floor: sells at any price, up to the market's fill cap. | Pro-rata with levels. No surplus fee. Claim the proceeds. |
| **Lattice** | A bounded limit-order **curve record**: `count` segments of bins `widthTicks` wide from `startTick` upward, released lowest bin first. | In-swap. Proceeds are **pushed to the owner inside each fill** (no claim). Opening one is restricted (see below). |

Markets the app trades (token / quote, both 18 decimals):

| Market | id | Token tick |
| --- | --- | --- |
| FLASH/ETH (quote = WETH; proceeds paid in WETH) | `0x4b39bd7aad60303a9b91876aee70156afd01ab01a569ea973d3105df78756a7b` | `-rcHook.poolState().tick` (FLASH is currency1) |
| QUANT/FLASH | `0xe4f1a55cd9ae77c991cb80e5d1ddb27e36e6371a8717feca8d0998724fc58292` | `v3Hook.poolState(QUANT key).tick` (QUANT is currency0) |

**Prices and ticks:** price (quote per token) = `1.0001^tick` in the **token orientation** above. A level floor is a token-orientation tick snapped **up** to the market's `levelConfig(id).stepTicks` (100 today): `floorTick = ceil(ln(price) / ln(1.0001) / step) * step`. The churn snaps the same way. Example: FLASH at 0.0006 ETH is tick ≈ -74,180. A floor of 0.01 ETH per FLASH is tick -46,000.

## Reads

| Call | Returns |
| --- | --- |
| `levelConfig(id)` | `(stepTicks, configured, minDeposit)`: levels are open when `configured` |
| `marketConfig(id)` | `(token, quote, creator, treasury, upstream, fillBps, sellerFeeBps)` |
| `marketAccounting(id)` | `(epoch, inventory, shares, grossQuoteFilled, sellerFees, rewardsDistributed, rewardsPaid, epochClosures)` |
| `levels(id, fromTick, max)` | `int24[]` open level ticks (use `fromTick = -887272`) |
| `levelPosition(id, level, user)` | `(epoch, shares, debt, claimable, tokenOwed)` |
| `previewLevelTokens(id, level, user)` | unsold tokens a `withdrawLevel` returns |
| `previewLevelClaim(id, level, user)` | quote claimable on that level |
| `positions(id, user, 0)` / `previewClaim(id, user, 0)` | full-range position / claimable (class 0 = Public) |
| `latticesOf(id)` | `(positionId, next, soldInNext, startTick, widthTicks, bins)[]` |
| `latticeOf(positionId)` | `(owner, marketId, params, state, unreleased, bins)` |

API: `GET /v1/stack/churn/markets`, `GET /v1/stack/churn/lattices?market=<id>`, `GET /v1/stack/churn/:account` (a wallet's orders).

## Writes (approve the **churn** for the token first: `token.approve(churn, total)`)

| Action | Call | Selector |
| --- | --- | --- |
| One limit order | `depositLevel(bytes32 id, int24 floorTick, uint256 amount, address beneficiary)` -> `(level, shares)` | `0xd41a2912` |
| Curve order (any user) | `depositLevels(bytes32 id, int24[] floorTicks, uint256[] amounts, address beneficiary)` -> `uint256[] shares` | `0x8c0041ae` |
| Cancel (unsold tokens back) | `withdrawLevel(bytes32 id, int24 level, uint256 shares, address receiver)` | `0xaec18bd0` |
| Claim level proceeds | `claimLevels(bytes32 id, int24[] levels, address receiver)` | `0x9bdf33ff` |
| Full-range deposit | `deposit(bytes32 id, uint256 amount, address beneficiary)` | `0x6ebf181b` |
| Full-range withdraw | `withdraw(bytes32 id, uint256 shares, address receiver)` | `0x3adab09c` |
| Full-range claim | `claim(bytes32 id, address receiver)` | `0x96c144f0` |

- `claim` and `claimLevels` revert `InvalidMarket()` when there is nothing to claim. Check the preview first.
- Keep curve orders at or below 48 levels: one `depositLevels` stays a modest transaction, and an 8-level curve measured ~725k gas.
- A floor at or below the current price fills on the next buy at market or better. Warn the user.
- Gas is not constant here. Use `eth_estimateGas`; the CLI pads it by 1.2x.

CLI:
- `limit-markets`
- `limit-orders --wallet W`
- `limit-place --market FLASH --amount 100 --price 0.002 --wallet W`: one level.
- `limit-place --market FLASH --amount 100 --low-mult 2 --high-mult 20 --bins 16 --shape exp --wallet W`: a curve from 2x to 20x the current price. `--shape` is `flat`, `front` (more near the low end), `back` or `exp` (geometric toward the top, the app default). Use `--low P --high P` for absolute prices.
- `limit-cancel --market FLASH --level -46000 --wallet W`
- `limit-claim --market FLASH --wallet W`
- `fullrange-deposit|fullrange-withdraw|fullrange-claim --market QUANT ...`

## Lattices

`openLattice(bytes32 id, (int24 startTick, uint24 widthTicks, uint8 count, uint128 total, (uint16 bins, int24 exponentTicks, uint32 sharePpm)[8] segments) p, address owner)` (selector `0x94324107`) is **restricted**. Only these callers may open one: churn operators, approved openers (`isLatticeOpener`, e.g. the launch-v5 executor that opens each launch's Lattice), the churn owner, and the market's `creator` / `treasury`. A normal wallet gets `NotOperator()`. It should place a **curve order** with `depositLevels` instead: same idea, any user.

The Lattice **owner** can manage an existing one:

| Call | Selector | Effect |
| --- | --- | --- |
| `withdrawLattice(positionId, to)` | `0xc5a44ee0` | Close; every unreleased token back |
| `withdrawLatticeAmount(positionId, amount, to)` | `0x3b82423d` | Partial; the record rescales with the same shape and cursor |
| `reformatLattice(positionId, p)` | `0x20493fae` | Close and reopen in the same position with new params; the difference is pulled or paid out. Used `segments[].sharePpm` must sum to 1,000,000. |
| `transferLattice(positionId, to)` | `0x5d10ff4b` | New owner |

CLI: `lattice-list --market FLASH|QUANT`, `lattice-show --id N`, `lattice-withdraw --id N [--amount X]`, `lattice-transfer --id N --to 0x`, `lattice-reformat --id N --params '<json>'`, `lattice-open --market M --params '<json>'` (creators and treasuries only).

Live today: Safe-owned FLASH Lattices #5 (10,500 FLASH from the FLASH spot price up) and #6 (9,000 FLASH from ~$300k to $1M FLASH market cap), plus the QUANT treasury's Lattice #1 on QUANT/FLASH. Their proceeds go to the treasury inside each fill.

## The cascade (why fills convert, not dump)

Protocol and creator proceeds in sub-token markets (e.g. QUANT/FLASH) route **upstream**: the FLASH they earn is deposited full-range into the FLASH/WETH market and converts to ETH as people buy FLASH. A token's fee income therefore climbs token -> FLASH -> ETH inside organic buys, with no keeper and no market sell. Creator and treasury churn positions auto-sweep into their treasuries. A user's own limit orders are separate: their proceeds sit in the position until claimed (levels, full range), or are pushed to the owner (Lattices).
