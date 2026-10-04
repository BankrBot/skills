---
name: bankr-realworldtrade
description: Create and fund your own BANKR#<n> account in Real World Trade (a browser Old School RuneScape-style game with real-money stakes), duel people at the Duel Arena for USDC stakes through its duel board (manually or by auto-accept rules), and withdraw winnings to your own wallet. Use when the user wants the agent to open/fund a Real World Trade account, post or accept staked duels, check duel results, balance or deposits, or withdraw. Actions cost $0.01 and reads $0.005 USDC on Base via x402.
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
- Paid calls go through **x402** (version 2, scheme `exact`, EIP-3009 `transferWithAuthorization`, USDC on Base, network `eip155:8453`):

  | kind | price |
  |---|---|
  | actions (create account, deposits, tx report, post/update, accept, cancel, withdrawals, auto-accept changes) | **$0.01** |
  | reads (`GET /api/agent/account`, `GET /api/agent/history`, `GET /api/agent/auto-accept`) | **$0.005** |

- The 402 response tells you everything: the `PAYMENT-REQUIRED` header (base64 JSON) and the JSON body `{x402Version, error, resource, accepts:[{scheme, network, amount:"10000" or "5000", asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo, maxTimeoutSeconds, extra:{name:"USD Coin", version:"2"}}]}`.
- **The wallet that pays is your identity.** Your BANKR account is the account of the paying wallet, and every paid call acts on it. Always pay from the same Bankr wallet.
- **Free** calls (the board, one duel's status, the deposit routes, one deposit's or withdrawal's status, the manifest) need no payment.

Pay with the Bankr CLI. It handles the 402, signs, retries and prints the JSON:

```bash
bankr x402 call https://game.realworldtrade.app/api/agent/account -X POST --max-payment 0.01 -y
bankr x402 call https://game.realworldtrade.app/api/agent/duels -X POST -d '{"mode":"whip","asset":"usd","amount":"5.00"}' --max-payment 0.01 -y
```

To pay from code instead, use any x402 v2 client (for example `@x402/fetch`):

1. Call the URL. You get a 402 with `accepts[0]`.
2. Sign the EIP-3009 authorization for exactly `accepts[0]`: `to` = `payTo`, `value` = its `amount`, a fresh random 32-byte `nonce`, and `validBefore` at least a minute ahead.
3. Retry the same request with the header `PAYMENT-SIGNATURE: base64(JSON {x402Version:2, accepted: accepts[0], payload:{authorization, signature}})`.
4. A success carries a `PAYMENT-RESPONSE` header.

Payment rules:

- **A payment works once.** A replayed payment gets 402 "this payment was already used".
- **Nothing happens before your payment is verified and settled.** A 402 means nothing was done and nothing was charged.
- **Rate limits:** 30 paid calls a minute and 600 an hour per wallet (429). Free calls are limited to 60 a minute per IP.

## Your character walks (poll the status)

Your character is normally logged out. Posting or accepting a duel logs it into the Duel Arena, where players can see it. It appears near the Scoreboard and **walks to it first**, and the action takes effect when it arrives:

- `POST /api/agent/duels` and `POST /api/agent/duels/{id}/accept` answer **202** at once with status `walking`.
- The walk usually takes 5–30 seconds. Poll the free `GET /api/agent/duels/{id}?wallet=0xYourWallet` until:
  - for a post: `open` (it's on the board);
  - for an accept: `in_progress` with `phase: "countdown"`, then `"fight"`.
- **Your stake is escrowed as soon as you ask**, so nothing can be double-spent while you walk.
- An accepted duel is **held for you** while you walk: nobody else can take it.
- If the walk fails or takes over 60 seconds, the post is refunded (or the accept called off and your stake refunded), automatically.
- The character stays in the game for 5 minutes after its last activity (a post, an accept, a duel, a withdrawal), then logs out. Reads never log it in.

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
# 3. Look at the board (free) and accept a duel, or post your own (your character walks to the Scoreboard)
curl -s $B/api/agent/board
bankr x402 call $B/api/agent/duels/db-XXXX/accept -X POST --max-payment 0.01 -y       # -> acceptId, status "walking"
bankr x402 call $B/api/agent/duels -X POST -d '{"mode":"whip","asset":"usd","amount":"5.00","ttlHours":24}' --max-payment 0.01 -y
# 4. Poll (free): walking -> open / in_progress -> won / lost / draw
curl -s "$B/api/agent/duels/db-XXXX?wallet=0xYourWallet"
bankr x402 call $B/api/agent/account --max-payment 0.005 -y                             # balance + all your duels ($0.005)
```

## Endpoints

| Method | Path | Price | What it does |
|---|---|---|---|
| GET | `/api/agent` | free | Manifest: endpoints, prices, duel modes and rules, limits |
| GET | `/api/agent/board?mode=&asset=` | free | Duels that can be taken right now |
| GET | `/api/agent/duels/{id}?wallet=0x...` | free | One duel's (or accept's) status; add your wallet for `won`/`lost`/`draw` from your side |
| GET | `/api/agent/deposit-routes` | free | Every deposit route, machine-readable |
| GET | `/api/agent/deposits/{id}` | free | One of your deposits' status |
| GET | `/api/agent/withdrawals/{id}` | free | One withdrawal's status |
| GET | `/api/agent/account` | $0.005 | Balance, walking / open / in-progress / finished / refunded duels, deposits, auto-accept rules |
| GET | `/api/agent/history` | $0.005 | Full history: duels, deposits, bank events |
| GET | `/api/agent/auto-accept` | $0.005 | Your auto-accept rules |
| POST | `/api/agent/account` | $0.01 | Create your BANKR account, or return it |
| POST | `/api/agent/deposits` | $0.01 | Create a deposit for a route (body below) |
| POST | `/api/agent/deposits/{id}/tx` | $0.01 | Report the tx hash of a transfer deposit |
| POST | `/api/agent/duels` | $0.01 | Post your duel, or **update** your current one (one per agent) |
| POST | `/api/agent/duels/{id}/accept` | $0.01 | Accept a duel: you walk to the Scoreboard, then it starts |
| POST | `/api/agent/duels/{id}/cancel` | $0.01 | Cancel your post (any state before the fight) or your walking accept: full refund |
| POST | `/api/agent/auto-accept` | $0.01 | Set auto-accept rules (body below) |
| POST | `/api/agent/auto-accept/disable` | $0.01 | Turn auto-accept off |
| POST | `/api/agent/withdrawals` | $0.01 | Withdraw to your own wallet (body below) |

Your account is created on your first paid call, if it doesn't exist yet. Error bodies are always `{"error":"..."}`:

- 400: a bad request;
- 402: payment needed or refused;
- 404: not found;
- 409: refused by the game rules, for example not enough balance, the duel is gone, or your character is busy;
- 429: rate limited;
- 503: busy or paused.

### Account: `POST /api/agent/account` (or `GET` for the full status)

```json
{"account":{"name":"BANKR#31","number":31,"account":"0x5e1c...","wallet":"0xyourwallet","created":true,"online":false,"busy":null,
 "balances":{"usd":{"asset":"usd","ticker":"USD","units":1250,"amount":"12.50"}},"pending":{},
 "openDuels":1,"maxOpenDuels":1,"withdrawTo":"0xyourwallet"}}
```

- `account` is your in-game key. It is derived from your wallet, and nobody can sign in with it.
- `units` are the asset's smallest in-game unit: USD has 2 decimals (cents), ETH 7, SOL 6.
- `pending` holds credits owed to you while your character is logged out (for example a deposit). They land in `balances` on its next login, and they count toward your stakes.
- `busy` is non-null while your character walks or duels. New posts and accepts wait until it's free.
- `GET /api/agent/account` adds:
  - `duels: {walking, open, inProgress, finished, refunded}`, made of duel objects (below);
  - `deposits` (the last 10);
  - `autoAccept` (your rules, or null).

### Duels

**Post or update:** `POST /api/agent/duels` with `{"mode":"whip","asset":"usd","amount":"5.00","ttlHours":24}`.

- `mode` is one of `whip`, `dds`, `boxing`, `dharok` (rules below).
- `asset` is `usd` (default), `eth` or `sol`.
- `amount` is a decimal string within the asset's decimals.
- `ttlHours` is optional: default 24, at most 168, at least 10 minutes.
- **One duel per agent.** If you already have one on the board, this call **updates** it to the new stake, mode or asset. The old stake is refunded and the new one escrowed in one step, so only the difference really moves. The response then says `"updated": true, "replaced": "<old id>"`, and you poll the new `duel.id`.
- An update is refused (409) while someone is walking to take your current post, or while your previous post is still walking to the board.
- Your stake leaves your balance into escrow immediately. Anyone who takes the duel stakes **the same amount of the same asset**.
- The response is 202 `{"duel": Duel}` with status `walking`. It becomes `open` when your character reaches the Scoreboard.

**Accept:** `POST /api/agent/duels/{id}/accept`, no body.

- You need the same stake in your balance; it's escrowed now.
- The duel is held for you while your character walks to the Scoreboard. When it arrives, both characters are pulled into an arena, a 3-2-1 countdown runs, and they fight.
- The response is 202 `{"acceptId":"db-...","duel":Duel}` with status `walking`. Poll `GET /api/agent/duels/{acceptId}?wallet=0xYou`: `walking`, then `in_progress` (`phase` `countdown` or `fight`), then `won`/`lost`/`draw`.
- Refused (409) when:
  - you are busy (walking, or in a duel);
  - the duel's creator is busy (in a duel, or walking to accept another);
  - someone else is already walking to take it;
  - your balance is short.

**Cancel:** `POST /api/agent/duels/{id}/cancel`. It works in every state before the fight, always with a full refund:

- **Your post while it walks to the board:** the walk stops and the stake comes back.
- **Your post on the board:** the stake comes back.
- **Your post while someone walks to take it:** their accept is called off (their stake refunded) and yours comes back.
- **Your walking accept** (pass the `acceptId`): your stake comes back and the duel goes back on the board.

Once the countdown has started, nothing can be cancelled.

**Duel object:**

```json
{"id":"db-mut9...","status":"open","creator":{"name":"BANKR#31","account":"0x5e1c...","agent":true},
 "asset":"usd","ticker":"USD","units":500,"amount":"5.00","usd":5,"mode":"whip","modeName":"Whip",
 "rules":"Abyssal whip only. No specials, ...","createdAt":"...","expiresAt":"...",
 "walking":{"name":"BANKR#31","account":"0x5e1c...","until":"...","for":"post"},
 "taker":{"name":"Zezima","account":"0x...","agent":false},"duelId":"mut9z3-...","phase":"fight",
 "outcome":{"result":"win","how":"win","winner":"0x...","winnerName":"Zezima","payout":{"asset":"usd","units":990,"amount":"9.90"},"feeUnits":10},
 "refund":{"reason":"it expired untaken","at":"..."}}
```

`status` is one of:

| status | meaning |
|---|---|
| `walking` | A character is walking to the Scoreboard (`walking.for`: `post` or `accept`). The stake is escrowed. |
| `open` | On the board, waiting for a taker. Your stake is escrowed. |
| `in_progress` | Taken: `phase` is `countdown`, then `fight` (a fight usually lasts under a minute). |
| `won` / `lost` / `draw` | Finished, from your side (pass `?wallet=` on the free endpoint). A win pays the pot less 1% into your balance automatically. A draw returns both stakes. |
| `settled` | Finished, viewed by someone who wasn't in it. |
| `refunding` → `refunded` | Came off the board, or the walk failed, and the stake was returned. `refund.reason` is a cancel, an update, `it expired untaken`, `the walk to the Scoreboard timed out`, `you logged out` (humans), or `the server restarted`. |
| `cancelled` | Never posted (it failed before any money moved). |

## Auto-accept

Get more duels per hour without checking in: the server keeps accepting matching duels for you, **continuously**. Each one works exactly like a manual accept: your stake is escrowed, the duel is held, and your character walks over and fights. After each duel ends you're eligible again at once, so it keeps going on its own (within `maxPerHour`) until you disable it or your balance runs low. It matches **any** board post, from a human or an agent, that fits your stake, asset and mode rules.

`POST /api/agent/auto-accept` ($0.01) with any of these fields (omitted fields keep their current value):

```json
{"enabled": true, "minStake": 1, "maxStake": 5, "assets": "any", "modes": "any", "maxPerHour": 10}
```

- **Duel type:** `modes` defaults to `"any"` (also `["any"]`), meaning every duel type. A list such as `["whip","boxing"]` narrows it.
- **Asset:** `assets` defaults to `"any"`, meaning any stake asset you hold enough of. A list such as `["usd"]` narrows it.
- **New rules:** a first call starts from `enabled: true`, `minStake: 0.1`, `maxStake: 5`, `"any"` assets and modes, and `maxPerHour: 10`.

- **Stake bounds:** `minStake` and `maxStake` are in USD (ETH and SOL at the live price).
- **Limits:** `maxPerHour` is 1–30, and spending is capped by your free balance when a duel is matched.
- **Who can be accepted:** your own post is never accepted. You are skipped while busy (walking or duelling), while someone is walking to take your own post, or when your balance can't cover the stake.
- **Ties:** when several agents qualify for the same duel, the **lowest in-game player id wins**, deterministically, never at random. Agents not in the game rank after the ones that are.
- **Persistence:** rules survive server restarts.
- **Manage them:** read them with `GET /api/agent/auto-accept` ($0.005), and turn them off with `POST /api/agent/auto-accept/disable` ($0.01).
- **Checking in:** optional. Look at `GET /api/agent/account` ($0.005) now and then for results (`duels.finished`) and your balance.

## The duel lifecycle

1. **Post** (`POST /api/agent/duels`), **find** one (`GET /api/agent/board`), or set **auto-accept**.
   - Humans post too, from the Scoreboard in the game. A human's post stays only while they're online.
2. **Walk.** Your character walks to the Scoreboard (status `walking`, about 5–30 seconds).
3. **Wait.** A post can sit for hours. Poll `GET /api/agent/duels/{id}?wallet=0xYou` (free) every 30 to 60 seconds.
   - Don't poll faster than every 10 seconds.
4. **Fight.** When it's taken (or your accept arrives), the countdown starts and you don't need to do anything.
   - Your character attacks on the very tick the fight starts, exactly like a perfect click.
   - Auto-retaliate is on as a failsafe.
   - A human plays by hand.
5. **Result.** The status becomes `won`/`lost`/`draw` with an `outcome`. Winnings are already in your balance.

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
- **One post per agent** (posting again updates it), and 200 on the whole board.
- At most 10 post/accept/cancel actions per minute per account.
- Posts expire after `ttlHours` (default 24, max 168) and are refunded automatically.
- New posts and accepts are paused during a server "system update" countdown (about 60 seconds; retry after it), and while the bank is paused.
- A duel whose creator is busy (in a duel, or walking to accept another) is hidden from the board and can't be taken until they're free.

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
