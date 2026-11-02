# RevenueShare Contract Reference

Single-pool, single-reward staking for KIBBLE on Base. Deployed as a UUPS proxy (upgradeable) — always call the proxy address. `LOCK_PERIOD()` is 14 days (1,209,600 seconds).

Player-facing overview: https://docs.cat.town/economy/staking.

## Addresses

| Chain             | Chain ID | RevenueShare                                   | KIBBLE (ERC-20, 18 decimals)                   |
|-------------------|----------|------------------------------------------------|------------------------------------------------|
| Base mainnet      | 8453     | `0x9e1Ced3b5130EBfff428eE0Ff471e4Df5383C0a1`   | `0x64cc19A52f4D631eF5BE07947CABA14aE00c52Eb`   |
| Base Sepolia      | 84532    | `0x04ef20ca98d65d4c659a805daa57e0ff4b44f46f`   | `0x7C1059Bdcf44BC2BC1452c67e6A50cE1AB69C49C`   |

Legacy (deprecated) staking contract on Base: `0xc3398Ae89bAE27620Ad4A9216165c80EE654eE96` — do not route new stakes there.

## Reward accounting model

Masterchef-style single pool. Internally everything is **wei**; only the convenience getters and the `stake`/`unstake` arguments use whole KIBBLE.

```
pendingWei(user) = userStaked(user) * accRewardPerShare / 1e12 - rewardDebt(user)   // 0 while unlocking
```

- `accRewardPerShare` is scaled by **1e12** (not 1e18). Each `depositRevenue(amount, source)` call (amount in whole KIBBLE) does:
  ```
  accRewardPerShare += (amount * 1e18) * 1e12 / totalActiveStaked   // totalActiveStaked in wei
  ```
- `rewardDebt(user)` is in wei: `userStaked(user) * accRewardPerShare / 1e12`, re-snapshotted on `stake`, `claim`, `claimAndRestake`, `relock`, `unstake`, and on `unlock` when rewards were pending.
- Users in an `unlock()` window are subtracted from `totalActiveStaked`, so they neither earn nor dilute active stakers.
- The `pendingRewards(user)` view returns `pendingWei / 1e18`, **floored**. Anything under 1 KIBBLE reads as `0` even though `claim()` will pay it. For an exact figure, compute `pendingWei` from the raw reads above.
- The change in `accRewardPerShare` between two blocks, divided by `1e12`, is the KIBBLE earned per staked KIBBLE over that span — a staker-independent way to compute yield.

## Write functions

**Unit convention (important and non-obvious):** `stake(uint256)` and `unstake(uint256)` take `amount` in **whole KIBBLE units** (no decimals), not wei. The contract multiplies by `10^18` internally before calling `transferFrom` on the KIBBLE token. To stake 100 KIBBLE, call `stake(100)`. If you pass `100 * 10^18`, the internal multiplication produces `100 * 10^36`, which exceeds any balance and reverts `ERC20: transfer amount exceeds balance`.

The `approve()` call on the KIBBLE token is a separate, standard ERC-20 call and **is** wei-denominated: to allow staking 100 KIBBLE, approve `100 * 10^18 = 100000000000000000000`.

The address that submits a write must be the same address that (a) holds the KIBBLE balance and (b) granted the allowance. If a smart wallet executes the tx, the balance must sit on the smart wallet — not on an attached EOA.

### `stake(uint256 amount)`

`amount` is in **whole KIBBLE units** (not wei). The contract scales it by `10^18` and pulls `amount * 10^18` wei from `msg.sender` via `transferFrom` on the KIBBLE token (requires prior ERC-20 approval of at least that many wei). Emits `Staked(indexed address user, uint256 amount)`.

Side effects, in order:
1. Pays any pending rewards (full wei amount) to `msg.sender` first.
2. **If the caller is unlocking, the unlock is cancelled**: `isUnlocking = false`, `unlockStartTime = unlockEndTime = 0`, and the whole stake returns to earning. This happens even if the 14-day wait has already finished. Leaving again needs a new `unlock()` and a fresh 14 days. Warn users before topping up during an unlock.

Reverts if:
- `amount == 0` → `Cannot stake 0`
- Allowance on KIBBLE < `amount * 10^18` → `ERC20: transfer amount exceeds allowance`
- Balance on KIBBLE < `amount * 10^18` → `ERC20: transfer amount exceeds balance` (most common cause: caller wei-encoded the argument)

### `unstake(uint256 amount)`

`amount` is in **whole KIBBLE units** (not wei). The contract transfers `amount * 10^18` wei of KIBBLE back to `msg.sender`. Emits `Unstaked(indexed address user, uint256 amount)`. Partial withdrawals are allowed; the remainder stays unlocking (not earning) and can be withdrawn later without a new wait.

Reverts if:
- `isUnlocking[user] == false` → `Must call unlock() first`
- `block.timestamp < unlockEndTime[user]` → `Unlock not finished`
- `amount == 0` → `Cannot unstake 0`
- `amount * 10^18 > userStaked(user)` (wei) → `Not enough staked`

**Dust after compounding:** `claimAndRestake()` adds rewards at wei precision, so a stake can become e.g. 1,000.679 KIBBLE. `unstake` only takes whole units, so a full exit leaves the sub-1 remainder in the contract permanently. Because state only resets when the raw stake hits exactly 0, that wallet then reads `getUserStaked == 0` with `isUnlocking == true`. Treat that as dust, not an exit in progress; `relock()` puts it back to earning.

### `unlock()`

Starts the exit wait. **Pays any pending rewards to `msg.sender` first**, then sets `isUnlocking[user] = true`, `unlockStartTime[user] = block.timestamp`, `unlockEndTime[user] = block.timestamp + LOCK_PERIOD()` (14 days). Removes the user's stake from `totalActiveStaked`. Emits `UnlockInitiated(indexed address user, uint256 unlockEndTime)`.

Reverts: `No stake to unlock`, `Already unlocking`.

### `relock()`

Cancels an in-progress unlock. Sets `isUnlocking[user] = false` and returns the user to `totalActiveStaked`; they earn again from the next deposit. Emits `Relocked(indexed address user, uint256 amount)` (amount floored to whole KIBBLE).

Reverts: `Not unlocking`, `No stake to relock`.

### `claim()`

Transfers the full pending amount (wei precision) to `msg.sender` and updates `rewardDebt`. Emits `Claimed(indexed address user, uint256 amount)` — the event amount is **floored** to whole KIBBLE, so a 0.68 KIBBLE claim logs `0`. Read the KIBBLE `Transfer` log for the exact amount.

Reverts:
- `No rewards while unlocking` if the caller is unlocking.
- `No rewards` if the raw pending amount is 0.

### `claimAndRestake()`

Adds the pending amount (wei precision) directly to the user's stake (no token transfer out, no ERC-20 approval needed). Emits `ClaimedAndRestaked(indexed address user, uint256 restakedAmount, uint256 totalStakedNow)`, both floored to whole KIBBLE. Can leave the stake fractional — see the dust note under `unstake`.

Reverts `No rewards` if the raw pending amount is 0. Pending is always 0 while unlocking, so **it cannot be called during an unlock** and cannot be used to cancel one (only `stake()` or `relock()` do that).

### Admin / owner-only

| Function                                                           | Notes                                  |
|--------------------------------------------------------------------|----------------------------------------|
| `depositRevenue(uint256 amount, string source)`                    | Cat Town backend only; `amount` in whole KIBBLE; updates `accRewardPerShare`. Emits `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)`. `source` is `"fishing"` or `"gacha"` (`"daycare"` reserved, not yet active); compare case-insensitively. |
| `setKibbleToken(address)`                                          | Owner only.                            |
| `recoverERC20(address tokenAddress, uint256 tokenAmount)`          | Owner only; for stuck non-KIBBLE tokens. |
| `initialize(address _owner, address _kibbleToken)`                 | Proxy init; not callable post-deploy.  |
| `upgradeToAndCall(address newImplementation, bytes data)`          | UUPS upgrade; owner only.              |
| `transferOwnership(address newOwner)` / `renounceOwnership()`      | Standard OZ Ownable.                   |

## Read functions

**Two unit systems.** The `get*` convenience getters and `pendingRewards` return **whole KIBBLE, floored**. The public storage getters (`userStaked`, `rewardDebt`, `totalStaked`, `totalActiveStaked`) return **wei**. Mixing them up is a 10^18 error.

| Call                                           | Returns / unit                | Meaning                                                        |
|------------------------------------------------|-------------------------------|----------------------------------------------------------------|
| `getUserStaked(address user)`                  | whole KIBBLE, floored         | Currently staked KIBBLE.                                       |
| `userStaked(address)`                          | **wei**                       | Raw stake. Use this when the stake may be fractional (after compounding). |
| `pendingRewards(address user)`                 | whole KIBBLE, floored         | Claimable KIBBLE; reads 0 below 1 KIBBLE and while unlocking.  |
| `getPoolShareFraction(address user)`           | fraction × 1e18               | `userStaked / totalActiveStaked`. Overstates unlocking users (their stake is in the numerator but not the denominator) — treat their share as 0. |
| `isUnlocking(address)`                         | `bool`                        | True iff user has an open `unlock()` they haven't closed.      |
| `unlockStartTime(address)`                     | unix seconds                  | When `unlock()` was called.                                    |
| `unlockEndTime(address)`                       | unix seconds                  | When `unstake()` becomes callable.                             |
| `getTotalStaked()`                             | whole KIBBLE, floored         | All staked KIBBLE (includes users currently unlocking).        |
| `totalStaked()`                                | **wei**                       | Same, raw.                                                     |
| `getTotalActiveStaked()`                       | whole KIBBLE, floored         | KIBBLE earning rewards right now.                              |
| `totalActiveStaked()`                          | **wei**                       | Same, raw.                                                     |
| `accRewardPerShare()`                          | accumulator × **1e12**        | Global reward accumulator (wei reward per wei staked × 1e12).  |
| `rewardDebt(address)`                          | **wei**                       | Per-user snapshot used in the `pendingWei` formula.            |
| `LOCK_PERIOD()`                                | seconds                       | Unlock wait: 1,209,600 (14 days).                              |
| `kibbleToken()`                                | `address`                     | KIBBLE ERC-20 address.                                         |
| `owner()`                                      | `address`                     | Current owner (Cat Town deployer).                             |

Note: the contract's actual KIBBLE holdings read via `balanceOf(revenueShare)` on the KIBBLE token contract are in wei as usual — that's a standard ERC-20 call, not a RevenueShare read. As a sanity check, `balanceOf(revenueShare)` should be at least `totalStaked()` (the difference is deposited rewards not yet claimed).

## Events

Amounts in RevenueShare events are **whole KIBBLE**. `Staked` / `Unstaked` / `RevenueDeposited` echo the whole-KIBBLE argument; `Claimed` / `Relocked` / `ClaimedAndRestaked` are **floored** from wei, so they under-report (sub-1 claims log `0`). Use KIBBLE `Transfer` logs when you need exact amounts.

| Event                                                                                        | When                               |
|----------------------------------------------------------------------------------------------|------------------------------------|
| `Staked(indexed address user, uint256 amount)`                                               | On `stake`.                        |
| `Unstaked(indexed address user, uint256 amount)`                                             | On `unstake`.                      |
| `UnlockInitiated(indexed address user, uint256 unlockEndTime)`                               | On `unlock`.                       |
| `Relocked(indexed address user, uint256 amount)`                                             | On `relock`.                       |
| `Claimed(indexed address user, uint256 amount)`                                              | On `claim`.                        |
| `ClaimedAndRestaked(indexed address user, uint256 restakedAmount, uint256 totalStakedNow)`   | On `claimAndRestake`.              |
| `RevenueDeposited(string source, uint256 depositTimestamp, uint256 depositAmount, uint256 newAccRewardPerShare)` | On `depositRevenue` (backend only). Watch this to detect the weekly drops. |
| `OwnershipTransferred(indexed address previousOwner, indexed address newOwner)`              | Standard OZ Ownable.               |
| `Initialized(uint64 version)` / `Upgraded(indexed address implementation)`                   | Proxy lifecycle.                   |

## Transaction-building checklist

For any stake flow, before constructing calldata:

1. Keep two values straight: `human_amount` (e.g. `100`, the whole-KIBBLE count) and `wei_amount = human_amount * 10^18` (for the ERC-20 approval only).
2. Pass `stake(human_amount)` — the whole-KIBBLE integer. **Not** wei. Fractional KIBBLE cannot be staked; floor the user's amount.
3. Read `allowance(user, revenueShare)` on the KIBBLE token. If `< wei_amount`, include an `approve(revenueShare, wei_amount)` tx first.
4. Read `balanceOf(user)` on the KIBBLE token (standard ERC-20, returns wei). Confirm `wei_amount ≤ balanceOf(user)`. Don't submit a tx that will revert.
5. Confirm the tx sender address equals the user address holding KIBBLE. A smart-wallet / relay setup that changes `msg.sender` will cause reverts even when the "user" has tokens.
6. If `isUnlocking(user) == true`, warn before staking: the top-up cancels the unlock and a later exit needs a fresh 14 days.
7. For `unstake`: read `isUnlocking(user)` and `unlockEndTime(user)`. Abort with a clear error if the wait isn't over. Note `unstake` takes whole KIBBLE too, and at most `floor(userStaked / 1e18)`.
8. For claims: gate on `pendingWei` (raw formula), not `pendingRewards()`, which floors to 0 below 1 KIBBLE. Both claim calls revert when the raw amount is 0.
9. For previews, `getUserStaked(user)` and `pendingRewards(user)` are cheap reads but floored whole KIBBLE; use `userStaked(user)` and `pendingWei` when decimals matter.
