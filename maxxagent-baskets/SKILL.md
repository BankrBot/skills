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
picks the stocks and weights; it never breaks a limit the user sets (a cap per stock, cash to keep, stocks to
leave out). It does not trade: it returns a proposal and a link where the user reviews it and buys from their own
wallet. No API key, no account, nothing to sign here.

## When to use it

- "Build me a basket of AI stocks", "split $200 across big tech but no Tesla", "an index of NVIDIA, Microsoft and Google, max 40% each"
- "What do tokenized NVDA / AAPL / TSLA cost on Base right now?"

Only these 10 stocks are supported: NVDAc, AAPLc, TSLAc, MSFTc, METAc, GOOGLc, AMZNc, MSTRc, SNDKc, SPCXc. If the user
names another stock, still call the endpoint: the answer says why it was left out.

## 1. Build a basket

```bash
curl -s -G "https://maxxagent.xyz/api/skill/basket" \
  --data-urlencode "prompt=AI and cloud, anything but Tesla, cap each at 30%, keep 10% in cash" \
  --data-urlencode "risk=Balanced"
```

- `prompt` (required): the user's request in their own words, up to 500 characters. Pass it through as written.
- `risk` (optional): `Conservative`, `Balanced` (default) or `Aggressive`.

The answer (JSON):

| Field | Use it to |
| --- | --- |
| `basket[]` | list each stock: `symbol`, `company`, `sharePct` (share of the user's money), `why` (top reasons) |
| `cashKeptInUsdcPct` | say how much stays in USDC (asked for, or left over so a cap holds) |
| `limits[]` | confirm each limit: `status` is `kept`, `adjusted` or `not possible`, with `detail` |
| `leftOut[]` | explain stocks that were left out, with `reason` |
| `facts[]` | back up the picks; each fact has `sources` (Chainlink, SEC filings, Base pools) — cite them |
| `buyUrl` | give the user this link to review and buy the basket from their own wallet |
| `buyNote` | repeat it when present (how to keep the USDC part) |
| `notice` | always show it |

Show the basket as a short table (stock, share, one reason), then the limits, then `buyUrl` and `notice`.
To refine ("replace Microsoft with Apple", "drop Meta"), call again with the original request and the change
together in one `prompt`.

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
