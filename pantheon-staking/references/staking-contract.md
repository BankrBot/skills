# Pantheon StakingVault — contract reference (Base)

Vault (proxy): `0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb` — Base mainnet, chain id 8453.
Live implementation behind the proxy: **`0xcBD6E8300676a0a2bdaE2A5f66E3f7F11939b75c`** (24,433
bytes, solc 0.8.28, verified on Basescan). `VERSION()` returns **9** since 2026-10-28. The same
implementation address and bytes are live on Robinhood Chain.

> **Errata, 2026-10-30 (V9).** Previous implementations: V7 `0xe0c448b4…19b2` (to 2026-08-24),
> V8 `0x1a614b8f…1974` (to 2026-10-28). **The verb signatures this skill uses are unchanged across
> V7 → V8 → V9, verified rather than assumed.** All five selectors were recomputed and confirmed
> present in the V9 runtime on both chains, and `stakes()` still returns the same 9-field tuple:
> `stake` `0x946debd5` · `accruedReward` `0x814b57b3` · `claimReward` `0x4953c782` ·
> `pools` `0xa4063dbc` · `stakes` `0xa4e47b66`.
> V9 adds `exitStamp(address,address)` `0x94adf580` (used in the position view) and
> `claimMany(address,address[])` `0x80302060` (max 16 reward tokens; not used by this skill, which
> claims one token per call). The delegated-staking verbs (`stakeOnBehalf` `0x45f54bfd`,
> `addToStakeOnBehalf` `0x9b316ed6`) are now present on both chains.

All signatures below were re-confirmed against the V9 runtime on 2026-10-30 at Base block
53,281,080 and RH block 101,613,531.

## ABI fragments (call these exactly)

```
function stake(address stakingToken, uint16 lockMonths, uint256 amount, bool autoRestakeOptIn)
function accruedReward(address user, address stakingToken, address rewardToken) view returns (uint256)
function claimReward(address stakingToken, address rewardToken)
function pools(address stakingToken) view returns (bool active, uint32 cliffMonths, uint256 totalStaked)
function stakes(address user, address stakingToken) view returns (
    uint256 amount,
    bool    autoRestake,
    uint16  lockMonths,
    uint32  lockDuration,
    uint32  stakeTime,
    uint32  unstakeRequestTime,
    uint32  unstakeTime,
    uint32  stakeMonthIndex,
    bool    compounderEnabled
)
function exitStamp(address user, address stakingToken) view returns (uint256 exitMonth, uint8 kind)   // V9; kind 1 = requested unstake, 2 = emergency exit; (0,0) = not exited this cycle, including any exit requested before V9
```

Selectors, if you need to match them: `stake` `0x946debd5` · `accruedReward` `0x814b57b3` · `claimReward` `0x4953c782` · `pools` `0xa4063dbc` · `stakes` `0xa4e47b66`.

ERC-20 approve first: `approve(0xBf52Aaf8b6C82FaD0220B5378022eA4fC0a98fDb, exactAmount)` on the token contract.

Rules:
- `lockMonths` is always `6` — the contract rejects every other value. `autoRestakeOptIn` is always `false` (skill policy).
- In `stake`, the **amount is the third argument**, after `lockMonths`. Getting this order wrong is the easiest way to send a wrong-sized transaction.
- Amounts are raw units (`human * 10^decimals`, decimals from the registry).
- Before staking, check `pools(token).active == true`; if false, refuse — the vault is not live.

## Reading a position

- `stakes(user, stakingToken)` returns the tuple above. Field `0` is the staked amount; field `7` (`stakeMonthIndex`) is the calendar-month anchor for every date the user cares about. Field `4` (`stakeTime`) is the raw stake timestamp — do **not** compute the lock end from it by adding six months; see `timing-and-fees.md`.
- **V9 exit states.** `amount == 0` with `unstakeTime` set = exited; the wallet may still hold
  claimable rewards for months before the exit — check `accruedReward`. `amount > 0` with
  `unstakeRequestTime` set = in the 7-day cooling-off; earning has already stopped. In both cases
  `exitStamp(user, token)` gives the month earning stopped, for exits made under V9; an exit
  requested before the 2026-10-28 upgrade returns `(0,0)` and has no month to quote. A position with `amount == 0` and
  `exitStamp == (0,0)` is genuinely empty.

## Reward tokens — a pool can have several

`accruedReward` and `claimReward` are **per reward token**. V9 adds `claimMany(stakingToken, rewardTokens[])` for up to 16 tokens per call; this skill keeps claiming one token per call so every transaction stays single-purpose (one Base pool pays 18 tokens, above the batch limit anyway).

**The only valid source is the registry's `reward_tokens` field.** Use it.

### Do NOT use `poolRewardTokens` as the reward-token list

The contract exposes `poolRewardTokens(stakingToken, i)`, and it looks like the natural on-chain enumeration. **It is incomplete by construction and will silently hide live rewards from users.**

That array is only written by the V3-era `fundRewardPool`. Pools funded before V3 have reward tokens that are still accruing and still claimable but were never added, and the V3 migration deliberately did not backfill them. Accrual is read from a different mapping (`rewardPoolBalances`), so a token can pay out forever while being absent from the array.

Measured on Base mainnet, 2026-08-07:

| Pool | `poolRewardTokens` says | Actually also paying |
|---|---|---|
| FADED `0x21F9…3fEB` | 1 token (USDC) | **FADED itself — 19,791,666/mo, 475,000,000 total** |
| BWIL `0xd830…f289` | 5 tokens | **BWIL itself — 11,875,000/mo, 285,000,000 total** |

Re-read 2026-10-30 under V9: BWIL now appears in its own array, and the V9 upgrade registered every
funded pair so `isRewardTokenForPool` now returns `true` for FADED/FADED — but FADED is **still
absent from its `poolRewardTokens` array** (length 4). The rule stands: the array is not a
complete list.

An agent that enumerated the array on the FADED pool would report USDC only and miss the single largest reward stream in that pool.

`isRewardTokenForPool(pool, token)` was backfilled for every funded pair at the V9 upgrade, but it is a registration flag, not a payout list — do not use it to enumerate either.

**If the registry is unreachable:** tell the user you cannot confirm their full reward list right now and send them to https://pantheonvaults.com. A partial list presented as complete is worse than no list. You may still claim a specific reward token if the user names one — `accruedReward` and `claimReward` work correctly for any token, listed or not.

## Revert codes — translate honestly, never guess

| Selector | Error | Tell the user |
|---|---|---|
| `0x2083cd40` | InvalidPool() | This vault isn't active on-chain. Don't retry; check pantheonvaults.com. |
| `0xea2d0505` | NotYetEarning() | Rewards aren't claimable yet — claiming opens at 00:00 UTC on the 1st of the second calendar month after you staked. Give the date. |
| `0x5aa9184d` | NoRewardToClaim() | Nothing to claim for that reward token right now (already claimed, or nothing accrued yet). |
| `0xfb348942` | NoActiveStake() | This wallet has no active stake in that vault. |
| `0xfa499066` | InvalidLockMonths(uint16) | The term must be exactly 6 months. This is a bug in the request — do not retry with a different number. |
| `0x1f2a2005` | ZeroAmount() | The stake amount was zero. |
| `0x7cac15fa` | StakeAlreadyActive() | This wallet already has an active stake in that vault. Pantheon allows one position per wallet per vault; add to it on pantheonvaults.com. |
| `0x3498ce58` | RestakeCooldownNotFinished() | This wallet unstaked from that vault recently and must wait 7 days before staking again. |
| `0xb509bbcf` | CliffNotPassed() | An unstake was requested in the **same calendar month as the stake**. It is not a lock-end check: a normal unstake can be requested from the next month on, with the 10% principal penalty if before lock end. Do not offer emergency exit as a workaround unless the user asks. |
| `0x08c379a0` | Error(string) | **Not a vault error.** Decode the string and relay it. From an older *token* contract this is typically `"Insufficient allowance"` — the approve step was missed or was too small. Re-approve the exact amount. |
| `0xfb8f41b2` | ERC20InsufficientAllowance(address,uint256,uint256) | **Not a vault error.** The same allowance failure from an OpenZeppelin v5 token (most newer Base creator coins). Re-approve the exact amount. |
| `0x13be252b` | InsufficientAllowance() | **Not a vault error.** Older-style allowance failure from the token contract (observed on WOLF). Re-approve the exact amount. |
| `0xd93c0665` | EnforcedPause() | The vault is paused by its operators. Do not retry; check pantheonvaults.com. |
| `0x42cc0c02` | MigrationPausedError() | Staking is temporarily paused during a vault migration. Do not retry; check pantheonvaults.com. |

**Which error you get depends on the call and its check order.** `stake` checks `ZeroAmount`, then `InvalidLockMonths`, then `InvalidPool` (`0x2083cd40`). `claimReward` checks the *position* first, so an unknown pool reverts `NoActiveStake` (`0xfb348942`), not `InvalidPool`. A wallet that exited under V9 skips the claim gates and gets `NoRewardToClaim` once its pre-exit months are claimed. Don't read `NoActiveStake` from a claim as proof the vault is fine.

Every row above was observed live on Base via `eth_call` on 2026-11-02 except `RestakeCooldownNotFinished`, `EnforcedPause` and `MigrationPausedError`, which are confirmed from the V9 source, and `Error(string)`, which was observed on Robinhood Chain (34 of 35 Base registry tokens returned `0xfb8f41b2`; WOLF returned `0x13be252b`).

Any other revert: report the raw selector and link the user to pantheonvaults.com support. Do not improvise an explanation.
