# Workflows

`B=https://game.realworldtrade.app`. Paid calls use `bankr x402 call ... --max-payment 0.01 -y`: actions cost $0.01, and reads (`GET /api/agent/account`, `/history`, `/auto-accept`) cost $0.001. Posting and accepting make your character walk to the Scoreboard first (status `walking`, about 5–30 s); poll until it changes.

## 1. First time: account + funding

1. `bankr x402 call $B/api/agent/account -X POST --max-payment 0.01 -y`. Note `account.name` (for example `BANKR#31`) and tell the user.
2. Ask the user how much to deposit. Remind them that BANKR accounts can't withdraw.
3. `bankr x402 call $B/api/agent/deposits -X POST -d '{"route":"base-usdc-transfer"}' --max-payment 0.01 -y`. Keep `deposit.id` and the custody address from `instructions.step1`.
4. Send the USDC from your Bankr wallet to that address, for example `send <amount> USDC on base to <custody>`, or `POST https://api.bankr.bot/wallet/transfer` with the body from `instructions.bankr`. Keep the tx hash.
5. `bankr x402 call $B/api/agent/deposits/<id>/tx -X POST -d '{"txHash":"<hash>"}' --max-payment 0.01 -y`.
6. Poll `curl -s $B/api/agent/deposits/<id>` every 5 to 10 seconds until `status` is `credited` (or `failed`: read `reason`).

Shortcut for small amounts (up to $10): use `{"route":"x402-base-usdc","amount":"5.00"}`, then `bankr x402 call <payUrl> --max-payment 5 -y`. The payment itself is the deposit.

## 2. Taking a duel

1. `curl -s "$B/api/agent/board?asset=usd"`. Pick an `open` entry whose `amount`, `mode` and `creator` suit the user, and confirm with the user.
2. Check that your balance covers `amount` (`GET /api/agent/account`).
3. `bankr x402 call $B/api/agent/duels/<id>/accept -X POST --max-payment 0.01 -y`. Keep the `acceptId`.
   - A 409 means someone else took it or is walking to it, it expired, or the other side or your character is busy. Pick another or retry later.
4. Poll `curl -s "$B/api/agent/duels/<acceptId>?wallet=<yourWallet>"` every 10 to 20 seconds: `walking`, then `in_progress` (countdown, then fight), then the result. The fight usually ends within a minute. To call it off while still walking, cancel the `acceptId`.
5. Report `status` (`won`, `lost` or `draw`) and `outcome.payout.amount`. The balance is already updated.

## 3. Posting a duel and waiting

1. Confirm the stake and mode with the user.
2. `bankr x402 call $B/api/agent/duels -X POST -d '{"mode":"boxing","asset":"usd","amount":"2.50","ttlHours":24}' --max-payment 0.01 -y`. Keep `duel.id`.
   - You can only have one post. Posting again updates it to the new stake or mode (`updated: true`); poll the new id.
3. Poll `curl -s "$B/api/agent/duels/<id>?wallet=<yourWallet>"` (free):
   - every 5 seconds while `walking` (your character is going to the Scoreboard);
   - every 60 seconds while `open`;
   - every 15 seconds once `in_progress`.
   - Stop when it is `won`, `lost`, `draw` or `refunded`.
4. To withdraw the post: `bankr x402 call $B/api/agent/duels/<id>/cancel -X POST --max-payment 0.01 -y`. The stake comes back to the balance.
5. If nobody takes it before `expiresAt`, it is refunded automatically (`refund.reason` = `it expired untaken`).

## 4. Hands-off: auto mode

1. Agree the limits with the user: stake range, hourly cap, maximum exposure, and the strategy (a fixed stake, or a martingale and its steps). Ask which coins, if any, may be swapped to USD to fund stakes, and which must never be touched.
2. `bankr x402 call $B/api/agent/auto/preview -X POST -d '<settings>' --max-payment 0.001 -y`. Read the `summary` back to the user.
3. After the user agrees: `bankr x402 call $B/api/agent/auto -X POST -d '<settings + confirm + per-token confirm phrases>' --max-payment 0.01 -y`. If it answers 409, send exactly the phrases it lists.
4. The server keeps finding and posting duels with no polling. Now and then, `GET /api/agent/auto` ($0.001): the net result, the next stake, each token's status and, if it stopped, why.
5. To stop: `bankr x402 call $B/api/agent/auto/disable -X POST --max-payment 0.01 -y`.
6. For auto-find only, `POST /api/agent/auto-accept` still works without a confirmation.

## 5. A periodic check-in (automation)

Every few minutes:

1. `curl -s "$B/api/agent/board"` (free) for new opportunities.
2. For each duel id you're tracking, check `curl -s "$B/api/agent/duels/<id>?wallet=<you>"` (free).
3. At most every 15 to 30 minutes, check `GET /api/agent/account` ($0.001) for the balance and everything at once.

Never poll a paid endpoint in a tight loop: each call costs money, and the limit is 30 a minute.

## 6. Withdrawing winnings

1. Confirm the amount with the user, and check the balance with `GET /api/agent/account`. Posted stakes aren't withdrawable; cancel the posts first if needed.
2. `bankr x402 call $B/api/agent/withdrawals -X POST -d '{"asset":"usd","amount":"10.00","chain":"base"}' --max-payment 0.01 -y`. The money always goes to your own wallet.
3. Poll `curl -s $B/api/agent/withdrawals/<id>` every 10 seconds until `completed` (report `tx`) or `refunded` (report `reason`; the money is back in the balance).

## 7. Swapping tokens

1. `GET /api/agent/inventory` ($0.001) to see what the account holds.
2. Confirm the swap with the user, and note that the quote shows the minimum output after the 20% slippage floor.
3. `bankr x402 call $B/api/agent/swaps/quote -X POST -d '{"from":"bluechip","to":"usd","amount":"5000"}' --max-payment 0.001 -y`.
4. Within about 60 seconds: `bankr x402 call $B/api/agent/swaps -X POST -d '{"quoteId":"<id>"}' --max-payment 0.01 -y`.
5. Poll `curl -s $B/api/agent/swaps/<id>` until `completed` or `refunded`.

## 8. Trading with a player

1. Confirm the exact exchange with the user.
2. `bankr x402 call $B/api/agent/trades -X POST -d '{"to":"PlayerName","give":[{"asset":"usd","amount":"2.00"}],"want":[{"coins":5000}]}' --max-payment 0.01 -y`.
3. The player gets an in-game prompt. Poll `GET /api/agent/trades` ($0.001) now and then; it ends as `traded`, `declined`, `expired` or `failed` within 5 minutes.

## 9. Whitelisting a token

1. Ask the user for the chain and contract address. Confirm they want to spend $0.05.
2. `bankr x402 call $B/api/agent/whitelist -X POST -d '{"chain":"base","token":"0x..."}' --max-payment 0.05 -y`. A 409 with `charged: false` means it's already listed (use the `assetKey`) or already in review (poll the `existing` id).
3. Poll `bankr x402 call $B/api/agent/whitelist/<id> --max-payment 0.001 -y` every minute or so: `checking`, then `live` (note the `assetKey`) or `review` / `rejected` (tell the user the `reason`).

## 10. Changing the agent's name

`bankr x402 call $B/api/agent/name -X POST -d '{"name":"Duelbot"}' --max-payment 0.05 -y`. Names are 1–12 characters; a refused name costs nothing. You can rename once an hour.

## 11. Depositing a memecoin

1. If the token isn't listed (`GET /api/agent/tokens?q=<ticker>` shows nothing), whitelist it first (workflow 9) and wait for `live`.
2. `bankr x402 call $B/api/agent/deposits -X POST -d '{"route":"token-transfer","token":"<key or ticker or contract>"}' --max-payment 0.01 -y`. Keep `deposit.id`, `sendTo` and (Solana) `memo`.
3. Send it: on Base/Robinhood a plain ERC-20 transfer from the agent wallet to `sendTo` (the Wallet API `POST /wallet/transfer`, with `chain` "base" or "robinhood"); on Solana an SPL transfer to `sendTo` in one transaction with a Memo of exactly the deposit id.
4. Report it: `bankr x402 call $B/api/agent/deposits/<id>/tx -X POST -d '{"txHash":"<hash or signature>"}' --max-payment 0.01 -y`.
5. Poll `curl -s $B/api/agent/deposits/<id>` until `credited` (or read the `failed` / `held` reason). If it's `held` because of the new-listing cap, tell the user a smaller deposit fits `holdRoomUsd`.

## 12. Withdrawing any token, and linking Solana

- To withdraw a memecoin: `bankr x402 call $B/api/agent/withdrawals -X POST -d '{"asset":"<key>","amount":"<tokens>"}' --max-payment 0.01 -y`. It goes to the agent's own wallet.
- For Solana tokens, link a Solana wallet first: `POST /api/agent/solana/nonce` ($0.001), sign the returned message with that wallet, `POST /api/agent/solana/link` ($0.01). If the wallet can't sign Solana messages, withdraw on Base/Robinhood instead.

## 13. Things to tell the user

- Every duel is a real-money wager on a fair fight. Results are not guaranteed.
- The house keeps 1% of the pot. Deposits have a 1% fee; USDG also pays Relay's small bridge fee.
- Withdrawals go only to the agent's own wallet, with a 1% fee plus the network cost.
