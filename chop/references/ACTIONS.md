# Actions reference

All commands: `node scripts/chop.mjs <command> [flags]`, run from the skill folder after `npm install` in
`scripts/`. Output is JSON on stdout. Exit code 0 on success, 1 on a refused or failed command (`ok:false`),
2 on a usage error.

Common flags:

- `--log <address | chSYMBOL | SYMBOL>` (or as the first positional). `--paired CHOP|WETH|USDG|0x…` picks one when a
  token has several logs.
- `--wallet 0x…`: the Bankr EVM wallet. Defaults to `$BANKR_WALLET_ADDRESS`.
- `--amount <decimal | all>`. Add `--raw` to pass integer base units.
- `--slippage-bps <1–1000>`. LP adds convert it to per-mille (100 bps = 1%).
- `--rpc <url>`. Defaults to `https://rpc.mainnet.chain.robinhood.com`, then `https://choplogs.app/api/rpc`.

Write commands return a **plan**: `status` (`approval-required` | `ready`), `summary`, `transactions[]`,
`warnings[]`, `expiresAt`, `next`. See SKILL.md for the submit loop.

## Reads

| Command | Returns |
|---|---|
| `logs [--yields] [--all]` | Every public log (`--all` adds pending ones): symbol, underlying, paired, fee set, eligibility, pool reserves, log price in paired, pool value, backing per log, unwrap value, $CHOP paid to farmers, stakers, reward route. `--yields` adds historical farmer APR and backing APY |
| `log <log>` | The same for one log, plus eligibility reasons and yields |
| `position [<log>] --wallet W` | Per log: wallet log/underlying/paired/raw-LP balances, unwrap value of held log tokens, staked LP, **withdrawable** LP (past the 10-min lock), pool share, the tokens behind your stake, unpaid / claimable-now / claimed-to-date $CHOP. Without `<log>`, every log you touch |
| `quote wrap --log L --amount <underlying>` | Log tokens out after the wrap fee |
| `quote unwrap --log L --amount <log>` | Underlying out after the unwrap fee |
| `quote buy\|sell --log L --amount N` | Output from the log's V2 pool after the log's buy/sell fee and the 0.3% pool fee |
| `quote farm --log L --amount <log>` | Paired tokens needed at the pool ratio |
| `quote farm-single --log L --amount <paired>` | How much is swapped into log tokens and the expected log output |
| `gaps [--log L]` | Log price vs. backing × market price of the underlying, round-trip cost, estimated edge. See ARBITRAGE.md |
| `arb --log L --size N` | Arb plan with wallet baselines; follow-up legs are `arb --leg … --since …` and spend only what the arb acquired. See ARBITRAGE.md |

## Writes

| Command | Approvals (exact) | Final call | Notes |
|---|---|---|---|
| `wrap` | underlying → log | `log.bond(underlying, amount, minMint)` | `minMint` = convertToShares × (1 − wrap fee) × (1 − slippage). Deposits need an eligible log |
| `unwrap` | none | `log.debond(amount, [], [])` | Redeems at backing; no minimum argument exists, so it is simulated right before. Works on any registered log, even unpublished |
| `buy` | paired → V2 router | `router.swapExactTokensForTokensSupportingFeeOnTransferTokens(amount, minOut, [paired, log], wallet, deadline)` | Trades in the log's own pool |
| `sell` | log → V2 router | same, path `[log, paired]` | Exit: allowed on any registered log |
| `farm` | log + paired → IndexUtils | `IndexUtils.addLPAndStake(log, logAmt, paired, pairedAmt, 0, slippage‰, deadline)` | `--paired-amount` defaults to the pool ratio. Leftovers are refunded |
| `farm-single` | paired → IndexUtils | `IndexUtils.addLPAndStakeSingleSided(log, (paired, amount, minSwapOutput, minStakedLp, slippage‰, deadline))` | Only the log's paired token is accepted (`QUOTE_ONLY`). For WETH pairs, run `wrap-eth` first. The swap pays the buy fee + 0.3% |
| `unfarm --to both` | staking receipt → IndexUtils | `IndexUtils.unstakeAndRemoveLP(log, amount, minLog, minPaired, deadline)` | Needs unlocked stake (10-min lock). Rewards stay claimable |
| `unfarm --to paired\|log` | staking receipt → IndexUtils | `IndexUtils.unstakeAndRemoveLPSingleSided(log, (output, amount, minLog, minPaired, minSwap, minOut, deadline))` | Swaps the unwanted side, paying the sell or buy fee + 0.3% |
| `stake` | V2 LP → staking pool | `stakingPool.stake(wallet, amount)` | For raw LP you already hold. Restricted pools are refused |
| `unstake` | none | `stakingPool.unstake(amount)` | Returns raw LP; use `unfarm` to also remove the liquidity |
| `claim --log L` | none | `rewards.claimReward(wallet)`, gas 800,000 | `--all` (or no `--log`) claims every log with something claimable via `IndexUtils.claimRewardsMulti`, gas 800,000 × logs |
| `process-fees` | none | `log.processFees()` | Permissionless upkeep, no reward for the caller. Needs a fresh fee price oracle; on `FEE_ORACLE_NOT_READY` see `update-oracle` |
| `update-oracle` | none | `log.updateFeeOracle()` | Permissionless. Two observations 10 to 20 minutes apart mature the TWAP the log uses to price its fee swap. The Chop keeper normally runs this |
| `wrap-eth` / `unwrap-eth` | none | `WETH.deposit()` with value / `WETH.withdraw(amount)` | Keep ETH for gas |
| `launch`, `create`, `seed` | see LAUNCH.md | | |

## Choosing for a user

- "Earn on my VRAX": wrap only earns backing growth. Farming earns $CHOP but adds impermanent loss and needs
  the paired token (or use `farm-single` with just the paired token). Offer both, honestly.
- "I only have ETH": `wrap-eth` → `farm-single` on a WETH-paired log.
- "Take everything out": `claim`, then `unfarm --amount all`, then `unwrap --amount all`. Check `position` first:
  stake inside the 10-minute lock cannot leave yet.
- Always `quote` or build, show the preview, and get the user's go-ahead before submitting.
