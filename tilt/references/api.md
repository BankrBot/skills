# Tilt public API reference

Base URL: `https://tilt-rust.vercel.app/api/public/v1`. GET only, JSON, no key, CORS open to any origin.
Responses are cached at the edge for about a minute. Each IP may make 60 requests a minute; above that
the API answers HTTP 429 with a `Retry-After` header.

Nothing in this API builds, quotes or submits a transaction, and nothing in it is about a user. Execution
belongs to Bankr (see [../SKILL.md](../SKILL.md)).

## Fields on every response

| Field | Meaning |
|---|---|
| `asOf` | ISO 8601 time the response was produced. Each score has its own `scoredAt`. |
| `apiVersion` | `"v1"`. |
| `disclaimer` | Not investment advice; not available to US persons or anyone located in the US; scores come from a language model and can be wrong. Show it, or its gist, with any score or plan. |
| `links.theme` | Tilt's page for the theme, when the response is about one theme. |
| `links.themePages` | Slug to page URL, when the response is about several themes. |
| `links.themes`, `links.docs`, `links.skill` | The themes list, the "Use Tilt from Bankr" docs page, this skill. |
| `error` | Only on errors: what was wrong, in one sentence. Some errors add `field`, `unknown`, `knownThemes` or `comingSoon`. |

Status codes: 200; 400 bad input (missing or malformed parameter, unknown theme in `/mix`, amount below the
minimum trade); 404 unknown theme in `/themes/{slug}`; 422 a coming-soon theme in `/mix`; 429 rate limit;
503 temporarily unavailable (try again shortly).

## Shared objects

**Constituent** (`constituents[]`, and the base of `stocks[]`)

| Field | Meaning |
|---|---|
| `ticker` | Underlying ticker, e.g. `NVDA`. |
| `symbol` | The Base token's own symbol, c-suffixed, e.g. `NVDAc`. Use this with Bankr: it pins the Base token. `null` if Coinbase does not list the ticker. |
| `contractAddress` | The token contract on Base. Check that Bankr resolves `symbol` to exactly this address before buying. |
| `chainId` | `8453` (Base mainnet). |
| `name` | Company name. |
| `tradable` | Passed Tilt's liquidity and contract checks in the last 48 hours. |

**Score** (`newsScore`, `score`)

| Field | Meaning |
|---|---|
| `score` | From -1 (clearly negative news) to +1 (clearly positive). |
| `confidence` | From 0 to 1: how sure the scoring was. |
| `reason` | One line written by a language model from the cited articles. |
| `scoredAt` | ISO 8601. Scores older than 4 days are not served (`null` instead). |

**Source** (`sources[]`)

| Field | Meaning |
|---|---|
| `url` | The article link, as stored from Tilt's news provider. |
| `headline`, `publisher`, `publishedAt` | `null` when the article is no longer stored. |

**Market** (`market`)

| Field | Meaning |
|---|---|
| `phase` | `regular` (US regular session open), `extended` or `closed`. |
| `open` | `true` only during the regular session. Do not buy when it is `false`. |
| `nextOpen` | ISO 8601 of the next regular-session open (now, while open). |
| `closesAt` | ISO 8601 of today's close while open, else `null`. |
| `note` | One sentence to relay. |

## `GET /themes`

Every curated theme: `slug`, `name`, `description`, `status` (`live` or `coming_soon`), `constituents[]`,
`newsScore` (or `null`), plus `market`. A theme is live only while every one of its stocks is tradable.

## `GET /themes/{slug}`

`theme` with:

| Field | Meaning |
|---|---|
| `slug`, `name`, `description`, `status`, `newsScore` | As in `/themes`. |
| `sources[]` | The articles the theme score cites. |
| `stocks[]` | Constituents plus `weightPct` (share of the theme; stocks are equal weight), `newsScore` and `sources[]` for that stock. |
| `tilt.byRiskLevel[]` | For risk levels 1 to 5: `label`, `maxTiltPoints` (largest move any theme can make), `themeTiltPoints` (how far this theme's score asks to move its weight in a mix, in percentage points, before the mix is brought back to 100%). |
| `tilt.note` | How to read the above. |

Plus `market`. Pre-rename slugs (for example `memory-storage`) resolve to the current theme.

## `GET /mix`

| Parameter | Rules |
|---|---|
| `themes` | Required. 1 to 8 slugs, comma-separated, each once. Live themes only (422 names any coming-soon ones). |
| `weights` | Optional. One percentage per theme, same order, up to 2 decimals, each above 0, adding up to exactly 100. Default: equal (33.34/33.33/33.33 for three). |
| `risk` | Optional. 1 Steady, 2 Careful, 3 Balanced (default), 4 Bold, 5 All in. |
| `amountUsd` | Optional. Dollars, up to 2 decimals, above 0 and at most 100000, and at least the minimum trade. |

`mix` with:

| Field | Meaning |
|---|---|
| `riskLevel` | `level`, `label`, `maxTiltPoints` (2, 4, 6, 8 or 10). |
| `themes[]` | `slug`, `name`, `baseWeightPct` (requested or equal), `tiltedWeightPct` (after the news tilt; adds up to exactly 100), `tiltPoints`, `score`. |
| `stocks[]` | Constituents plus `weightPct` (adds up to exactly 100), `themes` (which themes the weight comes from) and `amountUsd` (`null` without an amount; `"0.00"` for a stock the amount is too small to include). Ordered by weight, largest first. |
| `amount` | `null` without an amount. Else `requestedUsd`, `allocatedUsd` (always equal), `minTradeUsd`, `skipped[]` (`ticker`, `reason`) and `note`. |
| `explanations[]` | Plain sentences: starting weights, the band at this risk level, each theme's score, reason and move, how stocks are split, how the amount is split. |

How the weights are made, using the same code as Tilt's rebalancing engine:

1. Start from the requested theme weights.
2. Each theme asks to move by `round(score x risk level x 2)` percentage points, at most 10.
3. The mix is brought back to exactly 100% with one shared shift, never moving a theme further than the
   risk level's band (2 to 10 points) from where it started. A theme without a recent score is not tilted.
   A single theme keeps 100%.
4. Each theme's weight is split equally across its stocks; a stock in two themes gets both shares.
5. An amount is split in proportion to the stock weights, to the cent, adding up exactly. If it cannot give
   every stock the minimum trade, only the highest-weighted stocks that can each get it are kept.

## Example responses

Captured on 2026-11-21 (a Saturday, so the market is closed) from this code running against Tilt's
production data. Arrays are trimmed where noted; values are as served.

### `GET /themes` (2 of 8 themes shown)

```json
{
  "themes": [
    {
      "slug": "ai-infrastructure",
      "name": "AI Infrastructure",
      "description": "Companies supplying the chips, cloud and models behind AI.",
      "status": "live",
      "constituents": [
        {
          "ticker": "NVDA",
          "symbol": "NVDAc",
          "contractAddress": "0xb20000000000000000000078ee7ce2fE4908108C",
          "chainId": 8453,
          "name": "NVIDIA Corporation",
          "tradable": true
        },
        {
          "ticker": "MSFT",
          "symbol": "MSFTc",
          "contractAddress": "0xB200000000000000000000Ab99cFa739E253872B",
          "chainId": 8453,
          "name": "Microsoft Corporation",
          "tradable": true
        },
        {
          "ticker": "GOOGL",
          "symbol": "GOOGLc",
          "contractAddress": "0xb2000000000000000000002D0BA3164cc74f58B7",
          "chainId": 8453,
          "name": "Alphabet Inc.",
          "tradable": true
        },
        {
          "ticker": "META",
          "symbol": "METAc",
          "contractAddress": "0xb2000000000000000000008bC8786B856E61707C",
          "chainId": 8453,
          "name": "Meta Platforms Inc.",
          "tradable": true
        },
        {
          "ticker": "ANT",
          "symbol": "ANTc",
          "contractAddress": "0xb20000000000000000000016e38FD364d271Ba28",
          "chainId": 8453,
          "name": "Anthropic, PBC",
          "tradable": true
        }
      ],
      "newsScore": {
        "score": -0.351,
        "confidence": 0.8,
        "reason": "Nvidia's SEC investigation, Anthropic's valuation concerns, and Google's reduced chip orders pull the theme down, outweighing Microsoft's gains.",
        "scoredAt": "2026-11-20T21:47:15.577Z"
      }
    },
    {
      "slug": "energy",
      "name": "Energy",
      "description": "Integrated oil and gas producers.",
      "status": "coming_soon",
      "constituents": [
        {
          "ticker": "XOM",
          "symbol": "XOMc",
          "contractAddress": "0xb20000000000000000000065F7d0D6aac5fD4Bfd",
          "chainId": 8453,
          "name": "ExxonMobil Holdings Corporation",
          "tradable": false
        },
        {
          "ticker": "CVX",
          "symbol": "CVXc",
          "contractAddress": "0xB2000000000000000000003bf350E420c13e431a",
          "chainId": 8453,
          "name": "Chevron Corporation",
          "tradable": false
        },
        {
          "ticker": "COP",
          "symbol": "COPc",
          "contractAddress": "0xB200000000000000000000eC622942B76a2d3b21",
          "chainId": 8453,
          "name": "ConocoPhillips",
          "tradable": false
        }
      ],
      "newsScore": null
    }
  ],
  "market": {
    "phase": "closed",
    "open": false,
    "nextOpen": "2026-11-23T14:30:00.000Z",
    "closesAt": null,
    "note": "The US regular session is closed. Reference prices hold at the last close and pool prices can drift; wait for the next open before buying."
  },
  "asOf": "2026-11-21T11:34:54.168Z",
  "apiVersion": "v1",
  "disclaimer": "Not investment advice. Not available to US persons or to anyone located in the United States. Tilt publishes research and target weights only: it does not hold funds, place trades or check who is eligible to trade. News scores and their reasons are generated by a language model from public news; they are informational and can be wrong. Tokenized stocks can lose value, can trade at prices that differ from the underlying shares, and can be paused by their issuer.",
  "links": {
    "themes": "https://tilt-rust.vercel.app/themes",
    "docs": "https://tilt-rust.vercel.app/docs/use-tilt-from-bankr",
    "skill": "https://tilt-rust.vercel.app/skills/tilt/SKILL.md"
  }
}
```

### `GET /themes/ai-infrastructure` (trimmed: 1 of 5 stocks, 2 of the theme sources, 2 of 5 risk levels)

```json
{
  "theme": {
    "slug": "ai-infrastructure",
    "name": "AI Infrastructure",
    "description": "Companies supplying the chips, cloud and models behind AI.",
    "status": "live",
    "newsScore": {
      "score": -0.351,
      "confidence": 0.8,
      "reason": "Nvidia's SEC investigation, Anthropic's valuation concerns, and Google's reduced chip orders pull the theme down, outweighing Microsoft's gains.",
      "scoredAt": "2026-11-20T21:47:15.577Z"
    },
    "sources": [
      {
        "url": "https://finnhub.io/api/news?id=8bf35df9b608e7d1b579ee8d3b971dda191bb5aaba59d5f980e28543c26fd627",
        "headline": "Trump Calls for Nvidia to Rehire Jensen Huang",
        "publisher": "Yahoo",
        "publishedAt": "2026-11-20T19:52:00.000Z"
      },
      {
        "url": "https://finnhub.io/api/news?id=658afeb85fc89c828bdc17aaf2e99a9f54cc87f943de0d13c127aa97cab50c69",
        "headline": "Nvidia stock extends $2.5 trillion rout as SEC probe reportedly investigates its accounting",
        "publisher": "Yahoo",
        "publishedAt": "2026-11-20T19:42:54.000Z"
      }
    ],
    "stocks": [
      {
        "ticker": "NVDA",
        "symbol": "NVDAc",
        "contractAddress": "0xb20000000000000000000078ee7ce2fE4908108C",
        "chainId": 8453,
        "name": "NVIDIA Corporation",
        "tradable": true,
        "weightPct": 20,
        "newsScore": {
          "score": -0.9,
          "confidence": 0.9,
          "reason": "Nvidia stock deepened its sell-off amid reports of an SEC accounting investigation following the exit of CEO Jensen Huang.",
          "scoredAt": "2026-11-20T21:47:15.577Z"
        },
        "sources": [
          {
            "url": "https://finnhub.io/api/news?id=8bf35df9b608e7d1b579ee8d3b971dda191bb5aaba59d5f980e28543c26fd627",
            "headline": "Trump Calls for Nvidia to Rehire Jensen Huang",
            "publisher": "Yahoo",
            "publishedAt": "2026-11-20T19:52:00.000Z"
          }
        ]
      }
    ],
    "tilt": {
      "byRiskLevel": [
        {
          "level": 3,
          "label": "Balanced",
          "maxTiltPoints": 6,
          "themeTiltPoints": -2.11
        },
        {
          "level": 4,
          "label": "Bold",
          "maxTiltPoints": 8,
          "themeTiltPoints": -2.81
        }
      ],
      "note": "Tilts move whole themes, never single stocks. In a mix of two or more themes, each theme's weight moves by themeTiltPoints (capped at maxTiltPoints) and the mix is brought back to 100% within that band; a single theme always keeps 100%. Use the mix endpoint for the exact weights of a mix."
    }
  },
  "market": {
    "phase": "closed",
    "open": false,
    "nextOpen": "2026-11-23T14:30:00.000Z",
    "closesAt": null,
    "note": "The US regular session is closed. Reference prices hold at the last close and pool prices can drift; wait for the next open before buying."
  },
  "asOf": "2026-11-21T11:34:55.256Z",
  "apiVersion": "v1",
  "disclaimer": "(same text on every response)",
  "links": {
    "theme": "https://tilt-rust.vercel.app/themes/ai-infrastructure",
    "themes": "https://tilt-rust.vercel.app/themes",
    "docs": "https://tilt-rust.vercel.app/docs/use-tilt-from-bankr",
    "skill": "https://tilt-rust.vercel.app/skills/tilt/SKILL.md"
  }
}
```

### `GET /mix?themes=ai-infrastructure,semiconductors&weights=60,40&risk=4&amountUsd=50` (3 of 6 stocks shown)

```json
{
  "mix": {
    "riskLevel": {
      "level": 4,
      "label": "Bold",
      "maxTiltPoints": 8
    },
    "themes": [
      {
        "slug": "ai-infrastructure",
        "name": "AI Infrastructure",
        "baseWeightPct": 60,
        "tiltedWeightPct": 61.61,
        "tiltPoints": 1.61,
        "score": {
          "score": -0.351,
          "confidence": 0.8,
          "reason": "Nvidia's SEC investigation, Anthropic's valuation concerns, and Google's reduced chip orders pull the theme down, outweighing Microsoft's gains.",
          "scoredAt": "2026-11-20T21:47:15.577Z"
        }
      },
      {
        "slug": "semiconductors",
        "name": "Semiconductors",
        "baseWeightPct": 40,
        "tiltedWeightPct": 38.39,
        "tiltPoints": -1.61,
        "score": {
          "score": -0.754,
          "confidence": 0.875,
          "reason": "Nvidia's deep sell-off from an SEC probe and SanDisk's drop on bearish 2027 NAND flash pricing sharply weigh on the sector.",
          "scoredAt": "2026-11-20T21:47:15.577Z"
        }
      }
    ],
    "stocks": [
      {
        "ticker": "NVDA",
        "symbol": "NVDAc",
        "contractAddress": "0xb20000000000000000000078ee7ce2fE4908108C",
        "chainId": 8453,
        "name": "NVIDIA Corporation",
        "weightPct": 31.52,
        "themes": [
          "ai-infrastructure",
          "semiconductors"
        ],
        "amountUsd": "15.76"
      },
      {
        "ticker": "SNDK",
        "symbol": "SNDKc",
        "contractAddress": "0xb200000000000000000000397293Cb8cda9a10c5",
        "chainId": 8453,
        "name": "Sandisk Corporation",
        "weightPct": 19.2,
        "themes": [
          "semiconductors"
        ],
        "amountUsd": "9.60"
      },
      {
        "ticker": "ANT",
        "symbol": "ANTc",
        "contractAddress": "0xb20000000000000000000016e38FD364d271Ba28",
        "chainId": 8453,
        "name": "Anthropic, PBC",
        "weightPct": 12.32,
        "themes": [
          "ai-infrastructure"
        ],
        "amountUsd": "6.16"
      }
    ],
    "amount": {
      "requestedUsd": "50.00",
      "allocatedUsd": "50.00",
      "minTradeUsd": "0.01",
      "skipped": [],
      "note": null
    },
    "explanations": [
      "Starting weights as requested: AI Infrastructure 60%, Semiconductors 40%.",
      "At risk level 4 (Bold) a news score of +1 or -1 moves a theme by up to 8 percentage points; the mix is then brought back to exactly 100% without any theme leaving that band.",
      "AI Infrastructure: news score -0.35 (scored 2026-11-20T21:47:15.577Z). Nvidia's SEC investigation, Anthropic's valuation concerns, and Google's reduced chip orders pull the theme down, outweighing Microsoft's gains. Weight 60% to 61.61% (+1.61 points).",
      "Semiconductors: news score -0.75 (scored 2026-11-20T21:47:15.577Z). Nvidia's deep sell-off from an SEC probe and SanDisk's drop on bearish 2027 NAND flash pricing sharply weigh on the sector. Weight 40% to 38.39% (-1.61 points).",
      "Within a theme every stock gets an equal share; a stock in two themes gets both shares.",
      "The $50.00 is split in proportion to the stock weights, to the cent, and adds up exactly; no stock gets less than the $0.01 minimum trade."
    ]
  },
  "market": {
    "phase": "closed",
    "open": false,
    "nextOpen": "2026-11-23T14:30:00.000Z",
    "closesAt": null,
    "note": "The US regular session is closed. Reference prices hold at the last close and pool prices can drift; wait for the next open before buying."
  },
  "asOf": "2026-11-21T11:34:55.499Z",
  "apiVersion": "v1",
  "disclaimer": "(same text on every response)",
  "links": {
    "themePages": {
      "ai-infrastructure": "https://tilt-rust.vercel.app/themes/ai-infrastructure",
      "semiconductors": "https://tilt-rust.vercel.app/themes/semiconductors"
    },
    "themes": "https://tilt-rust.vercel.app/themes",
    "docs": "https://tilt-rust.vercel.app/docs/use-tilt-from-bankr",
    "skill": "https://tilt-rust.vercel.app/skills/tilt/SKILL.md"
  }
}
```

### `GET /mix?themes=ai-infrastructure&amountUsd=0.03`: an amount too small for every stock (`mix.stocks` and `mix.amount` only)

```json
{
  "stocks": [
    {
      "symbol": "ANTc",
      "weightPct": 20,
      "amountUsd": "0.01"
    },
    {
      "symbol": "GOOGLc",
      "weightPct": 20,
      "amountUsd": "0.01"
    },
    {
      "symbol": "METAc",
      "weightPct": 20,
      "amountUsd": "0.01"
    },
    {
      "symbol": "MSFTc",
      "weightPct": 20,
      "amountUsd": "0.00"
    },
    {
      "symbol": "NVDAc",
      "weightPct": 20,
      "amountUsd": "0.00"
    }
  ],
  "amount": {
    "requestedUsd": "0.03",
    "allocatedUsd": "0.03",
    "minTradeUsd": "0.01",
    "skipped": [
      {
        "ticker": "MSFT",
        "reason": "Below the $0.01 minimum trade at this amount"
      },
      {
        "ticker": "NVDA",
        "reason": "Below the $0.01 minimum trade at this amount"
      }
    ],
    "note": "This amount is too small to buy all 5 stocks at the minimum trade size, so it buys the top 3 by weight."
  }
}
```

### Errors

`GET /mix?themes=energy` (HTTP 422):

```json
{
  "error": "Not tradable yet (coming soon): energy. Only live themes can be mixed.",
  "comingSoon": ["energy"],
  "asOf": "2026-11-21T11:30:16.279Z",
  "apiVersion": "v1",
  "disclaimer": "(same text on every response)",
  "links": { "themes": "https://tilt-rust.vercel.app/themes", "docs": "https://tilt-rust.vercel.app/docs/use-tilt-from-bankr", "skill": "https://tilt-rust.vercel.app/skills/tilt/SKILL.md" }
}
```

`GET /mix?themes=ai-infrastructure&weights=50` (HTTP 400): `{ "error": "weights must add up to 100", "field": "weights", ... }`
