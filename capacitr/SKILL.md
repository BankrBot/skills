# Capacitr: Market Discovery Intelligence for AI Agents

Capacitr turns any URL or text topic into a ranked set of tradeable markets across **Polymarket**, **HyperLiquid**, and **Deribit** — enriched with **Quotient AI edge scores** to surface mispriced opportunities.

Drop in a news link, a tweet URL, a ticker, or a plain-text topic and get back structured prediction markets, perpetual futures, and options contracts — all ranked by relevance and edge potential.

---

## 🚀 Access

**Endpoint:** `https://app.capacitr.xyz/api/analyze-link`
**Method:** `POST`
**Payment:** `$0.01 USDC on Base` per request (x402)
**Content-Type:** `application/json`

No API key needed — pay per request using the x402 protocol.

---

## 📥 Request

```json
{
  "url": "https://reuters.com/article/oil-opec-cuts",
  "query": ""
}
```

Pass either `url` (a scraped web page) or `query` (plain text topic). One is required.

| Field | Type | Description |
|-------|------|-------------|
| `url` | string | Any public URL — news article, tweet, blog post |
| `query` | string | Free-text topic, ticker, or question |

---

## 📤 Response

```json
{
  "content": {
    "summary": "OPEC+ agreed to deeper production cuts...",
    "keywords": ["OPEC", "crude oil", "production cuts", "WTI"],
    "entities": ["Saudi Arabia", "Russia", "WTI", "Brent"],
    "tickers": ["OIL", "BRENTOIL", "CL"]
  },
  "predictions": [
    {
      "question": "Will WTI crude oil exceed $100 by end of 2025?",
      "yesPrice": 0.34,
      "noPrice": 0.66,
      "volume": 1240000,
      "slug": "wti-crude-oil-100-2025",
      "quotientOdds": 0.51,
      "spread": 0.17,
      "spreadDirection": "q_higher",
      "bluf": "Q models show undersupply risk from OPEC cuts is underpriced by market.",
      "signalCount": 8,
      "isQuotientSource": false
    }
  ],
  "perps": [
    {
      "asset": "BRENTOIL",
      "coinId": "xyz:BRENTOIL",
      "markPrice": "89.45",
      "funding": "0.0001",
      "volume24h": "12400000",
      "openInterest": "4200000",
      "source": "HyperLiquid (HIP-3)"
    }
  ],
  "options": [
    {
      "instrument": "BTC-27JUN25-100000-C",
      "markPrice": "0.042",
      "markIv": "58.3",
      "openInterest": "1240",
      "type": "CALL"
    }
  ]
}
```

---

## 🧠 Response Fields

### `content`
Extracted intelligence from the input.

| Field | Description |
|-------|-------------|
| `summary` | 2–3 sentence summary of the content |
| `keywords` | 5–8 keywords optimized for market search |
| `entities` | Named entities: people, companies, assets, events |
| `tickers` | Trading ticker symbols directly relevant to the content |

### `predictions` — Polymarket + Quotient
Binary outcome prediction markets. Items with Quotient edge scores appear first.

| Field | Description |
|-------|-------------|
| `question` | Market question |
| `yesPrice` | Current YES price (0–1) |
| `noPrice` | Current NO price (0–1) |
| `volume` | Total traded volume in USD |
| `slug` | Polymarket event slug for deep-linking |
| `quotientOdds` | Quotient AI forecast probability (if available) |
| `spread` | Absolute divergence between Q forecast and market price |
| `spreadDirection` | `q_higher` = market underprices YES, `q_lower` = overprices YES |
| `bluf` | Bottom Line Up Front — Quotient's one-line rationale |
| `signalCount` | Number of analyst signals backing the forecast |
| `isQuotientSource` | `true` if this market was surfaced by Quotient (not Polymarket search) |

**Edge signals:** Items with `spread > 0.05` are flagged as mispriced. `q_higher` means BUY YES, `q_lower` means BUY NO.

Trade link: `https://polymarket.com/event/{slug}` (or search by question if `isQuotientSource: true`)

### `perps` — HyperLiquid Perpetuals
Perpetual futures matching the topic. Includes standard crypto perps and HIP-3 real-world asset perps (stocks, commodities, indices).

| Field | Description |
|-------|-------------|
| `asset` | Display ticker (e.g. `BRENTOIL`, `BTC`, `AAPL`) |
| `coinId` | Full HyperLiquid coin identifier for trade URLs (e.g. `xyz:BRENTOIL`, `BTC`) |
| `markPrice` | Current mark price |
| `funding` | Current funding rate (annualized when multiplied by 8760) |
| `volume24h` | 24h notional volume in USD |
| `openInterest` | Open interest in USD |
| `source` | `HyperLiquid` or `HyperLiquid (HIP-3)` for real-world assets |

Trade link: `https://app.hyperliquid.xyz/trade/{coinId}`

**HIP-3 assets available:** `xyz:BRENTOIL`, `xyz:CL` (WTI), `xyz:GOLD`, `xyz:SILVER`, `xyz:NATGAS`, `xyz:SP500`, `xyz:XYZ100` (Nasdaq), `xyz:AAPL`, `xyz:TSLA`, `xyz:NVDA`, `xyz:MSFT`, `xyz:AMZN`, `xyz:META`, `xyz:PLTR`, `xyz:MSTR`, `xyz:GME`, `xyz:EUR`, `xyz:JPY`

### `options` — Deribit Options
Options contracts for crypto assets (BTC, ETH, SOL, XRP) relevant to the topic.

| Field | Description |
|-------|-------------|
| `instrument` | Deribit instrument name (e.g. `BTC-27JUN25-100000-C`) |
| `markPrice` | Mark price in BTC/ETH |
| `markIv` | Implied volatility % |
| `openInterest` | Open interest (contracts) |
| `type` | `CALL` or `PUT` |

Trade link: `https://www.deribit.com/options/{currency}/{instrument}`

---

## 💡 Usage Examples

### From a news article
```bash
curl -X POST https://app.capacitr.xyz/api/analyze-link \
  -H "Content-Type: application/json" \
  -d '{"url": "https://reuters.com/article/some-opec-story"}'
```

### From a topic or ticker
```bash
curl -X POST https://app.capacitr.xyz/api/analyze-link \
  -H "Content-Type: application/json" \
  -d '{"query": "Federal Reserve rate cut September 2025"}'
```

### With x402 payment (via @x402/fetch)
```javascript
import { wrapFetchWithPayment } from '@x402/fetch';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: base, transport: http() });

const fetchWithPayment = wrapFetchWithPayment(fetch, walletClient);

const res = await fetchWithPayment('https://app.capacitr.xyz/api/analyze-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: 'Tesla earnings miss expectations' }),
});

const markets = await res.json();
```

### With Bankr agent
```bash
bankr agent prompt "Find tradeable markets for this article: https://bloomberg.com/news/articles/..."
# The agent will call the Capacitr skill, pay $0.01 USDC via x402, and return ranked markets
```

---

## 🔧 Agent Integration Pattern

```
User shares link or topic
        ↓
POST /api/analyze-link { url or query }
        ↓
Parse response:
  - predictions with spread > 0.05 → flag as EDGE opportunity
  - for each edge: log spreadDirection (q_higher = buy YES, q_lower = buy NO)
  - perps → use coinId for trade URL construction
  - options → use instrument for Deribit deep link
        ↓
Present to user:
  - Top 3 EDGE predictions (sorted by spread desc)
  - Relevant perps with funding rate context
  - Options if crypto asset is involved
```

---

## ⚡ Pricing & Cost

| Call type | Cost |
|-----------|------|
| URL scan + market discovery | $0.01 USDC |
| Text query + market discovery | $0.01 USDC |

Payment via x402 on Base. No subscription, no API key, no account required.

---

## 🌐 Related Links

- **App:** https://app.capacitr.xyz
- **Markets Scanner:** https://markets.capacitr.xyz
- **Docs:** https://docs.capacitr.xyz
- **Spec:** https://spec.capacitr.xyz
