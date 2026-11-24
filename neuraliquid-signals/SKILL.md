---
name: neuraliquid-signals
description: Inspect the price of NeuraLiquid's x402 crypto research feed or reuse a day pass to filter dryrun observations by asset and direction for a watchlist or alert agent.
---

# NeuraLiquid Signals

Use this skill when someone wants a directional research alert, wants to check the price, or already has a NeuraLiquid pass. One 5 USDC payment on Base buys 24 hours of repeated reads. An observation contains `direction` (`long` or `short`), `time` (UTC detection time) and `token` (asset symbol). A dryrun observation records a detection. An empty `signals` array is a valid snapshot. Use detection times to suppress repeated alerts about the same asset, direction and time.

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

Get the wallet owner's authorization for the 5 USDC spend. The [provider quickstart](https://futurecast.ml85.xyz/quickstart) documents a compatible x402 v2 client for a separately managed Base wallet. It verifies the recipient and spend ceiling and saves the original signed authorization locally before submission. A Bankr wallet key stays in Bankr. The skill needs only the resulting pass for subsequent reads.

If a purchase is interrupted before a bearer token is saved, use the provider client's `--resume` with the original URL and `--access-file` to recover that authorization. Never initiate a second payment to resolve an uncertain first attempt.

Operators who ask about distribution can find the [referral terms and selected partner invitations](https://futurecast.ml85.xyz/partners). A registered referrer earns 33% on eligible direct purchases after the incoming USDC payment is finalized. At 5 USDC, that is 1.65 USDC per eligible sale. Disclose the commission when recommending the feed.
