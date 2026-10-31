# Read API: `https://api.tryflash.app`

Public, read-only, GET, JSON, no key. `/v1/stack/*` is an alias of `/v1/ecosystem/*`. Snapshots refresh about once a minute (stack.live is event-driven), so cache them. On HTTP 429 wait for `Retry-After`. Do not send a browser `Origin` header other than `https://tryflash.app`. Amount fields ending in `Wei` or `Raw`, and bare integer strings, are base units. `*Float`, `*Eth` and `*Usd` fields are human numbers. The API is a convenience: the chain is the source of truth before any write.

There are **no** quote or transaction-building endpoints for the live stack. Quote with the V4 Quoter and build calldata with `scripts/flash.mjs`. The `/v1/launch-v2/*` reads, `/v1/bonding/*`, `/v1/perps*` and the `/mcp` build tools serve the retired stack: do not use them to trade. The exceptions are the two token-profile writes below, which every launch-v5 launch and war entry needs.

| Route | Returns |
| --- | --- |
| `/v1/stack` | Overview: chainId, every contract address, prices, volume, counts, fee totals |
| `/v1/stack/live` | `flash` (sqrtPriceX96, tick, KOTH game, nextTrigger, top100, referral totals, codeThreshold), `perps[]` (nav, capacityUsdc, supply, targetLev, maxLev, change24hPct), `quant` |
| `/v1/stack/tokens` (`?all=1`) | Every stack token: price (USD and quote), quote token, 24h change and volume, pool ids, kind (flash, quant, perp, launch) |
| `/v1/stack/markets` (`?all=1` adds exit-only markets) | Perp markets: id, status, symbol, token, poolId, vault, navUsdc, buyCapacityUsdc, minIssueUsdc, gasFloor, change, volume |
| `/v1/stack/perps` | Perp markets with full detail (live only unless `?all=1`) |
| `/v1/stack/perps/:id/nav` | NAV history points and 24h change |
| `/v1/stack/perps/positions/:account` | Perps ledger: positions (qty, avgCost, costUsd, nav, unrealizedUsd, realizedUsd) and trades |
| `/v1/stack/perps/orders` | TP / SL config: `contract`, `feePips` (1000 = 0.1%), `live` |
| `/v1/stack/perps/orders/:account` (`?status=open\|filled\|cancelled`) | A wallet's TP / SL orders, newest first (id, marketId, kind, qty, triggerNav, minOut, expiry, sibling, status, expired, fill) |
| `/v1/stack/perps/orderbook/:marketId` | Open, unexpired TP / SL depth by trigger |
| `/v1/stack/quant` | QUANT supply, issuer mints, price (USD and FLASH), market cap, volume, mint stats |
| `/v1/stack/koth` | Game (`secondsLeft`, `expired`, pot, trigger, ETH and USD), totals, owed, wins, history |
| `/v1/stack/koth/history?limit=30` | Reigns and round results (limit up to 500) |
| `/v1/stack/referral/board` | Top-100 board (rank, account, score, ens) and pool stats |
| `/v1/stack/referral/:account` | code, referrer, referees, sortedRank, earned and claimable (ETH and FLASH), recent |
| `/v1/stack/referrals/top?limit=100`, `/v1/stack/referrals/:account` | Referral leaderboard and account detail |
| `/v1/stack/launches`, `/v1/stack/launches/:token` | launch-v5 launches, creation fee (FLASH), KPIs |
| `/v1/stack/wars`, `/v1/stack/wars/:warId` | Token War state: phase, goal, progress, entry fee, candidates, participants, KPIs |
| `/v1/stack/churn/markets` | Churn markets: token, quote, fillBps, sellerFeeBps, levels, Lattices |
| `/v1/stack/churn/lattices?market=<id>` | Lattices (all, or one market) |
| `/v1/stack/churn/:account` | A wallet's full range, levels, positions and Lattices per market |
| `/v1/stack/v3/pools` | FlashV3 pools: poolId, token, kind, quote, creator, marketId, tickSpacing, fee, price |
| `/v1/stack/pools` (`?venue=rc\|v3\|perps\|curve`), `/v1/stack/pools/:id`, `/v1/stack/pools/:id/trades?limit=100` | Pool rows with 24h stats, and recent trades |
| `/v1/stack/volume` | 24h volume per venue and pool |
| `/v1/stack/tokens/:token/chart?venue=rc\|v3\|perps&range=` | Price chart (also `/v1/tokens/:token/chart?venue=`) |
| `/v1/stack/buyback` | FLASH buyback runs, FLASH out, pending per asset |
| `/v1/wallet/:account/balances` (`?fresh=1`) | Wallet portfolio: ETH, ERC-20s and stack tokens with quantities |
| `/v1/tokens/prices` | USD prices (FLASH, ...) |
| `/v1/markets/stocks?symbols=AAPL,NVDA` | Stock quotes and US session state |
| `/v1/stack/presence` | Live user presence |

Known data caveats, as of 2026-10-24:

- `/v1/stack/quant` `mints.lossUsdFloat` is divided by 1e18, but `lossUsd` is USDC with 6 decimals.
- `/v1/stack/v3/pools` reports the QUANT pool creator as the treasury `0xD1EC...`. On chain, `v3Hook.poolInfoOf(poolId).creator` is now the QUANT treasury `0x6A7f...55E5`. Trust the chain.

Writes (token profiles only; see [LAUNCHES.md](LAUNCHES.md#token-profile-image-required-wallet-signed)):

| Route | Does |
| --- | --- |
| `POST /v1/uploads` (multipart `image`, header `x-flash-uploader`) | Moderates and stores token art; returns `{ imageUrl }` |
| `POST /v1/launch-v2/prepare` (JSON, header `x-flash-uploader`) | Saves a wallet-signed launch / war profile. Requires `imageUrl` (`TOKEN_IMAGE_REQUIRED`) and `profileAuth { nonce, issuedAt, signature }` (401 `TOKEN_PROFILE_SIGNATURE_REQUIRED`) |

Live pushes: the websocket `wss://api.tryflash.app/v1/live` sends `stack.live` (the `/v1/stack/live` snapshot) and `perp.order.created|updated|filled|cancelled` (one order record each).

CLI passthrough: `node scripts/flash.mjs api /v1/stack/live`.
