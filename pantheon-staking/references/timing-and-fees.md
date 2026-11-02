# Pantheon reward timing, fees, and exit rules

## The calendar-month model

Rewards are anchored to real calendar months (UTC boundaries), not day counts. The contract converts a timestamp to a month index — whole calendar months since January 1970, UTC, with real leap-year handling — and every date below is a month boundary at `00:00:00 UTC`.

- Stake in **Month A** → you earn nothing in Month A, no matter which day of the month you staked.
- Earning begins at the **start of Month B** (the next calendar month).
- The first claim opens at the **start of Month C** (the month after B).

**Do not compute any of these dates as an offset from the stake timestamp.** Someone who stakes on 1 August and someone who stakes on 31 August get identical dates.

### The three dates

Let `A` = the calendar month containing the stake (the contract stores this as `stakeMonthIndex`, field 7 of `stakes()`).

| Date | Formula | Example: staked any day of Aug 2026 |
|---|---|---|
| **Rewards start** | 1st of month `A + 1`, 00:00 UTC | 1 Sep 2026 |
| **First claim** | 1st of month `A + 2`, 00:00 UTC | 1 Oct 2026 |
| **Lock ends** | 1st of month `A + 7`, 00:00 UTC | **1 Mar 2027** |

The lock runs to the start of the **7th** month after the stake month because the stake month earns nothing: you earn across months `A+1 … A+6`, and the lock releases once that sixth earning month completes.

> ⚠️ **The lock end is NOT "stake time + 6 months".** For an August 2026 stake, "+6 months" gives 7 Feb 2027 — **22 days early**. Quoting that date would lead a user to request an unstake while still inside the lock and pay the 10% principal penalty. Always use the calendar formula above.

*(Every pool checked at the 2026-10-30 verification — all 35 Base registry pools and all 8 RH pools — has `cliffMonths = 0`, which is what the table assumes. If `pools(token).cliffMonths` is ever non-zero, every date shifts later by that many months: rewards start `A+1+cliff`, first claim `A+2+cliff`, lock ends `A+7+cliff`.)*

## Fees

| Event | Fee |
|---|---|
| Reward claim | 5% (user receives 95%) |
| Reward deposit by projects | 5% at deposit (already reflected in pools) |

The claim fee is read from the contract as `feePercent()` and was `5` on 2026-10-30. It is operator-adjustable, so prefer reading it live over hardcoding.

## Exit rules — why this agent does not unstake

There is no single `unstake()` function. A normal exit is two calls: `requestUnstake(token)`, then `finalizeUnstake(token)` at least 7 days later.

- **Exiting stops earning from the calendar month of the exit (inclusive).** Rewards for earlier months that the exiter has not yet claimed **remain claimable after the exit** — `claimReward` still works for an exited position. The exit month and later months go to the remaining stakers. (Before V9, 2026-10-28, an exit forfeited all unclaimed rewards; that is no longer the case.)
- A **10% principal penalty** applies if `requestUnstake` is called before the lock end. The penalty is **split 50/50: 5% burned to `0x…dEaD`, 5% to the treasury.** It is fixed at request time, so waiting before finalizing does not reduce it.
- A **7-day cooling-off** separates `requestUnstake` from `finalizeUnstake`; calling early reverts `CoolingOffNotFinished()` (`0xa79d0533`).
- `emergencyExit` bypasses the lock and cooling-off and costs **20% of principal** (split 50/50: 10% burned, 10% treasury). It does **not** burn or forfeit rewards: as with a normal exit, earlier months stay claimable and the exit month onward goes to the remaining stakers. It succeeds on the first call with no further confirmation from the chain and cannot be undone.
- After a `requestUnstake`, `emergencyExit` is blocked.
- There is no longer a claim-before-unstake ordering trap. Exits are still excluded from this skill on every chain because they cost 10–20% of principal, give up the exit month's rewards, and cannot be undone; the Pantheon web app shows the amounts before the click.
- If a user insists: state the rules above, link https://pantheonvaults.com, and do not execute any exit function.
