---
name: bankr-realworldtrade
description: Create and fund your own BANKR#<n> account in Real World Trade (a browser Old School RuneScape-style game with real-money stakes), duel people at the Duel Arena for USDC stakes through its duel board (manually, or hands-off with auto mode and betting strategies), and withdraw winnings to your own wallet. Use when the user wants the agent to open/fund a Real World Trade account, post or accept staked duels, check duel results, balance or deposits, or withdraw. Actions cost $0.01 and reads $0.001 USDC on Base via x402.
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
  | reads (`GET /api/agent/account`, `GET /api/agent/history`, `GET /api/agent/auto-accept`) | **$0.001** |

- The 402 response tells you everything: the `PAYMENT-REQUIRED` header (base64 JSON) and the JSON body `{x402Version, error, resource, accepts:[{scheme, network, amount:"10000" or "1000", asset:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", payTo, maxTimeoutSeconds, extra:{name:"USD Coin", version:"2"}}]}`.
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
- **Rate limits:** **actions** are limited to 30 a minute and 600 an hour per wallet, and **reads** to 20 a minute and 240 an hour (429, nothing charged). Free calls are limited to 60 a minute per IP.

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
bankr x402 call $B/api/agent/account --max-payment 0.001 -y                             # balance + all your duels ($0.001)
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
| GET | `/api/agent/account` | $0.001 | Balance, walking / open / in-progress / finished / refunded duels, deposits, auto-accept rules |
| GET | `/api/agent/history` | $0.001 | Full history: duels, deposits, bank events |
| GET | `/api/agent/auto-accept` | $0.001 | Your auto-accept rules |
| GET | `/api/agent/inventory` | $0.001 | Everything you hold, with amounts and USD values |
| POST | `/api/agent/swaps/quote` | $0.001 | Quote a swap (body below) |
| GET | `/api/agent/swaps/{id}` | free | One swap's status |
| GET | `/api/agent/trades` | $0.001 | Your trade proposals to players |
| POST | `/api/agent/swaps` | $0.01 | Confirm a swap quote |
| POST | `/api/agent/trades` | $0.01 | Propose a trade to a player (they accept in game) |
| POST | `/api/agent/trades/{id}/cancel` | $0.01 | Cancel your proposal |
| POST | `/api/agent/account` | $0.01 | Create your BANKR account, or return it |
| POST | `/api/agent/deposits` | $0.01 | Create a deposit for a route (body below) |
| POST | `/api/agent/deposits/{id}/tx` | $0.01 | Report the tx hash of a transfer deposit |
| POST | `/api/agent/duels` | $0.01 | Post your duel, or **update** your current one (one per agent) |
| POST | `/api/agent/duels/{id}/accept` | $0.01 | Accept a duel: you walk to the Scoreboard, then it starts |
| POST | `/api/agent/duels/{id}/cancel` | $0.01 | Cancel your post (any state before the fight) or your walking accept: full refund |
| GET | `/api/agent/auto` | $0.001 | Auto mode settings, state, token status and stop reason |
| POST | `/api/agent/auto/preview` | $0.001 | Validate auto mode settings and get the confirmation phrases |
| POST | `/api/agent/auto` | $0.01 | Turn on / update auto mode (needs the confirmations) |
| POST | `/api/agent/auto/disable` | $0.01 | Turn auto mode off |
| POST | `/api/agent/auto-accept` | $0.01 | Legacy: find-only rules, no confirmation |
| POST | `/api/agent/auto-accept/disable` | $0.01 | Legacy: turn them off |
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
- `asset` is `usd` (default) or **any tradeable token you hold** (`eth`, `sol`, a memecoin... see `GET /api/agent/inventory`). See "Staking any token" below.
- `amount` is a decimal string within the asset's decimals.
- `ttlHours` is optional: default 24, at most 168, at least 10 minutes.
- **One duel per agent.** If you already have one on the board, this call **updates** it to the new stake, mode or asset. The old stake is refunded and the new one escrowed in one step, so only the difference really moves. The response then says `"updated": true, "replaced": "<old id>"`, and you poll the new `duel.id`.
- An update is refused (409) while someone is walking to take your current post, or while your previous post is still walking to the board.
- Your stake leaves your balance into escrow immediately. Anyone who takes the duel stakes **the same amount of the same asset**.
- The response is 202 `{"duel": Duel}` with status `walking`. It becomes `open` when your character reaches the Scoreboard.

**Staking any token.** Anyone can stake a duel in any token the game supports. The server swaps the token to USD through the ordinary swap (the same quote, fees and 20% slippage floor as `POST /api/agent/swaps`) and escrows the **USD** it measures when the swap lands:

- You pass the token amount: `{"mode":"whip","asset":"bluechip","amount":"5000"}`. The response is 202 with status `converting` and `expectedUsd`. Poll `GET /api/agent/duels/{id}`: `converting`, then `walking`, then `open`.
- The token must be sellable to USD. If there's no route or the quote is refused, the post is refused (409) and your token is untouched. If the swap fails, the token is returned and the post ends `failed`.
- The stake is USD, so a duel shows in USD on the board and an opponent matches it in USD. The stake must be $0.10 to $1,000 after the swap; if it lands outside that, the USD stays in your inventory and the post fails.
- A cancel, expiry or offline removal refunds **USD**, not the token. (You can cancel once the swap has landed.)
- A token-staked post can't update an existing post: you need to have none on the board.

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
| `converting` | Your token is being swapped to USD for the stake (the post goes up when it lands). |
| `failed` | The swap failed or landed outside the stake limits; see `reason`. Your tokens (or the USD) are in your inventory. |
| `walking` | A character is walking to the Scoreboard (`walking.for`: `post` or `accept`). The stake is escrowed. |
| `open` | On the board, waiting for a taker. Your stake is escrowed. |
| `in_progress` | Taken: `phase` is `countdown`, then `fight` (a fight usually lasts under a minute). |
| `won` / `lost` / `draw` | Finished, from your side (pass `?wallet=` on the free endpoint). A win pays the pot less 1% into your balance automatically. A draw returns both stakes. |
| `settled` | Finished, viewed by someone who wasn't in it. |
| `refunding` → `refunded` | Came off the board, or the walk failed, and the stake was returned. `refund.reason` is a cancel, an update, `it expired untaken`, `the walk to the Scoreboard timed out`, `you logged out` (humans), or `the server restarted`. |
| `cancelled` | Never posted (it failed before any money moved). |

## Inventory

`GET /api/agent/inventory` ($0.001) lists everything your account holds: every coin, token and item in the inventory and bank, credits owed while you're logged out (`where: "pending"`), and stakes sitting in the duel board's escrow (`where: "board escrow"`).

```json
{"inventory":{"items":[{"kind":"token","asset":"bluechip","name":"BLUECHIP","ticker":"BLUECHIP","amount":"10000.00","units":1000000,"where":"inventory","usd":200,"usdText":"$200.00"},
  {"kind":"token","asset":"usd","amount":"5.00","where":"inventory","usd":5},{"kind":"coins","name":"Coins","amount":"20000","usd":0.004}],
 "totalUsd":205.004,"totalUsdText":"$205.00","unpriced":0},"online":false}
```

Tokens are valued at the live price, coins at the game's coin rate, other items at their Grand Exchange price (`usd: null` when unpriced).

## Swaps

Swap your tokens for other tokens, through the same Relay-backed route players use: a quote, then a confirm.

1. `POST /api/agent/swaps/quote` ($0.001) with `{"from":"bluechip","to":"usd","amount":"5000"}`. `from` and `to` are asset keys (`usd`, `eth`, `sol`, or any listed token, see `GET /api/agent/inventory`). You get `quote.id`, the expected and minimum output, the fees and `expiresIn` (about 60 seconds).
2. `POST /api/agent/swaps` ($0.01) with `{"quoteId":"..."}` within that time. The input is taken at once and the response is 202 `{"swap": {...}}`.
3. Poll the free `GET /api/agent/swaps/{id}`: `processing`, then `completing`, then `completed` (`received`), or `refunding` then `refunded` (the token comes back) if the route failed.

The protections are the players' own:
- a 20% slippage floor (the minimum output is shown);
- live transfer-tax checks;
- the 1% fee plus network cost;
- probation caps on newly listed tokens;
- a cooldown of a few seconds after each swap.

Swap output lands in your inventory. If your character has logged out it waits as `pending` and is delivered on its next login.

## Trading with players

You can propose a trade to a human player, and **they accept in game**. Nothing ever moves without both sides' explicit act.

`POST /api/agent/trades` ($0.01):

```json
{"to":"Zezima","give":[{"asset":"usd","amount":"2.00"}],"want":[{"coins":5000}],"note":"coins for cash"}
```

- Items are `{"asset":"<key>","amount":"1.5"}` (a token), `{"coins":1000}`, or `{"item":<object id>,"count":1}` (a tradeable item). Up to 8 per side.
- The player must be online, a wallet player (not another agent), and must hold what you want. You must hold what you give.
- The player sees an in-game prompt: "BANKR#N offers: you GET ..., you GIVE .... Accept?" Yes executes the exchange atomically and exactly as listed, after re-checking both sides. Declining, ignoring it for 5 minutes, or your cancel ends it with nothing moved.
- Response: 202 `{"trade": {"id","state":"offered",...}}`. Poll `GET /api/agent/trades` ($0.001): `offered`, then `traded` / `declined` / `expired` / `failed` (with `reason`) / `cancelled`.
- Limits: 3 open proposals, one per player, and a player is prompted at most once a minute by agents.
- Cancel with `POST /api/agent/trades/{id}/cancel` ($0.01).
- Players can't start trades with you; only you propose. Tokens trade under the same rules as between players. NFT rares and duel equipment can't be traded.

## Auto mode (auto-find, auto-create, strategies)

Get more duels per hour without checking in. Auto mode runs on the server, **continuously**, until you stop it or a limit stops it:

- **Auto-find** accepts matching board duels for you, from humans or agents. Each one works exactly like a manual accept: your stake is escrowed, the duel is held, and your character walks over and fights. After each duel you're eligible again at once.
- **Auto-create** posts duels for you and keeps re-posting as they resolve, with a staking strategy.
- **Strategies** pick the stake: a fixed stake, or a martingale. Limits stop it cleanly.
- **Token swaps** can fund the stakes, but only for tokens you approve one by one.

### Setting it up (preview, then confirm)

1. `POST /api/agent/auto/preview` ($0.001) with your settings. It validates them and returns a plain-English `summary`, the exact `confirm` phrase, and one approval phrase per token. Nothing is changed.
2. `POST /api/agent/auto` ($0.01) with the same body plus `confirm` and, inside every `approveTokens` entry, that token's `confirm` phrase. If any confirmation is missing or wrong you get 409 listing exactly what's missing, and **nothing is changed**.

```json
{"find": true, "create": true,
 "minStake": 1, "maxStake": 8, "modes": "any", "assets": "any", "maxPerHour": 10, "maxExposure": 20,
 "strategy": {"type": "martingale", "baseStake": 1, "maxSteps": 3, "takeProfit": 15, "stopLoss": 10, "maxDuels": 50},
 "approveTokens": [{"token": "bluechip", "maxAmount": "5000", "takeProfitPct": 25, "onTakeProfit": "leave",
                    "confirm": "I approve swapping BLUECHIP to USD"}],
 "protectedTokens": ["pons"],
 "confirm": "I confirm auto mode 1a2b3c4d"}
```

Omitted fields keep their current value. `approveTokens` and `protectedTokens`, when given, are the complete new lists.

### Settings

| field | meaning |
|---|---|
| `find` / `create` | turn auto-find (accept) and auto-create (post) on or off; at least one |
| `minStake`, `maxStake` | USD bounds: the duels auto-find accepts, and the cap on a created stake |
| `modes`, `assets` | `"any"` (the default) or a list: which duel types and post assets auto-find accepts; `modes` also rotates the types auto-create posts |
| `maxPerHour` | 1–30 auto accepts and posts an hour |
| `maxExposure` | most USD committed at once (posts, accepts, fights in progress) |
| `postTtlHours` | how long an auto post stays up before it's re-posted (default 1) |
| `strategy.type` | `fixed` or `martingale` |
| `strategy.baseStake` | the USD stake (fixed), or the first stake (martingale) |
| `strategy.maxSteps` | martingale: at most this many doublings, and **stops** after this many losses in a row |
| `strategy.takeProfit` | stop when net profit since start reaches this many USD |
| `strategy.stopLoss` | stop when net loss reaches this many USD |
| `strategy.maxDuels` | stop after this many duels |
| `approveTokens[]` | the only tokens auto mode may swap to USD to fund stakes (below) |
| `protectedTokens[]` | coins auto mode must never touch |

### Strategies

- **Fixed:** the same stake every duel.
- **Martingale:** the stake doubles after each loss and resets to the base after a win. It never exceeds `maxStake` or your free USD, and it stops (reason recorded) after `maxSteps` losses in a row.
- Net profit/loss counts only the duels auto mode took or posted, after the 1% fee.
- Every limit stops auto mode cleanly: open auto posts are called off and refunded, and a fight in progress finishes. The reason is recorded.

### Tokens: explicit approval only

Auto mode can swap a coin you hold to USD to fund a stake, **only if you approved that exact token**. Each `approveTokens` entry needs its own phrase, `I approve swapping <SYMBOL> to USD`, or the whole request is rejected.

- `maxAmount` caps the total of that token auto mode will ever swap.
- `takeProfitPct` / `takeProfitUsd` ("leave if we make X"): once the coin is up that much since you approved it, auto mode leaves it alone (`onTakeProfit: "leave"`, the default) or stops entirely (`"stop"`).
- `protectedTokens` are never touched; a token can't be both approved and protected. Unapproved tokens are never swapped.
- Funding swaps are the normal swap path (quote, 20% slippage floor, fees) and are rate limited (6 an hour).

### Status and stopping

- `GET /api/agent/auto` ($0.001): the settings, running state (`duels`, `wins`, `losses`, `net`, `lossStreak`), `committedUsd`, `freeUsd`, the next stake, each token's status (`active`, `left`, `protected`), and, when it has stopped, `stopReason` and `stoppedAt`. The same is in `GET /api/agent/account` as `autoMode`.
- `POST /api/agent/auto/disable` ($0.01) turns it off (`stopReason`: "turned off by the agent").
- It stops itself when you run out of USD and approved tokens: "out of funds ...". It also stops on any strategy limit or token take-profit set to "stop".
- Checking in is optional: look at the account status now and then for results and your balance.

When several agents qualify for the same duel, the **lowest in-game player id wins**, deterministically. Your own post is never accepted.

The older `POST /api/agent/auto-accept` (find only, with `minStake`, `maxStake`, `assets`, `modes`, `maxPerHour`) still works and needs no confirmation; it has no create, strategy or token settings.

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

### Players can challenge you in game

A player who right-clicks Challenge on your character gets a reply. If you have no duel up, they're pointed to the Scoreboard. If you have a duel on the board, they get an in-game prompt, "Accept BANKR#N's duel for $X?", and Yes takes your duel the normal way: both stakes escrowed, both characters in an arena, the countdown, and the fight. You don't need to do anything. This only works while your duel is open on the board.

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
