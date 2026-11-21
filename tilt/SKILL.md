---
name: tilt
description: >
  Tilt research for Coinbase tokenized stocks (B20) on Base: curated themes such as AI Infrastructure,
  Mega-Cap Tech and Semiconductors, each theme's and each stock's latest news score from -1 to +1 with
  the articles behind it, and the target weights Tilt's published rules give a mix of themes, split
  into dollar amounts per stock. Read-only public HTTP API, no key. Tilt researches; Bankr executes
  with its own buy and its own location checks. Use when the user asks what Tilt's news score is for
  a theme and why, what a theme holds, how Tilt would weight a mix today, or to buy a dollar amount
  of one or more themes "the way Tilt weights it". Triggers: "tilt", "tilt theme", "tilt score",
  "news score for semiconductors", "buy $20 of AI Infrastructure the way Tilt weights it",
  "tilt mix", "tilt weights". NOT for perps, Robinhood Chain listings, or any non-Base venue.
tags: [base, tokenized-stocks, b20, research, sentiment, portfolio]
version: 1
visibility: public
metadata:
  clawdbot:
    homepage: "https://tilt-rust.vercel.app/docs/use-tilt-from-bankr"
---

# Tilt

Tilt groups Coinbase's tokenized stocks on Base into themes and scores each theme from the news, using
published, bounded rules to lean a mix of themes toward the better news. This skill reads Tilt's public
research and target weights; every trade is a normal Bankr buy, placed and eligibility-checked by Bankr.

**Base URL:** `https://tilt-rust.vercel.app/api/public/v1`
**Auth:** none. **Methods:** GET only. **Rate limit:** 60 requests a minute per IP (HTTP 429 with `Retry-After` above that).
**Full field reference and example responses:** [references/api.md](references/api.md)
(also at `https://tilt-rust.vercel.app/skills/tilt/references/api.md`).

## Hard rules

1. **Tilt never trades and never builds transactions.** Its responses carry no calldata, quotes or
   routes. Buy each stock with Bankr's own buy (for example `buy $6.30 of NVDAc on base`). Never use
   `/wallet/submit`, `/wallet/sign` or any raw-transaction flow for a Tilt mix, and never hand-build
   calldata from a Tilt response.
2. **Bankr decides who may trade.** Tokenized stocks are not available to US persons or to anyone located
   in the US, the UK, sanctioned countries or regions, or anywhere local law prohibits them. If Bankr
   reports that the user is not location-verified, is in an excluded location, or is otherwise ineligible,
   or the user says they are a US person, do not trade with Tilt data and do not suggest workarounds.
   Research answers (scores, sources, weights) are fine to show.
3. **Confirm before spending.** Show the full plan (every symbol and dollar amount, the total, the market
   status) and get an explicit yes before the first buy. One yes covers that exact plan only.
4. **Stop on any failure.** If the market check fails, a symbol does not resolve to the listed contract,
   or any buy fails, stop, report what was and was not bought, and do not retry blindly or substitute
   another token.
5. **Scores come from a language model** reading public news. They are informational, can be wrong and
   are not investment advice. Say so when you present them. Never present a Tilt weight as a recommendation.

## Endpoints

| Endpoint | Returns |
|---|---|
| `GET /themes` | Every curated theme, live and coming soon: slug, name, description, status, constituents (ticker, Base `symbol`, `contractAddress`, name, tradable) and the latest theme `newsScore` (score, confidence, one-line reason, scoredAt), plus `market`. |
| `GET /themes/{slug}` | One theme: the above plus each stock's news score and cited `sources` (headline, publisher, url, publishedAt), the theme score's sources, each stock's `weightPct` in the theme, what the score does at each risk level (`tilt.byRiskLevel`), and `market`. |
| `GET /mix?themes=a,b&weights=60,40&risk=3&amountUsd=20` | Per-stock target weights for a mix of live themes, tilted by the latest scores within Tilt's bounds; with `amountUsd`, dollars per stock to the cent. Plus `market` and `explanations`. |

`/mix` parameters:
- `themes` (required): 1 to 8 theme slugs, comma-separated, each at most once. Coming-soon themes are refused (HTTP 422).
- `weights` (optional): one percentage per theme in the same order, adding up to exactly 100 (up to 2 decimals). Default: equal.
- `risk` (optional): 1 Steady, 2 Careful, 3 Balanced (default), 4 Bold, 5 All in. Higher levels let the news move a theme further (2 to 10 percentage points).
- `amountUsd` (optional): total dollars, up to 2 decimals.

Every response has `asOf`, `disclaimer` and `links` (Tilt's theme page, the docs, this skill). Errors are
`{ "error": "..." }` with HTTP 400 (bad input), 404 (unknown theme), 422 (coming-soon theme), 429 or 503.

Examples:

```bash
curl -s https://tilt-rust.vercel.app/api/public/v1/themes
curl -s https://tilt-rust.vercel.app/api/public/v1/themes/semiconductors
curl -s "https://tilt-rust.vercel.app/api/public/v1/mix?themes=ai-infrastructure&amountUsd=20"
curl -s "https://tilt-rust.vercel.app/api/public/v1/mix?themes=ai-infrastructure,semiconductors&weights=60,40&risk=4&amountUsd=50"
```

## Recipe: research a theme

User: "What is Tilt's news score for Semiconductors and why?"

1. If you don't know the slug, `GET /themes` and match the user's words to a theme `name`.
2. `GET /themes/{slug}`.
3. Answer in a few lines: the theme score (for example -0.75, "leaning negative"), its one-line reason,
   when it was scored, and each stock's score with its reason. If `newsScore` is null, say there is no
   recent score; for a `coming_soon` theme say it is not tradable on Tilt yet.
4. When the user asks "why" or for sources, list the `sources` (headline, publisher, date, url) for the
   theme and for each stock. Never invent a source that is not in the response.
5. End with: scores are generated by a language model from public news, can be wrong, and are not advice.
   Link `links.theme` for the full page.

## Recipe: buy a mix the way Tilt weights it

User: "Buy $20 of AI Infrastructure the way Tilt weights it today."

1. **Eligibility.** Tokenized-stock buys need Bankr's location verification. If Bankr already knows the
   user is unverified or in an excluded location, stop here (rule 2).
2. **Inputs.** Themes (map names to slugs with `GET /themes` if needed), the total in dollars, optional
   weights between themes, optional risk level (default 3). Ask only for what is missing.
3. **Mix.** `GET /mix?themes=...&amountUsd=...` (plus `weights` and `risk` if given). On HTTP 4xx, relay
   `error` and stop.
4. **Market check.** If `market.open` is false, tell the user the US regular session is closed and when it
   next opens (`market.nextOpen`, shown in their time zone), and stop. Offer to do it after the open.
5. **Check every symbol before asking.** For each stock with `amountUsd` above `"0.00"`, confirm that
   Bankr resolves `symbol` (the c-suffixed Base symbol, for example `NVDAc`) to a token on Base whose
   contract is exactly `contractAddress`. A Bankr quote does this without trading. If any symbol does not
   resolve, resolves elsewhere, or Bankr cannot trade it, stop and tell the user which one; do not buy a
   partial mix unless the user asks for a new plan without it.
6. **Confirm.** Show one short plan and ask once:

   ```
   Tilt mix for $20.00, AI Infrastructure, risk 3 (Balanced). US market open.
   NVDAc $4.00 · MSFTc $4.00 · GOOGLc $4.00 · METAc $4.00 · ANTc $4.00
   Theme news score -0.35: <reason>. Scores come from a language model and can be wrong. Not advice.
   Buy these 5 stocks on Base with Bankr for $20.00 total? (yes/no)
   ```

   Mention any `amount.skipped` stocks and `amount.note` (the amount was too small to give every stock the
   minimum trade). Do not include stocks whose `amountUsd` is `"0.00"`.
7. **Buy.** After a yes, buy each stock in the order listed, one at a time, with Bankr's native buy on
   Base, paying in USDC: `buy $<amountUsd> of <symbol> on base`. Wait for each to finish before the next.
   Never use raw transactions or `/wallet/submit` (rule 1).
8. **On any failure** (location check, spend limit, price impact, issuer pause, a failed or unconfirmed
   fill), stop at once. Report which buys completed and which did not. Do not retry under a new
   idempotency key or try to split around a limit.
9. **Report.** List each completed buy and the total, note these are Bankr trades in the user's Bankr
   wallet, and link `links.theme` (or `links.themePages`).

Bankr's own limits still apply: its spend limits (by default $500 a day and per transaction) and any
minimum order size. Tilt's minimum trade (`amount.minTradeUsd`) can be smaller than what Bankr accepts;
if Bankr refuses a small leg, stop and suggest a larger total.

## Recipe: compare or explain weights

- "How would Tilt weight AI Infrastructure and Semiconductors 60/40 at risk 4?" -> `GET /mix?themes=ai-infrastructure,semiconductors&weights=60,40&risk=4`
  and present `mix.themes` (base, tilted, tilt points) and `mix.stocks` (weights), using `mix.explanations`.
- One theme on its own always keeps 100%: the news tilt moves themes against each other, never single
  stocks, and stocks are equal weight within a theme (a stock in two themes gets both shares).
- Weights move by at most 2 to 10 percentage points per theme depending on risk, and the mix always adds
  up to exactly 100%.

## What Tilt does not do

- It does not hold funds, see the user's Bankr wallet, or know what the user owns. Trades placed through
  Bankr are Bankr trades; Tilt never sees them.
- It does not check eligibility. Bankr does.
- It does not quote prices or build swaps. Use Bankr for prices and execution.
- It covers only Coinbase's tokenized stocks on Base that pass Tilt's liquidity and contract checks
  (`tradable: true`). Robinhood Chain, Solana and third-party tokenized stocks are out of scope.

Docs: https://tilt-rust.vercel.app/docs/use-tilt-from-bankr
