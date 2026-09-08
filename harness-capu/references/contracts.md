# CAPU contracts and optional CAP minting

Read before any transaction, including buying/staking CAPU, CAP → sCAP →
CAPU minting, and exits back to CAP. Buying and staking existing CAPU does
not require minting. Every call below also requires the validation, preview,
and fresh explicit confirmation in [transaction-safety.md](transaction-safety.md).

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

## Reviewed deployment record required

Both vaults use UUPS upgradeable proxies. **This reference pins published
token addresses and reviewed source, but does not contain an approved
deployment record or verified implementation addresses/code hashes.** The
source repository does not establish those deployment pins. Until a separate
review supplies the complete record below, stop all affected transactions;
read-only inspection and key management may continue. Do not accept whichever
implementation an explorer currently reports as the expected implementation,
and do not use browser handoff to bypass the missing record.

Load a versioned, immutable deployment record from the host's approved local
configuration, established by deployment/security review independently of the
transaction being proposed. Pin the following for each touched contract:

| Required pin | What the review must establish |
| --- | --- |
| Provenance | Review reference, reviewer, source/compiler/build inputs, Base chain ID `8453`, observation block number and hash |
| Proxy identity | Exact proxy address and Keccak-256 of its deployed runtime bytecode |
| Implementation identity | Expected implementation address and Keccak-256 of its deployed runtime bytecode, linked to the reviewed source/build |
| Upgrade mechanism | UUPS/ERC-1967 implementation slot, admin/beacon slot values (including zero where expected), and any other upgrade path |
| Authority | Complete `DEFAULT_ADMIN_ROLE` membership and role-admin relationships; controlling EOA or multisig owners/threshold, timelock and delay if any; review evidence for absence of a delay |
| Token relationships | ScapStaking `capToken()` = pinned CAP, `capu()` = pinned CAPU; CAPU `MINTER_BURNER_ROLE` membership and its role admin; verified token decimals |
| Allowed calls | Target-specific signatures and computed four-byte selectors from the reviewed ABI; router nested-command allowlist where applicable |
| Parameters | Reviewed cooldown/unbonding values and mint parameter constraints relevant to the requested operation |

For direct non-proxy tokens/routers, pin runtime code hash and allowed calls;
if they are upgradeable, require the same implementation and authority record.
The swap input token and every router/spender also need reviewed identities;
the table of CAP/CAPU addresses alone cannot authorize them. Missing or
unverifiable fields fail validation, rather than becoming wildcards.

In the reviewed source, each vault's `DEFAULT_ADMIN_ROLE` authorizes upgrades,
role grants, pausing, and configuration changes. CAPU's `MINTER_BURNER_ROLE`
permits mint/burn; ScapStaking is the intended holder. Source code alone proves
neither the live membership nor a multisig/timelock protection. Reconstruct
complete role membership from deployment and role events plus current role
checks; checking one known admin with `hasRole` is insufficient.

Immediately before **each signing**, reread chain ID, proxy slots, runtime
code hashes, token relationships, roles/admin controls, and relevant parameters
from trusted Base RPC at a consistent block and compare to the reviewed record.
The standard ERC-1967 implementation slot is
`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`.
Decode its address and hash the runtime code at that address, not just the
proxy bytecode. Stop for deployment review on any implementation, code hash,
authority, relationship, or unreviewed parameter change. Never automatically
update the pins or treat user transaction confirmation as deployment review.
Revalidation reduces upgrade risk; an admin can still upgrade before inclusion,
which must remain part of the risk disclosure.

The reviewed-source operation allowlist is limited to:

| Target | Permitted signature, only for the requested flow | Selector |
| --- | --- | --- |
| CAPU or ScapStaking | `stake(uint256)` | `0xa694fc3a` |
| CAPU or ScapStaking | `initiateUnstake(uint256)` | `0xae5ac921` |
| CAPU | `unstake()` | `0x2def6620` |
| CAPU | `transfer(address,uint256)` for an explicitly requested liquid-token transfer | `0xa9059cbb` |
| CAP | `approve(address,uint256)` only for the reviewed spender and required amount | `0x095ea7b3` |
| ScapStaking | `lockAndMintCapu(uint256,uint256)` | `0x32d560d6` |
| ScapStaking | `burnAndUnlockScap(uint256)` | `0x826b420c` |
| ScapStaking | `finalizeUnstake()` | `0x0ea94341` |
| Swap input token/router | Only separately reviewed approval/swap calls for the selected route and exact batch | Pin in the deployment record |

Match both target and selector, then fully decode arguments. Identical
`stake(uint256)` selectors on CAPU and ScapStaking have different effects.
Initialization, upgrade, role administration, direct CAPU `mint`/`burn`,
unlimited approvals, and arbitrary multicalls are not authorized by this skill.

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
