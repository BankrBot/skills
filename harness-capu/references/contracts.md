# CAPU contracts and optional CAP minting

Use for contract verification, CAP → sCAP → CAPU minting, or a requested
exit back to CAP. Buying and staking existing CAPU does not require minting.

## Address and source map

Base mainnet, chain ID **8453**:

| Contract | Address | Function |
| --- | --- | --- |
| CAPU | `0x67558d3D990EA40b64fD37FBd5c4860d1f9B3a9F` | Transferable compute token with built-in CAPU staking |
| CAP | `0xbfa733702305280F066D470afDFA784fA70e2649` | Capital token used only for the optional minting path |
| ScapStaking / sCAP | `0x92ee42A61CF55642949B4fE74bB4796978ddB47a` | CAP staking vault, non-transferable sCAP receipt, and CAPU mint/burn |

Addresses are published in the official
[Mint CAPU guide](https://github.com/Capminal/capminal-gitbook/blob/7e128d64b22ae1cc63db73412b348ffcc1d76967/capminal/product-features/mint-capu.md).
Source reviewed 2026-09-06 at contracts commit
`3e2612984ef0ca07ffbdb174ef1dcef115152ec5`:

- [Capu.sol](https://github.com/Capminal/capminal-contracts/blob/3e2612984ef0ca07ffbdb174ef1dcef115152ec5/projects/capu/src/Capu.sol)
- [ScapStaking.sol](https://github.com/Capminal/capminal-contracts/blob/3e2612984ef0ca07ffbdb174ef1dcef115152ec5/projects/capu/src/ScapStaking.sol)
- [Contract overview](https://github.com/Capminal/capminal-contracts/tree/3e2612984ef0ca07ffbdb174ef1dcef115152ec5/projects/capu)

Both vaults use upgradeable proxies. Verify the live implementation, ABI,
token relationships, decimals, and relevant parameters before a transaction;
the reviewed repository commit is not proof of the deployed revision.

## CAPU staking calls

| Signature | Purpose |
| --- | --- |
| `balanceOf(address) returns (uint256)` | Liquid CAPU |
| `stakedOf(address) returns (uint256)` | Active staked CAPU |
| `cooldownOf(address) returns (uint256 amount, uint256 readyAt)` | Pending withdrawal and Unix timestamp in seconds |
| `cooldownDuration() returns (uint256)` | Current cooldown seconds |
| `decimals() returns (uint8)` | Unit conversion |
| `paused() returns (bool)` | Whether new stakes are paused |
| `stake(uint256 amount)` | Stake using internal transfer; no approval |
| `initiateUnstake(uint256 amount)` | Move active stake into cooldown |
| `unstake()` | Return all ready cooldown CAPU to the caller |

Use integer base units and zero native transaction value. A raw `transfer`
to CAPU's contract does not call staking or credit `stakedOf`. Finalizing a
ready cooldown before initiating another avoids resetting the ready time
for the combined queue. Use the live timestamp, not a fixed one-day timer.

## Optional mint path

1. Verify ScapStaking's `capToken()` and `capu()` against the pinned addresses.
   Read CAP/sCAP/CAPU decimals, existing sCAP `balanceOf(wallet)`,
   `availableOf(wallet)`, and `lockedOf(wallet)`. Reuse available sCAP.
2. If the user authorizes additional CAP staking, approve only the required
   CAP amount to ScapStaking using CAP's `approve(address,uint256)`, then
   call `stake(uint256 capAmount)` **on ScapStaking**. Confirm receipts and
   actual sCAP received; the reviewed contract accounts for CAP actually
   transferred, including any transfer fee.
3. Quote `pendingMintAmount(uint256 scapAmount)` on the current deployed
   ScapStaking contract. Determine `minCapuOut` from that quote and the user's
   slippage constraint. Do not estimate output by dividing by a stale mint
   rate: the reviewed implementation integrates along a supply-dependent
   curve. Do not use zero minimum output to bypass slippage protection.
4. Call `lockAndMintCapu(uint256 scapAmount,uint256 minCapuOut)` on
   ScapStaking. The lock is internal; it requires no sCAP approval/transfer.
   Wait for success and read actual CAPU received.
5. Call `stake(uint256 capuAmount)` **on CAPU**, then verify active stake and
   gateway quota before reporting the resulting compute allocation.

sCAP is non-transferable. Do not send it to another wallet or a separate
"mint contract." CAPU's direct `mint` and `burn` functions are role-gated;
normal users invoke the ScapStaking workflow instead.

## Optional exit back to CAP

Only for the user's own recorded mint position. Read `mintedCapuOf(wallet)`
and `lockedOf(wallet)`: secondary-market CAPU alone does not entitle a buyer
to somebody else's collateral.

1. If necessary, unstake CAPU using its cooldown flow and wait for the
   successful `unstake()` receipt.
2. Call `burnAndUnlockScap(uint256 capuAmount)` on ScapStaking, bounded by
   the caller's remaining `mintedCapuOf` and liquid CAPU. This burns CAPU and
   unlocks that wallet's original collateral proportionally; it does not
   transfer CAP out yet. No CAPU approval is required in the reviewed source.
3. Read `unbondingOf(wallet)` and `unbondingDuration()` on ScapStaking before
   a new exit. Call `initiateUnstake(uint256 amount)` for the requested
   available sCAP, then `finalizeUnstake()` only after its recorded `readyAt`.
   The documented unbonding period is seven days, but live state governs.
   A further initiation resets the entire pending sCAP queue's timestamp.
4. Confirm final CAP receipt and updated positions. Do not treat an
   initiated cooldown as a completed withdrawal.
