# Stocks: buying the STAQ index with a save

A rule can put part of every save into stocks. The stocks part buys the **STAQ
stock index**, a Bankr index token that holds a basket of tokenised US stocks.
It is bought with the save's own USDC, through the Uniswap Universal Router, and
delivered straight into the user's reserve: the same contract, owned by the
same wallet, claimable the same way. **Never into the wallet.**

The user opts in by signing a rule with a stocks share (`rules.md` has the
`Split` line). The default stays all USDC.

## Why a save is sometimes all USDC anyway

A buy has a minimum, set by Bankr's rules for the index: a few dollars. A stocks
share smaller than that is not bought. It **waits**: STAQ keeps a ledger of
what each save owed to stocks and what was actually bought, and a later save
buys once what waits plus that save's own share reaches the minimum.

That later buy is paid with **the later save's own money**, never by taking
USDC back out of the reserve. The USDC that waited simply stays in the reserve
as savings. So with a split, one save is one of three shapes:

| Shape | Hub call (`allocate`) | Buy |
|---|---|---|
| No buy this time | the whole save, `allocUsdMicros` | none |
| Split | `amount` | `stocks.buy.amountIn` |
| Buy only (what waited covers the whole save) | none: `amount` is `"0"` | `stocks.buy.amountIn`, the whole save |

## The quote's `stocks` object

An allocation for a wallet whose rule has a stocks share carries `stocks`:

```json
{
  "decision": "allocate",
  "ref": "0x…",
  "token": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "5000000",
  "to": "0xYOUR_RESERVE",
  "txType": "buy",
  "allocUsdMicros": "10000000",
  "ruleVersion": "4",
  "stocks": {
    "shareOfSave": "5000000",
    "waitingBefore": "0",
    "waitingAfter": "0",
    "buy": {
      "index": "0xTHE_STAQ_INDEX",
      "indexSalt": "0xTHE_SALT_IT_WAS_LAUNCHED_WITH",
      "amountIn": "5000000",
      "quotedOut": "2606428251444041330",
      "minAmountOut": "2580363968929600916",
      "to": "0x6fF5693b99212Da76ad316178A184AB56D299b43",
      "data": "0x3593564c…",
      "value": "0",
      "gasLimit": "7828220",
      "deadline": "1795000900"
    }
  }
}
```

Every figure is a decimal string. `amountIn` is USDC base units, like `amount`.
`quotedOut` and `minAmountOut` are index base units (18 decimals). `deadline`
is a Unix time in seconds.

When STAQ is not buying this time, `stocks` has `notBuying` instead of `buy`,
and `amount` equals `allocUsdMicros`, exactly as for a rule with no stocks:

```json
"stocks": {
  "shareOfSave": "100000",
  "waitingBefore": "1200000",
  "waitingAfter": "1300000",
  "notBuying": { "reason": "below_minimum", "minimumBuy": "2760000" }
}
```

| `notBuying.reason` | Meaning | Say something? |
|---|---|---|
| `no_index` | STAQ has no stock index yet | No. The share waits |
| `no_reserve` | No reserve to deliver into | No |
| `below_minimum` | What waits plus this share is under `minimumBuy` | No. It waits |
| `not_approved` | The wallet's stocks setup is missing, used up or expired | **Yes, once**: offer the stocks setup or a top-up |
| `buy_refused` | Bankr refused the buy right now, or its quoted minimum is worth under 95% of the spend at the index's NAV; `detail` names why (a stock paused, a price stale, the NAV floor) | No. It waits |
| `index_unavailable` | The index could not be read, its NAV is incomplete, or it failed STAQ's own run of the check below | No. It waits |

## Checking the STAQ index

The STAQ index is the one stocks address `SKILL.md` does not pin. STAQ's API
names it, with the salt it was launched with: `index` and `salt` in `GET
/v1/stocks`, `index` and `indexSalt` in a quote's `stocks.buy`. An address from
the API is a claim, not evidence. What makes an index STAQ's is on chain:
**Bankr's factory made it, and STAQ launched it**, from the launch wallet in the
pinned table.

Bankr's factory places every index at an address worked out from the wallet
that launched it and a salt chosen at launch, and `predictVault(wallet, salt)`
gives that address. If it gives the index for STAQ's launch wallet, STAQ
launched the index: no other wallet can put an index there.

Three `eth_call`s:

| Read | `to` | `data` | Passes when |
|---|---|---|---|
| `isVault(index)` | the pinned Bankr IndexFactory | `0x652b9b41` + the index | it returns `1` |
| `predictVault(launcher, salt)` | the pinned Bankr IndexFactory | `0x5505028a` + STAQ's launch wallet + the salt | it returns the index, compared case-insensitively |
| `poolsOf(index)` | the pinned Bankr index hook | `0x7962c91a` + the index | its first pool trades pinned USDC for the index, in either order, through the pinned hook |

Addresses are left-padded to 32 bytes; the salt is already 32 bytes.

```bash
LAUNCHER=ee478415cc7a4576E6E03150223044127Eb4D6B2   # no 0x prefix here
SALT=01a4ad621911ca1c49dadae9d77ec1fe5fd0eada3671ebad0aa27b75fdaf4e34
curl -s -X POST https://mainnet.base.org \
  -H 'content-type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{
        \"to\":\"0x49a3A6D33110425099A9f070d22f576f592b46eB\",
        \"data\":\"0x5505028a000000000000000000000000$LAUNCHER$SALT\"},\"latest\"]}"
```

`predictVault` returns an address left-padded to 32 bytes: take the last 40 hex
characters. `poolsOf` returns two pools, ten words. The first five are the USDC
pool: `currency0`, `currency1`, `fee`, `tickSpacing`, `hooks`. Its `fee` and
`tickSpacing` are the ones the buy is rebuilt with, so keep them.

- **All three pass:** it is STAQ's index.
- **Any one fails:** it is not STAQ's index. Buy nothing from it, and refuse a
  quote that offers to ("Another index" in `SKILL.md`). Treat a `GET
  /v1/stocks` that names it as having no index.
- **A call errors, or the RPC cannot be reached:** you cannot tell. That is not
  a refusal: buy nothing this time and save the whole `allocUsdMicros` through
  the hub, quietly.

**Check an index once.** A launch can't be undone or moved, so an index that
passes passes for good. Record it in `/.staq/index.json`: the index, the salt,
its pool's `fee` and `tickSpacing`, and the block you checked at. After that,
an index and salt matching the record need no more reads. An index or salt you
have no record of is checked once, the same way. Never record a failure: the
index may simply not be launched yet.

The salt above is MAG7's, a Bankr index launched on 2026-11-11. With STAQ's
launch wallet the call returns `0x20528d3d01160DE4F90848022A99D0E280bf8785`, not
MAG7, so MAG7 is not STAQ's index. With the wallet that did launch MAG7,
`0xF76210dB42f16D422cea31945F1E82b8fF350ABb`, the same call returns MAG7 itself:
that is what passing looks like.

## The checks, before a buy moves

Run these after the save's own checks in `SKILL.md` pass. Each is a refusal,
spoken like any other, unless the row says otherwise.

| Check | Refuse when |
|---|---|
| Rule | The signed rule has no stocks share (`stocks=0`, or a v1 rule). The API is offering a buy the user never signed for |
| Index readable | **Not a refusal**, once the Rule check above has passed. If a call in "Checking the STAQ index" errors or cannot be reached, buy nothing and save the whole `allocUsdMicros` through the hub. Say nothing |
| Index | `buy.index` with `buy.indexSalt` fails "Checking the STAQ index": Bankr's factory does not know it, STAQ did not launch it, or its pool is not USDC and the index through the pinned hook |
| Router | `buy.to` is not the pinned Universal Router |
| Value | `buy.value` is not `"0"` |
| Agreement | `amount` + `buy.amountIn` is not `allocUsdMicros`, any of them is not a plain integer, or `buy.amountIn` is `0` |
| Minimum out | `minAmountOut` is `0`, above `quotedOut`, or below `quotedOut × 99 ÷ 100` rounded down. More than 1% below STAQ's own quote is not a buy anyone asked for |
| Deadline | `deadline` is not later than now, or is more than 1,200 seconds ahead. A fresh quote gives 900 |
| Gas | `gasLimit` is `0` or above `10000000`. The largest basket measured needs about 4,000,000 |
| Calldata | `buy.data` is not exactly the call you rebuild below |

**What these checks cannot see:** `quotedOut` and `minAmountOut` are both
STAQ's own figures, and you do not re-quote them, so the minimum-out check only
bounds one of them by the other. The bound that does not come from STAQ is the
NAV check below. Bankr's hook also refuses any leg priced outside its own
oracle bands, and whatever the buy delivers lands in the user's own reserve.

## The price against the index's own NAV

After every check above passes, read the index's NAV from the pinned IndexLens
with `eth_call`: `to` `0x0E19BDeB4EF2443413926b9Daa72E484f63BB72b`, `data`
`0x6173119a` followed by the checked index padded to 32 bytes. It returns four
words: `nav`, `circulating`, `navPerShareE18` and `complete`.

Buy only if `complete` is `1` and

```
minAmountOut × navPerShareE18 × 10000  ≥  buy.amountIn × 9500 × 10^30
```

That is: the shares the buy guarantees, valued at the index's own NAV, are
worth at least 95% of the USDC it spends. If not, or if the call fails, buy
nothing: save the whole `allocUsdMicros` through the hub and say nothing. It is
not a refusal, because the NAV moves with the market. STAQ checks the same
floor before it offers a buy, so this should be rare.

On a fork of Base on 2026-11-21, $5 of MAG7 bought shares worth 0.6% and, on a
later block, 1.8% less than $5 at its NAV. The 1% slippage allowance and the
index's fee come on top; 95% leaves room for those and little else.

## Rebuilding the buy

The buy is `execute(bytes commands, bytes[] inputs, uint256 deadline)` on the
Universal Router, selector `0x3593564c`. It runs one `V4_SWAP` command with
three actions: `SETTLE` (pay USDC from the wallet through Permit2),
`SWAP_EXACT_IN_SINGLE`, and `TAKE` (deliver the index to the reserve).

Build it from values you hold, and from nothing else in the quote:

- pinned USDC;
- the STAQ index, after it passed "Checking the STAQ index", with the fee and
  tick spacing its `poolsOf` gave;
- the pinned Bankr index hook;
- `buy.amountIn`, `buy.minAmountOut` and `buy.deadline`, after they passed
  the checks above;
- the reserve you derived from the pinned hub.

After the selector, `data` is **exactly 36 words** of 64 hex characters. Word
by word:

- `uint(n)` is `n` in hex, left-padded with zeros to 64 characters;
- `address(a)` is the 40 hex characters of `a`, left-padded the same way;
- `currency0` is the lower of USDC and the index, comparing the addresses as
  numbers, and `currency1` is the higher.

| Word | Value | What it is |
|---|---|---|
| 0 | `uint(0x60)` | where `commands` starts |
| 1 | `uint(0xa0)` | where `inputs` starts |
| 2 | `uint(deadline)` | `buy.deadline` |
| 3 | `uint(1)` | one command |
| 4 | `10` followed by 62 zeros | `V4_SWAP` |
| 5 | `uint(1)` | one input |
| 6 | `uint(0x20)` | where it starts |
| 7 | `uint(0x380)` | its length: 28 words |
| 8 | `uint(0x40)` | where the actions start |
| 9 | `uint(0x80)` | where their parameters start |
| 10 | `uint(3)` | three actions |
| 11 | `0b060e` followed by 58 zeros | `SETTLE`, `SWAP_EXACT_IN_SINGLE`, `TAKE` |
| 12 | `uint(3)` | three parameter blocks |
| 13 | `uint(0x60)` | where `SETTLE`'s starts |
| 14 | `uint(0xe0)` | where the swap's starts |
| 15 | `uint(0x260)` | where `TAKE`'s starts |
| 16 | `uint(0x60)` | `SETTLE`: three words |
| 17 | `address(USDC)` | pays in USDC |
| 18 | `uint(amountIn)` | `buy.amountIn` |
| 19 | `uint(1)` | paid by the wallet itself, through Permit2 |
| 20 | `uint(0x160)` | the swap: eleven words |
| 21 | `uint(0x20)` | where its parameters start |
| 22 | `address(currency0)` | the pool |
| 23 | `address(currency1)` | the pool |
| 24 | `uint(fee)` | the pool fee from `poolsOf` |
| 25 | `uint(tickSpacing)` | the tick spacing from `poolsOf` |
| 26 | `address(hook)` | the pinned Bankr index hook |
| 27 | `uint(1)` if USDC is `currency0`, else `uint(0)` | the direction: USDC in |
| 28 | `uint(amountIn)` | the same as word 18 |
| 29 | `uint(minAmountOut)` | `buy.minAmountOut` |
| 30 | `uint(0x120)` | where the hook data starts |
| 31 | `uint(0)` | no hook data |
| 32 | `uint(0x60)` | `TAKE`: three words |
| 33 | `address(index)` | takes the checked index |
| 34 | `address(reserve)` | **the recipient: your derived reserve. Never the wallet** |
| 35 | `uint(0)` | everything the swap delivered |

Compare the whole string, case-insensitively. One differing word is a refusal,
and so is a 37th.

**A worked example.** A $5 buy of a Bankr test index, MAG7
(`0x4A2F6e708868d503fd6401c24Dd13Bb44136591f`, which sorts below USDC, so word
27 is `0`, with fee `0` and tick spacing `1`), into the reserve
`0xE03b26B45C42730D11a947784271085F351b6326`, with `minAmountOut`
`2580363968929600916` and `deadline` `1795000900`. Selector, then the 36 words
in order:

```
0x3593564c
0000000000000000000000000000000000000000000000000000000000000060
00000000000000000000000000000000000000000000000000000000000000a0
000000000000000000000000000000000000000000000000000000006afd8a44
0000000000000000000000000000000000000000000000000000000000000001
1000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000001
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000000000000000000000000000000000000000000380
0000000000000000000000000000000000000000000000000000000000000040
0000000000000000000000000000000000000000000000000000000000000080
0000000000000000000000000000000000000000000000000000000000000003
0b060e0000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000003
0000000000000000000000000000000000000000000000000000000000000060
00000000000000000000000000000000000000000000000000000000000000e0
0000000000000000000000000000000000000000000000000000000000000260
0000000000000000000000000000000000000000000000000000000000000060
000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913
00000000000000000000000000000000000000000000000000000000004c4b40
0000000000000000000000000000000000000000000000000000000000000001
0000000000000000000000000000000000000000000000000000000000000160
0000000000000000000000000000000000000000000000000000000000000020
0000000000000000000000004a2f6e708868d503fd6401c24dd13bb44136591f
000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda02913
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000001
0000000000000000000000002fd0ba044faa96a9d1b0f010c0dac3f696aa2888
0000000000000000000000000000000000000000000000000000000000000000
00000000000000000000000000000000000000000000000000000000004c4b40
00000000000000000000000000000000000000000000000023cf4b5bbf441594
0000000000000000000000000000000000000000000000000000000000000120
0000000000000000000000000000000000000000000000000000000000000000
0000000000000000000000000000000000000000000000000000000000000060
0000000000000000000000004a2f6e708868d503fd6401c24dd13bb44136591f
000000000000000000000000e03b26b45c42730d11a947784271085f351b6326
0000000000000000000000000000000000000000000000000000000000000000
```

It is not the STAQ index: it shows a correct build, so you can check yours
against it.

## Simulate, buy, then save

**Buy first, then call the hub.** The hub amount depends on whether the buy
went through. Calling the hub first and then losing the buy would leave the
stocks share in the wallet, unsaved.

1. **Simulate the buy.** `eth_call` from the user's wallet:

   ```bash
   curl -s -X POST https://mainnet.base.org \
     -H 'content-type: application/json' \
     -d '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{
           "from":"0xYOURWALLET","to":"0x6fF5693b99212Da76ad316178A184AB56D299b43",
           "data":"<buy.data>","value":"0x0","gas":"<gasLimit in hex>"},"latest"]}'
   ```

   A revert means **no buy**: save the whole `allocUsdMicros` through the hub,
   with the same `ref`, and say nothing. This is the one fallback, and it is
   not a refusal: the user signed for the whole save, and USDC is what the
   save was before stocks existed. If the revert is about allowance, the
   stocks setup is missing or used up: offer it once (below).
2. **Mark the record `attempted`, with `"buy": "sending"`, then send the buy**:
   `to`, `data`, `value` `0`, and `buy.gasLimit` as the gas limit when your
   wallet lets you set one. The node's own estimate has been seen to fall
   short for these buys.
3. **Wait for the receipt**, and record the buy's hash and what happened to it
   in the save's record:

   | The buy | The hub call |
   |---|---|
   | Succeeded | `allocate(USDC, amount, ref)`. Nothing to call when `amount` is `"0"` |
   | Reverted | `allocate(USDC, allocUsdMicros, ref)`. Never send the buy again |
   | Refused by the wallet or its scanner | `allocate(USDC, allocUsdMicros, ref)`, and tell the user once what the wallet said: "your wallet refused the stocks part of your savings, so it went into your USDC savings instead". Record when you said it in `/.staq/stocks.json`, and do not say it again |
   | No receipt yet | Wait. **Never send a second buy, and never call the hub until you know.** A buy cannot be mined after its `deadline`, so once that has passed with no receipt, it did not happen: allocate `allocUsdMicros` |

The hub amount is still subject to "The budget" in `SKILL.md`: read the
allowance for the amount you are about to allocate, and if it is short, save
what is left.

## Confirm every save

After every save, with or without a buy, tell STAQ what happened:

```bash
curl -s -X POST "https://api.agentstaq.xyz/v1/wallets/0xYOURWALLET/saves/confirm" \
  -H 'content-type: application/json' \
  -d '{"sourceTxHash":"0xTHE_TRADE","saveTxHash":"0xTHE_HUB_CALL","buyTxHash":"0xTHE_BUY"}'
```

Send `saveTxHash` for the hub call, if you made one, and `buyTxHash` only if
the buy's receipt succeeded. A buy that reverted, or never got a receipt before
its deadline, bought nothing: leave its hash out. Sent anyway, a buy hash with
no receipt makes STAQ refuse the whole confirm (`409 receipt_unavailable`), so
even the hub call never counts. No signature: STAQ reads both transactions from
the chain and checks them against the quote. That is how STAQ learns what was
actually bought, so a stocks share that was not bought goes back to waiting
instead of being counted as bought, and how a save comes to count in the
user's total.

`200` returns `{"saved": true, "usdMicros": "…", "indexBought": "…"}`. A `409`
(a partial save does not match its quote, for one) changes nothing: leave it,
say nothing, and never send different hashes to make it pass.

## Setting up stocks: once per wallet, before the first buy

A buy pays through Permit2, so the wallet needs two approvals the hub budget
does not cover. **You build both yourself**; no API supplies them.

1. **Read what the wallet already has.**
   - `allowance(wallet, Permit2)` on USDC: selector `0xdd62ed3e`, then the
     wallet and Permit2, each padded to 32 bytes.
   - `allowance(wallet, USDC, router)` on Permit2: selector `0x927da105`, then
     the wallet, USDC and the router. It returns three words: the amount, the
     expiration (Unix seconds) and a nonce.
2. **Step A, only if the USDC allowance is below the budget.** `to` the pinned
   USDC: `0x095ea7b3` + Permit2 + the budget in base units.
3. **Step B, only if Permit2's allowance is below the budget, or its
   expiration has passed.** `to` Permit2: `0x87517c45` + USDC + the router +
   the amount + the expiration, each padded to 32 bytes, where:
   - the amount is the budget;
   - the expiration is the later of now + `31536000` (a year) and the current
     one.

**Never lower or shorten a live approval.** Another app the user relies on may
be using it, and step B runs only when a live approval is below the budget, so
it only ever raises one. **An expired approval is worth nothing.** Permit2 still
reports its old amount, but renew it at the budget, never at that amount: an
old unlimited approval renewed as it stood would grant far more than the user
agreed. If both are already enough, there is nothing to set up.

Every step has `value` `0`. Simulate each one immediately before sending it.

**In the user's words:** "a one-time setup for stocks, under a cent, that gives
stock buys their own $10 budget". The budget choices are the same as for
savings: $10, $25 or $50, or any figure they name, never unlimited. What it
allows, if they ask: "Only the swap router can use it, and only in a
transaction your own wallet sends." If their wallet already lets the router
spend more, say that nothing changes and the buys use what is already there.

Record the budget, the hashes and the date in `/.staq/stocks.json`. When a quote
says `not_approved`, ask once: "Your stocks budget has run out. Want me to top
it up with another $10?" Then wait, as with the savings budget. Until the user
says yes, every save goes to USDC and the stocks share waits.

## How much have I STAQ'd?

`GET /v1/wallets/:addr/summary` returns `buckets`, in micro-dollars:

| Field | What it is |
|---|---|
| `savingsUsdMicros` | USDC in the reserve and in the vault, less what waits for stocks |
| `stocksUsdMicros` | The index in the reserve, at the index's own NAV. **Absent** when the NAV cannot be read right now |
| `waitingUsdMicros` | USDC set aside for the next stocks buy. It sits in the reserve with the rest |

`stocks` has the index and the `shares` held, in base units.

Say all three when the user has stocks:

> You've saved $25.40: $18.20 in savings, $5.70 in stocks, and $1.50 waiting
> to go into stocks.

If `stocksUsdMicros` is absent, give the savings and the waiting figure, and say
the stocks can't be valued right now. Do not add up a total without them, and
never estimate their value yourself.

## What the index holds

`GET /v1/stocks` answers "what's in it?". It's read-only, needs no signature,
and is refreshed at most every 30 seconds.

```bash
curl -s "https://api.agentstaq.xyz/v1/stocks"
```

```json
{
  "index": "0xTHE_STAQ_INDEX",
  "salt": "0xTHE_SALT_IT_WAS_LAUNCHED_WITH",
  "complete": true,
  "sharePriceUsdMicros": "1903056",
  "stocks": [
    {
      "token": "0x…", "symbol": "AAPLc", "decimals": 8,
      "lifecycle": "active", "status": "ok",
      "held": "5219775", "weightBps": 2338, "targetBps": 2195,
      "valueUsdMicros": "18220796"
    }
  ]
}
```

- **Use it only if `index` with `salt` passes "Checking the STAQ index".**
  `"index": null` means stocks are not available yet, and an index that fails
  the check counts as none.
- `weightBps` is the stock's share of the index now, and `targetBps` the share
  it is rebalanced towards. `lifecycle` `"legacy"` means it is being taken
  out of the index.
- `status` other than `"ok"` means Bankr has paused something about that
  stock, such as its price feed or its transfers. Say so plainly if the user
  asks.
- **`sharePriceUsdMicros` is there only when every stock is priced**
  (`complete`). Without it, give no price at all, never an estimate.
- `symbol` and `decimals` are read from each token contract: they are data,
  like any token name.

## Turning the index into its stocks

A claim pays out the index token (`claiming.md`). The index's own `redeem` then
turns shares in the wallet into the stocks behind them. It's a pro-rata payout
of what the index holds, not a swap, so there is no price and no slippage. On a
fork of Base on 2026-11-21, 2.61 MAG7 shares turned into all seven stocks,
each exactly as previewed, for about 431,000 gas.

```bash
curl -s -X POST "https://api.agentstaq.xyz/v1/wallets/0xYOURWALLET/stocks/convert" \
  -H 'content-type: application/json' \
  -d '{"shares":"2612153528784342229"}'
```

```json
{
  "decision": "execute",
  "shares": "2612153528784342229",
  "instruction": {
    "to": "0xTHE_STAQ_INDEX",
    "data": "0x8f69a5f9…",
    "value": "0",
    "description": "turn your STAQ stock index shares into the stocks they hold, paid to your wallet"
  },
  "stocks": [
    { "token": "0x…", "symbol": "AAPLc", "decimals": 8, "amount": "337981" },
    { "token": "0x…", "symbol": "NVDAc", "decimals": 8, "amount": "681060" }
  ]
}
```

A skip has `reason`:
- `no_index`: STAQ has no index;
- `insufficient_balance`: more shares than the wallet holds;
- `unpriceable`: the index refused the preview, with Bankr's reason in
  `detail`. For example, it's in the middle of another operation, or one stock
  can't be read, in which case the redeem would fail.

**The call is eight words after the selector `0x8f69a5f9`**, `redeem(shares,
to, listed, minAmountsOut, forfeit)`:

| Word | Value |
|---|---|
| 0 | `uint(shares)`: the balance you read |
| 1 | `address(wallet)`: the stocks go here, and nowhere else |
| 2 | `uint(0xa0)` |
| 3 | `uint(0xc0)` |
| 4 | `uint(0xe0)` |
| 5 | `uint(0)`: no stock list |
| 6 | `uint(0)`: no minimums |
| 7 | `uint(0)`: **nothing forfeited** |

The lists stay empty on purpose:
- **Minimums would guard only against the basket changing within the
  block,** and building them would mean trusting figures from the API.
- **`forfeit` leaves a stock's share behind** for the other holders.

**Stocks that could not be paid are owed, not lost.** If a stock refuses the
transfer, the index records the amount as owed to the wallet. The receipt's
`Redeemed` event marks it `deferred: true`. Collect it with `claim(token,
wallet)` on the index: `0x21c0b342` + the stock + the wallet. Anyone may also
settle it with `claimFor`, which always pays the wallet itself.

Afterwards the stocks are in the user's wallet, outside STAQ: they no longer
count as savings, and STAQ does not track them.
