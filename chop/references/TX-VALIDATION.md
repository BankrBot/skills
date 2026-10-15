# Transaction validation (before every Bankr submit)

The CLI already enforces these rules. Check them again before submitting, because a plan can be
tampered with between the CLI and Bankr, or an agent can be tricked into hand-editing calldata.
**Reject the whole plan if any check fails.** Do not edit a transaction to make it pass. Rebuild it.

## 1. Chain and value

- Every transaction: `chainId === 4663`.
- `value === "0"` for everything except `wrap-eth` (WETH `deposit()`), where `value` equals the requested ETH in wei.

## 2. Allowed `to` per step

Static addresses come from `known-contracts.json`. Log-specific addresses (log, staking pool, rewards,
LP pair) must match what `node scripts/chop.mjs log <log>` returns for the same log.

| `step` | `to` must be | Selector | Function |
|---|---|---|---|
| `approve`, `approve-reset` | the token being spent (underlying, paired, log, staking receipt or LP pair) | `0x095ea7b3` | `approve(address,uint256)` |
| `wrap` | the log | `0xb08d0333` | `bond(address,uint256,uint256)` |
| `unwrap` | the log | `0xee9c79da` | `debond(uint256,address[],uint8[])` |
| `buy`, `sell` | Uniswap V2 router `0x89e5DB8B5aA49aA85AC63f691524311AEB649eba` | `0x5c11d795` | `swapExactTokensForTokensSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)` |
| `farm` | IndexUtils `0x88BfFDf0ce9EB8889577924Cf802B2237bf8aD79` | `0x84614e1a` | `addLPAndStake(address,uint256,address,uint256,uint256,uint256,uint256)` |
| `farm-single` | IndexUtils | `0x0a34d8b6` | `addLPAndStakeSingleSided(address,(address,uint256,uint256,uint256,uint256,uint256))` |
| `unfarm` | IndexUtils | `0x1fd8ecd9` | `unstakeAndRemoveLP(address,uint256,uint256,uint256,uint256)` |
| `unfarm-single` | IndexUtils | `0x18bd064a` | `unstakeAndRemoveLPSingleSided(address,(address,uint256,uint256,uint256,uint256,uint256,uint256))` |
| `stake` | the log's staking pool | `0xadc9772e` | `stake(address,uint256)` |
| `unstake` | the log's staking pool | `0x2e17de78` | `unstake(uint256)` |
| `claim` | the log's rewards contract | `0xd279c191` | `claimReward(address)` |
| `claim-multi` | IndexUtils | `0xa1879d90` | `claimRewardsMulti(address[])` |
| `process-fees` | the log | `0xba69ebed` | `processFees()` |
| `update-oracle` | the log | `0x19c18710` | `updateFeeOracle()` |
| `wrap-eth` | WETH `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | `0xd0e30db0` | `deposit()` |
| `unwrap-eth` | WETH | `0x2e1a7d4d` | `withdraw(uint256)` |
| `launch` | ChopLogSeeder `0xE1F6638F3276a88557AD4e81c50bFd5AA99fc50c` | `0x0f320477` | `createAndSeed(string,string,bytes,bytes,(uint256,uint256,uint256,uint256,uint256,uint256))` |
| `seed` | ChopLogSeeder | `0x86a55bf9` | `seed(address,uint256,uint256,uint256,uint256,uint256,uint256)` |
| `create` | IndexManager `0xF2A26110396b4162d48A16eE8683372a6A2c3b76` | `0x98d98fe7` | `deployNewIndex(string,string,bytes,bytes,address)` |

`data` must start with the selector for its step. Any other selector or `to` means reject.
The selectors were checked against the deployed ABI bundle (chopdemo `src/contracts/abis`).

## 3. Approvals

- Spender (first argument) must be one of: the log (wrap), the V2 router (buy/sell), IndexUtils
  (farm, farm-single, unfarm), the log's staking pool (stake) or ChopLogSeeder (launch/seed).
- Amount (second argument) is exact. It equals the amount being spent, or `maxPaired` for seeding.
  **Never `0xfff…fff`.** `approve-reset` sets 0 before a new exact approval.

## 4. Recipients and minimums

- `buy`/`sell`: the `to` argument inside the swap is the user's wallet, and `amountOutMin > 0`.
- `wrap`: `_amountMintMin > 0`. `unwrap` has no minimum argument by design, so it was simulated just before.
- `farm`/`farm-single`/`unfarm*`: deadline in the future; every minimum argument `> 0`.
- `claim`: argument equals the user's wallet. `gas` = 800,000 per log.

## 5. Preview

Show the user, before submitting: action, log symbol and address, amounts, expected and minimum
output, fee rates, every `warnings` entry, and `chainId: 4663`.
