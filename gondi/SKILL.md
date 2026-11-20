---
name: gondi
description: Live NFT market and NFT lending data from GONDI, an NFT marketplace with peer-to-peer lending on Ethereum, Hyperliquid (HyperEVM) and Robinhood Chain. Use when the user asks for a collection's floor price or top bid, one NFT's listing, top bid, last sale or estimated value, the cheapest NFTs for sale, recent sales, floor history, top or trending collections, GONDI's fees against OpenSea, what a wallet's NFTs are worth, how much an NFT can borrow, what buying with a loan costs, a borrower's open loans, loan offers and lending APRs, or the top lenders and their returns. Read-only. It calls the hosted GONDI MCP server at https://api.gondi.xyz/mcp with no API key and no wallet, and never signs or sends a transaction.
license: MIT
compatibility: Requires network access to https://api.gondi.xyz. Uses the agent's MCP client when it has one, otherwise curl.
metadata:
  author: gondixyz
  version: "1.0.0"
  chain: multichain
  category: NFT & Tokens
  openclaw:
    homepage: https://github.com/gondixyz/mcp
    requires:
      bins:
        - curl
---

# GONDI

[GONDI](https://www.gondi.xyz) is an NFT marketplace with peer-to-peer lending
built in. On Ethereum, Hyperliquid (HyperEVM) and Robinhood Chain, users buy,
sell, list and bid on NFTs, and borrow or lend against them.

This skill answers questions about that market with live data from the hosted
GONDI MCP server: prices, bids, listings, sales, fees, wallets, loans, loan
offers and lenders. The server has 20 tools, all of them read-only.

| | |
| --- | --- |
| Endpoint | `https://api.gondi.xyz/mcp` |
| Transport | Streamable HTTP (JSON-RPC 2.0 over `POST`) |
| Authentication | None: no API key, no wallet, no sign-in |
| Access | Read-only |
| Chains | `ethereum`, `hyperliquid`, `robinhood` |
| Currencies | `WETH`, `USDC`, `WHYPE`, `HUSDC`, `RWETH`, `USDG` |

## Read-only scope

- No tool holds keys, signs a message or sends a transaction. Nothing in this
  skill asks for a private key, a seed phrase or a wallet connection; never ask
  the user for one.
- A wallet is only ever a public identifier here: an address, a GONDI username
  or an ENS name whose public data is read.
- To act (buy, bid, list, borrow, repay, renegotiate, refinance, make a loan
  offer), send the user to the `gondi_url` the tool answered, where they act
  with their own wallet. Developers who want to sign offers from code use the
  [`gondi` npm SDK](https://www.npmjs.com/package/gondi) with their own wallet;
  that is outside this skill.
- Answers are market data, not financial advice.

## What you probably got wrong

- **GONDI is a marketplace, not only a lending protocol.** It answers floor
  prices, bids, listings and sales as well as loans. Never tell a user GONDI is
  not a marketplace.
- **Never guess a slug.** Collection and artist slugs are GONDI's own
  (`pudgypenguins`, not `pudgy-penguins`). When you have a name, call
  `search_gondi` first and take the slug from its result.
- **`token_id` is a decimal string**, `"4507"`, not a number and not hex.
- **Do not resolve a wallet first.** Wallet tools take a `0x` address, a GONDI
  username or an ENS name as given by the user.
- **The listed price is what the buyer pays.** GONDI's sale fee comes out of
  the seller's proceeds. On every listing and bid, `gondi_fee_percent` is the
  seller's fee and `buyer_pays` is the total the buyer or bidder pays.
- **Amounts are whole tokens**, not wei: `2.17` next to `currency_symbol`
  `ETH` is 2.17 ETH. USD values are dollars and are `null` when a rate is
  unavailable. Rates are percent, durations are days.
- **A loan offer with a `token_id` is for that NFT only.** Collection offers
  are the ones any NFT of the collection can take.
- **Sell or borrow is the user's call.** State both figures and the trade-off;
  do not advise which to choose.

## Setup

There is nothing to install and no key to get. Pick one of the two ways.

### With an MCP client

If the agent can connect to remote MCP servers, add the endpoint and call the
tools by name.

OpenClaw:

```sh
openclaw mcp set gondi '{"url":"https://api.gondi.xyz/mcp","transport":"streamable-http"}'
```

Claude Code:

```sh
claude mcp add --transport http gondi https://api.gondi.xyz/mcp
```

Any other client: a remote server at `https://api.gondi.xyz/mcp`, transport
Streamable HTTP, no authentication.

### With curl

The server is stateless: a single `POST` answers, with no `initialize` call and
no session header. This calls a tool:

```sh
curl -sS -X POST https://api.gondi.xyz/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_collection_market","arguments":{"slug":"pudgypenguins"}}}'
```

The answer is JSON. `result.structuredContent` holds the data as an object, and
`result.content[0].text` holds the same data as a JSON string:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "isError": false,
    "structuredContent": {
      "collection_slug": "pudgypenguins",
      "collection_name": "Pudgy Penguins",
      "chain": "ethereum",
      "gondi_url": "https://www.gondi.xyz/collections/pudgypenguins",
      "floor_price": {"amount": 2.17, "currency_symbol": "ETH", "amount_usd": 3824.61},
      "top_collection_bid": {"amount": 2.1, "currency_symbol": "WETH", "gondi_fee_percent": 0.5, "buyer_pays": 2.1},
      "fees": {"gondi_sale_fee_percent": 0.5, "opensea_sale_fee_percent": 1.0}
    }
  }
}
```

The numbers above are a sample from November 2026 with some fields left out;
every call answers live data.

To read the current tools with their full descriptions and input schemas:

```sh
curl -sS -X POST https://api.gondi.xyz/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Tools

Arguments in **bold** are required. Every `limit` has a default, so leave it
out unless the user asks for more or fewer rows.

### Search

| Tool | Arguments | Answers |
| --- | --- | --- |
| `search_gondi` | **`query`** (a name, slug, token id, ENS name or address), `limit` (1 to 15 per kind, default 5) | Matching `collections`, `artists`, `nfts` and `users`, each with its slug or address, chain and `gondi_url`. |

### Market

| Tool | Arguments | Answers |
| --- | --- | --- |
| `get_collection_market` | **`slug`** | A collection's floor price and top collection bid, in its currency and in USD, and its fees to sell and buy on GONDI against OpenSea. |
| `get_nft_market` | **`collection_slug`**, **`token_id`** | One NFT's listing, top bid, last sale, estimated value, whether it is collateral in an open loan, and what the seller keeps on GONDI against OpenSea. |
| `list_cheapest_for_sale` | exactly one of `collection_slug` and `artist_slug`; `limit` (1 to 25, default 10) | The cheapest NFTs for sale from a collection or by an artist, cheapest first, with the page to buy each. |
| `list_recent_sales` | **`collection_slug`**, `token_id` (only this NFT's sales), `period` (`HOURS_24`, `DAYS_7`, `DAYS_30`, `DAYS_90`, `DAYS_365`; every sale if unset), `limit` (1 to 20, default 10) | The latest sales, newest first, with price, marketplace, buyer and seller, and a summary with the period's sale count and min, median and max USD price. |
| `get_floor_price_history` | **`collection_slug`**, `period` (`DAYS_7`, `DAYS_30`, `DAYS_90`, `DAYS_180`, `DAYS_365`; default `DAYS_30`) | The floor in ETH over the period, one point a day (at most 31), with the change in percent. |
| `list_top_collections` | `sort_by` (`VOLUME`, `SALES`, `TRENDING`, `MARKET_CAP`, `FLOOR_CHANGE`; default `VOLUME`), `period` (`1D`, `7D`, `30D`; default `7D`), `chain`, `limit` (1 to 25, default 10) | The top and trending collections with floor, floor change, volume and sales. |

### Lending

| Tool | Arguments | Answers |
| --- | --- | --- |
| `get_lending_market_overview` | none | The whole lending market in USD: open principal, interest paid and accruing, volume and APRs of new loans. |
| `get_supported_markets` | none | Per chain the loan contract and principal currencies, the accepted offer durations and the protocol fee on interest. |
| `get_lending_guide` | none | How lending on GONDI works, step by step, with its risks and fees. Read it before advising a lender. |
| `list_lending_opportunities` | `chain`, `currency`, `sort_by` (`TOTAL_OUTSTANDING_PRINCIPAL`, `LOAN_COUNT`, `OFFER_COUNT`, `TOTAL_LOAN_VOLUME`; default `TOTAL_OUTSTANDING_PRINCIPAL`), `limit` (1 to 25, default 10) | Collections borrowers take loans against, ranked, with open loans, repayment rate, floor and offer count. |
| `get_collection_lending_stats` | **`slug`**, `currency` (the chain's wrapped native token if unset) | How much is lent against a collection, its open loans, repayment rate, and the principal, APR and remaining-time ranges of its open loans. |
| `list_loan_offers` | `collection_slug`, `offer_type` (`CollectionOffer`, `SingleNFTOffer`), `chain`, `currency`, `min_apr_percent`, `sort_by` (`APR_BPS`, `PRINCIPAL_AMOUNT`, `AVAILABLE_PRINCIPAL_AMOUNT`, `DURATION`, `CREATED_DATE`; default `APR_BPS`), `order` (`DESC`, `ASC`; default `DESC`), `limit` (1 to 25, default 10) | Active loan offers: principal, APR, duration and the page where a borrower takes each. |
| `get_top_lenders` | **`metric`** (`OUTSTANDING_PRINCIPAL`, `EARNINGS`, `LOWEST_DEFAULT_RATE`, `NET_EAPR`), `period` (`LAST_30_DAYS`, `LAST_90_DAYS`, `LAST_180_DAYS`; default `LAST_90_DAYS`), `currency`, `limit` (1 to 25, default 10) | The leading lenders with open principal, earnings, net APR and default rate. |
| `get_lender_returns` | **`wallet`**, `currency` (every currency the wallet lent in if unset) | One lender's record per currency: principal lent, net profit, net APR, defaults and open positions. |

### Borrowing

| Tool | Arguments | Answers |
| --- | --- | --- |
| `list_borrower_loans` | **`wallet`**, `expiring_within_days`, `sort_by` (`DUE_DATE`, `REFINANCE_SAVING`; default `DUE_DATE`), `limit` (1 to 25, default 10), `offset` (the previous answer's `next_offset`) | A borrower's open loans: due dates, repayment due, and the renegotiation or market offers that could make them cheaper, with a summary over every matching loan. |
| `list_borrowing_opportunities` | **`wallet`**, `currency`, `sort_by` (`PRINCIPAL`, `APR`; default `PRINCIPAL`), `limit` (1 to 25, default 10) | The NFTs a wallet holds outside a loan, with the largest offer each can take today. NFTs sharing an offer come as one row with `fundable_count`, how many of them it can fund. |
| `get_borrow_quote` | **`collection_slug`**, **`token_id`**, `currency` | How much one NFT can borrow now: its largest offer and its cheapest-APR offer. |
| `get_buy_with_loan_quote` | **`collection_slug`**, **`token_id`** | What buying a listed NFT with a loan costs: upfront payment, the loan's terms and repayment, and the fee. `unavailable_reason` says why when there is no quote. |

### Wallet

| Tool | Arguments | Answers |
| --- | --- | --- |
| `get_wallet_holdings` | **`wallet`**, `limit` (collections, 1 to 25, default 10) | What a wallet's NFTs are worth in ETH and USD, where it holds them, its most valuable collections, and what it owes as a borrower. |

`chain` is one of `ethereum`, `hyperliquid`, `robinhood`. `currency` is one of
`WETH`, `USDC`, `WHYPE`, `HUSDC`, `RWETH`, `USDG`, and implies its chain.
`wallet` is a `0x` address, a GONDI username or an ENS name.

## Common patterns

Each line is the `name` and `arguments` of a `tools/call` request.

**Name to slug.** Always the first call when the user gives a name:

```json
{"name": "search_gondi", "arguments": {"query": "pudgy penguins"}}
```

Take `slug` from `collections` or `artists`, or `collection_slug` and
`token_id` from `nfts`.

**Floor and top bid of a collection:**

```json
{"name": "get_collection_market", "arguments": {"slug": "pudgypenguins"}}
```

**One NFT: listing, top bid, last sale, value:**

```json
{"name": "get_nft_market", "arguments": {"collection_slug": "pudgypenguins", "token_id": "4507"}}
```

**Cheapest for sale, by collection or by artist:**

```json
{"name": "list_cheapest_for_sale", "arguments": {"collection_slug": "pudgypenguins", "limit": 5}}
{"name": "list_cheapest_for_sale", "arguments": {"artist_slug": "xcopy", "limit": 5}}
```

**Sales this week and the floor over 90 days:**

```json
{"name": "list_recent_sales", "arguments": {"collection_slug": "pudgypenguins", "period": "DAYS_7"}}
{"name": "get_floor_price_history", "arguments": {"collection_slug": "pudgypenguins", "period": "DAYS_90"}}
```

**Trending today:**

```json
{"name": "list_top_collections", "arguments": {"sort_by": "TRENDING", "period": "1D"}}
```

**How much an NFT can borrow, and what buying it with a loan costs:**

```json
{"name": "get_borrow_quote", "arguments": {"collection_slug": "pudgypenguins", "token_id": "4507"}}
{"name": "get_buy_with_loan_quote", "arguments": {"collection_slug": "pudgypenguins", "token_id": "4507"}}
```

**Sell or borrow.** Call `get_nft_market` and `get_borrow_quote` for the NFT.
Selling nets the listing price or the top bid, less fees (`listing_seller_net`,
`top_bid_seller_net`). Borrowing nets `net_principal` now, keeps the NFT, and
costs the interest over the duration (principal times APR times days over 365),
repaid with the principal by expiry; unpaid, the lender takes the NFT.

**The cheapest loan any NFT of a collection can take:**

```json
{"name": "list_loan_offers", "arguments": {"collection_slug": "pudgypenguins", "offer_type": "CollectionOffer", "sort_by": "APR_BPS", "order": "ASC"}}
```

**A wallet: what it holds, what it can borrow, which loans come due:**

```json
{"name": "get_wallet_holdings", "arguments": {"wallet": "vitalik.eth"}}
{"name": "list_borrowing_opportunities", "arguments": {"wallet": "vitalik.eth"}}
{"name": "list_borrower_loans", "arguments": {"wallet": "vitalik.eth", "expiring_within_days": 7}}
```

For "which loans should I renegotiate", call `list_borrower_loans` with
`sort_by` `REFINANCE_SAVING`.

**Where to lend and what it returns:**

```json
{"name": "list_lending_opportunities", "arguments": {"sort_by": "TOTAL_OUTSTANDING_PRINCIPAL"}}
{"name": "get_collection_lending_stats", "arguments": {"slug": "pudgypenguins"}}
{"name": "get_top_lenders", "arguments": {"metric": "EARNINGS", "period": "LAST_30_DAYS"}}
{"name": "get_lender_returns", "arguments": {"wallet": "vitalik.eth"}}
```

Call `get_lending_guide` before explaining how lending works, and
`get_supported_markets` for the loan contract, currencies and durations of each
chain. `get_lending_market_overview` answers the size of the whole market.

## Example prompts

- "What's the floor and the top bid on Pudgy Penguins?"
- "What's the top bid on Milady #1234, and what is it listed for?"
- "Show me the five cheapest CryptoPunks for sale."
- "What's the cheapest piece for sale by XCOPY?"
- "What did Fidenza sell for this week?"
- "How has the Pudgy Penguins floor moved over the last 90 days?"
- "What are the top NFT collections right now, and what's trending today?"
- "What is vitalik.eth's NFT wallet worth?"
- "How much can I borrow against Milady #1234?"
- "What would it cost to buy Azuki #42 with a loan?"
- "Should I sell my Pudgy Penguin or borrow against it?"
- "Where do I pay the lowest fees to sell a Fidenza, GONDI or OpenSea?"
- "If I accept the top bid on my Milady, what do I keep?"
- "Which of my loans expire this week?"
- "Which of my loans should I renegotiate?"
- "What can I borrow against the NFTs in vitalik.eth?"
- "What's the cheapest loan I can take on Azuki?"
- "What APR can I earn lending against Pudgy Penguins?"
- "Which collections are best to lend against?"
- "Who are the top lenders this month and what do they earn?"
- "What are my lending returns?"
- "How does GONDI lending work and what are the risks?"

When the user says "my" wallet or loans and has not given one, ask for an
address, a GONDI username or an ENS name.

## How to answer

- Open with the direct answer and its number.
- Give each amount with its currency symbol, and the USD value when the tool
  answers one.
- Link each collection, NFT, loan or user you name to its `gondi_url`.
- Keep a list to the rows that answer the question, and offer to show more.
- Live data changes between calls: answer from the call you just made, not from
  an earlier one or from memory.

## Fees

Take fees from the tools rather than from memory: `get_collection_market`
answers them per collection, and every listing and bid carries
`gondi_fee_percent`, `buyer_fee_percent` and `buyer_pays`. As of November 2026:

- A regular GONDI sale costs the seller 0.5% of the price, against OpenSea's
  1.0%. Buyers pay no GONDI fee.
- A stealth listing costs the seller 2.0%. A stealth bid adds 0.5% on top of
  the bid, paid by the bidder, while its seller pays 0.5%.
- Buying with a loan adds 2.0% to the price, paid by the buyer. Selling an NFT
  that is collateral in a loan to repay it costs the seller 2.0%.
- CryptoPunks pay no GONDI sale fee.
- Buying an OpenSea listing through GONDI costs the same as on OpenSea.

## Errors

A failed call still answers HTTP 200, with `result.isError` set to `true` and
the reason in `result.content[0].text`:

| Message | Fix |
| --- | --- |
| `No collection with slug '...' on GONDI. Find its slug with search_gondi.` | Call `search_gondi` and use the slug it answers. |
| `Pass exactly one of collection_slug and artist_slug.` | `list_cheapest_for_sale` takes one or the other, never both or neither. |
| `Field required` | A required argument is missing; see the tables above. |
| `` Pass `wallet`: a 0x address, a GONDI username or an ENS name. `` | Ask the user for their wallet. |

Requests are rate-limited per IP address. When a call is refused for that
reason, wait before trying again and do not retry in a loop.

## Keeping current

The server is the source of truth. This file lists its tools as of version
1.0.0 of the skill; when a tool, an argument or a value here differs from what
`tools/list` answers, follow `tools/list`.

## Links

- Server README and issue tracker: <https://github.com/gondixyz/mcp>
- Documentation: <https://docs.gondi.xyz/gondi-v3/mcp-server/>
- GONDI: <https://www.gondi.xyz>
