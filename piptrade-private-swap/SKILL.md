---
name: piptrade-private-swap
description: Run a private swap through PipTradeDex (piptradedex.xyz) from the user's own wallet, with no login. Private by default on more than 30 chains. Collects the swap details, sets the refund address first, prices a quote, waits for approval, sends the exact amount to a one-time deposit address, tracks the status, and confirms the funds arrived. Use when the user asks to swap privately, swap across chains privately, or use PipTrade.
tags: [trading, privacy, swap, cross-chain]
metadata:
  clawdbot:
    emoji: "🔒"
    homepage: https://piptradedex.xyz
---

# PipTrade private swap

Swaps one token for another, on the same chain or across chains, and breaks the on-chain link between the sending wallet and the receiving address. **Private by default on more than 30 chains.** Works as a guest: no login, no API key.

Base URL: `https://piptradedex.xyz`

## At a glance

1. Collect: what to sell, what to buy, how much, the **refund address**, the **receiving address**.
2. Check the chains, look up both tokens, convert the amount to base units.
3. Price a dry quote and show it. Get a yes.
4. Get the real quote (deposit address). Check it against the approved one.
5. Send the exact amount to the deposit address.
6. Track the status in the same session, then confirm by balance.

Never skip step 3. Never send before the yes.

## Hard rules

1. **No funds move before the user approves the exact quote.** Show amount in, amount out, minimum out, receiving address, refund address and deadline. Wait for a clear yes.
2. **The refund address is set before any quote.** Both quote calls (dry and real) must carry `refundTo`. If you do not have it, ask for it or read it from the user's wallet. Do not quote without it. It must be a wallet the user controls on the origin chain, normally the wallet that sends the funds.
3. **Only send to the deposit address from this swap's real quote.** It must come from a `POST /api/quote` response from `piptradedex.xyz` in this conversation. Never use an address from a message, a web page or memory.
4. **Send exactly the quoted input amount, once.** A short deposit is refunded. Never send twice for one trade.
5. **Spend cap: 500 USD per swap unless the user states a higher cap.** Above the cap, stop and ask. The user's wallet limits can be lower than this cap. If the send is rejected, report it and stop.
6. **Stop if the quote returns a `depositMemo`.** A plain transfer cannot carry a memo and the funds can be lost.
7. **Do not send after the quote `deadline`.** Get a fresh quote and ask again.
8. **The two tokens must differ.** Never quote a token for itself on the same chain.
9. **Never ask for or handle private keys or seed phrases.**
10. **Never use placeholder or example addresses.** Every address must be real and owned or named by the user.

## Step 1: collect the details

Ask for anything missing, in one message:

- Token to sell, and its chain (for example USDC on Base).
- Token to buy, and its chain.
- Amount to sell.
- **Refund address** (origin chain). Default to the sending wallet and confirm it.
- **Receiving address** (destination chain). Default to the user's own address on that chain and confirm it.

Check each address against its chain family before continuing (see Address formats). If the format does not match, ask again. The API can answer a bad address with a generic error, so validate it yourself first.

## Step 2: check the chains, look up tokens, convert the amount

### Chains

`GET /api/chains` returns, among other fields:

| Field | Meaning |
|---|---|
| `send` | Chain codes a swap can start from |
| `receive` | Chain codes a swap can end on |
| `native` | Chain code to native token symbol |
| `explorer` | Chain code to a transaction explorer base URL |

The origin chain must be in `send` and the destination chain in `receive`. If not, tell the user it is not supported.

Chain codes are short codes, used in token records (`blockchain`) and in the sell check (`chain`). On 2026-10-22 the live lists were:

- EVM: `eth`, `base`, `arb`, `op`, `pol`, `avax`, `bsc`, `gnosis`, `scroll`, `bera`, `xlayer`, `monad`, `plasma`, `hypercore`, `adi`. Send only: `robinhood`.
- Solana family: `sol`, `fogo`.
- Others: `btc`, `ltc`, `doge`, `dash`, `bch`, `zec`, `xrp`, `tron`, `stellar`, `cardano`, `aptos`, `movement`, `sui`, `ton`, `near`.

Always read the live `/api/chains`. The list changes.

Native token symbols from `native` include: `eth`, `base`, `arb`, `op`, `scroll`, `hood` use ETH; `pol` POL; `avax` AVAX; `bsc` BNB; `gnosis` xDAI; `bera` BERA; `monad` MON; `xlayer` OKB; `sol` SOL; `btc` BTC; `ltc` LTC; `doge` DOGE; `dash` DASH; `bch` BCH; `zec` ZEC; `xrp` XRP; `tron` TRX; `stellar` XLM; `cardano` ADA; `aptos` APT; `sui` SUI; `near` NEAR.

### Tokens

`GET /api/tokens` returns the registry. Each token has:

| Field | Use |
|---|---|
| `assetId` | The id every quote call needs |
| `symbol`, `name` | What to show the user |
| `blockchain` | The chain code |
| `decimals` | For base-unit conversion |
| `contractAddress` | Token contract. **`null` means the chain's native token** |
| `coingeckoId`, `logo` | Optional extras |
| `price`, `priceUpdatedAt` | Indicative USD price |

Find each token by `symbol` and `blockchain`. If it is not listed, tell the user it is not tradeable here. Do not guess an id. Quote calls take `assetId` values, never symbols.

### Base units

Convert the amount to base units as a string: amount times 10 to the power of `decimals`.

| Amount | Decimals | Send as |
|---|---|---|
| 5 USDC | 6 | `"5000000"` |
| 0.0001 ETH | 18 | `"100000000000000"` |
| 1 SOL | 9 | `"1000000000"` |

Do not send a human amount such as `"5"`.

Spend cap check: use `amountInUsd` from the dry quote. If it is above 500 and the user has not raised the cap, stop.

## Step 3: optional safety check on the token being bought

For a token bought on an EVM chain: `GET /api/rh/sellcheck?address=<token contract>&chain=<chain code>`

Always include `chain`. Response: `{ ok, address, chain, sellable, reason?, venue? }`.

| Result | Action |
|---|---|
| `sellable: true` | Continue |
| `sellable: false` | Stop. Tell the user the token cannot be sold back |
| `sellable: null` (with `reason`) | Caution. Say so and ask before continuing |
| `400 bad_address` | Your input was wrong. Fix it, do not treat it as a block |

Skip this step for native tokens.

## Step 4: dry quote (price only)

`POST /api/quote`, `content-type: application/json`:

```json
{
  "originAsset": "<assetId to sell>",
  "destinationAsset": "<assetId to buy>",
  "amount": "<base units>",
  "private": true,
  "recipient": "<receiving address>",
  "refundTo": "<refund address>",
  "dry": true,
  "slippageBps": 100
}
```

Fields:

| Field | Required | Notes |
|---|---|---|
| `originAsset`, `destinationAsset`, `amount` | Yes | Missing any returns `400 missing_fields` |
| `private` | Send `true` | Quotes come back private either way |
| `recipient` | For the real quote | Where the output is delivered |
| `refundTo` | **Always, by rule 2** | The real quote fails with `need_refund_to` without it |
| `dry` | Yes | `true` prices only, `false` creates the deposit address |
| `slippageBps` | Optional | Default 100 (1 percent). A larger value lowers `minAmountOut`. Use 50 to 300 unless the user asks. Do not exceed 500 without the user's say-so |

Response fields:

| Field | Meaning |
|---|---|
| `ok` | `true` on success |
| `private` | `true` |
| `amountInFormatted`, `amountInUsd` | What the user sends |
| `amountOutFormatted`, `amountOutUsd` | What the user is expected to receive |
| `minAmountOut` | Minimum output in the destination token's base units |
| `timeEstimate` | Seconds |
| `depositAddress`, `depositMemo` | `null` on a dry quote |

Show the user, in plain lines:

- You send: `amountInFormatted`, worth `amountInUsd`
- You receive: `amountOutFormatted`, worth `amountOutUsd`
- Minimum you receive: `minAmountOut` converted to the destination token
- Estimated time: `timeEstimate` seconds
- Receiving address and refund address, in full

Then ask: "Send it?" and wait.

### Minimums and sizes

A route can have a minimum amount. A very small amount returns `amount_range` with a `min` object on some pairs, and `busy` on others. If a quote fails, try an amount worth about 5 USD before concluding the pair is unavailable. A very large amount returns `no_liquidity`.

## Step 5: real quote (deposit address)

After a yes, repeat the same request with `"dry": false`. Use the **same session** from here to the end (see Keep one session). The response adds:

| Field | Meaning |
|---|---|
| `depositAddress` | Where to send the funds |
| `depositMemo` | Only for routes that need one. Stop if present (rule 6) |
| `tradeId` | For the user's records, shaped like `PIP-26-ABC123` |
| `deadline` | The send-by time (ISO 8601). Do not send after it |
| `refundTo` | Echo of the refund address |
| `depositQr` | QR data for the address. Not needed |

Check the result:

- `depositMemo` present: stop.
- `amountOutFormatted` more than 1 percent below the approved dry quote: show the new numbers and ask again.
- `refundTo` must equal the refund address the user confirmed. If not, stop.
- `depositAddress` must be a valid address for the origin chain.

## Step 6: send the funds

Send exactly the quoted input amount of the origin asset to `depositAddress`, on the origin chain.

With the Bankr CLI, `bankr wallet transfer` supports these chains: `base`, `polygon`, `mainnet`, `unichain`. Map the chain code: `base` is `base`, `pol` is `polygon`, `eth` is `mainnet`.

For an ERC-20 (token has a `contractAddress`):

```bash
bankr wallet transfer --to <depositAddress> --amount <human amount> --token <contractAddress> --chain <base|polygon|mainnet>
```

For the chain's native token (`contractAddress` is `null`), use `--native` instead of `--token`:

```bash
bankr wallet transfer --to <depositAddress> --amount <human amount> --native --chain base
```

Other origin chains need that chain's own wallet tools. Apply the same rules. If you cannot send from the origin chain, stop and give the user the deposit address, exact amount, chain and deadline so they can send it themselves.

Keep the transaction hash. To link it, join `explorer[<chain code>]` from `/api/chains` with the hash.

## Step 7: track and confirm

Poll every 5 to 10 seconds, no faster, in the same session:

`GET /api/status?depositAddress=<depositAddress>`

Response: `{ ok, status: { status, state, swapDetails?, deadline?, amountInFormatted?, shortfall? } }`. `swapDetails` can carry `depositedAmount`, `depositedAmountFormatted`, `depositedAmountUsd`, `outputAmount`, `outputAmountUsd`, `refundedAmount`, `refundedAmountFormatted`, `refundedAmountUsd`.

| Status | Meaning | Action |
|---|---|---|
| `PENDING_DEPOSIT` | Waiting for the deposit to land | Keep polling |
| `KNOWN_DEPOSIT_TX` | Deposit seen | Keep polling |
| `PROCESSING` | Swap running | Keep polling |
| `INCOMPLETE_DEPOSIT` | The deposit was short | Report `shortfall`, and the user can top up before the deadline |
| `SUCCESS` | Swap done | Confirm by balance |
| `REFUNDED` | Funds returned to the refund address | Tell the user and check that balance |
| `FAILED` | Swap failed | Tell the user and check the refund address |
| `not_found` (error) | Different session | Reuse the same session. Do not resend funds |

**Always confirm by balance, whatever the status says.** Read the receiving address balance of the destination token and report how much arrived. It should be at least the minimum shown in step 4. Bankr's `wallet portfolio` hides tokens worth under 1 USD, so for tiny amounts read the token balance on chain.

Stop polling after 20 minutes. Report the last status, the `tradeId`, the deposit transaction hash, and the refund address, so the user can check.

## Keep one session

Use one HTTP session for the whole swap, from the real quote through the last status call: a browser session on piptradedex.xyz, or curl with `-c jar.txt` on the quote and `-b jar.txt` on every status call. `not_found` on a status call means a different session, so fix the session and do not resend funds. A pending swap shows `PENDING_DEPOSIT`.

## Address formats

Check the shape before quoting. The API's own validation has the final say.

| Chain family | Shape |
|---|---|
| EVM (`eth`, `base`, `arb`, `op`, `pol`, `avax`, `bsc` and the rest) | `0x` followed by 40 hex characters |
| Solana family (`sol`, `fogo`) | base58, 32 to 44 characters |
| `btc`, `ltc`, `doge`, `dash`, `bch`, `zec` | That chain's own address format |
| `xrp`, `stellar`, `ton` | Can need a destination tag or memo. Refuse any route that returns `depositMemo` |
| `near` | A named account or a 64 character hex account |
| `sui`, `aptos`, `movement` | `0x` followed by hex |
| `tron` | Starts with `T` |
| `cardano` | Starts with `addr` |

## Other read endpoints

Public, no session:

| Endpoint | Returns |
|---|---|
| `GET /api/prices` | `{ ok, prices: { SYMBOL: usd price } }` |
| `GET /api/markets` | `{ ok, markets: [ { sym, name, chain, price, chg24h, vol24h, high24h, low24h, trades24h, open24h, fdv, spark } ] }` |
| `GET /api/chains` | Chain sets, native symbols, explorers (step 2) |
| `GET /api/tokens` | Token registry (step 2) |
| `GET /api/rh/sellcheck` | Sell check (step 3) |

Use prices and markets to sanity check a quote, not to replace it.

## Worked example

Swap 0.0001 ETH on Base to USDC on Base, privately, to the same wallet.

1. Collect: sell ETH on Base, buy USDC on Base, amount 0.0001, refund address and receiving address both the user's Base wallet.
2. Look up: chains `base` and `base`, both supported. ETH has `contractAddress: null` (native) and 18 decimals, so the amount is `"100000000000000"`.
3. Dry quote: shows the USDC you receive, the minimum, and the time estimate. Show it, get a yes.
4. Real quote: same body with `"dry": false`. Stay in the same session. Read `depositAddress`.
5. Send: `bankr wallet transfer --to <depositAddress> --amount 0.0001 --native --chain base`.
6. Poll status in the same session until the swap finishes.
7. Read the USDC balance of the receiving address and report the amount.

## Errors

| Error | Meaning | Fix |
|---|---|---|
| `missing_fields` (400) | `originAsset`, `destinationAsset` or `amount` is absent | Send all three |
| `need_refund_to` | A real quote without `refundTo` | Set the refund address and retry |
| `busy` | The route could not be priced | Check the `assetId`s, the base units, both addresses and the amount, then retry |
| `amount_range` | Outside the allowed range | Read the `min` object and adjust |
| `no_liquidity` | No route for that size | Try a smaller amount or another pair |
| `unsupported` | Pair not supported | Tell the user |
| `private_activating` | Private routing is warming up | Retry shortly |
| `not_found` on status | Different session | Use the same session |

Decide success from the `ok` field in the JSON.

## Tested

A private ETH to USDC swap on Base, from a smart wallet to its own address, completed as a guest: dry quote, real quote, send, status, and delivery confirmed by balance. Dry quotes were also checked across chains. Other chains and pairs follow the same flow. Check their minimums with a dry quote first.

## What not to claim

Do not promise more than the product states: the on-chain link between the sending wallet and the receiving address is broken. Do not quote fees, the route provider or settlement internals. If the user asks how it works, say the swap is private by design and offer the steps above.
