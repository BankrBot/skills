# Bookrunners: crediting Bankr for what its users do on Borro

Bookrunners is Borro's integrator program (https://borro.markets/bookrunners). A registered code earns a share of
Borro's own fee on what its users do; the users pay nothing extra and earn exactly what they would without it.

## Terms, as Borro publishes them

- **Deposits.** For each deposit made through BorroBuilders with the code, the code's payee gets 100% of Borro's fee on
  what that deposit earns (lending fees on stock, interest on USDG) for the deposit's first 12 months, then 50% for as
  long as it stays.
- **Borrowing and shorts.** A wallet that has signed a binding to the code (below) credits it with Borro's fee on the
  interest that wallet pays: its USDG loans and the stock its shorts borrow. All of it for 12 months from the
  signature, half after.
- Paid monthly in USDG to the code's payee, for every month in which at least $1 is owed. Nothing is promised: if
  nobody borrows, there is no fee to share.
- The public statement of every code (what it brought, earned and was paid) is `https://borro.markets/builders.json`
  (`node borro.mjs read bookrunners`).
- The depositor keeps the vault shares, its lending fees and its own $BORRO Drip in full.

## Is the code usable?

`node borro.mjs code bankr`

- `use: true` only when the code is registered and BorroBuilders shows the payee pinned for it in
  known-contracts.json (`bookrunner.payee`). `lend --code` and `bind` refuse anything else with `CODE_NOT_PINNED`.
- Codes are first come, first served and anyone can register one, so a registered code is not enough: a code with
  another payee would send Borro's fee to whoever registered it. The pin is what makes the code Bankr's.
- `registered: false`: nobody has registered `bankr` on BorroBuilders, and a deposit with it would revert
  (`NotRegistered`). As of 2026-10-24 `bankr` is not registered and no payee is pinned, so the skill lends with
  `plan supply`. The pin is set in an update of this skill once Bankr's payee wallet is agreed.
- A code is registered by calling `BorroBuilders.register(bytes32 code)` from the wallet that will be paid; first come,
  first served; only that payee can later move it with `setPayee`. This skill never registers a code.

## Which vaults take bookrunner deposits

BorroBuilders accepts deposits into the vaults its owner (Borro's multi-signature wallet) has listed. Checked on chain on
2026-10-24 (`BorroBuilders.vaults(vault)`): USDG and SPY, QQQ, NVDA, TSLA, MSTR, COIN, PLTR, SPCX, GME are listed;
**AAPL, GOOGL and MSFT are not**, and a deposit into them through BorroBuilders reverts `BadVault`. The script refuses
those with `VAULT_NOT_LISTED`; lend them with `plan supply`. `known-contracts.json` carries `bookrunner_deposits` per
stock, and `lend` re-checks the chain when `BORRO_RPC_URL` is set.

## How `lend --code` builds the deposit

1. Asks Borro's MCP for the plain deposit of the same amount (`supply`): this caps the amount to what the wallet holds,
   names the vault and the token, and simulates it from the wallet. The script checks all three against the pins.
2. Reads `previewDeposit(assets)` on the vault, from `BORRO_RPC_URL` (one Multicall3 call with `builders(code)` and
   `vaults(vault)`), or takes it from `--preview-shares`. The minimum is that less half a percent, as Borro's own site
   does.
3. Builds two calls: `approve(BorroBuilders, assets)` on the token, then
   `BorroBuilders.deposit(vault, assets, code, minShares)`. BorroBuilders pulls the token, deposits it into the vault in
   the caller's name, checks the shares against the minimum and emits `Referred(code, who, vault, assets, shares)`. It
   holds nothing between transactions.
4. With `BORRO_RPC_URL`, simulates both calls in order from the wallet with `eth_simulateV1` and decodes any revert
   (`BadVault`, `NotRegistered`, `TooFewShares`).

Without `BORRO_RPC_URL`, read the preview through Bankr ("Read previewDeposit(uint256) on <vault> on Robinhood Chain
with <assets>", the exact sentence is in the `NEED_PREVIEW` answer) and pass the raw number as `--preview-shares`.
`bUSDG` and the stock vault shares have 18 decimals; 0.3 USDG previewed 299,991,386,151,830,374 shares on 2026-10-23.

Taking it back is a plain `plan withdraw`: the shares are in the user's wallet.

## Crediting borrowing and shorts: `bind`

1. `node borro.mjs bind --wallet W --code bankr` returns EIP-712 typed data (domain "Borro Builders", version 1,
   chainId 4663; statement "Credit my Borro borrowing to builder code bankr"), good for 10 minutes, and `bankr_sign`,
   the `/wallet/sign` body.
2. Sign it with Bankr: `POST /wallet/sign` with `signatureType: "eth_signTypedData_v4"`. No gas, nothing moves.
3. `node borro.mjs bind --wallet W --code bankr --signature 0x... --timestamp T` submits it (the same as
   `POST https://borro.markets/builders/bind`).

One code per wallet: the first binding stands. Borro accepts only a signature from the wallet's own key. Ask the user
once; a "no" never stops a trade.
