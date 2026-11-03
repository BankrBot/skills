# Token Wars V6

A Token War is a group launch. Anyone enters a candidate: name, ticker, and **its own pair** (ETH, FLASH, a stock or a perp). Backers put FLASH behind candidates. When total backing reaches the goal, the war locks and the **leader launches** on its own pair. All backers then claim the launched token: the winner's backers by units, the other candidates' backers by cost basis.

| | |
| --- | --- |
| Token War V6 (the only live war) | `0x793D3730040582fc58F3699F51396Dc6cD00dD3f` |
| War router V6 (ETH / USDC in) | `0x470e310f02625DAdaea471579f5ccC66fd606638` |

Back and enter only through these two contracts. Launch routers do not back V6 candidates.

**Token art is required.** Before `war-enter`, save the candidate's signed profile (image required) as in [LAUNCHES.md](LAUNCHES.md#token-profile-image-required-wallet-signed) with `action: "war"`. The on-chain entry carries no metadata: the profile attaches to the candidate by (creator, name, ticker).

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

## Goal, extensions and payouts

- **Goal:** $690 base, re-derived in FLASH at the live price on every touch, capped at 10x (`capFactorBps` 100000, a $69,000 market cap).
- **Extensions** (`config.extensionParams()`): +1% per entrant after the first; +5% on a tie at the barrier; +10% per leader flip once 10% or less of the goal remains, escalating +50% per repeat; buys of 10% of the goal or more extend up to +25%.
- **Decay:** 2 h grace, then a 12 h half-life, floor at the base goal.
- **Lock:** needs principal at or above the barrier, no exact tie, a clear 600 s settle timer and an OK price path.
- **Names and tickers** are unique per war, case-insensitive.
- **Creator fees:** every candidate's creator earns fees on its own market. The winner's creator is pushed at finalize, the others in airdrop batches; `claimCreatorFees` collects early.
- **Finalize** requires READY and at least 70% of the locked USD goal realised.
- **Claims** pay 1% in tokens. If the losers' launch-block buy failed (`loserPoolIsQuote(warId)`), losers are paid in the war's quote with no claim fee (`warQuote(warId)`).
- **Airdrop and poke:** `airdrop(warId, from, count)` `0x8c195122` (max 400, skips under $1) and `poke(warId)` `0x32145f90` are permissionless. CLI: `war-airdrop [--war N --from N --count N]`, `war-poke [--war N]`. MCP: `build_war_action` actions `airdrop` and `poke`.
- **Open:** `openWar` is price-gated (`TooVolatile`). While IDLE only the owner or a config keeper can open; anyone can after a war LAUNCHED or ABORTED.
- **Abort:** the Safe at any time, a keeper after READY + 1 day. Refunds pay in kind with no fee.

## Actions

| Action | Call | Selector |
| --- | --- | --- |
| Enter, paying the fee in ETH | `router.submitWithEth((name, symbol), pair, quote, shape, minFlashOut)`, payable. `minFlashOut` = the FLASH entry fee; `value` = an exact-out ETH quote for it + 5%. Leftover FLASH is refunded. | `0x619aca05` |
| Enter, paying the fee in FLASH | `FLASH.approve(war, fee + 5%)`, then `war.registerCandidatePaired((name, symbol), pair, quote, shape)` | `0x019a20c9` |
| Enter, paying with USDC or FLASH through the router | `router.submitWithToken(input, pair, quote, shape, tokenIn, amountIn, minFlashOut)` after `tokenIn.approve(router)` | `0xaf84df24` |
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
- STOCK and PERP candidates must use reward 0 (= their quote). The quote rules match [LAUNCHES.md](LAUNCHES.md): live perps 0-14, stocks with a route.
- The war's FLASH backing graduates through the FLASH/ETH pool. ETH, STOCK and PERP winners wait for ETH depth there.
- `minFlashOut` for an ETH or USDC back = simulate the router call with zero minimums from the user's wallet, then subtract slippage. The CLI does this with `eth_simulateV1`.
- Gas is not constant (enter ~2M, ETH back ~1.9M, FLASH back ~1.0M, a locking buy far more). Use `eth_estimateGas`.

CLI:
- `war-status [--wallet W]`
- `war-enter --name "Name" --symbol TKR --pair ETH|FLASH|STOCK|PERP [--quote NVDAc|ETH2xL] [--mode deep|medium|degen --preset soft|long-term|fast-burn --reward 0x] [--pay ETH|FLASH] --wallet W`
- `war-back --id 1 --pay ETH|USDC|FLASH --amount 0.01 --wallet W`
- `war-sell --id 1 [--units all]`
- `war-jump --from 1 --to 2 [--units all]`
- `war-claim [--war N]`, `war-refund --war N --id N`, `war-creator-claim [--war N]`, `war-open`, `war-finalize`

Verified 2026-10-24 by simulation on war #1: entries for ETH, STOCK (NVDAc) and PERP (ETH2xL) pairs, backs with ETH, USDC and FLASH, and a sell. `war-claim`, `war-open` and `war-finalize` correctly revert `WrongPhase()` while the war is TRADING.
