# Token Wars V6

A Token War is a group launch. Anyone enters a candidate: name, ticker, and **its own pair** (ETH, FLASH, a stock or a perp). Backers put FLASH behind candidates. When total backing reaches the goal, the war locks and the **leader launches** on its own pair. All backers then claim the launched token: the winner's backers by units, the other candidates' backers by cost basis.

| | |
| --- | --- |
| Token War V6 (live, war #1 open) | `0x793D3730040582fc58F3699F51396Dc6cD00dD3f` |
| War router V6 (ETH / USDC in) | `0x470e310f02625DAdaea471579f5ccC66fd606638` |
| Token War V5 (retired, history only) | `0xE3787F2EbB6b5d00B9EE5ECF73ec6C9770Bb5084` |

The older launch routers (`0x7aB1...`) bind the retired war. Use the V6 war router above.

## Read

| Call | Returns |
| --- | --- |
| `currentWarId()` | current war id (0 = none yet) |
| `warState(warId)` | `(phase, pair, candidateCount, winnerId, entryFee, baseGoal, goal, totalPrincipal, winnerToken, poolId, ...)`; phase 0 IDLE, 1 TRADING, 2 READY, 3 LAUNCHED, 4 ABORTED |
| `candidatesPage(warId, offset, limit)` | `(creator, name, symbol, principal, buyVolume, sellVolume, buyCount, sellCount, units, costBasis)[]`; candidate ids are 1-based in page order |
| `candidatePairOf(warId, id)` | `(pair, quote)` |
| `goalNow()` | `(goalUsd, goalFlash, extBps, capFactorBps, flashUsd18, priceState)`: $690 base goal, extends as candidates join |
| `currentEntryFee()` | entry fee in FLASH wei ($0.169) |
| `unitsOf(warId, id, account)` / `costBasisOf(warId, id, account)` | your backing |
| `quoteBuyV5(id, grossFlash)` | `(spent, principal, feeBps, extensionBps, wouldLock)` |
| `quoteUnits(id, grossFlash)` | units minted |
| `quoteSell(account, id, units)` | `(gross, baseOut, quoteOut)`; use `minFlashOut = baseOut x (1 - slippage)` |
| `quoteJump(account, fromId, toId, units)` | `(unitsOut, principalOut, sellFee, buyFee, sellFeeBps, buyFeeBps, wouldLock)`; zeros = it would revert |
| `hasClaimed(warId, account)`, `creatorFeesOf(warId, creator)` | claim state |

API: `GET /v1/stack/wars`, `GET /v1/stack/wars/:warId`.

## Actions

| Action | Call | Selector |
| --- | --- | --- |
| Enter, paying the fee in ETH | `router.submitWithEth((name, symbol), pair, quote, shape, minFlashOut)`, payable. `minFlashOut` = the FLASH entry fee; `value` = an exact-out ETH quote for it + 5%. Leftover FLASH is refunded. | `0x619aca05` |
| Enter, paying the fee in FLASH | `FLASH.approve(war, fee + 5%)`, then `war.registerCandidatePaired((name, symbol), pair, quote, shape)` | `0x019a20c9` |
| Enter, paying with another token | `router.submitWithToken(input, pair, quote, shape, tokenIn, amountIn, minFlashOut)` after `tokenIn.approve(router)` | `0xaf84df24` |
| Back with ETH | `router.backWithEth(candidateId, minFlashOut, minUnits, recipient)`, payable | `0xe82665d7` |
| Back with USDC | `USDC.approve(router, amount)`, then `router.backWithToken(candidateId, USDC, amount, minFlashOut, minUnits, recipient)` | `0xb02ad7dd` |
| Back with FLASH | `FLASH.approve(war, gross)`, then `war.buy(id, gross, minUnits, recipient)` | `0x0bb5eaf3` |
| Cash out (while TRADING) | `war.sell(id, units, minFlashOut, recipient)` | `0xdc234f5a` |
| Jump to another candidate | `war.jump(fromId, toId, units, minUnitsOut)`: atomic sell + buy, both fees, FLASH never leaves | `0x9c6665d0` |
| Lock and launch (permissionless once eligible) | `war.finalize()` | `0x4bb278f3` |
| Claim the launched token | `war.claim(warId, recipient)` -> `(winnerTokens, loserTokens)` | `0xddd5e1b2` |
| Candidate creator fees | `war.claimCreatorFees(warId, recipient)` | `0x90ccadd3` |
| Refund (ABORTED) | `war.refundAborted(warId, id, recipient)` | `0xa3a3b741` |
| Open the next war (after LAUNCHED / ABORTED) | `war.openWar()` | `0x5bd99c7f` |

Rules and gotchas:
- **One entry per wallet per war** (`AlreadyEntered()`).
- STOCK and PERP candidates must use reward 0 (= their quote). The quote rules match [LAUNCHES.md](LAUNCHES.md): live perps 6-11 and 16-24, stocks with a route.
- The war's FLASH backing graduates through the FLASH/ETH pool. ETH, STOCK and PERP winners wait for ETH depth there.
- `minFlashOut` for an ETH or USDC back = simulate the router call with zero minimums from the user's wallet, then subtract slippage. The CLI does this with `eth_simulateV1`.
- Gas is not constant (enter ~2M, ETH back ~1.9M, FLASH back ~1.0M, a locking buy far more). Use `eth_estimateGas`.

CLI:
- `war-status [--wallet W]`
- `war-enter --name "Name" --symbol TKR --pair ETH|FLASH|STOCK|PERP [--quote NVDAc|ETH2xL] [--pay ETH|FLASH] --wallet W`
- `war-back --id 1 --pay ETH|USDC|FLASH --amount 0.01 --wallet W`
- `war-sell --id 1 [--units all]`
- `war-jump --from 1 --to 2 [--units all]`
- `war-claim [--war N]`, `war-refund --war N --id N`, `war-creator-claim [--war N]`, `war-open`, `war-finalize`

Verified 2026-10-24 by simulation on war #1: entries for ETH, STOCK (NVDAc) and PERP (ETH2xL) pairs, backs with ETH, USDC and FLASH, and a sell. `war-claim`, `war-open` and `war-finalize` correctly revert `WrongPhase()` while the war is TRADING.
