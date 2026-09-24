# NFT Operations Reference

Browse, buy, sell, mint and transfer NFTs through OpenSea on **Ethereum, Base, Polygon, Unichain, Arbitrum and Robinhood Chain**.

## What the agent can do

| Action | Prompt |
|---|---|
| Find collections, floors and cheapest listings (by name, contract address or OpenSea URL) | "What's the floor price for Pudgy Penguins?", "Show me trending NFT collections" |
| Buy a specific NFT or the floor | "Buy Pudgy Penguin #1234", "Buy the cheapest Azuki", "Purchase this NFT: [OpenSea URL]" |
| List an NFT for sale, with a price and expiry | "List my Pudgy Penguin #1234 for 12 ETH for 7 days" |
| Cancel your listings | "Cancel my listings for Pudgy Penguin #1234" |
| Accept the best offer on an NFT you own | "Accept the best offer on my Pudgy Penguin #1234" |
| Make or cancel a collection-wide offer | "Offer 0.5 WETH on any Doodle", "Cancel my offers on Doodles" |
| Review your NFTs, listings and offers | "Show my NFTs", "Show my NFT listings" |
| Mint | "Mint from [Manifold or OpenSea drop link]" — Manifold on Base and Ethereum, SeaDrop drops on the chains above |
| Transfer (ERC-721 and ERC-1155) | "Send my Bored Ape #123 to vitalik.eth" |

Holdings are also in `bankr wallet portfolio --nfts` and `GET /wallet/portfolio?include=nfts`.

## Buying

- **ERC-20-priced listings work** — for example USDG listings on Robinhood Chain. Bankr submits the payment-token approval, checks your balance of that currency before signing, and prices the listing in its own decimals, so the quoted amount is what you pay. Collection offers are always paid in an ERC-20 — WETH (Bankr wraps any shortfall from ETH) or the collection's own currency, such as USDG on some Robinhood Chain collections.
- **Floor buys survive being sniped.** "The cheapest X" walks the candidate listings: if the one Bankr picked is bought out mid-purchase (order invalid or not found, marketplace rejection, signer simulation revert), it moves to the next-cheapest, up to **three purchase attempts**. Anything else — a price above your cap, insufficient balance, a wallet-safety block — fails at once. The reply names any substitution, and nothing is retried after a broadcast. Naming a token ID is a single attempt.
- **Recipient allowlists block marketplace actions.** An API key with `allowedRecipients` set can't buy, list, mint, or make or accept offers, since the counterparty can't be allowlisted; NFT transfers are checked against the list.
