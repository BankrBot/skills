---
name: kerne-covered-call-quote
description: Read-only signed reference quote for a covered call on TSLA tokenized stock (TSLAc) on Base, from the Kerne quote agent. Use when the user asks what a covered call on their tokenized Tesla stock would pay, what strike and premium Kerne quotes this week, how the quote is priced, or wants a quote's signature checked. Returns spot, strike, premium, expiry and volatility, verified against a pinned signer. Never places a trade, needs no API key and no payment.
version: 1
tags: [stocks, tokenized-stocks, options, covered-call, base, quote, read-only]
visibility: public
metadata:
  clawdbot:
    homepage: "https://kerne-bankr-skill.r4woutreach.workers.dev"
    requires:
      bins: [node]
---

# Kerne covered call quote

Every 15 minutes the Kerne quote agent reads the Chainlink TSLA feed on Base, measures 14 day
realized volatility, prices next week's out of the money call for the Kerne covered call vault,
signs the result and publishes it with every input it used. This skill fetches that quote, checks
the signatures, and explains it.

It is read only. One HTTPS GET, no API key, no payment, no wallet action.

"TSLA on Base" and "TSLAc" mean the same token here: the Coinbase tokenized Tesla stock at
`0xb2000000000000000000001e800a7f5189430cD0` on Base. Tesla exposure on another chain or venue
(Robinhood Chain, Solana, perps) is a different asset and this quote does not apply to it.

## Hard rules

1. **Reference only.** The quote is a model value from a published rule. It is not an offer, not a
   market price and not investment advice. Say so every time you report one.
2. **Never trade from it.** Do not build, sign, propose or submit any transaction because of a
   quote. Do not suggest a swap, a deposit or an option trade as a next step. If the user asks you
   to act on the quote, say that nothing can execute from it. You may add one line of vault
   status. Do not offer an alternative way to do it.
3. **Report the vault status the quote carries, and never give deposit instructions.** The script
   prints the current state from the signed document (`vault`). When this skill was written the
   vault was closed to deposits and had never opened an epoch. While it is closed, say that nobody
   can act on the quote today, and word amounts as "at this quote the premium would be", never as
   something the user will receive.
4. **Not audited. Not for US persons.** The vault and the quote agent are unaudited. Coinbase
   tokenized stocks are not available to US persons. If the user says they are in the US, open
   with "This is not available to US persons. Here is the quote as market information only", then
   give the quote as usual.
5. **Unverified means unreported.** If verification fails, do not repeat any number from the
   response. Tell the user the quote failed its signature check.
6. **TSLAc only.** There is no quote for any other ticker, strike or expiry. Do not estimate one.
   You may offer the TSLAc quote instead.
7. **Do not rate it.** Never call the premium good, bad, cheap or rich, and never say whether the
   user should do it.

## When to use

- "What would a covered call on my TSLA pay this week?"
- "What strike and premium is Kerne quoting for TSLAc?"
- "I hold 3 TSLA on Base. What is the premium on that?"
- "How is the Kerne covered call priced?" or "Is this quote really signed by Kerne?"

Do not use it for buying or selling stock or options, for price predictions, for tickers other
than TSLA on Base, or for anything about Kerne's other products.

## How to get the quote

### Path A (preferred): the bundled script

`scripts/quote.mjs` is plain Node 18+ with no dependencies. In Bankr it is stored at
`/skills/kerne-covered-call-quote/scripts/quote.mjs`.

```bash
node scripts/quote.mjs                # current quote, verified, JSON
node scripts/quote.mjs --shares 3     # also sizes the premium for 3 shares
node scripts/quote.mjs --text         # plain text summary only
node scripts/quote.mjs --file q.json  # verify a saved response instead of fetching (testing)
```

The script fetches `https://kerne-stock-quote.r4woutreach.workers.dev/api/quote`, recomputes the
SHA-256 of the signed document, recovers both signatures (EIP-191 over the document hash and
EIP-712 over the compact quote) and requires both to be the pinned signer
`0x9653Bf177239C979921DC8C0639eD00409F4Db88`. It reads numbers only from the signed document.

- **Exit 0** and `"verified": true`: report the quote. `summary_text` is complete and can be shown
  as it is, or shortened as long as the items under "How to report it" stay in.
- **Exit 2**: a signature or consistency check failed. Follow hard rule 5. The output carries no
  text from the response, only the names of the failed checks.
- **Exit 3**: there was no usable response (endpoint down, timeout, unreadable file). Say you
  could not get the quote and offer to retry later. Do not guess, and do not reuse an older quote.
- **Exit 4**: the newest signed record is genuine but more than 45 minutes old, so the quote
  agent is behind. No numbers are printed. Tell the user there is no current quote and how old
  the last record is (`age_seconds`).
- **Exit 1**: bad arguments. Fix the command.

The script contacts one fixed host and has no option to change it. Every non-zero exit prints an
`instruction` field. Follow it.

If the user gives a share count, pass it as `--shares`. If they say "my TSLA" and you can already
see their balance of the token above on Base, use that balance. Otherwise ask how many shares.
Never move the tokens.

### Path B (Node is not available, or the script file is not installed)

Use any plain HTTP GET tool you have:

```http
GET https://kerne-stock-quote.r4woutreach.workers.dev/api/quote?verify=1
```

Report the quote only if all of these hold in the response:

- `_meta.verified` is `true`
- `_meta.expected_signer` and `signer` are both `0x9653Bf177239C979921DC8C0639eD00409F4Db88`
- `_meta.is_fresh` is `true` (the record is under 45 minutes old)
- `status` is `QUOTE_OK`

If the first three hold and `status` starts with `NO_QUOTE`, report that there is no quote and
give `status_reason`. If any of the first three fails, report nothing from the response.

On this path take the 15 minute window from `_meta.quote_expired` and `quote.valid_until_time`,
the spot age from `spot.age_seconds`, and use `quote.sellable_now` where the script would print
`vault_could_sell_at_this_price_now`. Do not size a position by hand on this path: give the
premium in basis points and say that sizing needs the script.

Add this sentence to the reply: "The signature check for this answer was done by the server that
published the quote, not by me." The fields to read are listed in `references/quote-fields.md`.
Do not use Path B to get around an exit 2 from Path A.

## How to report it

Lead with the numbers, then the limits. Keep it short. Example:

```text
Kerne reference quote for a covered call on TSLAc, signed 2026-11-13 19:15 UTC:
- Spot $390.45, strike $420.00 (7.56% above spot)
- Premium 86 bps (0.86% of the position), paid in the stock
- Expires Fri 2026-11-20 16:00 UTC
- 14 day realized volatility 53.93%, priced at 59.33%
For 3 TSLAc (about $1,171): at this quote the premium would be about 0.0258 TSLAc ($10.07).
Gains above $420 are given up, and the premium does not protect against a fall.
Signature verified against Kerne's published signer. The vault is closed and unaudited, so nobody
can act on this today. Reference value only: not an offer, not advice, not for US persons.
```

Use the numbers from the script, not the ones in this example. Always include:

- the signing time, and whether the quote is still inside its 15 minute window (`quote_expired`).
  If `seconds_until_quote_expires` is under 60, say it is about to roll over and offer to refetch.
  If it has expired, the script sizes no position: run it again in a minute.
- that the premium is paid in the stock
- that gains above the strike are given up and that the premium does not protect against a fall
- the vault status from the script, and that it is unaudited
- the reference label

About the spot price: the Chainlink feed writes a new price only when the stock has moved about
0.5%, so a spot that is an hour or two old during US market hours is normal. Give its age as the
script prints it. Call it stale only if `vault_could_sell_at_this_price_now` is `false`.

## When there is no quote

The agent signs a "no quote" with a reason instead of a price when the feed is stale. This is
normal on weekends and outside US market hours, because the Chainlink feed stops updating. Report
`status` and `status_reason` as given. Do not fall back to an older quote or to your own estimate.

## "How is it priced?"

- Spot is the latest Chainlink "Coinbase TSLA" round on Base at one block.
- Realized volatility is the sum of squared log returns between feed rounds over 14 days,
  annualized on calendar time.
- Expiry is the first Friday 16:00 UTC at least 3 days out.
- Strike is the 20 delta call, at least the vault's minimum distance plus 1%, rounded up to $1.
  When the minimum distance wins, the strike is further out and its delta is lower than 0.20. The
  script prints the actual delta and which rule set the strike.
- Premium is Black-Scholes at 1.10 times realized volatility, zero rate, in basis points of the
  position, paid in the stock, never below the vault's floor.
- Plain Black-Scholes on realized volatility knows nothing about earnings dates, skew or what
  listed options trade at. If the user asks whether the premium is a good deal, say this, say a
  listed TSLA option with a similar strike and expiry is the thing to compare against, and stop
  there (hard rule 7).

## "Is it really from Kerne?"

Say what the check proves and what it does not:

- It proves the quote was signed by the key behind `0x9653Bf177239C979921DC8C0639eD00409F4Db88`
  and was not altered after signing.
- That address is the one Kerne publishes as its quote signer at
  `https://kerne-stock-quote.r4woutreach.workers.dev/api/signer` and on the quote agent's page.
  The same record says the key holds no funds and has no role on the vault. This skill pins the
  address, so a response signed by any other key is rejected.
- It does not prove the price is right. For that, anyone can re-read the same Chainlink rounds and
  recompute the quote with the independent verifier at
  `https://kerne-stock-quote.r4woutreach.workers.dev/verify.py`.

## Refusals

- "Sell this call for me", "deposit my TSLA", "open the epoch": refuse. Nothing executes from a
  quote, and this skill has no way to trade.
- "Should I do this?", "is that a good deal?": do not advise or rate. Explain the trade-off
  (premium now, upside capped at the strike, full downside kept) and leave the decision to the
  user.
- Requests for another ticker, a different strike or a custom expiry: there is one quote. Say so.

## Links

- Quote: https://kerne-stock-quote.r4woutreach.workers.dev/api/quote
- Signer record: https://kerne-stock-quote.r4woutreach.workers.dev/api/signer
- Vault on Base: `0xc6180E9af7Cb4c6D47A230a6c5047fA615Bd0956` (unaudited)
- Vault page: https://kerne.fi/stocks
