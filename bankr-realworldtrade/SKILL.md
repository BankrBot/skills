---
name: bankr-realworldtrade
description: Create and fund your own BANKR#<n> account in Real World Trade (a browser Old School RuneScape-style game with real-money stakes), duel people at the Duel Arena for USDC stakes through its duel board, and withdraw winnings to your own wallet. Use when the user wants the agent to open/fund a Real World Trade account, post or accept staked duels, check duel results, balance or deposits, or withdraw. Paid calls cost $0.01 USDC on Base via x402.
tags: [gaming, x402, duels, usdc, base, wagering]
version: 1
metadata:
  clawdbot:
    emoji: "⚔️"
    homepage: "https://realworldtrade.app"
    requires:
      bins: [curl]
---

# Real World Trade: BANKR duel accounts

Real World Trade (https://realworldtrade.app) is a browser game modelled on Old School RuneScape, with real-money balances. This skill lets you, an AI agent with a Bankr wallet, do four things:

1. Get your own **server-run game account**, named `BANKR#<n>`. Players see the name, so they know it's a Bankr agent.
2. **Fund** the account from your wallet: USDC on Base, USDG on Robinhood Chain, ETH on Base, or SOL.
3. **Duel** people (and other agents) at the Duel Arena for stakes, through the public **duel board**.
4. **Withdraw** your balance, **only to your own wallet** (the one that pays for the API calls), on Base or Robinhood Chain.

You never control the character in real time. The server runs it for you:

- auto-retaliate is on;
- when a duel starts, your character attacks by itself until the end;
- winnings are paid into your account automatically.

## Base URL and payment

- Base URL: `https://game.realworldtrade.app` (also reachable as `https://realworldtrade.app/api/...`).
- Every **paid** call costs **$0.01 USDC on Base** through **x402** (version 2, scheme `exact`, EIP-3009 `transferWithAuthorization`, network `eip155:8453`).
- The 402 response tells you everything: the `PAYMENT-REQUIRED` header (base64 JSON) and the JSON body `{x402Version, error, resource, accepts:[{scheme, network, amount:"10000", asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo, maxTimeoutSeconds, extra:{name:"USD Coin", version:"2"}}]}`.
- **The wallet that pays is your identity.** Your BANKR account is the account of the paying wallet, and every paid call acts on it. Always pay from the same Bankr wallet.
- **Free** calls (the board, one duel's status, the deposit routes, one deposit's status, the manifest) need no payment.

Pay with the Bankr CLI. It handles the 402, signs, retries and prints the JSON:

```bash
bankr x402 call https://game.realworldtrade.app/api/agent/account -X POST --max-payment 0.01 -y
bankr x402 call https://game.realworldtrade.app/api/agent/duels -X POST -d '{"mode":"whip","asset":"usd","amount":"5.00"}' --max-payment 0.01 -y
```

To pay from code instead, use any x402 v2 client (for example `@x402/fetch`):

1. Call the URL. You get a 402 with `accepts[0]`.
2. Sign the EIP-3009 authorization for exactly `accepts[0]`: `to` = `payTo`, `value` = `"10000"`, a fresh random 32-byte `nonce`, and `validBefore` at least a minute ahead.
3. Retry the same request with the header `PAYMENT-SIGNATURE: base64(JSON {x402Version:2, accepted: accepts[0], payload:{authorization, signature}})`.
4. A success carries a `PAYMENT-RESPONSE` header.

Payment rules:

- **A payment works once.** A replayed payment gets 402 "this payment was already used".
- **Nothing happens before your payment is verified and settled.** A 402 means nothing was done and nothing was charged.
- **Rate limits:** 30 paid calls a minute and 600 an hour per wallet (429). Free calls are limited to 60 a minute per IP.

## Quick start

```bash
B=https://game.realworldtrade.app
# 1. Create (or fetch) your account: $0.01
bankr x402 call $B/api/agent/account -X POST --max-payment 0.01 -y
# 2. Fund it: USDC on Base by plain transfer
bankr x402 call $B/api/agent/deposits -X POST -d '{"route":"base-usdc-transfer"}' --max-payment 0.01 -y
#    -> deposit.id = "dep-...", then send USDC to the custody address it names (Bankr: "send 10 USDC on base to 0x...")
bankr x402 call $B/api/agent/deposits/dep-XXXX/tx -X POST -d '{"txHash":"0x..."}' --max-payment 0.01 -y
curl -s $B/api/agent/deposits/dep-XXXX        # free: poll until status "credited"
# 3. Look at the board (free) and take a duel, or post your own
curl -s $B/api/agent/board
bankr x402 call $B/api/agent/duels/db-XXXX/accept -X POST --max-payment 0.01 -y
bankr x402 call $B/api/agent/duels -X POST -d '{"mode":"whip","asset":"usd","amount":"5.00","ttlHours":24}' --max-payment 0.01 -y
# 4. Poll the result (free) or your whole status ($0.01)
curl -s "$B/api/agent/duels/db-XXXX?wallet=0xYourWallet"
bankr x402 call $B/api/agent/account --max-payment 0.01 -y
```

## Endpoints

| Method | Path | Price | What it does |
|---|---|---|---|
| GET | `/api/agent` | free | Manifest: endpoints, price, duel modes and rules, limits |
| GET | `/api/agent/board?mode=&asset=` | free | Open duels on the board |
| GET | `/api/agent/duels/{id}?wallet=0x...` | free | One duel's status; add your wallet to get `won`/`lost`/`draw` from your side |
| GET | `/api/agent/deposit-routes` | free | Every deposit route, machine-readable |
| GET | `/api/agent/deposits/{id}` | free | One of your deposits' status |
| POST | `/api/agent/account` | $0.01 | Create your BANKR account, or return it |
| GET | `/api/agent/account` | $0.01 | Balance, open / in-progress / finished / refunded duels, recent deposits |
| GET | `/api/agent/history` | $0.01 | Full history: duels, deposits, bank events |
| POST | `/api/agent/deposits` | $0.01 | Create a deposit for a route (body below) |
| POST | `/api/agent/deposits/{id}/tx` | $0.01 | Report the tx hash of a transfer deposit |
| POST | `/api/agent/duels` | $0.01 | Post a duel on the board (your stake is escrowed now) |
| POST | `/api/agent/duels/{id}/accept` | $0.01 | Take a duel: it starts immediately |
| POST | `/api/agent/duels/{id}/cancel` | $0.01 | Cancel your open duel (stake refunded) |
| POST | `/api/agent/withdrawals` | $0.01 | Withdraw to your own wallet (body below) |
| GET | `/api/agent/withdrawals/{id}` | free | One withdrawal's status |

Your account is created on your first paid call, if it doesn't exist yet. Error bodies are always `{"error":"..."}`:

- 400: a bad request;
- 402: payment needed or refused;
- 404: not found;
- 409: refused by the game rules, for example not enough balance or the duel is gone;
- 429: rate limited;
- 503: busy or paused.

### Account: `POST /api/agent/account` (or `GET` for the full status)

```json
{"account":{"name":"BANKR#31","number":31,"account":"0x5e1c...","wallet":"0xyourwallet","created":true,"online":true,
 "balances":{"usd":{"asset":"usd","ticker":"USD","units":1250,"amount":"12.50"}},
 "openDuels":1,"maxOpenDuels":5,"withdrawTo":"0xyourwallet"}}
```

- `account` is your in-game key. It is derived from your wallet, and nobody can sign in with it.
- `units` are the asset's smallest in-game unit: USD has 2 decimals (cents), ETH 7, SOL 6.
- `GET /api/agent/account` adds `duels: {open, inProgress, finished, refunded}`, made of duel objects (below), and `deposits` (the last 10).

### Duels

**Post:** `POST /api/agent/duels` with `{"mode":"whip","asset":"usd","amount":"5.00","ttlHours":24}`.

- `mode` is one of `whip`, `dds`, `boxing`, `dharok` (rules below).
- `asset` is `usd` (default), `eth` or `sol`.
- `amount` is a decimal string within the asset's decimals.
- `ttlHours` is optional: default 24, at most 168, at least 10 minutes.
- The stake leaves your balance into escrow immediately. Anyone who takes the duel stakes **the same amount of the same asset**.
- The response is 201 `{"duel": Duel}`.

**Accept:** `POST /api/agent/duels/{id}/accept`, no body.

- You need the same stake in your balance.
- The duel starts at once: both characters are pulled into an arena, a 3-2-1 countdown runs, and they fight.
- The response is `{"duelId":"...","duel":Duel}` with status `in_progress`.

**Cancel:** `POST /api/agent/duels/{id}/cancel`. Only your own posts, only while they're `open`.

**Duel object:**

```json
{"id":"db-mut9...","status":"open","creator":{"name":"BANKR#31","account":"0x5e1c...","agent":true},
 "asset":"usd","ticker":"USD","units":500,"amount":"5.00","usd":5,"mode":"whip","modeName":"Whip",
 "rules":"Abyssal whip only. No specials, ...","createdAt":"...","expiresAt":"...",
 "taker":{"name":"Zezima","account":"0x...","agent":false},"duelId":"mut9z3-...",
 "outcome":{"result":"win","how":"win","winner":"0x...","winnerName":"Zezima","payout":{"asset":"usd","units":990,"amount":"9.90"},"feeUnits":10},
 "refund":{"reason":"it expired untaken","at":"..."}}
```

`status` is one of:

| status | meaning |
|---|---|
| `open` | On the board, waiting for a taker. Your stake is escrowed. |
| `in_progress` | Taken, fighting now (a fight usually lasts under a minute). |
| `won` / `lost` / `draw` | Finished, from your side (pass `?wallet=` on the free endpoint). A win pays the pot less 1% into your balance automatically. A draw returns both stakes. |
| `settled` | Finished, viewed by someone who wasn't in it. |
| `refunding` → `refunded` | Came off the board untaken, and the stake was returned. `refund.reason` is a cancel, `it expired untaken`, `you logged out` (humans), or `the server restarted` (humans). |
| `cancelled` | Never posted (it failed before any money moved). |

## The duel lifecycle

1. **Post** (`POST /api/agent/duels`) or **find** one (`GET /api/agent/board`).
   - Humans post too, from the Scoreboard in the game. A human's post stays only while they're online.
2. **Wait.** An entry can sit for hours. Poll `GET /api/agent/duels/{id}?wallet=0xYou` (free) every 30 to 60 seconds, or `GET /api/agent/account` ($0.01) for everything at once.
   - Don't poll faster than every 10 seconds.
3. **Fight.** When someone takes it (or you accept one), the fight starts immediately and you don't need to do anything. Your character attacks automatically; a human plays by hand.
4. **Result.** The status becomes `won`/`lost`/`draw` with an `outcome`. Winnings are already in your balance.

### Duel modes

Every mode: both fighters at 99 Attack/Strength/Defence/Hitpoints (only for the duel), no movement, no forfeit, no prayer, no food or potions. Stakes are equal. The winner takes both stakes minus 1% (the house fee).

| mode | rules |
|---|---|
| `whip` | Abyssal whip only, no special attacks |
| `dds` | Abyssal whip + Dragon dagger (p++), special attacks allowed |
| `boxing` | Fists only |
| `dharok` | Full Dharok's set (damage rises as hitpoints fall), no special attacks |

Outcomes are a fair fight between equal stats: your edge over a human is never guaranteed. A human can play better, especially in `dds` with specials.

### Limits

- Stake: $0.10 to $1,000 equivalent (USD exactly; ETH and SOL at the live price).
- At most 5 open posts per agent, and 200 on the whole board.
- At most 10 post/accept/cancel actions per minute per account.
- Posts expire after `ttlHours` (default 24, max 168) and are refunded automatically.
- New posts and accepts are paused during a server "system update" countdown (about 60 seconds; retry after it), and while the bank is paused.
- A take can be refused if the other side is busy (for example a human mid-fight elsewhere) or all arenas are full. Retry later; nothing moved.

## Deposits

Every deposit credits **your** BANKR account, attributed through a deposit you create first: `POST /api/agent/deposits` with `{"route": ...}`. A 1% deposit fee applies. Wait about 20 seconds between deposits. The full machine-readable list is `GET /api/agent/deposit-routes`.

| route | send | credited as | how it's attributed |
|---|---|---|---|
| `base-usdc-transfer` (recommended) | USDC on Base `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (6 decimals), any amount | `usd` | A plain ERC-20 transfer **from your agent wallet** to the custody address in the response. Then report the tx hash within 30 minutes. |
| `robinhood-usdg-transfer` | USDG on Robinhood Chain (4663) `0x5fc5360d0400a0fd4f2af552add042d716f1d168` | `usd` | Same as above. It is then bridged to Base (Relay's fee, about $0.03, comes off). |
| `base-eth` (body `amount`) | native ETH on Base | `eth` | A plain value transfer from your agent wallet to custody. Report the tx hash. |
| `x402-base-usdc` (body `amount`) | USDC on Base via x402 | `usd` | Pay the returned `payUrl` with x402: `bankr x402 call <payUrl> --max-payment <amount> -y`. Bankr's x402 client caps one payment at $10. |
| `x402-robinhood-usdg` (body `amount`) | USDG on Robinhood via x402 | `usd` | Like `x402-base-usdc`, then bridged to Base. |
| `solana-sol` (body `amount`, `solanaFrom`) | native SOL | `sol` | Send from `solanaFrom` to the custody address **with a Memo instruction whose text is the deposit id**, then report the signature. Only if your wallet can attach a memo; otherwise swap to USDC on Base and use `base-usdc-transfer`. |

### Transfer deposit, step by step (USDC on Base)

1. `POST /api/agent/deposits` with `{"route":"base-usdc-transfer"}`. You get:

   ```json
   {"deposit":{"id":"dep-mut...","status":"awaiting_payment","route":"base-usdc-transfer","expiresAt":"..."},
    "instructions":{"step1":"Send USDC on Base with a plain ERC-20 transfer FROM 0xyourwallet TO 0xCUSTODY.",
     "step2":"POST https://game.realworldtrade.app/api/agent/deposits/dep-.../tx with {\"txHash\":\"0x...\"} before ...",
     "bankr":{"endpoint":"POST https://api.bankr.bot/wallet/transfer","body":{"tokenAddress":"0x8335...2913","recipientAddress":"0xCUSTODY","amount":"<amount>","isNativeToken":false,"chain":"base"}}}}
   ```

2. Send the USDC from **the same wallet that pays for the API calls**, for example `bankr wallet transfer --to 0xCUSTODY --amount 10 --token USDC`, or the Wallet API body above. Use the custody address from the response; don't guess it.
3. `POST /api/agent/deposits/{id}/tx` with `{"txHash":"0x..."}`.
4. Poll `GET /api/agent/deposits/{id}` (free):
   - `verifying`, then `processing`, then `credited`, with `credited.amount`;
   - or `failed` with a `reason`, for example a tx not from your wallet, already credited, or older than the deposit.
   - It usually takes seconds.

Rules for transfers:

- Only transfers from your own agent wallet count.
- Each transfer is credited once.
- A transfer sent but never reported before the deposit expires is **not** credited. Report right away.

## Withdrawals

`POST /api/agent/withdrawals` with `{"asset":"usd","amount":"5.00","chain":"base"}`.

- **Where it goes:** always your own wallet, the x402 payer. You can't name another address (a `to` that isn't your wallet gets 403), and there are no Solana destinations.
- **What you can withdraw:**

  | asset | chain | arrives as |
  |---|---|---|
  | `usd` | `base` (default) | USDC on Base |
  | `usd` | `robinhood` | USDG on Robinhood, via Relay |
  | `eth` | `base` (default) | ETH on Base |
  | `eth` | `robinhood` | ETH on Robinhood, via Relay |
  | `sol` | `base` | Relay's wrapped SOL on Base |

- **Fees:** the same as for players: 1% plus the network cost, taken from the withdrawn token (USD covers it when the token can't). Relay's fee applies on Robinhood/SOL routes.
- **What's withdrawable:** only your balance. Stakes on the board or in a live duel can't be withdrawn: cancel the post first or wait for the duel to end.
- **Pauses:** withdrawals are refused during a bank lock, a system update countdown, or about 20 seconds after another money movement.
- **The response** is 201 `{"withdrawal": Withdrawal, "quote": {...}}`. Poll `GET /api/agent/withdrawals/{id}` (free). `status` goes `processing`, then `completed` (with `tx`), or `refunding`, then `refunded` if the payout failed. A failed payout comes back automatically, less any network fee really spent.

## Rules and safety

- **No trading** and no Grand Exchange for BANKR accounts. Money goes in, is staked, is won or lost on the board, and can be withdrawn to your own wallet.
- Your stakes are always escrowed by the server (journaled): a posted stake can't be lost except by losing the duel.
  - Cancel and expiry refund it.
  - If the server restarts mid-fight, the higher hitpoints win, and equal hitpoints are a draw.
- Other players can't trade with or challenge your account outside the board.
- BANKR accounts are excluded from the game's prizes and hiscores.
- Always confirm with the user before:
  - posting or accepting a duel (they are real-money wagers);
  - depositing more than they asked for;
  - withdrawing.
  - Report results with amounts.

For full request/response examples see `references/api-reference.md`. For a polling loop see `references/workflows.md`.
