# Errors

## CLI codes (`ok: false`)

| `code` | Meaning | What to tell the user |
|---|---|---|
| `USAGE` | Missing or bad flag | Fix the command |
| `WRONG_CHAIN` | RPC is not Robinhood Chain 4663 | Use a 4663 RPC (`--rpc`) |
| `LOG_NOT_FOUND` / `AMBIGUOUS_LOG` | No log, or several, match the name | Pass the address or `--paired`. `matches` lists candidates |
| `LOG_NOT_ELIGIBLE` | Not registered, not public, or failed `validateIndex` | Deposits are closed. Exits still work if it is registered |
| `LOG_NOT_REGISTERED` | Address is not a Chop log | Never interact with it |
| `UNSUPPORTED_LOG` | Multi-asset or transfer-tax log | Not supported by this skill |
| `INSUFFICIENT_BALANCE` | Wallet lacks the tokens | Show balance vs. needed |
| `ZERO_AMOUNT` / `AMOUNT_TOO_SMALL` | Nothing to do, or too small for a nonzero minimum | Use a larger amount |
| `NO_LIQUIDITY` | Pool not seeded yet | Seed it (creator) or wait |
| `HAS_LIQUIDITY` | `seed` on a funded log | Use `farm` |
| `STAKE_WAIT` | Staked LP still inside the 10-minute lock | Try again after the unlock |
| `STAKE_RESTRICTED` | Direct staking disabled for this pool | Use `farm` |
| `NOTHING_TO_CLAIM` | Nothing claimable now | New rewards mature 10 minutes after staking |
| `DUPLICATE_LOG` | Log exists for this token + pair | Use the existing log (`log` field) |
| `NO_REWARD_ROUTE` | Paired token has no reviewed $CHOP route | Pair with CHOP, WETH or USDG |
| `NO_PRICE` | No market price for the underlying | Gap/arb cannot be computed |
| `FEE_ORACLE_NOT_READY` | The log's fee price oracle is not matured or is stale | `update-oracle`, wait ~11 min, `update-oracle`, then `process-fees`. Usually the keeper handles it |
| `SIMULATION_REVERTED` | The final transaction would revert | Relay the reason (below). Nothing was submitted |

## Common revert reasons inside `SIMULATION_REVERTED`

| Reason | Meaning |
|---|---|
| `M` | Wrap minted less than the minimum (price moved, or a fee changed). Rebuild |
| `QUOTE_ONLY` | Single-sided entry with a token other than the log's paired token |
| `InvalidSingleSidedParams()` | Zero bound, too much LP slippage, or an expired deadline. Rebuild |
| `SingleSidedOutputTooLow()` | Output fell below the minimum. Rebuild or widen slippage |
| `STAKE_WAIT` | Receipts not yet unlocked |
| `UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT` | Pool moved past the swap minimum |
| `UniswapV2Router: EXPIRED` | Deadline passed. Rebuild |
| `InvalidInput()` / `BelowMinimum()` (seeder) | Bad seed amounts, expired deadline, or minimum not met |
| `InvalidRegistryStatus()` (seeder) | The log is already public, or the caller is not its creator |
| `TRANSFER_TAX` | Log has a transfer tax; single-sided helpers refuse it |
| `FeeOracleNotReady()` / `FeeOracleStale()` | Fee processing needs a matured, recent fee oracle (see `update-oracle`) |

After any revert on-chain (Bankr `status: "reverted"`), rebuild from scratch. Never resubmit the same transaction.
