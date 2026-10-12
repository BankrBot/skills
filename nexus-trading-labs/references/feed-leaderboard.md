# Feed, Leaderboard & Thesis Reference

## Public Feed

```
GET https://og.nexustradinglabs.com/feed
```

Returns all public theses. Each object:
- `id`, `wallet`, `symbol`, `direction` ("LONG"/"SHORT")
- `entry`, `sl`, `tp1`, `tp2`, `tp3`
- `status` — "ACTIVE", "HIT_TP", "STOPPED_OUT", "CLOSED"
- `copyCount`, `onChainId`, `onChainTxHash`, `timestamp`

---

## Trader Lab

```
GET  /lab/:walletAddress          // all theses for wallet
PUT  /lab/:walletAddress          // body: { theses: ThesisTrade[] }
GET  /profile/:walletAddress      // { pfp, displayName }
PUT  /profile/:walletAddress      // body: { pfp?, displayName? }
```

---

## Rep Score

Composite 0–100 on-chain credibility score:

```
repScore = winRate + min(avgRR * 10, 20) - samplePenalty
```

- `winRate` = (wins / (wins + losses)) * 80
- `avgRR` = average (tp1 - entry) / (entry - sl) on closed winning theses
- `samplePenalty` = 0 if ≥5 closed trades, else (5 - closed) * 4
- Clamped to [0, 100]

On-chain stats: call `getTraderStats(walletAddress)` on ThesisRegistry returns `(wins, losses, activeTrades)`.

---

## Build the Leaderboard

1. `GET https://og.nexustradinglabs.com/feed` → all public theses
2. Group by wallet
3. Compute per wallet:
   - `wins` = count of `HIT_TP` theses
   - `losses` = count of `STOPPED_OUT` theses
   - `avgRR` = mean of `(tp1 - entry) / (entry - sl)` for winning theses
   - `repScore` using formula above
4. Sort by `repScore` desc, then total theses desc
5. For verified on-chain stats: call `getTraderStats(wallet)` on ThesisRegistry (shows ⛓ badge)

---

## ThesisRegistry Contract

**Address:** `0x2F4EdA890f96a7979d6f26bCB210cEDAD68346Bc` (Arbitrum One)
**Verified:** https://arbiscan.io/address/0x2F4EdA890f96a7979d6f26bCB210cEDAD68346Bc

Key functions:
```solidity
registerThesis(string symbol, string direction, uint256 entry, uint256 sl, uint256 tp) → thesisId
closeThesis(uint256 thesisId, string outcome, string settlementTxHash)
getTraderStats(address trader) → (wins, losses, activeTrades)
getThesis(uint256 thesisId) → ThesisData
```

Price encoding: `Math.round(price * 1e6)` — e.g. BTC at $65,432.10 → `65432100000` (contract uses 6 decimal scaling, NOT 8)

Events: `ThesisRegistered(thesisId, trader, symbol)`, `ThesisClosed(thesisId, trader, outcome)`

---

## Copy Trading Flow

> ⚠️ **Copying is NOT auto-trading.** This flow saves a *thesis* (a plan) to the user's lab — it does **not** place an order. NEVER chain a copied thesis straight into `/trade`/`/agent` without an explicit user confirmation for that specific position.
>
> **On reputation signals:** the VERIFIED-CALLERS leaderboard (`/theses/leaderboard`) grades outcomes **objectively against public Orderly price** (first-touch TP-vs-SL on public OHLC, recomputable by anyone) — not self-reported PnL, which is the strongest signal here. Even so, treat ANY single metric — Rep Score, leaderboard rank, or `getTraderStats()` — as a **cross-check only, never the sole automated gate** before risking capital: rankings can still be influenced by wash trading or coordinated publishing. Always require operator sign-off before opening a position derived from a third party's call.

1. `GET https://og.nexustradinglabs.com/feed` → find thesis by trader/symbol/direction
2. Prompt user: account size (USDC), risk % (e.g. 2%), optional max loss cap
3. Compute position size: `accountSize * riskPct / (entry - sl)` (longs); adjust for shorts
4. `GET /lab/:userWallet` → fetch user's theses
5. Append new thesis:
   - All levels from source
   - `copiedFromWallet: sourceWallet`, `copiedThesisId: sourceId`
   - Notes: "Copied from [sourceWallet] via Nexus"
   - `isPublic: false` (user decides)
6. `PUT /lab/:userWallet`
7. Optionally: `POST /notifications/:sourceWallet` to alert them

> If the user then wants to actually *open* the copied position, confirm the symbol, direction, size, and leverage with them first, then follow the normal `/trade` flow — never silently.

---

## Publish a Thesis On-Chain

Two ways. Both put the SAME call in `/feed`, built from what the chain holds, and both are graded the
same way (below). Registering is optional: a call saved through `PUT /lab/:address` is graded too, and
the public call ledger is anchored on Arbitrum every hour.

### A. Through Nexus (we encode, Bankr submits)

```
POST https://og.nexustradinglabs.com/proxy/thesis-register
{
  "walletAddress": "<wallet>",
  "bankrApiKey":   "<Bankr API key>",
  "symbol":        "PERP_BTC_USDC",
  "direction":     "LONG",
  "entryPrice":    65000.50,
  "stopLoss":      62000,
  "takeProfit1":   70000,
  "takeProfit2":   0,
  "isPublic":      true,
  "notes":         "BTC breakout thesis",
  "exitPlan":      "SPLIT_50"            // optional, see below
}
```

Before anything is sent, the route checks the levels and simulates the exact transaction from the
wallet (`eth_call`). A refusal at that stage costs no gas. What comes back:

| Status | Meaning | What to do |
|---|---|---|
| 200 `{ok, txHash, thesisId, onChainId}` | Registered and in `/feed` | Done |
| 200 `{already: true}` | This exact call was already registered | Done. Nothing was resent |
| 202 `{pending: true, txHash}` | Sent, receipt not readable yet | **Don't resend.** `POST /theses/index` with that txHash in a minute |
| 400 `bad_levels` / `bad_split` / `bad_exit_plan` / `price_too_small` / `notes_too_long` / `would_revert` | Refused before sending, no gas spent | Fix the call |
| 409 `in_flight` | The same call was sent in the last 15 min and its outcome is unknown | **Don't resend.** Check the wallet's last Arbitrum tx; if it landed, `POST /theses/index` |
| 409 `recent_failure` | Bankr refused the same call in the last 15 min | Check the wallet's last tx; resend only with `"retry": true` |
| 502 `bankr_timeout` / `bankr_no_tx_hash` | Unknown whether Bankr sent it | **Don't resend.** Check the wallet's last tx, then `POST /theses/index` |
| 502 `bankr_submit_failed` | Bankr refused it | Read `detail` |
| 503 `simulation_unavailable` | Arbitrum unreachable, nothing sent | Try again shortly |

The same call (same wallet, same levels and notes) can't be sent twice within 15 minutes, so a retry
loop can't pay twice. `walletAddress` must be the wallet behind `bankrApiKey`: the call is written only
if the registry's event names that wallet.

### B. Call the contract yourself, then index it (no key shared with Nexus)

ThesisRegistry on Arbitrum One (chainId 42161): `0x2F4EdA890f96a7979d6f26bCB210cEDAD68346Bc`

```
function registerThesis(
  string symbol,        // "PERP_BTC_USDC"
  uint8 direction,      // 0 = LONG, 1 = SHORT
  uint256 entryPrice,   // price × 1e6  (65000.50 → 65000500000)
  uint256 stopLoss,     // × 1e6
  uint256 takeProfit1,  // × 1e6
  uint256 takeProfit2,  // × 1e6, 0 if none
  uint256 riskReward,   // |tp1 − entry| / |entry − stop| × 1e4  (2.0 → 20000)
  bool isPublic,
  string notes          // add "#SPLIT_50" to declare a split exit (see below)
) returns (uint256)
```

Send it with Bankr `write_contract` (or any wallet), then:

```
POST https://og.nexustradinglabs.com/theses/index
{ "txHash": "0x…", "walletAddress": "<the wallet that sent it>" }
```

No key. The route reads the transaction from Arbitrum, checks it succeeded with ONE registry event
naming that wallet, decodes the levels from the calldata, and writes that call. Indexing twice returns
the same call (`already: true`). Errors: `wallet_not_proven`, `tx_failed`, `not_a_registration`,
`multiple_registrations` (one registration per transaction), `calldata_unreadable`, `too_old` (index
within 6 hours), 202 `pending` (not mined yet, try again), 503 `chain_unreadable`.
Simulate first (`eth_call` with the same calldata from the wallet): a call the registry rejects reverts
there for free.

**How a call is graded.** First touch on public 1h candles: TP1 before the stop = WIN at the R of the
posted levels; stop first (or both in one hour) = LOSS, −1R. An entry away from the market rests until
price trades it. A `takeProfit2` on its own is a note; it is NOT graded.

**Split exit (optional).** Declares half closed at TP1 and half at TP2, both on the ORIGINAL stop (no
move to breakeven). Graded total = 0.5·R1 + 0.5·R2 if the runner reaches TP2, or 0.5·R1 − 0.5 if the
runner is stopped (WIN when the total is above zero); the call stays PENDING until the runner closes.
Requires `takeProfit2` beyond `takeProfit1`. It is declared ON-CHAIN, as `#SPLIT_50` in the registered
notes: route A adds it when you pass `"exitPlan": "SPLIT_50"`; with route B put it in `notes` yourself.
It can't be added or removed after the call is registered. A call saved through `PUT /lab/:address`
declares it with the field `exitPlan: "SPLIT_50"` at first publish.

---

## Track Your Calls (for agents)

```
GET https://og.nexustradinglabs.com/theses/status/:wallet
```

No key. Returns the wallet's PUBLIC calls that are still open, newest first, plus the last 10 graded:

```
{
  "counts": { "working": 2, "open": 1, "runner": 0, "unchecked": 0, "recentGraded": 3 },
  "calls": [{
    "id": "reg-…", "symbol": "PERP_ETH_USDC", "direction": "LONG",
    "entryPrice": 2400, "stopLoss": 2350, "takeProfit1": 2500, "takeProfit2": null,
    "exitPlan": null, "plannedR": { "tp1": 2, "tp2": null },
    "state": "WORKING",                 // WORKING · OPEN · RUNNER · UNCHECKED
    "filledAt": null, "tp1HitAt": null,
    "live": {
      "mark": 2538,
      "levels": { "entry": { "price": 2400, "pct": -5.44, "r": 2.76 }, "stop": {…}, "tp1": {…} },
      "crossedEntrySincePost": false    // WORKING only
    }
  }],
  "recent": [{ "id": "…", "state": "WIN", "graded": { "outcome": "WIN", "r": 2, "at": 1790… } }]
}
```

- `state` comes from the hourly grader: **WORKING** = the entry hasn't traded (no position) ·
  **OPEN** = live · **RUNNER** = a split call whose TP1 half closed, runner still open · **UNCHECKED**
  = not stamped yet (posted in the last hour).
- `live` is the Orderly mark right now (cached ≤20 s), **not a grade**. `levels.*.pct` = how far each
  level is from the mark, signed; `levels.*.r` = that distance in units of the call's risk. `moveR` (open
  calls) = the position's move in R. A mark through the entry is a fill only once the hourly grade says so.
- Poll it every few minutes to rotate: a call leaves `calls` when it's graded and appears in `recent`.

**Alerts.** The owner gets a notification when a resting order fills (`call_fill`), when a split call's
TP1 half closes (`call_tp1`) and when a call is graded (`call_resolved`). They land in
`GET /notifications/:wallet?unreadOnly=true` (below), on phones with Nexus alerts on, and in Telegram if
linked. All of them come from the hourly grading pass, so expect up to an hour's delay; for anything
faster, poll `/theses/status`.

---

## Notifications

```
GET    /notifications/:wallet
GET    /notifications/:wallet?unreadOnly=true
POST   /notifications/:wallet      { type, message, fromWallet? }
PUT    /notifications/:wallet       { markAllRead: true }
DELETE /notifications/:wallet/:id
```

---

## Comments & Reactions

```
GET    /comments/:thesisId
POST   /comments/:thesisId         { wallet, text }
DELETE /comments/:thesisId/:commentId
GET    /reactions/:thesisId
PUT    /reactions/:thesisId/:emoji  { wallet }   // toggle
```

Allowed emojis: 🔥 💎 📉 ✅ ❌

---

## On-Chain Wallet Registry

```
GET https://og.nexustradinglabs.com/wallets/onchain
```

Returns `{ wallets: string[], fromCache: bool }` — all wallets that have ever registered a thesis on Arbitrum.

---

## Example Prompts

**"Show me the top 5 traders by Rep Score"**
→ GET https://og.nexustradinglabs.com/feed → group by wallet → compute repScore → sort desc → return top 5

**"Who has the highest win rate with ≥5 closed trades?"**
→ GET https://og.nexustradinglabs.com/feed → filter wallets where (HIT_TP + STOPPED_OUT) >= 5 → sort by wins/(wins+losses) desc

**"Copy the #1 trader's latest active BTC thesis with 2% of my $10k stack"**
→ build leaderboard → top wallet → find PERP_BTC_USDC ACTIVE thesis → size: $10k * 0.02 / (entry - sl) → GET /lab/:userWallet → append → PUT /lab/:userWallet

**"Publish my ETH short: entry 3200, SL 3350, TP 2800"**
→ GET /lab/:wallet → create thesis object → registerThesis("PERP_ETH_USDC", "SHORT", 320000000000, 335000000000, 280000000000) → parse ThesisRegistered event → update thesis with onChainId → PUT /lab/:wallet
