---
name: neuraliquid-signals
description: Inspect the price of NeuraLiquid's x402 crypto research feed or filter observations with a day pass, or connect an MCP client for budgeted checkout and revisioned watchlist events.
---

# NeuraLiquid Signals

Use this skill when someone wants a directional research alert, wants to check the price, or already has a NeuraLiquid pass. One 5 USDC payment on Base buys 24 hours of repeated reads. An observation contains `direction` (`long` or `short`), `time` (UTC detection time) and `token` (asset symbol). A dryrun observation records a detection. An empty `signals` array is a valid snapshot. Use detection times to suppress repeated alerts about the same asset, direction and time.


## Revisioned events and MCP checkout

Inspect the [historical event example](https://futurecast.ml85.xyz/api/v2/signals/example) for free. With an existing x402 pass, call `read_agent_events` in the [NeuraLiquid MCP client](https://github.com/Marcolist/neuraliquid-mcp). Keep its `next_cursor` and send it as `cursor` on the next read, at least 30 seconds later. Each revision identifies the candle, observation time, direction or conflict, and expiry. Direct HTTP clients select `?view=events-v2` on the paid endpoint with their existing bearer token.

For operators who prefer MCP checkout, `buy_or_resume_pass` can buy one 5 USDC Base day pass using a separately configured, authorized wallet and budget. Resume pending purchases with the same private pass file.

## Check the offer

From the installed skill directory, run the following command using Python 3. It makes one unsigned GET, without a wallet, and prints the current payment terms. The bundled helper can only make read requests.

```sh
python3 scripts/watchlist.py offer
```

Check the live terms before authorizing any purchase. The day pass uses x402 v2 `exact`, network `eip155:8453`, Base USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` and `5000000` base units. Ask before buying if the terms change.

## Use an existing pass

Supply the path to the buyer's private pass file. The helper reads a FutureCast client file (`access_token`) or a NeuraLiquid MoonPay checkout receipt (`data.access_token`). The helper sends it only to the fixed FutureCast HTTPS endpoint, follows no redirects and omits the token from output. Keep this file local and set permissions to `0600`.

```sh
python3 scripts/watchlist.py read --pass-file ./access.json
python3 scripts/watchlist.py read --pass-file ./access.json --token "$WATCHLIST_SYMBOL" --direction long
```

A pending response asks you to poll with the same pass after 15 seconds. Once confirmed, space snapshot reads at least 30 seconds apart. If the source is unavailable after confirmation, retry during the original pass validity. An expired pass requires a new purchase decision.

## When a buyer needs a pass

Get the wallet owner's authorization for the 5 USDC spend. The [provider quickstart](https://futurecast.ml85.xyz/quickstart?utm_source=bankr) documents a compatible x402 v2 client for a separately managed Base wallet. It verifies the recipient and spend ceiling and saves the original signed authorization locally before submission. A Bankr wallet key stays in Bankr. The skill needs only the resulting pass for subsequent reads.

If a purchase is interrupted before a bearer token is saved, use the provider client's `--resume` with the original URL and `--access-file` to recover that authorization. Never initiate a second payment to resolve an uncertain first attempt.

For referral distribution, open the [partner page](https://futurecast.ml85.xyz/partners?utm_source=bankr). From 26 November 2026 at 22:00 UTC until 26 December 2026 at 22:00 UTC, a wallet signature creates a personal link without a purchase. That link stays eligible after enrollment closes. The live feed requires a paid pass. Each eligible direct sale earns 34% after the incoming USDC payment is finalized (1.70 USDC for a 5 USDC pass). Disclose the commission when recommending the feed.
