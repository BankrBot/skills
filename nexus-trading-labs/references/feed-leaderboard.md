# Feed, Leaderboard & Thesis Reference

## Public Feed

```
GET https://og.nexustradinglabs.com/feed
```

Returns `{ feed: [...] }`: three kinds of row.

- **Resolution rows (`resolution: true`)** announce a graded call ("BTC SHORT stopped out, −1R"). No levels:
  `kind`, `wallet`, `thesisId`, `symbol`, `direction`, `outcome`, `r`, `message`, `createdAt`.
- **Agent rows (`agent: true`, name "Nexus Agent")** are the autonomous agent's own trades. They are not
  calls, aren't graded and never count toward a caller's record.
- **Call rows** (everything else) = the public calls:
  - `id`, `wallet`, `displayName`, `pfp`, `symbol`, `direction` ("LONG"/"SHORT")
  - `entryPrice`, `stopLoss`, `takeProfit1`, `takeProfit2`, `exitPlan` (`"SPLIT_50"` or absent), `notes`
  - `createdAt` / `publishedAt` (server clock), `publishMark` (market price read at publish, when present)
  - **The grade:** `gradedOutcome` ("WIN" / "LOSS", absent while unresolved) and `gradedR` (the R it paid),
    stamped hourly from public price. Count results from these two fields.
  - `fillState` on an unresolved call: "WORKING" = the entry hasn't traded yet (no position), "OPEN" = it has.
  - `status` mirrors the grade on a published call; use `gradedOutcome`, which is the grade itself.
  - Ignore `actualPnl`, `accountSize` and `positionSize` for any record: the caller types them. `riskReward`
    is caller-written too; the R:R is `(takeProfit1 − entryPrice) / (entryPrice − stopLoss)` from the levels.

---

## Trader Lab

```
GET  /lab/:walletAddress          // all theses for wallet
PUT  /lab/:walletAddress          // body: { theses: ThesisTrade[] }
GET  /profile/:walletAddress      // { pfp, displayName }
PUT  /profile/:walletAddress      // body: { pfp?, displayName? }
```

---

## The Graded Caller Board

The caller board is computed by Nexus's grader, not by the agent. Read it; don't rebuild it.

```
GET https://og.nexustradinglabs.com/theses/leaderboard
```

Returns `{ leaderboard, emerging, criteria }`:
- `leaderboard`: callers with **5+ graded calls AND a positive average R**, top 25, already in rank order.
  Each entry: `rank`, `wallet`, `displayName`, `calls` (graded calls), `hitRate` (%), `avgR`, `totalR`,
  `score`, `expectancy` (`{ expectancy, profitFactor, … }` in R), `meritRank`, plus `discipline`,
  `calibration`, `regimeEdge`, `contrarian`, `rSeries`.
- `emerging`: callers with 1–4 graded calls. Each: `wallet`, `calls`, `hitRate`, `avgR`, `totalR`,
  `callsToQualify`, `displayName`, `pfp` (up to 15). **Unranked**: list them as emerging, never number them.
- `criteria`: `{ minCalls, grading, discipline, regime }`. `criteria.grading` explains, in plain text, how
  every call is graded. Quote it when a user asks how ranking works.

**Order = the array order (`rank`).** `score` is sample-adjusted expectancy in R, not hit rate. Don't
re-sort by hit rate or anything else.

**An empty `leaderboard` is a real answer**, not an outage: nobody currently clears 5 graded calls with a
positive average R. Say that, and offer `emerging` if it has rows.

**`meritRank`** is earned from the graded record only. `null` = unranked, so show nothing. Never invent
a tier.

| Rank | Needs |
|---|---|
| ▪ Signal | 5+ graded calls, average R above zero |
| ◆ Sharp | 15+ graded calls, 50%+ hit rate, average R ≥ 0.5 |
| ✦ Apex | 30+ graded calls, 55%+ hit rate, average R ≥ 1.0 |

### One trader's graded record

```
GET https://og.nexustradinglabs.com/theses/process/:wallet
```

`{ wallet, calls, hitRate, avgR, totalR, meritRank, expectancy, calibration, contrarian, regime,
regimeEdges, discipline }` for any wallet, ranked or not: every graded public call, the same record
the board ranks on. `calls: 0` (with `note`) = no graded call yet. Say "no graded calls yet", not
"0% win rate".

### How to state a record

- **A hit rate never goes out alone.** Always pair it with the average R and the graded call count:
  "28 graded calls · 36% hit · +0.05R avg". A 36% hit rate can be profitable and a 70% one can lose.
- Under 5 graded calls, give the count and say it's too few to rank on.
- Say "graded from public price", never "verified": these are numbers from Nexus's API (SKILL.md safety
  rules). The grade is recomputable from public candles; `criteria.grading` says how.

### Retired: Rep Score

Earlier versions of this guide had agents compute a "Rep Score" from the feed (hit rate plus a bonus
for the R:R the caller *planned*). It isn't graded: it rewards wide planned targets that never hit, and
it read self-set statuses. Nexus removed it from the app on 2026-10-16. **Don't compute it.** When a user
asks for a Rep Score, answer with the graded record above.

---

## ThesisRegistry Contract

**Address:** `0x2F4EdA890f96a7979d6f26bCB210cEDAD68346Bc` (Arbitrum One)
**Verified:** https://arbiscan.io/address/0x2F4EdA890f96a7979d6f26bCB210cEDAD68346Bc

Key functions:
```solidity
registerThesis(string symbol, uint8 direction, uint256 entryPrice, uint256 stopLoss,
               uint256 takeProfit1, uint256 takeProfit2, uint256 riskReward, bool isPublic,
               string notes) → thesisId          // full argument notes: "Publish a Thesis On-Chain", route B
closeThesis(uint256 thesisId, string outcome, string settlementTxHash)
getTraderStats(address trader) → (wins, losses, activeTrades)   // self-reported, see below
getThesis(uint256 thesisId) → ThesisData
```

Price encoding: `Math.round(price * 1e6)` — e.g. BTC at $65,432.10 → `65432100000` (contract uses 6 decimal scaling, NOT 8)

`getTraderStats` counts the outcomes callers report themselves through `closeThesis`. It is not the
grade: never rank on it or quote it as a record. The graded record is `/theses/process/:wallet`.

Registering emits ONE event from the registry with the thesis id as topic 1 and the trader (`msg.sender`) as
topic 2. Read it by that layout, not by an event-signature hash.

---

## Copy Trading Flow

> ⚠️ **Copying is NOT auto-trading.** This flow saves a *thesis* (a plan) to the user's lab — it does **not** place an order. NEVER chain a copied thesis straight into `/trade`/`/agent` without an explicit user confirmation for that specific position.
>
> **On reputation signals:** the graded caller board (`/theses/leaderboard`) grades outcomes **objectively against public Orderly price** (first-touch TP-vs-SL on public OHLC, recomputable by anyone), not self-reported PnL. That's the strongest signal here. Even so, treat ANY single number (a merit rank, a board position, a graded record) as a **cross-check only, never the sole automated gate** before risking capital: a record can still be gamed by wash trading or coordinated publishing. `getTraderStats()` is self-reported and not a signal at all. Always require operator sign-off before opening a position derived from a third party's call.

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
  "takeProfit2":   74000,                // optional; required (beyond TP1) only with exitPlan
  "isPublic":      true,
  "notes":         "BTC breakout thesis",
  "exitPlan":      "SPLIT_50"            // optional, see below. Omit it (and TP2 if unused) for TP1-only
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

**Send one request and wait for its answer.** A REPEAT of the same call (same wallet, same levels and
notes) within 15 minutes is never sent again: it gets the first txHash, or a 409. That covers a retry
loop that waits for each answer. It does NOT cover two identical requests fired at the same moment:
they can both be sent and both pay gas. So never fire the same registration in parallel, and after any
502 / 409 / timeout, check the wallet's last Arbitrum transaction before doing anything else.
`walletAddress` must be the wallet behind `bankrApiKey`: the call is written only if the registry's
event names that wallet.

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
  "markAt": 1790000000000, "markAgeSec": 4,  // when the marks in `live` were read
  "marksAvailable": true,                    // false → no marks: every `live` is null
  "marksStale": false,                       // true → Orderly unreadable, marks up to 2 min old
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
- `live` is the Orderly mark at `markAt`, **not a grade**. Normally ≤20 s old. If Orderly can't be
  read, the last read is reused for up to 2 minutes with `marksStale: true`; past that there are no
  marks (`marksAvailable: false`, every `live` is `null`). Check `markAgeSec` before acting on a distance. `levels.*.pct` = how far each
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

**"Show me the top 5 callers"** (or "…by Rep Score")
→ GET https://og.nexustradinglabs.com/theses/leaderboard → first 5 of `leaderboard`, in order → for each: name or
short wallet, `meritRank`, "N graded calls · H% hit · ±R avg". Empty `leaderboard` → "No caller clears the bar
yet (5 graded calls, positive average R)", then list `emerging`. Rep Score is retired: say so in one line.

**"Who has the highest win rate?"**
→ GET https://og.nexustradinglabs.com/theses/leaderboard → answer from the graded entries, each with its average R
and call count beside the hit rate, and say the board is ordered by expectancy, not hit rate. Never rank callers
from `/feed` statuses.

**"What's 0xabc…'s record?"**
→ GET https://og.nexustradinglabs.com/theses/process/0xabc… → "N graded calls · H% hit · ±R avg", plus `meritRank`
if not null. `calls: 0` → "no graded calls yet".

**"Copy the #1 trader's latest active BTC thesis with 2% of my $10k stack"**
→ GET /theses/leaderboard → top entry's wallet (empty board → say so, stop) → find its PERP_BTC_USDC call in /feed
with no `gradedOutcome` → confirm with the user → size: $10k * 0.02 / (entry - sl) → GET /lab/:userWallet → append → PUT /lab/:userWallet

**"Publish my ETH short: entry 3200, SL 3350, TP 2800"**
→ Route A: POST https://og.nexustradinglabs.com/proxy/thesis-register { walletAddress, bankrApiKey, symbol: "PERP_ETH_USDC", direction: "SHORT", entryPrice: 3200, stopLoss: 3350, takeProfit1: 2800, isPublic: true } → done when it answers 200 (202 → POST /theses/index with the txHash)
→ or Route B: write_contract registerThesis("PERP_ETH_USDC", 1, 3200000000, 3350000000, 2800000000, 0, 26667, true, "") → POST /theses/index { txHash, walletAddress }
