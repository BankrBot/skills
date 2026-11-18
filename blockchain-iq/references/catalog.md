# Blockchain IQ x402 catalog (local copy)

Read from https://www.blockchainiq.co/api/x402/v1 on 11/17/2026. Host: www.blockchainiq.co only. The price shown is the CEILING for that resource; never pay more.

Payees: Base (eip155:8453) USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` to `0x617dA9383fbA67e86137BC4924b8b7E400fB7C9e`; Solana USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` to `473o2o4QaubXvvAFr9jikTCEirA6xhpzMSBxJpbTocLf`.

| id | method | path | price | what it returns |
| --- | --- | --- | --- | --- |
| catalog | GET | `/api/x402/v1` | free | Catalog: This resource list, prices, and price classes. |
| sample | GET | `/api/x402/v1/sample` | free | Free sample: Bitcoin's network activity, unpaid — transactions, active addresses and fees in BTC for its latest single day, from AWS Public Blockchain Data — to |
| free-dashboards | GET | `/api/x402/v1/free/dashboards` | free | Free dashboards: Free, no payment: the Blockchain IQ analytics dashboards given away to everyone (US government public data and our own chain reads), each with  |
| free-dashboard | GET | `/api/x402/v1/free/dashboards/{slug}` | free | Free dashboard: Free, no payment: every panel of one free dashboard (for example cftc-positioning, the CFTC's weekly crypto futures positions) as time series or |
| macro | GET | `/api/x402/v1/macro` | $0.05 | US macro indicators: US growth, inflation, employment and interest-rate indicators from FRED and other official sources, plus WTI crude oil, gold and silver pri |
| calendar | GET | `/api/x402/v1/calendar` | $0.03 | Economic and crypto calendar: The next 90 days of market-moving events: US data releases (CPI, jobs, GDP, PCE, PPI, retail sales and more) with their release ti |
| indices | GET | `/api/x402/v1/indices` | $0.03 | Indices list: Every Blockchain IQ curated index, with its coin count. |
| dashboard | GET | `/api/x402/v1/dashboards/{slug}` | $0.25 | Analytics dashboard: One dashboard, every panel: any of the 14 blockchain network dashboards ($0.25) or defi-lending-rates ($0.10, Aave v3 and Morpho lending ra |
| dashboard-panel | GET | `/api/x402/v1/dashboards/{slug}/{panel}` | $0.03 | Analytics chart: One chart from a blockchain network dashboard, with our analyst's read of it. The price panel is not sold (404, no payment asked). An unknown p |
| dashboard-section | GET | `/api/x402/v1/sections/{section}` | $0.50 | Analytics section bundle: Every blockchain network dashboard sold through the API in a single call (section 'networks', 14 chains, one dashboard each), with eve |
| brief | GET | `/api/x402/v1/brief` | $0.01 | Market brief: The opening call of a trading-agent loop, parameter-free: BTC, ETH, SOL and XRP with price, 24h/7d/30d moves and rank, scheduled events in the nex |
| event-risk | GET | `/api/x402/v1/event-risk` | $0.05 | Event risk: Scheduled market-moving events for the next N days (default 7, up to 90): US data releases with release times, FOMC/ECB/BoJ decisions, Treasury auct |
| network | GET | `/api/x402/v1/network/{chain}` | $0.03 | Network activity: One blockchain's activity in one call: the latest weekly value and 7-day change for every metric on its dashboard (transactions, active addres |
| networks | GET | `/api/x402/v1/networks` | $0.10 | All networks: Parameter-free: the activity snapshot for all 14 chains sold through the API (Bitcoin, Ethereum, Solana, XRP Ledger, Arbitrum, Polygon, Avalanche, |
| stablecoins | GET | `/api/x402/v1/stablecoins` | $0.02 | Circle USDC and EURC snapshot: Parameter-free: Circle's USDC on Ethereum, Base and Arbitrum and EURC on Ethereum and Base in one call, from our own reads of the |
| stablecoin-events | GET | `/api/x402/v1/stablecoins/events` | $0.02 | Circle USDC and EURC control events: Every control event Circle's USDC and EURC contracts emitted since a date (default 30 days, at most 90 back per call), newe |
| stablecoin-history | GET | `/api/x402/v1/stablecoins/history` | $0.02 | Circle USDC and EURC daily history: Daily history for one Circle token-chain (default Ethereum USDC, 30 days, up to 365): end-of-day total supply, supply change |
| x402-market | GET | `/api/x402/v1/x402-market` | $0.02 | x402 seller roster: Parameter-free: the Blockchain IQ x402 Conformance Index in one call. The top 1,000 x402 sellers (a payTo wallet on one network) ranked by a |
| x402-seller-history | GET | `/api/x402/v1/x402-seller-history` | $0.05 | x402 seller history: One x402 seller wallet's daily record in the Blockchain IQ Conformance Index: per day its score (0-100), grade (A-F), rank among mainnet se |
| analyst-pack | GET | `/api/x402/v1/analyst-pack` | $2.00 | BIQ Analyst daily pack: Parameter-free: one pack a day of what the Blockchain IQ Autonomous Trader reviews, scores only. Per coin (about 100, best first): total |
| reports-index | GET | `/api/x402/v1/reports` | free | Reports for sale: Free: every Blockchain IQ report sold here, with its cadence, the date of its newest edition, its price and its page. |
| reports-digest | GET | `/api/x402/v1/reports/digest` | $0.50 | Reports digest: Parameter-free: the newest edition of every report sold here in one call. Since 12 Oct 2026 that is The Ripple Review only; other reports are se |
| report-ripple-review | GET | `/api/x402/v1/reports/the-ripple-review` | $0.10 | The Ripple Review: The newest daily edition of The Ripple Review, parameter-free: XRP and the XRP Ledger in depth — price, ledger activity, RLUSD, the spot-ETF  |
| report-liquidation-levels | GET | `/api/x402/v1/reports/liquidation-levels` | $0.10 | Liquidation Levels: Coinbase loan books: Liquidation Levels, parameter-free: where Coinbase's BTC, ETH and XRP loan collateral (four Morpho Blue markets on Base |
| research-index | GET | `/api/x402/v1/research` | free | Coin Research index: Free: every Coin Research brief for sale (130+ coins), with its CoinGecko id, when its lede was last updated and its path. |
| research-digest | GET | `/api/x402/v1/research/digest` | $0.50 | Chain research digest: Parameter-free: the research read for all 21 tracked blockchains in one call — each chain's lede and its dated 'what the chain data shows |
| research | GET | `/api/x402/v1/research/{coin}` | $0.05 | Coin Research brief: One coin's full Blockchain IQ research brief: what it is, how it has traded, who is behind it, its chain data and recent coverage, every cl |
| dispatch-index | GET | `/api/x402/v1/dispatch` | free | Dispatches for sale: Free: every Blockchain IQ Dispatch sold here, newest first, with its lede, date, price and path. |
| dispatch-bis-review | GET | `/api/x402/v1/dispatch/bis-digital-money-research-review` | $0.02 | Dispatch: What the BIS says crypto, stablecoins and CBDCs must do: The Blockchain IQ Dispatch "What the BIS says crypto, stablecoins and CBDCs must do", paramet |
| dispatch-charter-race | GET | `/api/x402/v1/dispatch/occ-bank-charter-race` | $0.02 | Dispatch: The Charter Race: The Blockchain IQ Dispatch "The Charter Race", parameter-free: the full piece as Markdown plus its structured sections, sources and  |
| dispatch-sec-v-ripple | GET | `/api/x402/v1/dispatch/sec-v-ripple` | $0.02 | Dispatch: SEC v. Ripple: The Blockchain IQ Dispatch "SEC v. Ripple", parameter-free: the full piece as Markdown plus its structured sections, sources and links. |
| dispatch-governance | GET | `/api/x402/v1/dispatch/blockchain-governance-models` | $0.02 | Dispatch: Who's Actually in Charge? A Field Guide to Blockchain Governance: The Blockchain IQ Dispatch "Who's Actually in Charge? A Field Guide to Blockchain Go |
| dispatch-ondo-blackrock | GET | `/api/x402/v1/dispatch/ondo-blackrock-intelligent-portfolios` | $0.02 | Dispatch: BlackRock Puts Three Model Portfolios on Ondo: The Blockchain IQ Dispatch "BlackRock Puts Three Model Portfolios on Ondo", parameter-free: the full pi |
| dispatch-x402-market | GET | `/api/x402/v1/dispatch/x402-market-november-2026` | $0.02 | Dispatch: The x402 market in November 2026: who sells, who passes conformance, who buys: The Blockchain IQ Dispatch "The x402 market in November 2026: who sells |
| glossary | GET | `/api/x402/v1/glossary` | $0.05 | Crypto glossary: Parameter-free: the whole Blockchain IQ crypto glossary in one call — every term with its aliases, category, plain-English definition, related  |
