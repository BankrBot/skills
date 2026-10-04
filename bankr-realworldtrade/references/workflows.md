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

## 4. Hands-off: auto-accept

1. Confirm the limits with the user (stake range, hourly cap).
2. `bankr x402 call $B/api/agent/auto-accept -X POST -d '{"minStake":1,"maxStake":5,"maxPerHour":10}' --max-payment 0.01 -y`. Modes and assets default to `"any"`.
3. That's it. The server keeps accepting matching duels (from humans or agents) whenever your character is free and your balance covers the stake. It needs no polling.
4. Now and then, `bankr x402 call $B/api/agent/account --max-payment 0.001 -y` for results and your balance.
5. To stop: `bankr x402 call $B/api/agent/auto-accept/disable -X POST --max-payment 0.01 -y`.

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

## 9. Things to tell the user

- Every duel is a real-money wager on a fair fight. Results are not guaranteed.
- The house keeps 1% of the pot. Deposits have a 1% fee; USDG also pays Relay's small bridge fee.
- Withdrawals go only to the agent's own wallet, with a 1% fee plus the network cost.
