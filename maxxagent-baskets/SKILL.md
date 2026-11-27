---
name: maxxagent-baskets
description: Builds a basket of Coinbase tokenized stocks on Base (NVIDIA, Apple, Tesla, Microsoft, Meta, Alphabet, Amazon, Strategy, SanDisk, SpaceX) from a plain-English request such as "AI and cloud, no Tesla, max 30% each, keep 10% in cash", using MAXXAGENT's rule-based agent. Use it when the user wants a stock basket or index, wants to split money across several tokenized stocks, or asks for live prices of these stocks. Returns weights, the reasons and sourced facts behind each pick, the limits it kept, and a link to buy the basket from the user's own wallet.
tags: [stocks, tokenized-stocks, base, portfolio, index, basket]
version: 1
metadata:
  clawdbot:
    emoji: "📊"
    homepage: "https://maxxagent.xyz"
    requires:
      bins: [curl]
---

# MAXXAGENT Baskets

MAXXAGENT turns a request in plain English into a basket of Coinbase tokenized stocks on Base. A rule-based agent
picks the stocks and weights and keeps the limits it can (a cap per stock, up to 90% kept in USDC, stocks to leave
out). When part of a request can't be followed (an unsupported stock, more than 90% in cash), it says so in
`limits` and sets `needsConfirmation`, and you check with the user before offering to buy. It does not trade: it
returns a proposal and a link where the user reviews it and buys from their own wallet. No API key, no account,
nothing to sign here.

## When to use it

- "Build me a basket of AI stocks", "split $200 across big tech but no Tesla", "an index of NVIDIA, Microsoft and Google, max 40% each"
- "What do tokenized NVDA / AAPL / TSLA cost on Base right now?"

Only these 10 stocks are supported: NVDAc, AAPLc, TSLAc, MSFTc, METAc, GOOGLc, AMZNc, MSTRc, SNDKc, SPCXc. If the user
names another stock, still call the endpoint: the answer says why it was left out.

## 1. Build a basket

```bash
curl -s -G "https://maxxagent.xyz/api/skill/basket" \
  --data-urlencode "prompt=AI and cloud, anything but Tesla, cap each at 30%, keep 10% in cash" \
  --data-urlencode "amount=200"
```

- `prompt` (required): the user's request in their own words, up to 500 characters. Pass it through as written.
- `amount` (optional): the total in USD the user wants to put in, e.g. `200`. If the request already says "$200",
  you can leave it out. With an amount, `buyUrl` opens the basket with the stock part filled in.
- `risk` (optional): `Conservative`, `Balanced` (default) or `Aggressive`. Words like "safe" or "aggressive" in the
  request already set it, so only pass it when the user picks a profile explicitly.
- `then` (optional, repeatable): follow-up changes to the same basket, in order, e.g.
  `--data-urlencode "then=replace Microsoft with Apple" --data-urlencode "then=drop Meta"`.

The answer (JSON):

| Field | Use it to |
| --- | --- |
| `basket[]` | list each stock: `symbol`, `company`, `sharePct` (share of the user's money), `why` (top reasons) |
| `cashKeptInUsdcPct` | say how much stays in USDC (asked for, or left over so a cap holds) |
| `limits[]` | confirm each limit: `status` is `kept`, `adjusted` or `not possible`, with `detail` |
| `needsConfirmation` | when `true`, part of the request couldn't be followed: see the step below before any buy link |
| `confirmationReasons[]` | what couldn't be followed, in plain words (show these to the user) |
| `leftOut[]` | explain stocks that were left out, with `reason` |
| `facts[]` | back up the picks; each fact has `sources` (Chainlink, SEC filings, Base pools) — cite them |
| `buyUrl` | give the user this link to review and buy the basket from their own wallet (only once it matches the request) |
| `buyNote` | repeat it when present (the amount in stocks and the USDC kept) |
| `riskNote` | when present, say it: live volatility history wasn't loaded yet, so fixed estimates were used this time |
| `notice` | always show it |

**Before you show the buy link, check the answer against what the user asked:**

1. If `needsConfirmation` is `true`, don't offer `buyUrl` yet. Show the proposal as a draft, list
   `confirmationReasons` (e.g. "Netflix isn't one of the 10 supported stocks", "a basket keeps at most 90% in USDC"),
   and ask how to continue: drop that part, pick from the supported stocks, or not buy at all.
2. Also compare yourself: every stock the user named or excluded, any cap, the cash share and any weights they set
   must match `basket`, `cashKeptInUsdcPct` and `limits`. If something they asked for isn't reflected, say so and ask
   instead of offering to buy.
3. Only when it matches (or the user agrees to the changes) show the basket as a short table (stock, share, one
   reason), then the limits, then `buyUrl` and `notice`.

To refine ("replace Microsoft with Apple", "drop Meta"), call again with the same `prompt` and every change so
far as `then` parameters, oldest first. Keep the same `amount`.

## 2. Live prices

```bash
curl -s "https://maxxagent.xyz/api/skill/stocks"
```

Returns each stock's `navPriceUsd` (Chainlink), `dexPriceUsd` (24/7 price on Base), `change24hPct`,
`dexLiquidityUsd`, its token address and its MAXXAGENT page.

## Rules

- Never present the basket as advice or promise returns. Always include `notice`.
- These tokenized stocks are only for eligible persons outside the U.S. If the user says they are in the U.S., don't
  help them buy.
- Don't place the trades yourself from this skill: send the user to `buyUrl`, where they review the prices and sign
  every transaction from their own wallet.
- Limits: about 20 basket requests a minute per IP. On HTTP 429 or 503, wait a minute and retry once.
