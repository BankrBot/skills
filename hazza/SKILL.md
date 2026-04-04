---
name: hazza
description: hazza onchain name registry — register, manage, and resolve immediately useful names on Base, powered by x402 and Net Protocol.
---

# hazza — Onchain Names on Base

You can help users register, manage, and resolve hazza names — immediately useful names on Base. hazza uses x402 for payments and is powered by Net Protocol.

## What is hazza

- **Short onchain names** on Base (e.g., `geaux.hazza.name`)
- **First name free** for everyone (just pay gas), then **$5 USDC** — pay once, available forever
- **Unlimited Pass holders** get 1 additional free name + 20% off all registrations
- Every name gets a profile page at `https://<name>.hazza.name`
- Text records for avatar, description, social links, agent config
- Names are ERC-721 NFTs — transferable, composable, onchain

## Key Info

- **Website:** https://hazza.name
- **Contract (Base Mainnet):** `0xD4E420201fE02F44AaF6d28D4c8d3A56fEaE0D3E`
- **USDC (Base):** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Chain:** Base (chainId 8453)
- **Powered by:** x402 payment protocol + Net Protocol

---

## CLI Reference

The `hazza` CLI lets you interact with the hazza registry from the terminal.

### Installation

```bash
cd cli && npm install && npm link
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output (for agents/scripts) |
| `--rpc-url <url>` | Override RPC URL |
| `--wallet <addr>` | Override wallet address |

### Commands

#### Search for a name

```bash
hazza search <name>
```
Checks availability and shows pricing. If a wallet is configured and eligible for a free claim, that's shown too.

#### Register a name

```bash
hazza register <name> [--wallet <address>]
```
Full x402 registration flow:
1. Checks availability
2. Checks free claim eligibility (Unlimited Pass + NL member)
3. If free: registers directly, no payment
4. If paid: gets 402 with USDC amount, transfers via `cast`, retries with payment header

#### List owned names

```bash
hazza names [address]
```
Lists all names owned by an address. Defaults to configured wallet.

#### View a profile

```bash
hazza profile <name>
```
Shows full profile: owner, status, text records, profile URL.

#### Text records

```bash
hazza records get <name> <key>     # Get a record
hazza records set <name> <key> <value>  # Set a record (requires cast)
hazza records list <name>          # List all records

# Shorthands:
hazza get <name> <key>
hazza set <name> <key> <value>
```

Common keys: `avatar`, `description`, `url`, `com.twitter`, `com.github`, `xyz.farcaster`, `org.telegram`

#### Registry stats

```bash
hazza stats
```
Shows total registered names, contract address, chain.

#### Configuration

```bash
hazza config show           # Show current config
hazza config set <key> <val>  # Set a value
hazza config get <key>       # Get a value
hazza config reset           # Reset to defaults
```

Config keys: `wallet`, `baseUrl`, `rpcUrl`, `registryAddress`, `usdcAddress`, `chainId`

Config file: `~/.config/hazza/config.json`

---

## API Reference

Base URL: `https://hazza.name`

### Read Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/available/:name` | Check name availability |
| `GET /api/resolve/:name` | Resolve name to owner address |
| `GET /api/quote/:name?wallet=` | Get registration price |
| `GET /api/free-claim/:address` | Check free claim eligibility (first-registration + Unlimited Pass) |
| `GET /api/profile/:name` | Full profile with text records |
| `GET /api/text/:name/:key` | Get single text record |
| `GET /api/names/:address` | List names owned by address |
| `GET /api/stats` | Registry statistics |
| `GET /api/metadata/:name` | ERC-721 token metadata |
| `GET /api/reverse/:address` | Reverse resolve address to name |
| `GET /api/og/:name` | Generate OG image (1200x630 PNG) |
| `GET /api/share` | Square share image (1200x1200 PNG) — for Farcaster/social |
| `GET /api/icon` | App icon (1200x1200 PNG) |

### Write Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /x402/register` | Register a name (x402 payment flow) |
| `POST /x402/text/:name` | Set text record via x402 ($0.02 USDC, no API key) |
| `POST /x402/text/:name/batch` | Batch set text records via x402 ($0.02 USDC, no API key) |
| `POST /api/text/:name` | Set text record (API key auth, returns unsigned tx) |
| `POST /api/text/:name/batch` | Batch set text records (API key auth, returns unsigned txs) |

### Two Ways to Write Records

**x402 path (recommended for agents):** Pay $0.02 USDC per request, relayer executes the transaction. No API key, no gas management. The `from` address in the payment must own the name.

**API key path:** Generate an API key on-chain, get unsigned transaction data back, sign and submit yourself. Free (no $0.02 fee) but you need ETH for gas and must be the owner/operator.

### x402 Registration Flow

1. `POST /x402/register` with `{name, owner}`
2. If eligible for free claim → returns success immediately
3. If paid → returns `402` with payment requirements:
   - `accepts[0].maxAmountRequired` = USDC amount (6 decimals)
   - `accepts[0].payTo` = relayer address
4. Transfer USDC to `payTo` address
5. Retry `POST /x402/register` with `X-PAYMENT` header:
   - Base64 of `{"scheme":"exact","txHash":"0x...","from":"0x..."}`
6. Returns: `{name, owner, tokenId, registrationTx, profileUrl}`

### x402 Text Record Flow

1. `POST /x402/text/:name` with `{key, value}` (or `/x402/text/:name/batch` with `{records: [{key, value}, ...]}`)
2. Returns `402` with payment requirements: `maxAmountRequired: "20000"` ($0.02 USDC)
3. Transfer $0.02 USDC to `payTo` address
4. Retry with `X-PAYMENT` header: Base64 of `{"scheme":"exact","txHash":"0x...","from":"0x..."}`
5. `from` must be the name owner — relayer verifies ownership before executing
6. Returns: `{name, key, value, tx, profileUrl}` (or `{name, records, tx, profileUrl}` for batch)

---

## Pricing

| Situation | Cost |
|-----------|------|
| First name per wallet | **FREE** (gas only) |
| Unlimited Pass holder — 2nd name | **FREE** (gas only) |
| Paid names 1–3 (per wallet, 90-day window) | $5 USDC |
| Paid names 4–5 | $12.50 USDC (2.5x) |
| Paid names 6–7 | $25 USDC (5x) |
| Paid names 8+ | $50 USDC (10x) |
| Unlimited Pass discount | 20% off all paid tiers |

Free registrations do not count toward the progressive pricing tiers. If a user gets 2 free names, their next 3 paid names are still at the $5 tier.

Names are permanent — no renewals, no expiry. Pay once, own forever.

---

## Contract Functions

Key read functions:
- `available(name)` → bool
- `resolve(name)` → (owner, tokenId, registeredAt, expiresAt, operator, agentId, agentWallet)
- `text(name, key)` → string
- `textMany(name, keys)` → string[]
- `quoteName(name, owner, len, hasPass, isRenewal)` → cost
- `namesOfOwner(owner)` → string[]

Key write functions:
- `register(name, owner)` — standard registration (requires USDC approval)
- `registerDirectWithMember(name, owner, ...)` — free claim with membership
- `setText(name, key, value)` — set text record (owner/operator only)
- `setTexts(name, keys, values)` — batch set text records

---

## Examples

### Register a name
```bash
hazza config set wallet 0x96168ACf7f3925e7A9eAA08Ddb21e59643da8097
hazza search alice
hazza register alice
```

### Set up a profile
```bash
hazza set alice avatar https://example.com/pfp.png
hazza set alice description "Builder on Base"
hazza set alice com.twitter AliceOnBase
hazza set alice url https://alice.dev
```

### Check ownership
```bash
hazza names                    # uses configured wallet
hazza names 0x9616...          # specific address
hazza profile alice
```

### Agent/script usage
```bash
hazza search alice --json | jq .available
hazza names --json | jq '.[].name'
```

---

## Marketplace

The hazza marketplace at `hazza.name/marketplace` is a whitelabeled Net Protocol Bazaar. All listings are stored onchain as Net Protocol messages via Seaport, and appear on both `hazza.name/marketplace` and `netprotocol.app/bazaar`.

### Agent Bounties

Sellers can set an agent bounty that comes out of the sale price. The bounty ETH is held by the Bounty Escrow contract (`0x95a29AD7f23c1039A03de365c23D275Fc5386f90`) until the name sells or the seller cancels. If an agent helps sell the name, the agent earns the bounty. If no agent claims, the bounty is returned to the seller. Self-registered agents get 24-hour windows; seller-assigned agents never expire.

### Features
- **Dual currency:** List names in ETH or USDC
- **4 tabs:** Browse Listings, My Names, Collection Offers, Recent Sales
- **Cart:** Buy multiple listings, register new names, and list names for sale — all in one session
- **Watchlist:** Save listings for later. Shows "in X watchlists" as social proof.
- **Adaptive buying:** Direct Seaport when wallet is connected, x402 fallback when no wallet.
- **Cross-linked:** Dashboard has "sell" button, register success has "list on marketplace" CTA, profile pages link to marketplace.

### CLI Marketplace Commands

```bash
hazza market listings         # Browse active listings (ETH + USDC)
hazza market ls               # Alias for listings
hazza market offers           # View collection offers
hazza market sales            # Recent sales
hazza market sell <name> <price> [--usdc]   # List a name (ETH default, --usdc for USDC)
hazza market buy <orderHash>  # Buy a listing
```

### Listing Helper (for agents)

Agents don't need to know Seaport internals. Call the listing helper to get everything needed to list a name:

```
POST /api/marketplace/list-helper
{
  "name": "alice",
  "price": "0.1",
  "seller": "0xAGENT_WALLET",
  "duration": 0,
  "bountyAmount": "0.01"
}

→ Returns:
  - typedData: EIP-712 data to sign with agent's wallet
  - bazaarSubmit: order parameters for Bazaar.submit() call
  - approvalNeeded: setApprovalForAll tx if Seaport isn't approved yet
  - bountyRegistration: registerBounty tx if bounty was set
```

Agent flow: call list-helper → sign typedData → call Bazaar.submit() with signature → optionally register bounty. All from the agent's own wallet.

### Marketplace API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/marketplace/list-helper` | Build Seaport listing data for agent signing |
| `GET /api/marketplace/listings` | Active hazza name listings (ETH + USDC) |
| `GET /api/marketplace/offers` | Active collection offers |
| `GET /api/marketplace/sales` | Recent sales |
| `GET /api/marketplace/watch/:orderHash` | Watchlist count for a listing |
| `POST /api/marketplace/watch` | Add to watchlist `{orderHash, address}` |
| `DELETE /api/marketplace/watch` | Remove from watchlist `{orderHash, address}` |
| `GET /api/bounty/:tokenId` | Check bounty status for a name |
| `GET /api/bounty/pending/:address` | Check pending withdrawals |
| `POST /api/bounty/register` | Register bounty (returns unsigned tx) |
| `POST /api/bounty/register-agent` | Register as agent for bounty |
| `POST /api/bounty/claim` | Claim bounty after sale |
| `POST /api/bounty/cancel` | Cancel bounty (seller only) |
| `POST /api/bounty/withdraw-bounty` | Withdraw bounty ETH (seller) |
| `POST /api/bounty/withdraw` | Withdraw pending payouts |

### Key Contracts (Base)
- **Seaport:** `0x0000000000000068F116a894984e2DB1123eB395`
- **Bazaar V2:** `0x000000058f3ade587388daf827174d0e6fc97595`
- **Bounty Escrow (Proxy):** `0x95a29AD7f23c1039A03de365c23D275Fc5386f90`
- **Fee:** 0 bps (zero listing fee)

---

## Farcaster Mini App

hazza.name is a Farcaster Mini App — all pages work in Warpcast and Base App webviews.

- **Manifest:** `hazza.name/.well-known/farcaster.json`
- **SDK:** `@farcaster/miniapp-sdk` from esm.sh CDN
- **Wallet:** `window.ethereum` injected by Warpcast/Base App
- **Embed meta:** `fc:frame` tags on all pages for link previews
- **Sharing:** Post-registration and post-listing prompts for cast embeds

---

## Brand Kit

See **[BRAND.md](BRAND.md)** for the full brand reference — colors, typography, logo specs, Nomi mascot guidelines, and naming rules. Key points:

- **Colorway:** Moonlit B — cream `#F7EBBD` background, bandana red `#CF3748` accent, hat blue `#4870D4` secondary, navy `#131325` text
- **Font:** Fredoka (Bold 700, SemiBold 600, Regular 400)
- **Logo:** white "h" in red filled rounded rect (no border)
- **Wordmark:** "hazza" navy + ".name" blue, Fredoka Bold
- **Mascot:** Nomi (Nibble #4240) — complements the brand, not the brand itself
- **Image endpoints:** `/api/share` (1200x1200 square), `/api/icon` (1200x1200 icon), `/api/og/:name` (1200x630 per-name)

When creating hazza-branded assets (images, pages, embeds), always reference BRAND.md for exact specs.

## Guidelines

- hazza names are "immediately useful" — always use this phrase
- Always say "powered by x402 and Net Protocol"
- It's "hazza" or "hazza.name" — NEVER "HAZZA Names"
- Never put "hazza.name" + "immediately useful names" together (double "name")
- "hazza" + "immediately useful names" = OK
- "hazza.name" + "immediately useful" = OK
- Link to https://hazza.name for the website
- Profile pages are at `https://<name>.hazza.name`
- Marketplace at `hazza.name/marketplace` — listings cross-list to netprotocol.app
- Live on Base mainnet
- The `cast` binary (Foundry) is required for onchain transactions (register via x402, set records)
- Free claims require both an Unlimited Pass NFT AND Net Library membership
