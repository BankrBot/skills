# Referrals, the top-100 board and King of the Hill

Everything here lives on the FLASH/ETH Referral Coin pool. Registry `0x20E37314A4D52Ba1FB55a675a834665Cf2515857`, KOTH `0x2556ffbAb00D1993aD1BDA44fb6c0dc15fde7457`.

## Referral codes

- A **code** is a positive `uint64`. Links look like `https://tryflash.app/?ref=<code>`. Code #1 is ROOT, owned by the registry itself; its earnings sweep to the treasury.
- **Getting a code:** while referred, make one FLASH buy of at least `registry.codeThreshold()` (0.1 ETH today). The registry then issues the wallet its own code: read `registry.codeOf(wallet)`.
- **Being referred** cuts the FLASH fee from 6.9% to 1.69%. The referrer earns 1% of the referee's volume, as shares of one ETH+FLASH pool. Binding is **permanent**: one referrer per wallet.

### Reads

| Call | Returns |
| --- | --- |
| `bindingOf(account)` | `(referrer, explicitlyBound)`; referrer `0x0` = not referred |
| `isReferred(account)` | bool |
| `codeOf(account)` / `ownerOfCode(code)` | `uint64` / address |
| `refereeCount(account)` | number of direct referees |
| `bucketOf(account)` | `(eth, flash)` accrued, unclaimed |
| `lifetimeEarned(account)` | `(eth, flash)` |
| `previewClaim(account)` | `(ethPayout, tokenPayout, parent, ethCascaded, tokenCascaded)`: what `claim()` pays now, and the 33% passed up to `parent` |
| `sortedRankOf(account)` | 1-based rank on the top-100 board (0 = not ranked) |
| `top100Sorted()` | `(address[] accounts, uint256[] scores)` in payout order |
| `top100Pool()` / `top100FlashPool()` | ETH / FLASH waiting for the board |
| `airdropThreshold()` / `flashAirdropThreshold()` | pool size that triggers a board payout (0.01 ETH / 0.01 FLASH today) |
| `bindNonce(account)` | EIP-712 nonce |

CLI: `referral-status --wallet W`, `referral-board`. API: `GET /v1/stack/referral/:account`, `GET /v1/stack/referral/board`, `GET /v1/stack/referrals/top`.

### Binding a code (three ways)

1. **Plain EOA, one transaction:** `registry.bind(uint64 code)`, selector `0xd9cd8b6e`. CLI: `referral-bind --code N --wallet W`.
2. **Smart wallet, EIP-7702 account or undeployed ERC-6492 wallet:** the account signs EIP-712 typed data and anyone relays `registry.bindWithSig(account, code, deadline, sig)`, selector `0x7899c516`. The registry verifies ERC-6492, then ecrecover (7702), then ERC-1271.
   ```
   domain  = { name: "Flash Referral", version: "1", chainId: 8453, verifyingContract: 0x20E37314A4D52Ba1FB55a675a834665Cf2515857 }
   types   = { Bind: [ {account,address}, {code,uint64}, {nonce,uint256}, {deadline,uint256} ] }
   message = { account, code, nonce: registry.bindNonce(account), deadline }
   ```
   Include `EIP712Domain` in `types` for raw `eth_signTypedData_v4` payloads. MetaMask otherwise hashes a different domain and the registry returns `InvalidSignature()`. CLI: `referral-bind --code N --wallet W` returns `status: needs-signature` and the typed data. Sign it, then re-run with `--signature 0x... --deadline T`.
3. **In-swap bind, on the first FLASH swap:** put the signature in the RC hop's `hookData`:
   ```
   hookData = BIND_MAGIC ++ abi.encode(address account, uint64 code, uint256 deadline, bytes sig)
   BIND_MAGIC = 0x64dc7253   (rcHook.BIND_MAGIC(), = bytes4(keccak256("FlashReferral.bind(address,uint64,uint256,bytes)")))
   ```
   Add 88,000 gas to the FLASH swap constant. Quote with the same hookData to see the 1.69% price. CLI: `swap --market FLASH ... --ref-code N --ref-signature 0x... --ref-deadline T`.

Simulate a bind before sending it. It reverts with `AlreadyBound()`, `InvalidCode()`, `SelfReferral()`, `SignatureExpired()`, `InvalidSignature()`, `NotDeployed()` (undeployed smart wallet) or `ForbiddenFactory()`.

### Claiming referral earnings

`registry.claim()`, selector `0x4e71d92d`, takes no arguments and returns `(ethPaid, tokenPaid)`. It pays the caller's bucket in ETH and FLASH. 33% cascades one level up the referral chain, and ROOT's share auto-sweeps to the treasury. A claim with nothing to pay does not revert. It still costs gas, and it **does** enter or re-rank the wallet on the top-100 board: the board only updates inside `claim()`. CLI: `referral-claim --wallet W`.

### Top-100 board

The unreferred fee's 4.14% and a share of sell taxes fill the top-100 pool. Payouts are weighted by rank (#1 gets 6.9x what #100 gets). `distributeTop100()` (selector `0x75433fed`, permissionless) pays the pool out once it holds at least the airdrop threshold. A ranked claim also triggers it. CLI: `referral-distribute --wallet W`.

### Active buckets

All rewards are shares of one ETH+FLASH pool, so a claim pays a mix of both. It buys FLASH inside sells and sells FLASH inside buys when impact exceeds 1% and price has crossed the 30-minute slow EMA (`bucketFillParams` = 100, 5000, 1800). Limits: 50% of the swap, 10% of the pool per swap, 20% per block. Rewards are market-exposed, with no opt-out. A sell filled by buckets earns up to 10% of its sell taxes back. Quotes include these fills. Reads: `activePool()`, `fillCapacity()`, `buyFillCapacity()`, `bucketDetail(account)`.

### Dormancy

After 180 days with no own claim, the protocol owner can call `recoverDormant(user, to)` and send your bucket to `to`. The 33% cut still applies. Your own `claim()` resets the clock. Read `dormantSince(account)` -> `(lastActivity, recoverableAt)`.

### Codes and the board

With no code, the app binds code #2, held by the protocol wallet `0x3Cc4F0CA3476996815cb5D6F86B97e83aB74578d`. Your own code is issued on a referred FLASH buy of at least the threshold, measured on the FLASH/ETH hop, so pay routes count, and a bind in the same swap counts.

Board score is lifetime ETH earned, frozen until your own `claim()`. Share = `round(1e6 * 6.9^((100-rank)/99))` / sum of weights, so #1 of 100 gets 2.25%. A distribution credits direct shares to board accounts, and you still call `claim()`. The top 100 is also funded by 10% of buyback FLASH. Only referral shares cascade 33%; top-100 airdrops and `depositFor` credits do not. A zero claim enters or re-ranks you only if lifetime ETH earned is above 0, and on a full board the score must also beat the current minimum.

`cancelBindSignatures()` `0xaaca60e8` burns your bind nonce. `claimFor(account)` `0xddeae033` is callable only by the account or the owner.

## King of the Hill (KOTH)

A jackpot game on FLASH buys. 0.69% of referred volume and 0.9% of unreferred volume (plus part of the taxes) flow into KOTH.

**Income:** 0.69% referred or 0.90% unreferred fee, 31% of rolling tax, 23% of impact tax. ETH: 31% to the leader, 69% to the pot, 100% to the pot with no leader. FLASH: 31% into the leader's 3 churn positions (25% full range, 25% just above price, 50% at 2x), the rest into KOTH's own positions, whose ETH joins the pot.

**Outbid:** you are paid at once (held ETH, plus converted ETH and unsold FLASH). The dethroning trade still credits you.

**Forfeit:** a sell before expiry hands everything to the protocol, which takes the throne. The clock restarts and the trigger is unchanged. A sell at or after expiry does not forfeit.

**Contract wallets:** ETH pushes use fixed gas (50,000). A wallet that cannot receive within that loses the payout to the treasury.

**Rules** (read the live values from `koth.game()`):

- **Take the throne:** make one FLASH buy whose **gross ETH input** is at least `koth.nextTrigger()`. It counts before fees and before any churn fill. A pay route (USDC -> ETH -> FLASH) counts: the bid is the ETH volume of the FLASH/ETH hop.
- **The trigger** starts at `startBid` (0.001 ETH). Each new king raises it by `incrementBps` (1000 = 10%) from the **trigger**, not from the bid size, so a huge buy only advances it one step. A leader can overtake themselves: a new qualifying buy restarts their clock.
- **While leading**, the leader earns 31% of KOTH inflows, held for them as `held` plus a FLASH churn position. The other 69% grows the `pot`.
- **Winning:** hold for `duration` seconds (60) with nobody out-buying you. The round pays out in **ETH** on the next trade, or when anyone calls `koth.settle()` (selector `0x11da60b4`, permissionless, reverts `NotExpired()` early). The winner gets 69% of the pot plus their held share. 31% goes to the protocol. The round then resets to `startBid`.
- **Selling FLASH while leading forfeits** the leader's share to the protocol owner, who takes the leader's place.
- No claim transaction is needed: payouts happen in-swap.

`koth.game()` returns `(round, leader, leaderBid, trigger, since, expiresAt, held, pot, duration, incrementBps, startBid)`. Use `expiresAt - now` for seconds left (0 = no leader). `koth.totals()` returns `(ethIn, churnEth, flashIn, flashToChurn, revShareIn)`. API: `GET /v1/stack/koth`, `GET /v1/stack/koth/history?limit=30`.

CLI:
- `koth-status`
- `koth-buy --wallet W [--amount ETH]`: an exact-in ETH buy of the trigger rounded up to 6 decimals, or more.
- `koth-settle --wallet W`

A throne buy is a normal FLASH buy (see [TRADING.md](TRADING.md)) with the 3.2M gas constant. Remind the user that the 6.9% / 1.69% fee applies and that a sell while leading forfeits.
