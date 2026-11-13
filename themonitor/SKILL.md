---
name: themonitor
description: Monitor, autonomous trading intelligence on Elysium (Kinetiq's chain, id 99901), app at app.themonitor.bot. It watches every block, waits for confluence among the strongest on-chain wallets and trades from the user's own smart account. Use when the user wants Monitor to trade part of their HYPE on Elysium, check the status or P&L of that account, sell a position, add funds, stop and withdraw everything, or revoke its permissions. The funds sit in the user's own smart account; the Bankr wallet signs scoped, time-limited permissions and sends one deposit transfer.
tags: [trading, autonomous-trading, smart-money, elysium, hype, defi]
version: 1
metadata:
  clawdbot:
    homepage: "https://app.themonitor.bot/app/"
    requires:
      bins: [curl, jq]
      packages: [viem@2.57.16]
---

# Monitor on Elysium

Monitor (https://themonitor.bot, app at https://app.themonitor.bot/app/) is an autonomous trading agent on the Elysium chain (id 99901, gas coin HYPE). It watches every block, tracks the strongest on-chain wallets, waits for confluence and trades from the user's own smart account, with a per-trade size the user picks. The fee is 15% (Balanced) or 20% (Aggressive) of profit above the account's high-water mark, taken when money is withdrawn. No performance is promised: these are new, unvalidated wallets on a young chain, and meme-coin trading can lose most of the money put in.

## What the user is agreeing to

- **Non-custodial.** Funds are held by a smart account that the user's wallet owns. Monitor cannot move them except within the permissions below.
- **Four permissions, each an EIP-712 signature by the user's wallet** (about one year, then they must be renewed):
  1. `swap`: Elysium's server key may call only `buy` and `sell` on one guarded swap contract (`0x795f8ff1d458a168b78e3c37c028fb834d1146d5`), up to a per-call value cap and a 24-hour cap, and a fixed number of calls. The contract pays swap output only to the user's account.
  2. `approve`: the same key may approve token spending, with the spender fixed to that contract.
  3. `withdraw`: the key may send native HYPE out of the account **only to the user's own wallet address**.
  4. `feegas`: the key may pay the performance fee and a gas refund, **only to the fee address** (`0x509c3978687c9fb3e94a11b84703796f75f51588`), up to a cap.
- The user can stop at any time (agents stop, positions are sold, cash is withdrawn to the Bankr wallet), and can revoke the permissions on chain from their own wallet (Step 9). Withdrawals are sent by the Elysium server; if it is unreachable, say so and tell the user to retry later.
- The agent must never ask the user to sign or send anything other than what is described in this file.

## Requirements on the Bankr side

1. A Bankr API key with Wallet API enabled and read-only off.
2. **Arbitrary contract calls must be switched on** (Bankr security settings, needs MFA). Without it `/wallet/sign` refuses typed data (error `MFA_REQUIRED` or 403). Suggest the 10-minute to 24-hour timer so it switches itself off afterwards. **Permitted recipients must be off** while signing, otherwise typed data is refused too.
3. HYPE in the Bankr wallet **on Elysium** (not HyperEVM). Bankr can bridge HYPE HyperEVM -> Elysium in chat. The deposit amount plus about 0.01 HYPE for gas must be there. Gas is paid by the wallet and is never sponsored.
4. Name the chain every time: "Elysium", chain id 99901. Never default to HyperEVM (chain 999).

## Constants

| Item | Value |
|---|---|
| API base | `https://app.themonitor.bot/api` |
| Chain id | 99901 (RPC `https://rpc.agoradex.app`, `https://rpc-live.elysp.com`) |
| Delegation manager (typed-data `verifyingContract`) | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| Executor (typed-data `delegate`) | value of `executor` in `/live/state` (production: `0x7Fea74C5eB9acaeFd7fC2f9c627b5d286E134940`) |
| Guarded swap contract | `0x795f8ff1d458a168b78e3c37c028fb834d1146d5` |
| Fee address | `0x509c3978687c9fb3e94a11b84703796f75f51588` |
| Per-buy size limits | 0.0145 HYPE (about $1) to 145 HYPE |

Every request is `POST` with `Content-Type: application/json` unless marked GET. Send the header `X-Elysium-Client: bankr` on every call. After sign-in also send `Authorization: Bearer <token>`. Keep the token in memory for the conversation only and never print it. All amounts in the API are HYPE (fields are named `*_eth`), decimal strings or numbers.

If any call answers `403 Request not allowed from this page.`, the agent access is not enabled on the server yet: tell the user and stop.

## Step 0. Look around (public, no sign-in)

- `GET /api/status` -> `{chain: 99901, traders}`.
- `GET /api/ethusd` -> `{usd}` is the HYPE price in USD. If it has `stale: true` and `age` over 300, do not move money.
- `GET https://app.themonitor.bot/app/strategies.json` -> `strategies[]` with `id` (`elite` = Aggressive, 20% fee, 7% of the account per buy; `wave` = Balanced, 15% fee, 5% per buy), `leaders[]` (ids like `E4`), `ticket_pct`, `take_x`, `status`, `bt`. Read `status` and `bt` and tell the user what they say (at the time of writing: dry-run, no backtest, forward validation required).
- `GET /api/leaders` -> map of leader id to `{short, verdict, note}`. Drop any leader whose `verdict` is `reject`.
- `GET /api/balance/{address}` -> `{eth}` native HYPE balance of any address on Elysium.

## Step 1. Plan with the user (nothing signed yet)

Ask for: strategy (`wave` or `elite`), amount to put in (HYPE or USD), and confirm the per-buy size. Default per-buy = `ticket_pct`% of the amount, clamped to 0.0145..145 HYPE. Show: amount, per-buy size, fee percent, the four permissions above, that the first signature creates the account record, and the risk sentence. Ask for an explicit "yes". Tell the user that the signed per-buy ceiling will be shown before signing and can be larger than the per-buy size. The amount and per-buy size set the caps inside the permissions, so decide them now: `caps = {"amount_eth": <amount>, "ticket_eth": <per-buy>}`.

## Step 2. Sign in and sign the first permission

Let `ME` = the Bankr wallet's EVM address (lowercase). It must hold the HYPE on Elysium.

**New wallet (the first permission is also the sign-in):**

1. `POST /api/live/prepare` body `{"kind":"swap","address":ME,"mode":"sa","opt":caps}` -> `{kind, typedData}`.
   - `401 Connect your wallet first.` means this wallet already has an account: go to "Returning wallet" below.
   - `403 The live beta is full right now.`: tell the user, stop.
2. Run the checks in "Checking a permission" on `typedData` (the delegator is not yet comparable to a server-reported account, so compute it with `scripts/verify-account.mjs ME` and require delegator = that address).
3. Show the user what is being signed (kind `swap`, the exact limits printed by the check, expiry) and ask for confirmation of those numbers.
4. Sign with the Bankr wallet: `POST https://api.bankr.bot/wallet/sign` (header `X-API-Key`) body `{"signatureType":"eth_signTypedData_v4","typedData": <typedData with types.EIP712Domain removed>}` -> `{signature}`. (CLI: `bankr wallet sign --type eth_signTypedData_v4 ...`.)
5. `POST /api/live/submit` body `{"kind":"swap","address":ME,"signature":SIG}` -> `{ok:true, kind, token}`. Keep `token`.

**Returning wallet (account exists, no token):**

1. `POST /api/auth/nonce` `{"address":ME}` -> `{nonce, message}`.
2. Sign `message` exactly as given (including line breaks) with `signatureType: "personal_sign"`, `message: <message>`. This message moves nothing.
3. `POST /api/auth/verify` `{"address":ME,"nonce":NONCE,"signature":SIG}` -> `{address, token}`.

## Step 3. Create the account and sign the rest

1. `POST /api/live/state` `{}` -> note `account` (the smart account address), `deployed`, `executor`, `to_sign`, `mode` (must be `"sa"`), `swap_cap_eth`.
2. Run `node scripts/verify-account.mjs ME` and require the printed address to equal `account`. If not, stop and tell the user: nothing may be sent to that address.
3. If `deployed` is false: `POST /api/live/deploy` `{}` -> `{ok:true}` (Elysium's server pays for deployment). Then `state` again.
4. For each `kind` in `to_sign` (for a fresh account: `approve`, `withdraw`, `feegas`; `swap` is already done):
   - `POST /api/live/prepare` `{"kind":kind,"opt":caps}` -> `{typedData}`.
   - Run the check, show the user the printed limits, get confirmation (you may group the remaining ones in one confirmation, but list each with its limits).
   - Sign as in Step 2, then `POST /api/live/submit` `{"kind":kind,"signature":SIG}` -> `{ok:true}`.
5. `state` again. `to_sign` must be empty. Do not sign `exit` or `exit_approve` (optional cold-key permissions; skip them).

### Checking a permission before the wallet signs it

Save the `typedData` from `prepare` to a file and run:

```
node scripts/check-permission.mjs KIND typedData.json ME ACCOUNT AMOUNT PER_BUY
```

(`ACCOUNT` = `account` from `state`, or the address computed in Step 2; `AMOUNT` and `PER_BUY` = the amount and per-buy size the user agreed in Step 1.) If it prints `STOP: ...`, do not sign: tell the user the reason and stop. The script refuses unless all of this holds:

- `domain` is `DelegationManager` v1, `chainId` 99901, `verifyingContract` = the delegation manager above; `primaryType` is `Delegation`; `delegator` = `ACCOUNT`; `delegate` = Monitor's executor key; `authority` = root (`0xff..ff`).
- The caveats are **exactly** the expected set for the kind, each identified by its pinned enforcer address on Elysium (nothing missing, nothing extra, no duplicates, no `args`), and each `terms` matches Monitor's encoding byte for byte:
  - `swap`: AllowedTargets = exactly the guarded swap contract; AllowedMethods = exactly `buy` and `sell` (`0xf496a610`, `0x3581f5bb`); ValueLte (per-buy cap); NativeTokenPeriodTransfer with a 24-hour period; LimitedCalls; Timestamp.
  - `approve`: AllowedMethods = exactly `0x095ea7b3`; AllowedCalldata = exactly 64 bytes, **offset 4** followed by the guarded swap contract padded to 32 bytes (so the bound argument is the spender, not the amount); ValueLte = 0; Timestamp.
  - `withdraw`: ExactCalldata empty (plain transfers only); AllowedTargets = exactly `ME`; NativeTokenTransferAmount; Timestamp.
  - `feegas`: same as `withdraw`, but AllowedTargets = exactly the fee address.
  - Timestamp: valid from now until a date at most 400 days away.
- For `swap`, the per-buy cap is not below the agreed per-buy size.

On success the script prints the decoded limits. **Show these exact numbers to the user and get an explicit "yes" for them before signing**, in particular for `swap`:

- `max_per_buy_hype`: the most a single buy can spend. Monitor sets this ceiling from the plan, not from the per-buy size, so it is usually larger than the per-buy size (`per_buy_cap_vs_agreed` times larger) and can be the whole deposit (`per_buy_cap_covers_whole_deposit: true`). Say it plainly, e.g. "This permission lets Monitor spend up to 2 HYPE in one buy, which is your whole deposit; Monitor's own size is 0.1 HYPE per buy, but the signature does not enforce that smaller size."
- `max_per_24h_hype` and `max_calls`: the 24-hour spending ceiling and the total number of swap calls.
- For `feegas`, `max_total_hype` is the most that can ever be paid to the fee address; for `withdraw`, money can only go to the user's own wallet.

If the user does not accept a ceiling, do not sign. Run the same check every time a permission is renewed or replaced (Step 5, Step 7). Only these kinds are ever requested: `swap`, `approve`, `withdraw`, `feegas`. The only other typed data the agent ever signs is the revoke `PackedUserOperation` in Step 9, after the checks listed there.

## Step 4. Deposit

Only after Step 3 is clean and the user confirms the exact amount and the destination `account`:

- Send the amount as native HYPE **on Elysium (chain id 99901)** from the Bankr wallet to `account`. Either use Bankr's normal transfer ("send X HYPE on Elysium to ACCOUNT"), or the raw call: `POST https://api.bankr.bot/wallet/submit` body `{"transaction":{"to":ACCOUNT,"chainId":99901,"value":"<wei>"},"description":"Deposit to Elysium account","waitForConfirmation":true}`. Plain transfer, no calldata; gas is about 21,000 to 100,000 (under the 3,000,000 limit) and costs a fraction of a cent in HYPE.
- Poll `POST /api/live/state` every 3 s for up to 2 minutes until `deposits_eth` has grown by the amount. If it has not, do not resend; tell the user and check the transaction hash.

## Step 5. Start Monitor

`POST /api/live/follow`:

```json
{"leaders":["E2","E3"],"custom":[],"ticket_eth":0.05,"active":true,"take_x":2,"strat":"wave"}
```

`leaders` and `take_x` come from the chosen strategy; `ticket_eth` must be at most what the `swap` permission allows (`swap_cap_eth` in `state` is the per-call cap; keep `ticket_eth * 1.15` below it, otherwise sign a new `swap` permission with a larger `opt.ticket_eth` first, after running the check on it and getting the user's yes for its limits). The reply is the new state: `follow.active` must be true. Report: strategy, number of leaders, per-buy size, account address.

## Step 6. Check status and P&L

**Always read the account from Elysium, never from Bankr's own portfolio or token balances.** Most tokens on Elysium have no price in Bankr, so a balance view misses open positions and shows a loss that is not there. In a new conversation there is no token yet: sign in again with the existing-wallet flow in Step 2 (one `personal_sign`, moves nothing), then:

`POST /api/live/state` `{}`. Report in HYPE and USD (price from `/api/ethusd`):

- Value now: `equity_eth` (free cash `eth` + open positions `positions_eth`).
- Put in: `deposits_eth`; taken out: `withdrawn_eth`. Result = `equity_eth + withdrawn_eth - deposits_eth`.
- `realized_eth`, `fees_eth` (fee paid so far), `fee_pct`, `gas_paid_eth`.
- `positions[]`: `sym`, `cost_eth`, `value_eth`, `lid` (which trader), `token`.
- `trades[]`: latest buys and sells, each with `kind`, `sym`, `eth`, `t` (ms), `pnl_eth` on sells.
- `follow.active`, `perm_expires` (unix seconds), `renew_soon`. If `renew_soon` is true or `to_sign` is not empty, offer to renew: repeat the Step 3 signing loop.
- `stale: true` means the server returned a cached snapshot; say so.

## Step 7. Sell, add, change

- Sell one position: `POST /api/live/sell` `{"token":"<token address from positions>"}` -> job, then poll (below). Confirm with the user first.
- Add to a position from free cash: `POST /api/live/add` `{"token":TOKEN,"eth":"<HYPE>"}` -> job, poll. The free cash must cover amount plus 0.0003 HYPE.
- Add funds: repeat Step 4. Per-buy size does not change by itself; offer to raise it (Step 5 again; a larger size can need a new `swap` signature as noted).
- Pause or resume trading: `follow` again with `active:false` or `active:true` and the same other fields.

**Job polling.** `sell`, `add`, `sellall` and `withdraw` return at once and run in the background. Poll `POST /api/live/job` `{}` every 3 s, for up to 3 minutes, until `done` is true. `error` set means it failed (show the text, do not retry blindly). For `sellall` the result is `{sold:[{sym, why?}]}`; an item with `why` was not sold. For `withdraw` the result is `{ok:true}`.

## Step 8. Stop and withdraw

Show the user what will happen and ask for confirmation, then:

1. `POST /api/live/follow` `{"leaders":<current follow.leaders>,"ticket_eth":<current follow.ticket_eth>,"active":false,"take_x":<current>}`.
2. `POST /api/live/sellall` `{}`, poll the job. If some items have `why`, tell the user which could not be sold; they stay in the account and the step can be repeated later.
3. `state`; if `eth` > 0: `POST /api/live/withdraw` `{"amount":"all"}` (or a decimal HYPE amount for part of the free cash), poll the job. A performance fee on profit above the high-water mark is taken first; `fees_eth` shows it.
4. The HYPE arrives in the Bankr wallet on Elysium. `state` again and report the amount actually sent: `withdrawn_eth` (already after the fee) and the fee `fees_eth`, not the account value before the fee. Check the wallet with `GET /api/balance/ME`. Moving it back to HyperEVM is Bankr's own bridge, and the exit from Elysium takes about 6 days.

Optionally `POST /api/logout` `{}` (with the bearer header) to end the session.

## Step 9. Revoke the permissions (optional, on chain)

Stopping (Step 8) already ends trading. If the user also wants the four permissions cancelled on chain, so that nothing can ever act on the account again, the user's own wallet does it. This is one EIP-712 signature and one transaction sent by the Bankr wallet; nothing is handed out signed-but-unsent. The account can be empty; the wallet pays the gas of its own transaction (a fraction of a cent in HYPE).

1. `POST /api/live/delegations` `{}` -> `{account, delegation_manager, delegations}`. Save it as `delegations.json`.
2. `node scripts/revoke.mjs prepare ME delegations.json`. The script checks that `account` is owned by `ME`, that every permission belongs to that account, and which ones are still active, then prints `summary` and `typedData`. Stop if it prints `STOP`.
3. Check `typedData` before signing: `domain.name == "HybridDeleGator"`, `domain.chainId == 99901`, `domain.verifyingContract == account`, `primaryType == "PackedUserOperation"`, `message.sender == account`, `message.entryPoint == 0x0000000071727De22E5E9d8BAf0edAc6f37da032`, `message.gasFees` and `message.paymasterAndData` empty (zero). Show the user `summary.to_revoke` and ask for confirmation.
4. Sign with `POST https://api.bankr.bot/wallet/sign` `{"signatureType":"eth_signTypedData_v4","typedData":<typedData>}` -> `SIG`.
5. `node scripts/revoke.mjs tx ME SIG`. The script checks that `SIG` was made by `ME` and simulates the transaction, then prints `transaction` (`to` is the EntryPoint, `chainId` 99901, `value` 0) and `estimated_gas` (well under 1,000,000).
6. Send it with `POST https://api.bankr.bot/wallet/submit` `{"transaction":<transaction>,"description":"Revoke Elysium permissions","waitForConfirmation":true}`.
7. `node scripts/revoke.mjs check ME delegations.json` must show `revoked: true` for every permission. Tell the user it is done. To use Elysium again later, the user simply signs new permissions (Step 3).

## Errors

| Response | Meaning and action |
|---|---|
| 401 `Connect your wallet first.` | No or expired token. Step 2. |
| 403 `Request not allowed from this page.` | Agent access not enabled server-side. Stop. |
| 403 `The live beta is full right now.` | Tell the user, stop. |
| 429 | Rate limit (10 first-permission calls, 20 nonces, 30 verifications per minute per caller IP). Wait 60 s once, then stop. |
| 400 with a short sentence | Show the sentence. Do not retry money steps blindly. |
| 400 `Something went wrong. Try again in a minute.` | Generic server error; retry once after a minute. |
| 503 `Trading service is not reachable` | Retry later. Funds are not affected. |
| Bankr 403 `MFA_REQUIRED` / `Arbitrary contract calls disabled` | Ask the user to enable contract calls in Bankr security settings. |
| Bankr `insufficient_funds_for_gas` | Wallet needs more HYPE on Elysium. |
| `signed` or `to_sign` still lists a kind after submit | Repeat prepare and sign for that kind once. |

## Rules for the agent

- Always show amounts (HYPE and USD) and the destination, and wait for an explicit yes before every signature and every transaction.
- Never send funds anywhere except the verified `account`. Never sign a permission that fails the checks.
- Do not call `/api/live/fee` or the optional `exit` permissions.
- Do not give financial or tax advice. Say plainly that returns are not guaranteed and the strategies are unvalidated.
- Do not quote a "typical return"; use only what `state` and `strategies.json` report.
